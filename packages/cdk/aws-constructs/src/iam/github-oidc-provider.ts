import { aws_iam } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { GITHUB_OIDC_HOST } from "./github-oidc-host";

export interface GithubOidcProviderProps {
	readonly oidcProviderName?: string;
}

export class GithubOidcProvider extends aws_iam.OidcProviderNative {
	constructor(scope: Construct, id: string, props: GithubOidcProviderProps = {}) {
		super(scope, id, {
			oidcProviderName: props.oidcProviderName,
			url: `https://${GITHUB_OIDC_HOST}`,
			clientIds: ["sts.amazonaws.com"],
		});
	}
}
