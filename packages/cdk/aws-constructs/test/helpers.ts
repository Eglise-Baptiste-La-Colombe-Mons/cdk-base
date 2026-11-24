import { App, Stack } from "aws-cdk-lib";

export function createApp(): App {
	return new App({ context: { "aws:cdk:bundling-stacks": [] } });
}

export function createStack(app: App = createApp(), id = "TestStack"): Stack {
	return new Stack(app, id, { env: { account: "123456789012", region: "eu-west-1" } });
}
