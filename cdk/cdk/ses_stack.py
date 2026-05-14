from aws_cdk import (
    Stack,
    aws_ses as ses,
    aws_ssm as ssm,
    aws_route53 as route53,
    aws_iam as iam,
)
from constructs import Construct


class SESStack(Stack):
    def __init__(self, scope: Construct, cid: str, *, env_name: str, **kw):
        super().__init__(scope, cid, **kw)

        # Domain configuration
        domain_name = "harmonest.de"
        from_email = f"noreply@{domain_name}"

        # Create SES domain identity
        domain_identity = ses.EmailIdentity(
            self, "HarmonestDomainIdentity",
            identity=ses.Identity.domain(domain_name),
            configuration_set=None,  # Can be added later if needed
            dkim_signing=True,  # Enable DKIM signing
            dkim_identity=None,  # Use default DKIM identity
            feedback_forwarding=False,  # Disable bounce/complaint forwarding
            mail_from_domain=None,  # Use default MAIL FROM domain
        )

        # Note: No need to create individual email identity since domain verification
        # allows sending from any email address on the verified domain

        # Create configuration set for tracking (optional but recommended)
        config_set = ses.ConfigurationSet(
            self, "HarmonestConfigSet",
            configuration_set_name=f"harmonest-{env_name}-config-set",
        )

        # Store SES configuration in SSM for other stacks to reference
        ssm.StringParameter(
            self, "SESDomainIdentityArn",
            parameter_name=f"/harmonest/{env_name}/ses/domainIdentityArn",
            string_value=domain_identity.email_identity_arn,
        )

        # Email identity ARN not needed since domain verification covers all emails

        ssm.StringParameter(
            self, "SESFromEmail",
            parameter_name=f"/harmonest/{env_name}/ses/fromEmail",
            string_value=from_email,
        )

        ssm.StringParameter(
            self, "SESConfigSetName",
            parameter_name=f"/harmonest/{env_name}/ses/configSetName",
            string_value=config_set.configuration_set_name,
        )

        ssm.StringParameter(
            self, "SESDomainName",
            parameter_name=f"/harmonest/{env_name}/ses/domainName",
            string_value=domain_name,
        )

        # Store references for other stacks
        self.domain_identity = domain_identity
        self.config_set = config_set
        self.domain_name = domain_name
        self.from_email = from_email
