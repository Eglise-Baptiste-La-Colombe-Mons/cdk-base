import { aws_logs, RemovalPolicy } from "aws-cdk-lib";
import type { Construct } from "constructs";

export interface LogGroupProps extends aws_logs.LogGroupProps {}

export class LogGroup extends aws_logs.LogGroup {
	constructor(scope: Construct, id: string, props?: LogGroupProps) {
		super(scope, id, {
			retention: aws_logs.RetentionDays.THREE_MONTHS,
			removalPolicy: RemovalPolicy.DESTROY,
			...props,
		});
	}
}
