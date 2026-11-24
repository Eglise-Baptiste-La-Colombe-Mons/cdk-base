import { aws_dynamodb, aws_ssm } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { dynamodb } from "../../src";
import { createApp, createStack } from "../helpers";

const partitionKey = { name: "pk", type: aws_dynamodb.AttributeType.STRING };

describe("dynamodb.EphemeralTable", () => {
	it("applique les défauts : à la demande, TTL sur expiresAt, supprimée avec la stack", () => {
		const stack = createStack();
		new dynamodb.EphemeralTable(stack, "Table", { partitionKey });

		const template = Template.fromStack(stack);
		template.resourceCountIs("AWS::DynamoDB::GlobalTable", 1);
		template.hasResource("AWS::DynamoDB::GlobalTable", {
			Properties: {
				BillingMode: "PAY_PER_REQUEST",
				TimeToLiveSpecification: { AttributeName: "expiresAt", Enabled: true },
				Replicas: [
					Match.objectLike({
						DeletionProtectionEnabled: Match.absent(),
						PointInTimeRecoverySpecification: Match.absent(),
					}),
				],
			},
			DeletionPolicy: "Delete",
			UpdateReplacePolicy: "Delete",
		});
	});

	it("laisse une prop du projet remplacer le défaut", () => {
		const stack = createStack();
		new dynamodb.EphemeralTable(stack, "Table", { partitionKey, timeToLiveAttribute: "ttl" });

		Template.fromStack(stack).hasResourceProperties("AWS::DynamoDB::GlobalTable", {
			TimeToLiveSpecification: { AttributeName: "ttl", Enabled: true },
		});
	});

	it("n'accepte pas de tableName et laisse CloudFormation nommer la table", () => {
		const props: dynamodb.EphemeralTableProps = {
			partitionKey,
			// @ts-expect-error
			tableName: "nom-fixe",
		};
		expect(props).toBeDefined();

		const stack = createStack();
		new dynamodb.EphemeralTable(stack, "Table", { partitionKey });

		Template.fromStack(stack).hasResourceProperties("AWS::DynamoDB::GlobalTable", {
			TableName: Match.absent(),
		});
	});

	it("est lue par une autre stack sans export CloudFormation", () => {
		const app = createApp();
		const producer = createStack(app, "Producer");
		const consumer = createStack(app, "Consumer");
		const table = new dynamodb.EphemeralTable(producer, "Table", { partitionKey });
		new aws_ssm.StringParameter(consumer, "TableName", { stringValue: table.tableName });

		expect(JSON.stringify(Template.fromStack(consumer).toJSON())).not.toContain("Fn::ImportValue");
		expect(Template.fromStack(producer).findOutputs("*", { Export: Match.anyValue() })).toEqual({});
	});
});
