import { aws_cloudfront, Duration } from "aws-cdk-lib";
import type { Construct } from "constructs";

export interface SecurityHeadersPolicyProps
	extends Omit<
		aws_cloudfront.ResponseHeadersPolicyProps,
		"securityHeadersBehavior" | "customHeadersBehavior"
	> {
	readonly connectSrc?: string[];
	readonly noIndex?: boolean;
	readonly contentSecurityPolicy?: string;
	readonly permissionsPolicy?: string;
}

export class SecurityHeadersPolicy extends aws_cloudfront.ResponseHeadersPolicy {
	constructor(scope: Construct, id: string, props: SecurityHeadersPolicyProps = {}) {
		const {
			connectSrc = [],
			noIndex = false,
			contentSecurityPolicy = defaultContentSecurityPolicy(connectSrc),
			permissionsPolicy = "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
			...policyProps
		} = props;

		super(scope, id, {
			...policyProps,
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
					{ header: "Permissions-Policy", value: permissionsPolicy, override: true },
					{ header: "Cross-Origin-Opener-Policy", value: "same-origin", override: true },
					...(noIndex ? [{ header: "X-Robots-Tag", value: "noindex", override: true }] : []),
				],
			},
		});
	}
}

function defaultContentSecurityPolicy(connectSrc: string[]): string {
	return [
		"default-src 'self'",
		"script-src 'self'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data:",
		"font-src 'self'",
		`connect-src ${["'self'", ...connectSrc].join(" ")}`,
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
	].join("; ");
}
