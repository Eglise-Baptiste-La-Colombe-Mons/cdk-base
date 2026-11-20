import { aws_ssm, Stack, type StackProps, Tags, Token } from "aws-cdk-lib";
import { Construct } from "constructs";

export type Shared<T> = (scope: Construct, dependency?: boolean) => T;

export interface BaseStackProps extends StackProps {
	readonly project: string;
	readonly stage?: string;
}

const PROJECT_PATTERN = /^[a-z][a-z0-9-]*$/;

export abstract class BaseStack extends Stack {
	readonly project: string;
	readonly stage?: string;

	private readonly sharedParameters: Construct;

	constructor(scope: Construct, id: string, props: BaseStackProps) {
		if (!PROJECT_PATTERN.test(props.project)) {
			throw new Error(
				`BaseStack : project "${props.project}" invalide (minuscules, chiffres, tirets).`,
			);
		}

		super(scope, id, {
			...props,
			terminationProtection:
				props.terminationProtection ?? (props.stage === undefined || props.stage === "prod"),
		});

		this.project = props.project;
		this.stage = props.stage;
		this.sharedParameters = new Construct(this, "SharedParameters");

		Tags.of(this).add("Project", props.project);
		Tags.of(this).add("ManagedBy", "cdk");
		if (props.stage) {
			Tags.of(this).add("Stage", props.stage);
		}
	}

	shareValue(name: string, value: string): Shared<string> {
		const parameterName = [this.ssmPrefix, name].join("/");
		const id = name.replace(/\//g, "-");
		if (!this.sharedParameters.node.tryFindChild(id)) {
			new aws_ssm.StringParameter(this.sharedParameters, id, { parameterName, stringValue: value });
		}
		return (scope, dependency = true) =>
			Stack.of(scope) === this ? value : this.importValue(scope, parameterName, dependency);
	}

	shareResource<R extends Construct, I, K extends string>(
		resource: R,
		attributes: Record<K, string>,
		create: (scope: Construct, id: string, attributes: Record<K, string>) => I,
	): Shared<I> {
		const path = this.resourcePath(resource);
		const getters = Object.entries<string>(attributes).map(
			([name, value]) => [name, this.shareValue(`${path}/${name}`, value)] as const,
		);

		return (scope, dependency = true) => {
			if (Stack.of(scope) === this) {
				return resource as unknown as I;
			}
			const id = `${this.stackName}-${path.replace(/\//g, "-")}`;
			const existing = scope.node.tryFindChild(id);
			if (existing) {
				return existing as unknown as I;
			}
			const values = Object.fromEntries(
				getters.map(([name, get]) => [name, get(scope, dependency)]),
			);
			return create(scope, id, values as Record<K, string>);
		};
	}

	private get ssmPrefix(): string {
		return ["/cdk", this.project, this.stage, this.stackName].filter(Boolean).join("/");
	}

	private importValue(scope: Construct, parameterName: string, dependency: boolean): string {
		const consumer = Stack.of(scope);
		const differs = (a: string, b: string) =>
			!Token.isUnresolved(a) && !Token.isUnresolved(b) && a !== b;
		if (differs(consumer.account, this.account) || differs(consumer.region, this.region)) {
			throw new Error(
				`BaseStack : ${consumer.stackName} ne peut pas lire les paramètres SSM de ${this.stackName} : ` +
					"les deux stacks doivent être dans le même compte et la même région.",
			);
		}
		if (dependency) {
			consumer.addStackDependency(this);
		}

		const id = `Imported${parameterName.replace(/\//g, "-")}`;
		const existing = scope.node.tryFindChild(id) as aws_ssm.IStringParameter | undefined;
		return (existing ?? aws_ssm.StringParameter.fromStringParameterName(scope, id, parameterName))
			.stringValue;
	}

	private resourcePath(resource: Construct): string {
		const scopes = resource.node.scopes;
		const index = scopes.indexOf(this);
		if (index === -1) {
			throw new Error(`BaseStack : ${resource.node.path} n'appartient pas à ${this.stackName}.`);
		}
		return scopes
			.slice(index + 1)
			.map((construct) => construct.node.id.replace(/[^A-Za-z0-9_.-]/g, "_"))
			.join("/");
	}
}
