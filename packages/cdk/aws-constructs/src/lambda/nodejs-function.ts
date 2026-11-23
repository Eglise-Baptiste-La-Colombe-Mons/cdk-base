import { aws_lambda, aws_lambda_nodejs, Duration } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { LogGroup } from "../cloudwatch";

export interface NodejsFunctionProps extends aws_lambda_nodejs.NodejsFunctionProps {}

export class NodejsFunction extends aws_lambda_nodejs.NodejsFunction {
	constructor(scope: Construct, id: string, props: NodejsFunctionProps) {
		super(scope, id, {
			runtime: aws_lambda.Runtime.NODEJS_24_X,
			architecture: aws_lambda.Architecture.ARM_64,
			memorySize: 1024,
			timeout: Duration.seconds(10),
			bundling: { minify: true },
			...props,
			logGroup: props.logGroup ?? new LogGroup(scope, `${id}LogGroup`),
		});
	}
}
