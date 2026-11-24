import { aws_s3, Duration, RemovalPolicy } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { s3 } from "../../src";
import { createStack } from "../helpers";

function expectEnforcedSettings(template: Template): void {
	template.hasResourceProperties("AWS::S3::Bucket", {
		PublicAccessBlockConfiguration: {
			BlockPublicAcls: true,
			BlockPublicPolicy: true,
			IgnorePublicAcls: true,
			RestrictPublicBuckets: true,
		},
	});
	expectDenyStatement(template, { Bool: { "aws:SecureTransport": "false" } });
	expectDenyStatement(template, { NumericLessThan: { "s3:TlsVersion": 1.2 } });
}

function expectDenyStatement(template: Template, condition: Record<string, unknown>): void {
	template.hasResourceProperties("AWS::S3::BucketPolicy", {
		PolicyDocument: {
			Statement: Match.arrayWith([Match.objectLike({ Effect: "Deny", Condition: condition })]),
		},
	});
}

describe("s3.Bucket", () => {
	it("applique les défauts : SSE-S3, versionné, versions anciennes expirées à 30 jours, conservé", () => {
		const stack = createStack();
		new s3.Bucket(stack, "Bucket");

		const template = Template.fromStack(stack);
		template.resourceCountIs("AWS::S3::Bucket", 1);
		template.hasResource("AWS::S3::Bucket", {
			Properties: {
				BucketEncryption: {
					ServerSideEncryptionConfiguration: [
						{ ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } },
					],
				},
				VersioningConfiguration: { Status: "Enabled" },
				LifecycleConfiguration: {
					Rules: [
						Match.objectLike({
							NoncurrentVersionExpiration: { NoncurrentDays: 30 },
							Status: "Enabled",
						}),
					],
				},
			},
			DeletionPolicy: "Retain",
			UpdateReplacePolicy: "Retain",
		});
	});

	it("impose le blocage de l'accès public, HTTPS et TLS 1.2 minimum", () => {
		const stack = createStack();
		new s3.Bucket(stack, "Bucket");

		expectEnforcedSettings(Template.fromStack(stack));
	});

	it("ne laisse pas le projet assouplir les réglages imposés", () => {
		const publicAccess: s3.BucketProps = {
			// @ts-expect-error
			blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ACLS_ONLY,
		};
		const ssl: s3.BucketProps = {
			// @ts-expect-error
			enforceSSL: false,
		};
		const tls: s3.BucketProps = {
			// @ts-expect-error
			minimumTLSVersion: 1.0,
		};

		const stack = createStack();
		new s3.Bucket(stack, "Bucket", { ...publicAccess, ...ssl, ...tls });

		expectEnforcedSettings(Template.fromStack(stack));
	});

	it("remplace la règle de lifecycle par défaut sans la fusionner", () => {
		const stack = createStack();
		new s3.Bucket(stack, "Bucket", { lifecycleRules: [{ expiration: Duration.days(7) }] });

		Template.fromStack(stack).hasResourceProperties("AWS::S3::Bucket", {
			LifecycleConfiguration: {
				Rules: [
					Match.objectLike({
						ExpirationInDays: 7,
						NoncurrentVersionExpiration: Match.absent(),
					}),
				],
			},
		});
	});

	it("laisse une prop du projet remplacer le défaut", () => {
		const stack = createStack();
		new s3.Bucket(stack, "Bucket", { versioned: false, removalPolicy: RemovalPolicy.DESTROY });

		Template.fromStack(stack).hasResource("AWS::S3::Bucket", {
			Properties: { VersioningConfiguration: Match.absent() },
			DeletionPolicy: "Delete",
			UpdateReplacePolicy: "Delete",
		});
	});
});
