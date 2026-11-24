import { aws_iam, Duration, Stack } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { GITHUB_OIDC_HOST } from "./github-oidc-host";

export interface GithubRepository {
	readonly owner: string;
	readonly ownerId: string;
	readonly name: string;
	readonly id: string;
}

export interface GithubDeployRoleProps {
	readonly provider: aws_iam.IOidcProvider;
	readonly repository: GithubRepository;
	readonly branch?: string;
	readonly cdkQualifier?: string;
	readonly roleName?: string;
	readonly maxSessionDuration?: Duration;
}

export class GithubDeployRole extends aws_iam.Role {
	constructor(scope: Construct, id: string, props: GithubDeployRoleProps) {
		const { owner, ownerId, name, id: repositoryId } = props.repository;
		const branch = props.branch ?? "main";
		const subject = `repo:${owner}@${ownerId}/${name}@${repositoryId}:ref:refs/heads/${branch}`;

		super(scope, id, {
			roleName: props.roleName,
			maxSessionDuration: props.maxSessionDuration ?? Duration.hours(1),
			assumedBy: new aws_iam.WebIdentityPrincipal(props.provider.oidcProviderArn, {
				StringEquals: {
					[`${GITHUB_OIDC_HOST}:aud`]: "sts.amazonaws.com",
					[`${GITHUB_OIDC_HOST}:sub`]: subject,
				},
			}),
		});

		const qualifier = props.cdkQualifier ?? "hnb659fds";
		this.addToPolicy(
			new aws_iam.PolicyStatement({
				actions: ["sts:AssumeRole"],
				resources: [`arn:aws:iam::${Stack.of(this).account}:role/cdk-${qualifier}-*`],
			}),
		);
	}
}
