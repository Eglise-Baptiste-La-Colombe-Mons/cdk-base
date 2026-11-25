import { aws_cloudfront, Duration } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { cloudfront } from "../../src";
import { createStack } from "../helpers";

const RESOURCE = "AWS::CloudFront::ResponseHeadersPolicy";
const API = "https://api.example.com";

function config(template: Template): Record<string, unknown> {
	const resources = Object.values(template.findResources(RESOURCE));
	expect(resources).toHaveLength(1);
	return resources[0].Properties.ResponseHeadersPolicyConfig;
}

function ecodimPolicyConfig(noIndex: boolean): Record<string, unknown> {
	const stack = createStack();
	const contentSecurityPolicy = [
		"default-src 'self'",
		"script-src 'self'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data:",
		"font-src 'self'",
		`connect-src 'self' ${API}`,
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
	].join("; ");
	new aws_cloudfront.ResponseHeadersPolicy(stack, "EcodimResponseHeaders", {
		securityHeadersBehavior: {
			contentTypeOptions: { override: true },
			frameOptions: { frameOption: aws_cloudfront.HeadersFrameOption.DENY, override: true },
			referrerPolicy: {
				referrerPolicy: aws_cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
				override: true,
			},
			strictTransportSecurity: { accessControlMaxAge: Duration.days(365), override: true },
			xssProtection: { protection: false, override: true },
			contentSecurityPolicy: { contentSecurityPolicy, override: true },
		},
		customHeadersBehavior: {
			customHeaders: [
				{
					header: "Permissions-Policy",
					value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
					override: true,
				},
				{ header: "Cross-Origin-Opener-Policy", value: "same-origin", override: true },
				...(noIndex ? [{ header: "X-Robots-Tag", value: "noindex", override: true }] : []),
			],
		},
	});
	return config(Template.fromStack(stack));
}

function customHeaders(template: Template): unknown {
	return (config(template).CustomHeadersConfig as { Items: unknown }).Items;
}

describe("cloudfront.SecurityHeadersPolicy", () => {
	it("applique les défauts : CSP d'une SPA sur son domaine et en-têtes de sécurité", () => {
		const stack = createStack();
		new cloudfront.SecurityHeadersPolicy(stack, "Policy");

		Template.fromStack(stack).hasResourceProperties(RESOURCE, {
			ResponseHeadersPolicyConfig: {
				SecurityHeadersConfig: {
					ContentSecurityPolicy: {
						ContentSecurityPolicy:
							"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
						Override: true,
					},
					ContentTypeOptions: { Override: true },
					FrameOptions: { FrameOption: "DENY", Override: true },
					ReferrerPolicy: { ReferrerPolicy: "strict-origin-when-cross-origin", Override: true },
					StrictTransportSecurity: {
						AccessControlMaxAgeSec: 31536000,
						IncludeSubdomains: Match.absent(),
						Preload: Match.absent(),
						Override: true,
					},
					XSSProtection: { Protection: false, Override: true },
				},
				CustomHeadersConfig: {
					Items: [
						{
							Header: "Permissions-Policy",
							Value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
							Override: true,
						},
						{ Header: "Cross-Origin-Opener-Policy", Value: "same-origin", Override: true },
					],
				},
			},
		});
	});

	it("ajoute les origines de connectSrc après 'self' dans connect-src", () => {
		const stack = createStack();
		new cloudfront.SecurityHeadersPolicy(stack, "Policy", { connectSrc: [API] });

		Template.fromStack(stack).hasResourceProperties(RESOURCE, {
			ResponseHeadersPolicyConfig: {
				SecurityHeadersConfig: {
					ContentSecurityPolicy: {
						ContentSecurityPolicy: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ${API}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`,
					},
				},
			},
		});
	});

	it.each([false, true])(
		"produit la même configuration que la ResponseHeadersPolicy d'ecodim (noIndex: %s)",
		(noIndex) => {
			const stack = createStack();
			new cloudfront.SecurityHeadersPolicy(stack, "EcodimResponseHeaders", {
				connectSrc: [API],
				noIndex,
			});

			expect(config(Template.fromStack(stack))).toEqual(ecodimPolicyConfig(noIndex));
		},
	);

	it("ajoute X-Robots-Tag en dernier avec noIndex", () => {
		const stack = createStack();
		new cloudfront.SecurityHeadersPolicy(stack, "Policy", { noIndex: true });

		expect(customHeaders(Template.fromStack(stack))).toEqual([
			expect.objectContaining({ Header: "Permissions-Policy" }),
			expect.objectContaining({ Header: "Cross-Origin-Opener-Policy" }),
			{ Header: "X-Robots-Tag", Value: "noindex", Override: true },
		]);
	});

	it.each([{ noIndex: false }, {}])("n'ajoute pas X-Robots-Tag sans noIndex (%o)", (props) => {
		const stack = createStack();
		new cloudfront.SecurityHeadersPolicy(stack, "Policy", props);

		expect(customHeaders(Template.fromStack(stack))).not.toContainEqual(
			expect.objectContaining({ Header: "X-Robots-Tag" }),
		);
	});

	it("laisse le projet remplacer la CSP et la Permissions-Policy", () => {
		const stack = createStack();
		new cloudfront.SecurityHeadersPolicy(stack, "Policy", {
			connectSrc: [API],
			contentSecurityPolicy: "default-src 'none'",
			permissionsPolicy: "camera=(self)",
		});

		Template.fromStack(stack).hasResourceProperties(RESOURCE, {
			ResponseHeadersPolicyConfig: {
				SecurityHeadersConfig: {
					ContentSecurityPolicy: { ContentSecurityPolicy: "default-src 'none'", Override: true },
				},
				CustomHeadersConfig: {
					Items: Match.arrayWith([
						{ Header: "Permissions-Policy", Value: "camera=(self)", Override: true },
					]),
				},
			},
		});
	});

	it("n'accepte ni securityHeadersBehavior ni customHeadersBehavior", () => {
		const security: cloudfront.SecurityHeadersPolicyProps = {
			// @ts-expect-error
			securityHeadersBehavior: {},
		};
		const custom: cloudfront.SecurityHeadersPolicyProps = {
			// @ts-expect-error
			customHeadersBehavior: { customHeaders: [] },
		};

		const stack = createStack();
		new cloudfront.SecurityHeadersPolicy(stack, "Policy", { ...security, ...custom });

		Template.fromStack(stack).hasResourceProperties(RESOURCE, {
			ResponseHeadersPolicyConfig: {
				SecurityHeadersConfig: { FrameOptions: { FrameOption: "DENY", Override: true } },
				CustomHeadersConfig: {
					Items: Match.arrayWith([Match.objectLike({ Header: "Cross-Origin-Opener-Policy" })]),
				},
			},
		});
	});
});
