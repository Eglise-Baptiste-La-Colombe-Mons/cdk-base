import { aws_apigatewayv2, type aws_logs } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { LogGroup } from "../cloudwatch";

export interface ThrottleLimits {
	readonly rateLimit: number;
	readonly burstLimit: number;
}

export interface HttpApiProps extends aws_apigatewayv2.HttpApiProps {
	readonly throttle?: ThrottleLimits;
	readonly routeThrottles?: Record<string, ThrottleLimits>;
	readonly accessLogGroup?: aws_logs.ILogGroup;
	readonly accessLogFormat?: string;
}

const DEFAULT_ACCESS_LOG_FORMAT = JSON.stringify({
	requestId: "$context.requestId",
	requestTime: "$context.requestTime",
	ip: "$context.identity.sourceIp",
	routeKey: "$context.routeKey",
	status: "$context.status",
	latency: "$context.responseLatency",
	integrationLatency: "$context.integrationLatency",
	integrationError: "$context.integrationErrorMessage",
});

export class HttpApi extends aws_apigatewayv2.HttpApi {
	constructor(scope: Construct, id: string, props: HttpApiProps = {}) {
		const { throttle, routeThrottles, accessLogGroup, accessLogFormat, ...apiProps } = props;

		if (apiProps.createDefaultStage === false) {
			const stageOptions = Object.entries({
				throttle,
				routeThrottles,
				accessLogGroup,
				accessLogFormat,
			})
				.filter(([, value]) => value !== undefined)
				.map(([name]) => name);
			if (stageOptions.length > 0) {
				throw new Error(
					`HttpApi ${id}: ${stageOptions.join(", ")} apply to the default stage, which is not created when createDefaultStage is false`,
				);
			}
		}

		super(scope, id, apiProps);

		if (!this.defaultStage) {
			return;
		}

		const stage = this.defaultStage.node.defaultChild as aws_apigatewayv2.CfnStage;
		const { rateLimit, burstLimit } = throttle ?? { rateLimit: 30, burstLimit: 60 };
		stage.defaultRouteSettings = {
			throttlingRateLimit: rateLimit,
			throttlingBurstLimit: burstLimit,
		};

		const logGroup = accessLogGroup ?? new LogGroup(scope, `${id}AccessLogs`);
		stage.accessLogSettings = {
			destinationArn: logGroup.logGroupArn,
			format: accessLogFormat ?? DEFAULT_ACCESS_LOG_FORMAT,
		};

		const routes = Object.entries(routeThrottles ?? {});
		if (routes.length > 0) {
			stage.addPropertyOverride(
				"RouteSettings",
				Object.fromEntries(
					routes.map(([routeKey, limits]) => [
						routeKey,
						{ ThrottlingRateLimit: limits.rateLimit, ThrottlingBurstLimit: limits.burstLimit },
					]),
				),
			);
		}
	}
}
