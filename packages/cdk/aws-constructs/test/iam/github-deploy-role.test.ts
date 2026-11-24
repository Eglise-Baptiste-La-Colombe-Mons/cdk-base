import { aws_iam, CfnOutput, Duration, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { iam } from "../../src";
import { createStack } from "../helpers";

const repository = { owner: "lacolombemons", ownerId: "111", name: "ecodim-app", id: "222" };
const ACCOUNT = "123456789012";

function trustCondition(subject: string): Record<string, unknown> {
	return {
		StringEquals: {
			"token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
			"token.actions.githubusercontent.com:sub": subject,
		},
	};
}

function deployStatement(qualifier: string): Record<string, unknown> {
	return {
		Effect: "Allow",
		Action: "sts:AssumeRole",
		Resource: `arn:aws:iam::${ACCOUNT}:role/cdk-${qualifier}-*`,
	};
}

function ecodimTemplate(): Record<string, unknown> {
	const stack = createStack();
	const host = "token.actions.githubusercontent.com";
	const subject = `repo:${repository.owner}@${repository.ownerId}/${repository.name}@${repository.id}:ref:refs/heads/main`;
	const provider = new aws_iam.OidcProviderNative(stack, "GithubOidcProvider", {
		url: `https://${host}`,
		clientIds: ["sts.amazonaws.com"],
	});
	const role = new aws_iam.Role(stack, "GithubDeployRole", {
		roleName: "ecodim-github-deploy",
		maxSessionDuration: Duration.hours(1),
		assumedBy: new aws_iam.WebIdentityPrincipal(provider.oidcProviderArn, {
			StringEquals: {
				[`${host}:aud`]: "sts.amazonaws.com",
				[`${host}:sub`]: subject,
			},
		}),
	});
	role.addToPolicy(
		new aws_iam.PolicyStatement({
			actions: ["sts:AssumeRole"],
			resources: [`arn:aws:iam::${stack.account}:role/cdk-hnb659fds-*`],
		}),
	);
	new CfnOutput(stack, "GithubDeployRoleArn", { value: role.roleArn });
	return Template.fromStack(stack).toJSON();
}

function serialize(template: Record<string, unknown>): string {
	return JSON.stringify(template, null, 2);
}

function createRole(
	stack: Stack,
	props: Partial<iam.GithubDeployRoleProps> = {},
): iam.GithubOidcProvider {
	const provider = new iam.GithubOidcProvider(stack, "GithubOidcProvider");
	new iam.GithubDeployRole(stack, "GithubDeployRole", { provider, repository, ...props });
	return provider;
}

describe("iam.GithubDeployRole", () => {
	it("limite la confiance au repo et à la branche main, et n'autorise que les rôles du bootstrap CDK", () => {
		const stack = createStack();
		const provider = createRole(stack);

		const template = Template.fromStack(stack);
		template.hasResourceProperties("AWS::IAM::Role", {
			MaxSessionDuration: 3600,
			AssumeRolePolicyDocument: {
				Statement: [
					{
						Effect: "Allow",
						Action: "sts:AssumeRoleWithWebIdentity",
						Principal: { Federated: stack.resolve(provider.oidcProviderArn) },
						Condition: trustCondition("repo:lacolombemons@111/ecodim-app@222:ref:refs/heads/main"),
					},
				],
			},
		});
		template.hasResourceProperties("AWS::IAM::Policy", {
			PolicyDocument: { Statement: [deployStatement("hnb659fds")] },
		});
	});

	it("utilise la branche et le qualifier CDK passés par le projet", () => {
		const stack = createStack();
		createRole(stack, { branch: "release", cdkQualifier: "custom123" });

		const template = Template.fromStack(stack);
		template.hasResourceProperties("AWS::IAM::Role", {
			AssumeRolePolicyDocument: {
				Statement: [
					Match.objectLike({
						Condition: trustCondition(
							"repo:lacolombemons@111/ecodim-app@222:ref:refs/heads/release",
						),
					}),
				],
			},
		});
		template.hasResourceProperties("AWS::IAM::Policy", {
			PolicyDocument: { Statement: [deployStatement("custom123")] },
		});
	});

	it("n'accorde aucune autre permission que sts:AssumeRole", () => {
		const stack = createStack();
		createRole(stack);

		const template = Template.fromStack(stack);
		template.resourceCountIs("AWS::IAM::Policy", 1);
		template.hasResourceProperties("AWS::IAM::Policy", {
			PolicyDocument: { Statement: [deployStatement("hnb659fds")] },
		});
		template.hasResourceProperties("AWS::IAM::Role", {
			ManagedPolicyArns: Match.absent(),
			Policies: Match.absent(),
		});
	});

	it("fonctionne avec un provider importé par ARN, sans en créer", () => {
		const stack = createStack();
		const providerArn = `arn:aws:iam::${ACCOUNT}:oidc-provider/token.actions.githubusercontent.com`;
		const provider = aws_iam.OidcProviderNative.fromOidcProviderArn(stack, "Provider", providerArn);
		new iam.GithubDeployRole(stack, "GithubDeployRole", { provider, repository });

		const template = Template.fromStack(stack);
		template.resourceCountIs("AWS::IAM::OIDCProvider", 0);
		template.hasResourceProperties("AWS::IAM::Role", {
			AssumeRolePolicyDocument: {
				Statement: [Match.objectLike({ Principal: { Federated: providerArn } })],
			},
		});
	});

	it("produit le même template que la stack GithubDeploy d'ecodim", () => {
		const stack = createStack();
		const provider = new iam.GithubOidcProvider(stack, "GithubOidcProvider");
		const role = new iam.GithubDeployRole(stack, "GithubDeployRole", {
			provider,
			repository,
			roleName: "ecodim-github-deploy",
		});
		new CfnOutput(stack, "GithubDeployRoleArn", { value: role.roleArn });

		expect(serialize(Template.fromStack(stack).toJSON())).toBe(serialize(ecodimTemplate()));
	});
});
