import { aws_route53 } from "aws-cdk-lib";
import type { Construct } from "constructs";

export interface AliasRecordPairProps extends aws_route53.ARecordProps {}

export class AliasRecordPair extends aws_route53.ARecord {
	readonly ipv6Record: aws_route53.AaaaRecord;

	constructor(scope: Construct, id: string, props: AliasRecordPairProps) {
		super(scope, id, props);
		this.ipv6Record = new aws_route53.AaaaRecord(scope, `${id}V6`, props);
	}
}
