import { aws_apigatewayv2, aws_logs, Duration, type Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { apigatewayv2, cloudwatch } from "../../src";
import { createStack } from "../helpers";

const STAGE = "AWS::ApiGatewayV2::Stage";
const DEFAULT_FORMAT =
	'{"requestId":"$context.requestId","requestTime":"$context.requestTime","ip":"$context.identity.sourceIp","routeKey":"$context.routeKey","status":"$context.status","latency":"$context.responseLatency","integrationLatency":"$context.integrationLatency","integrationError":"$context.integrationErrorMessage"}';
const REQUEST_LINK_THROTTLE = { "POST /v1/auth/request-link": { rateLimit: 5, burstLimit: 20 } };

const corsPreflight = {
	allowOrigins: ["https://ecodim.lacolombemons.be"],
	allowMethods: [
		aws_apigatewayv2.CorsHttpMethod.GET,
		aws_apigatewayv2.CorsHttpMethod.POST,
		aws_apigatewayv2.CorsHttpMethod.PATCH,
		aws_apigatewayv2.CorsHttpMethod.DELETE,
	],
	allowHeaders: ["content-type"],
	allowCredentials: true,
	maxAge: Duration.hours(1),
};

function ecodimApi(stack: Stack, accessLogsId: string): void {
	const httpApi = new aws_apigatewayv2.HttpApi(stack, "EcodimHttpApi", { corsPreflight });
	const defaultStage = httpApi.defaultStage?.node.defaultChild as aws_apigatewayv2.CfnStage;
	defaultStage.defaultRouteSettings = { throttlingRateLimit: 30, throttlingBurstLimit: 60 };
	const accessLogGroup = new cloudwatch.LogGroup(stack, accessLogsId);
	defaultStage.accessLogSettings = {
		destinationArn: accessLogGroup.logGroupArn,
		format: JSON.stringify({
			requestId: "$context.requestId",
			requestTime: "$context.requestTime",
			ip: "$context.identity.sourceIp",
			routeKey: "$context.routeKey",
			status: "$context.status",
			latency: "$context.responseLatency",
			integrationLatency: "$context.integrationLatency",
			integrationError: "$context.integrationErrorMessage",
		}),
	};
	defaultStage.addPropertyOverride("RouteSettings", {
		"POST /v1/auth/request-link": { ThrottlingRateLimit: 5, ThrottlingBurstLimit: 20 },
	});
}

function serialize(stack: Stack): string {
	return JSON.stringify(Template.fromStack(stack).toJSON(), null, 2);
}

describe("apigatewayv2.HttpApi", () => {
	it("applique les défauts : throttling 30/60 et logs d'accès JSON dans un LogGroup créé à côté", () => {
		const stack = createStack();
		new apigatewayv2.HttpApi(stack, "Api");

		const logGroup = stack.node.tryFindChild("ApiAccessLogs");
		if (!(logGroup instanceof cloudwatch.LogGroup)) {
			throw new Error("ApiAccessLogs absent du scope parent ou d'un autre type");
		}

		const template = Template.fromStack(stack);
		template.resourceCountIs("AWS::Logs::LogGroup", 1);
		template.hasResource("AWS::Logs::LogGroup", {
			Properties: { RetentionInDays: 90 },
			DeletionPolicy: "Delete",
			UpdateReplacePolicy: "Delete",
		});
		template.hasResourceProperties(STAGE, {
			StageName: "$default",
			DefaultRouteSettings: { ThrottlingRateLimit: 30, ThrottlingBurstLimit: 60 },
			AccessLogSettings: {
				DestinationArn: stack.resolve(logGroup.logGroupArn),
				Format: DEFAULT_FORMAT,
			},
			RouteSettings: Match.absent(),
		});
	});

	it("utilise le accessLogGroup fourni par le projet sans en créer d'autre", () => {
		const stack = createStack();
		const accessLogGroup = new aws_logs.LogGroup(stack, "ProjectAccessLogs");
		new apigatewayv2.HttpApi(stack, "Api", { accessLogGroup });

		expect(stack.node.tryFindChild("ApiAccessLogs")).toBeUndefined();

		const template = Template.fromStack(stack);
		template.resourceCountIs("AWS::Logs::LogGroup", 1);
		template.hasResourceProperties(STAGE, {
			AccessLogSettings: { DestinationArn: stack.resolve(accessLogGroup.logGroupArn) },
		});
	});

	it("laisse le projet choisir le throttling, les limites par route et le format des logs", () => {
		const stack = createStack();
		new apigatewayv2.HttpApi(stack, "Api", {
			throttle: { rateLimit: 100, burstLimit: 200 },
			routeThrottles: {
				"POST /v1/auth/request-link": { rateLimit: 5, burstLimit: 20 },
				"POST /v1/login": { rateLimit: 2, burstLimit: 4 },
			},
			accessLogFormat: '{"requestId":"$context.requestId"}',
		});

		Template.fromStack(stack).hasResourceProperties(STAGE, {
			DefaultRouteSettings: { ThrottlingRateLimit: 100, ThrottlingBurstLimit: 200 },
			RouteSettings: {
				"POST /v1/auth/request-link": { ThrottlingRateLimit: 5, ThrottlingBurstLimit: 20 },
				"POST /v1/login": { ThrottlingRateLimit: 2, ThrottlingBurstLimit: 4 },
			},
			AccessLogSettings: { Format: '{"requestId":"$context.requestId"}' },
		});
	});

	it("reproduit à l'identique le stage d'ecodim (même escape hatch)", () => {
		const reference = createStack();
		ecodimApi(reference, "EcodimHttpApiAccessLogs");

		const stack = createStack();
		new apigatewayv2.HttpApi(stack, "EcodimHttpApi", {
			corsPreflight,
			routeThrottles: REQUEST_LINK_THROTTLE,
		});

		expect(serialize(stack)).toBe(serialize(reference));
	});

	it("garde le LogGroup EcodimApiAccessLogs d'ecodim quand il est passé en accessLogGroup", () => {
		const reference = createStack();
		ecodimApi(reference, "EcodimApiAccessLogs");

		const stack = createStack();
		new apigatewayv2.HttpApi(stack, "EcodimHttpApi", {
			corsPreflight,
			routeThrottles: REQUEST_LINK_THROTTLE,
			accessLogGroup: new cloudwatch.LogGroup(stack, "EcodimApiAccessLogs"),
		});

		expect(Template.fromStack(stack).toJSON()).toEqual(Template.fromStack(reference).toJSON());
	});

	it.each([
		["throttle", { throttle: { rateLimit: 1, burstLimit: 1 } }],
		["routeThrottles", { routeThrottles: REQUEST_LINK_THROTTLE }],
		["accessLogFormat", { accessLogFormat: "{}" }],
	])("refuse %s avec createDefaultStage: false", (option, props) => {
		const stack = createStack();

		expect(
			() => new apigatewayv2.HttpApi(stack, "Api", { createDefaultStage: false, ...props }),
		).toThrow(option);
	});

	it("refuse accessLogGroup avec createDefaultStage: false", () => {
		const stack = createStack();
		const accessLogGroup = new aws_logs.LogGroup(stack, "ProjectAccessLogs");

		expect(
			() => new apigatewayv2.HttpApi(stack, "Api", { createDefaultStage: false, accessLogGroup }),
		).toThrow("accessLogGroup");
	});

	it("ne crée ni stage ni LogGroup avec createDefaultStage: false", () => {
		const stack = createStack();
		new apigatewayv2.HttpApi(stack, "Api", { createDefaultStage: false });

		const template = Template.fromStack(stack);
		template.resourceCountIs(STAGE, 0);
		template.resourceCountIs("AWS::Logs::LogGroup", 0);
	});
});
