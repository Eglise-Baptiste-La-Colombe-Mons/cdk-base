import { aws_s3, Duration, RemovalPolicy } from "aws-cdk-lib";
import type { Construct } from "constructs";

export interface BucketProps
	extends Omit<aws_s3.BucketProps, "blockPublicAccess" | "enforceSSL" | "minimumTLSVersion"> {}

export class Bucket extends aws_s3.Bucket {
	constructor(scope: Construct, id: string, props?: BucketProps) {
		super(scope, id, {
			encryption: aws_s3.BucketEncryption.S3_MANAGED,
			versioned: true,
			lifecycleRules: [{ noncurrentVersionExpiration: Duration.days(30) }],
			removalPolicy: RemovalPolicy.RETAIN,
			...props,
			blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
			enforceSSL: true,
			minimumTLSVersion: 1.2,
		});
	}
}
