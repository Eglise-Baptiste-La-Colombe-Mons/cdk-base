import { aws_logs } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { cloudwatch } from "../../src";
import { createStack } from "../helpers";

describe("cloudwatch.LogGroup", () => {
	it("applique les défauts : rétention 90 jours et suppression avec la stack", () => {
		const stack = createStack();
		new cloudwatch.LogGroup(stack, "LogGroup");

		const template = Template.fromStack(stack);
		template.resourceCountIs("AWS::Logs::LogGroup", 1);
		template.hasResource("AWS::Logs::LogGroup", {
			Properties: { RetentionInDays: 90 },
			DeletionPolicy: "Delete",
			UpdateReplacePolicy: "Delete",
		});
	});

	it("laisse une prop du projet remplacer le défaut", () => {
		const stack = createStack();
		new cloudwatch.LogGroup(stack, "LogGroup", {
			retention: aws_logs.RetentionDays.ONE_MONTH,
		});

		Template.fromStack(stack).hasResourceProperties("AWS::Logs::LogGroup", {
			RetentionInDays: 30,
		});
	});
});
