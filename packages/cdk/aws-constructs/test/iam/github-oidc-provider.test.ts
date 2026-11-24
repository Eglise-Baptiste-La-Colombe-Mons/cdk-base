import { Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { iam } from "../../src";
import { createStack } from "../helpers";

describe("iam.GithubOidcProvider", () => {
	it("crée le provider OIDC de GitHub Actions pour STS", () => {
		const stack = createStack();
		new iam.GithubOidcProvider(stack, "GithubOidcProvider");

		const template = Template.fromStack(stack);
		template.resourceCountIs("AWS::IAM::OIDCProvider", 1);
		template.hasResourceProperties("AWS::IAM::OIDCProvider", {
			Url: "https://token.actions.githubusercontent.com",
			ClientIdList: ["sts.amazonaws.com"],
		});
	});

	it("n'accepte pas d'autre URL ni d'autres clientIds", () => {
		const url: iam.GithubOidcProviderProps = {
			// @ts-expect-error
			url: "https://example.com",
		};
		const clientIds: iam.GithubOidcProviderProps = {
			// @ts-expect-error
			clientIds: ["autre"],
		};

		const stack = createStack();
		new iam.GithubOidcProvider(stack, "GithubOidcProvider", { ...url, ...clientIds });

		Template.fromStack(stack).hasResourceProperties("AWS::IAM::OIDCProvider", {
			Url: "https://token.actions.githubusercontent.com",
			ClientIdList: ["sts.amazonaws.com"],
		});
	});
});
