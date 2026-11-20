import { Stack, type StackProps, Tags } from "aws-cdk-lib";
import type { Construct } from "constructs";

export interface BaseStackProps extends StackProps {
	readonly project: string;
	readonly stage?: string;
}

const PROJECT_PATTERN = /^[a-z][a-z0-9-]*$/;

export abstract class BaseStack extends Stack {
	readonly project: string;
	readonly stage?: string;

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

		Tags.of(this).add("Project", props.project);
		Tags.of(this).add("ManagedBy", "cdk");
		if (props.stage) {
			Tags.of(this).add("Stage", props.stage);
		}
	}
}
