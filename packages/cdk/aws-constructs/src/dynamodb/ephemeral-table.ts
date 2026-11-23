import { aws_dynamodb, ReferenceStrength, RemovalPolicy } from "aws-cdk-lib";
import type { Construct } from "constructs";

export interface EphemeralTableProps extends Omit<aws_dynamodb.TablePropsV2, "tableName"> {}

export class EphemeralTable extends aws_dynamodb.TableV2 {
	constructor(scope: Construct, id: string, props: EphemeralTableProps) {
		super(scope, id, {
			billing: aws_dynamodb.Billing.onDemand(),
			timeToLiveAttribute: "expiresAt",
			removalPolicy: RemovalPolicy.DESTROY,
			...props,
		});
		this.applyCrossStackReferenceStrength(ReferenceStrength.WEAK);
	}
}
