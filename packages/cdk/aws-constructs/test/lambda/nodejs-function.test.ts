import path from "node:path";
import { Duration } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { cloudwatch, lambda } from "../../src";
import { createStack } from "../helpers";

const entry = path.join(__dirname, "../fixtures/handler.ts");

describe("lambda.NodejsFunction", () => {
	it("applique les défauts : Node.js 24, arm64, 1024 Mo, 10 secondes", () => {
		const stack = createStack();
		new lambda.NodejsFunction(stack, "Function", { entry });

		const template = Template.fromStack(stack);
		template.resourceCountIs("AWS::Lambda::Function", 1);
		template.hasResourceProperties("AWS::Lambda::Function", {
			Runtime: "nodejs24.x",
			Architectures: ["arm64"],
			MemorySize: 1024,
			Timeout: 10,
		});
	});

	it("crée un LogGroup avec les défauts de cloudwatch.LogGroup, dans le scope parent", () => {
		const stack = createStack();
		new lambda.NodejsFunction(stack, "Function", { entry });

		const logGroup = stack.node.tryFindChild("FunctionLogGroup");
		if (!(logGroup instanceof cloudwatch.LogGroup)) {
			throw new Error("FunctionLogGroup absent du scope parent ou d'un autre type");
		}

		const template = Template.fromStack(stack);
		template.resourceCountIs("AWS::Logs::LogGroup", 1);
		template.hasResource("AWS::Logs::LogGroup", {
			Properties: { RetentionInDays: 90 },
			DeletionPolicy: "Delete",
			UpdateReplacePolicy: "Delete",
		});
		template.hasResourceProperties("AWS::Lambda::Function", {
			LoggingConfig: { LogGroup: stack.resolve(logGroup.logGroupName) },
		});
	});

	it("utilise le logGroup fourni par le projet sans en créer d'autre", () => {
		const stack = createStack();
		const logGroup = new cloudwatch.LogGroup(stack, "ProjectLogGroup");
		new lambda.NodejsFunction(stack, "Function", { entry, logGroup });

		expect(stack.node.tryFindChild("FunctionLogGroup")).toBeUndefined();

		const template = Template.fromStack(stack);
		template.resourceCountIs("AWS::Logs::LogGroup", 1);
		template.hasResourceProperties("AWS::Lambda::Function", {
			LoggingConfig: { LogGroup: stack.resolve(logGroup.logGroupName) },
		});
	});

	it("laisse une prop du projet remplacer le défaut", () => {
		const stack = createStack();
		new lambda.NodejsFunction(stack, "Function", {
			entry,
			memorySize: 512,
			timeout: Duration.seconds(30),
		});

		Template.fromStack(stack).hasResourceProperties("AWS::Lambda::Function", {
			MemorySize: 512,
			Timeout: 30,
		});
	});
});
