import { App, Stack } from "aws-cdk-lib";

export function createStack(): Stack {
	const app = new App({ context: { "aws:cdk:bundling-stacks": [] } });
	return new Stack(app, "TestStack", { env: { account: "123456789012", region: "eu-west-1" } });
}
