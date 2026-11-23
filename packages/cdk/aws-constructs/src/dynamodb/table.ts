import { aws_dynamodb, ReferenceStrength, RemovalPolicy } from "aws-cdk-lib";
import type { Construct } from "constructs";

export interface TableProps extends Omit<aws_dynamodb.TablePropsV2, "tableName"> {}

export class Table extends aws_dynamodb.TableV2 {
	constructor(scope: Construct, id: string, props: TableProps) {
		super(scope, id, {
			billing: aws_dynamodb.Billing.onDemand(),
			pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
			deletionProtection: true,
			removalPolicy: RemovalPolicy.RETAIN,
			...props,
		});
		this.applyCrossStackReferenceStrength(ReferenceStrength.WEAK);
	}
}
