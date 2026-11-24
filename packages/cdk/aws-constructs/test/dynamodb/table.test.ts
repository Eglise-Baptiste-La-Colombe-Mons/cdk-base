import { aws_dynamodb, aws_ssm, RemovalPolicy } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { dynamodb } from "../../src";
import { createApp, createStack } from "../helpers";

const partitionKey = { name: "pk", type: aws_dynamodb.AttributeType.STRING };

describe("dynamodb.Table", () => {
	it("applique les défauts : à la demande, PITR, protection contre la suppression, conservée", () => {
		const stack = createStack();
		new dynamodb.Table(stack, "Table", { partitionKey });

		const template = Template.fromStack(stack);
		template.resourceCountIs("AWS::DynamoDB::GlobalTable", 1);
		template.hasResource("AWS::DynamoDB::GlobalTable", {
			Properties: {
				BillingMode: "PAY_PER_REQUEST",
				Replicas: [
					Match.objectLike({
						DeletionProtectionEnabled: true,
						PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
					}),
				],
				TimeToLiveSpecification: Match.absent(),
			},
			DeletionPolicy: "Retain",
			UpdateReplacePolicy: "Retain",
		});
	});

	it("laisse une prop du projet remplacer le défaut", () => {
		const stack = createStack();
		new dynamodb.Table(stack, "Table", {
			partitionKey,
			deletionProtection: false,
			removalPolicy: RemovalPolicy.DESTROY,
		});

		Template.fromStack(stack).hasResource("AWS::DynamoDB::GlobalTable", {
			Properties: {
				Replicas: [Match.objectLike({ DeletionProtectionEnabled: false })],
			},
			DeletionPolicy: "Delete",
			UpdateReplacePolicy: "Delete",
		});
	});

	it("n'accepte pas de tableName et laisse CloudFormation nommer la table", () => {
		const props: dynamodb.TableProps = {
			partitionKey,
			// @ts-expect-error
			tableName: "nom-fixe",
		};
		expect(props).toBeDefined();

		const stack = createStack();
		new dynamodb.Table(stack, "Table", { partitionKey });

		Template.fromStack(stack).hasResourceProperties("AWS::DynamoDB::GlobalTable", {
			TableName: Match.absent(),
		});
	});

	it("est lue par une autre stack sans export CloudFormation", () => {
		const app = createApp();
		const producer = createStack(app, "Producer");
		const consumer = createStack(app, "Consumer");
		const table = new dynamodb.Table(producer, "Table", { partitionKey });
		new aws_ssm.StringParameter(consumer, "TableName", { stringValue: table.tableName });

		expect(JSON.stringify(Template.fromStack(consumer).toJSON())).not.toContain("Fn::ImportValue");
		expect(Template.fromStack(producer).findOutputs("*", { Export: Match.anyValue() })).toEqual({});
	});
});
