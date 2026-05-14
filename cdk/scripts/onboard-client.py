#!/usr/bin/env python3
"""
Client Onboarding Automation

Automated client onboarding process that creates configuration,
validates settings, and optionally deploys infrastructure.
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Optional
import argparse
from datetime import datetime

# Try to import questionary for interactive mode
try:
    import questionary
    QUESTIONARY_AVAILABLE = True
except ImportError:
    QUESTIONARY_AVAILABLE = False

# Add config directory to Python path
project_root = Path(__file__).parent.parent
config_dir = project_root / "config"
sys.path.insert(0, str(config_dir))

from config.config_manager import ConfigManager, ConfigurationError


class ClientOnboardingWizard:
    """Interactive client onboarding wizard"""
    
    def __init__(self, interactive: bool = True):
        """Initialize the onboarding wizard"""
        self.config_manager = ConfigManager()
        self.interactive = interactive and QUESTIONARY_AVAILABLE
        self.client_config = {}

        if interactive and not QUESTIONARY_AVAILABLE:
            print("⚠️ Interactive mode requires 'questionary' package. Falling back to non-interactive mode.")
            print("   Install with: pip install questionary")
    
    def run_onboarding(self, client_name: Optional[str] = None) -> Dict[str, Any]:
        """Run the complete onboarding process"""
        print("🚀 Welcome to the Multi-Tenant Hotel Management System")
        print("   Client Onboarding Wizard")
        print("=" * 60)
        
        # Step 1: Basic client information
        self._collect_basic_info(client_name)
        
        # Step 2: Domain configuration
        self._collect_domain_info()
        
        # Step 3: Email configuration
        self._collect_email_info()
        
        # Step 4: AWS configuration
        self._collect_aws_info()
        
        # Step 5: Feature configuration
        self._collect_feature_info()
        
        # Step 6: Environment configuration
        self._collect_environment_info()
        
        # Step 7: Integration configuration
        self._collect_integration_info()
        
        # Step 8: Review and confirm
        if self.interactive:
            self._review_configuration()
        
        return self.client_config
    
    def _collect_basic_info(self, client_name: Optional[str] = None):
        """Collect basic client information"""
        print("\n📋 Step 1: Basic Client Information")
        print("-" * 40)
        
        if client_name:
            self.client_config["client"] = {"name": client_name}
        elif self.interactive:
            name = questionary.text(
                "Client name (lowercase, alphanumeric, hyphens only):",
                validate=lambda x: len(x) > 0 and x.replace("-", "").replace("_", "").isalnum()
            ).ask()
            self.client_config["client"] = {"name": name.lower()}
        else:
            raise ValueError("Client name is required for non-interactive mode")
        
        client = self.client_config["client"]
        
        if self.interactive:
            client["displayName"] = questionary.text(
                "Display name (human-readable):",
                default=client["name"].replace("-", " ").title()
            ).ask()
            
            client["description"] = questionary.text(
                "Description (optional):",
                default=""
            ).ask()
        else:
            client["displayName"] = client["name"].replace("-", " ").title()
            client["description"] = f"Hotel management system for {client['displayName']}"
    
    def _collect_domain_info(self):
        """Collect domain configuration"""
        print("\n🌐 Step 2: Domain Configuration")
        print("-" * 40)
        
        domains = {}
        
        if self.interactive:
            domains["primary"] = questionary.text(
                "Primary domain (e.g., example.com):",
                validate=lambda x: "." in x and len(x) > 3
            ).ask()
            
            add_www = questionary.confirm("Add www subdomain?", default=True).ask()
            if add_www:
                domains["www"] = f"www.{domains['primary']}"
            
            add_dev = questionary.confirm("Add development domain?", default=True).ask()
            if add_dev:
                dev_domain = questionary.text(
                    "Development domain:",
                    default=f"dev.{domains['primary']}"
                ).ask()
                domains["dev"] = dev_domain
            
            add_staging = questionary.confirm("Add staging domain?", default=False).ask()
            if add_staging:
                staging_domain = questionary.text(
                    "Staging domain:",
                    default=f"staging.{domains['primary']}"
                ).ask()
                domains["staging"] = staging_domain
            
            add_api = questionary.confirm("Add separate API domain?", default=False).ask()
            if add_api:
                api_domain = questionary.text(
                    "API domain:",
                    default=f"api.{domains['primary']}"
                ).ask()
                domains["api"] = api_domain
        else:
            # Non-interactive defaults
            client_name = self.client_config["client"]["name"]
            domains["primary"] = f"{client_name}.example.com"
            domains["www"] = f"www.{domains['primary']}"
            domains["dev"] = f"dev.{domains['primary']}"
        
        self.client_config["client"]["domains"] = domains
    
    def _collect_email_info(self):
        """Collect email configuration"""
        print("\n📧 Step 3: Email Configuration")
        print("-" * 40)
        
        email = {}
        primary_domain = self.client_config["client"]["domains"]["primary"]
        
        if self.interactive:
            email["noreply"] = questionary.text(
                "No-reply email address:",
                default=f"noreply@{primary_domain}"
            ).ask()
            
            add_support = questionary.confirm("Add support email?", default=True).ask()
            if add_support:
                email["support"] = questionary.text(
                    "Support email address:",
                    default=f"support@{primary_domain}"
                ).ask()
            
            add_admin = questionary.confirm("Add admin email?", default=False).ask()
            if add_admin:
                email["admin"] = questionary.text(
                    "Admin email address:",
                    default=f"admin@{primary_domain}"
                ).ask()
            
            email["fromName"] = questionary.text(
                "Email from name:",
                default=self.client_config["client"]["displayName"]
            ).ask()
        else:
            # Non-interactive defaults
            email["noreply"] = f"noreply@{primary_domain}"
            email["support"] = f"support@{primary_domain}"
            email["fromName"] = self.client_config["client"]["displayName"]
        
        self.client_config["client"]["email"] = email
    
    def _collect_aws_info(self):
        """Collect AWS configuration"""
        print("\n☁️ Step 4: AWS Configuration")
        print("-" * 40)
        
        aws = {}
        client_name = self.client_config["client"]["name"]
        
        if self.interactive:
            aws["profile"] = questionary.text(
                "AWS CLI profile name:",
                default=f"{client_name}admin"
            ).ask()
            
            aws["region"] = questionary.select(
                "AWS region:",
                choices=[
                    "us-east-1", "us-west-2", "eu-west-1", "eu-central-1",
                    "ap-southeast-1", "ap-northeast-1", "other"
                ],
                default="us-east-1"
            ).ask()
            
            if aws["region"] == "other":
                aws["region"] = questionary.text("Enter AWS region:").ask()
            
            add_account_id = questionary.confirm("Specify AWS account ID?", default=False).ask()
            if add_account_id:
                aws["accountId"] = questionary.text(
                    "AWS account ID (12 digits):",
                    validate=lambda x: x.isdigit() and len(x) == 12
                ).ask()
            
            add_kms = questionary.confirm("Use custom KMS key?", default=False).ask()
            if add_kms:
                aws["kmsKeyId"] = questionary.text("KMS key ID or ARN:").ask()
        else:
            # Non-interactive defaults
            aws["profile"] = f"{client_name}admin"
            aws["region"] = "us-east-1"
        
        self.client_config["client"]["aws"] = aws
    
    def _collect_feature_info(self):
        """Collect feature configuration"""
        print("\n⚙️ Step 5: Feature Configuration")
        print("-" * 40)
        
        features = {}
        
        # Check-in feature
        if self.interactive:
            enable_checkin = questionary.confirm("Enable check-in feature?", default=True).ask()
        else:
            enable_checkin = True
        
        if enable_checkin:
            checkin = {"enabled": True}
            
            if self.interactive:
                checkin["deadlineHours"] = int(questionary.text(
                    "Check-in deadline (hours before check-in):",
                    default="25",
                    validate=lambda x: x.isdigit() and 1 <= int(x) <= 168
                ).ask())
                
                checkin["qrCodeEnabled"] = questionary.confirm(
                    "Enable QR code generation?", default=True
                ).ask()
            else:
                checkin["deadlineHours"] = 25
                checkin["qrCodeEnabled"] = True
            
            features["checkin"] = checkin
        
        # Reservations feature
        if self.interactive:
            enable_reservations = questionary.confirm("Enable reservations sync?", default=True).ask()
        else:
            enable_reservations = True
        
        if enable_reservations:
            reservations = {"enabled": True, "syncEnabled": True}
            
            if self.interactive:
                reservations["syncIntervalMinutes"] = int(questionary.text(
                    "Reservations sync interval (minutes):",
                    default="30",
                    validate=lambda x: x.isdigit() and 5 <= int(x) <= 1440
                ).ask())
            else:
                reservations["syncIntervalMinutes"] = 30
            
            features["reservations"] = reservations
        
        # Listings feature
        if self.interactive:
            enable_listings = questionary.confirm("Enable listings sync?", default=True).ask()
        else:
            enable_listings = True
        
        if enable_listings:
            listings = {"enabled": True, "syncEnabled": True}
            
            if self.interactive:
                listings["publicListings"] = questionary.confirm(
                    "Enable public listings API?", default=False
                ).ask()
            else:
                listings["publicListings"] = False
            
            features["listings"] = listings
        
        self.client_config["client"]["features"] = features
    
    def _collect_environment_info(self):
        """Collect environment configuration"""
        print("\n🏗️ Step 6: Environment Configuration")
        print("-" * 40)
        
        environments = {}
        
        # Production environment
        environments["prod"] = {"enabled": True}
        
        if self.interactive:
            add_dev = questionary.confirm("Add development environment?", default=True).ask()
            if add_dev:
                environments["dev"] = {
                    "enabled": True,
                    "scaling": {
                        "lambda": {
                            "memorySize": 256,
                            "timeout": 30
                        }
                    }
                }
            
            add_staging = questionary.confirm("Add staging environment?", default=False).ask()
            if add_staging:
                environments["staging"] = {"enabled": True}
        else:
            # Non-interactive defaults
            environments["dev"] = {
                "enabled": True,
                "scaling": {
                    "lambda": {
                        "memorySize": 256,
                        "timeout": 30
                    }
                }
            }
        
        self.client_config["environments"] = environments
    
    def _collect_integration_info(self):
        """Collect integration configuration"""
        print("\n🔗 Step 7: Integration Configuration")
        print("-" * 40)
        
        integrations = {}
        
        # Guesty for Hosts integration
        if self.interactive:
            enable_g4h = questionary.confirm("Configure Guesty for Hosts integration?", default=True).ask()
        else:
            enable_g4h = True
        
        if enable_g4h:
            g4h = {
                "origin": "https://app.guestyforhosts.com",
                "appVersion": "6.x",
                "platform": "browser--win32"
            }
            
            if self.interactive:
                custom_origin = questionary.confirm("Use custom G4H origin?", default=False).ask()
                if custom_origin:
                    g4h["origin"] = questionary.text(
                        "G4H origin URL:",
                        default=g4h["origin"]
                    ).ask()
                
                g4h["deviceUuid"] = questionary.text(
                    "Device UUID:",
                    default=f"ypa-uuid-{self.client_config['client']['name']}"
                ).ask()
            else:
                g4h["deviceUuid"] = f"ypa-uuid-{self.client_config['client']['name']}"
            
            integrations["g4h"] = g4h
        
        if integrations:
            self.client_config["client"]["integrations"] = integrations
    
    def _review_configuration(self):
        """Review and confirm configuration"""
        print("\n📋 Step 8: Configuration Review")
        print("-" * 40)
        
        print("\nGenerated configuration:")
        print(json.dumps(self.client_config, indent=2))
        
        confirm = questionary.confirm(
            "\nDoes this configuration look correct?",
            default=True
        ).ask()
        
        if not confirm:
            print("❌ Configuration cancelled. Please run the wizard again.")
            sys.exit(0)
    
    def save_configuration(self) -> str:
        """Save the configuration to file"""
        client_name = self.client_config["client"]["name"]
        
        try:
            # Create client configuration
            config_path = self.config_manager.create_client_config(client_name, self.client_config)
            print(f"✅ Configuration saved to: {config_path}")
            return config_path
        except Exception as e:
            print(f"❌ Failed to save configuration: {e}")
            raise
    
    def validate_configuration(self) -> bool:
        """Validate the created configuration"""
        client_name = self.client_config["client"]["name"]
        
        try:
            # Import validation script
            from scripts.validate_config import ConfigurationValidator
            
            validator = ConfigurationValidator()
            report = validator.validate_client(client_name)
            
            if report.has_errors:
                print("❌ Configuration validation failed:")
                for result in report.results:
                    if result.is_blocking:
                        print(f"  - {result.message}")
                return False
            else:
                print("✅ Configuration validation passed")
                return True
                
        except ImportError:
            print("⚠️ Validation script not available, skipping validation")
            return True
        except Exception as e:
            print(f"⚠️ Validation failed: {e}")
            return True  # Don't block on validation errors
    
    def deploy_infrastructure(self, environment: str = "dev") -> bool:
        """Deploy infrastructure for the new client"""
        client_name = self.client_config["client"]["name"]
        
        print(f"\n🚀 Deploying infrastructure for {client_name} ({environment})")
        
        try:
            # Use deployment script
            deploy_cmd = [
                "python", "deploy.py", "deploy", client_name,
                "--env", environment,
                "--pipeline"  # Use advanced pipeline
            ]
            
            result = subprocess.run(deploy_cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                print("✅ Infrastructure deployment successful")
                return True
            else:
                print(f"❌ Infrastructure deployment failed: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"❌ Deployment error: {e}")
            return False


def main():
    """Main function for client onboarding"""
    parser = argparse.ArgumentParser(description="Client Onboarding Automation")
    parser.add_argument("--client", help="Client name (for non-interactive mode)")
    parser.add_argument("--interactive", action="store_true", default=True, help="Interactive mode")
    parser.add_argument("--non-interactive", action="store_true", help="Non-interactive mode")
    parser.add_argument("--deploy", action="store_true", help="Deploy infrastructure after configuration")
    parser.add_argument("--environment", default="dev", help="Environment to deploy (default: dev)")
    parser.add_argument("--config-only", action="store_true", help="Only create configuration, don't deploy")
    
    args = parser.parse_args()
    
    # Determine interactive mode
    interactive = args.interactive and not args.non_interactive
    
    # Check for required dependencies in interactive mode
    if interactive and not QUESTIONARY_AVAILABLE:
        print("❌ Interactive mode requires 'questionary' package")
        print("   Install with: pip install questionary")
        print("   Falling back to non-interactive mode...")
        interactive = False
    
    # Initialize wizard
    wizard = ClientOnboardingWizard(interactive=interactive)
    
    try:
        # Run onboarding process
        print("Starting client onboarding process...")
        config = wizard.run_onboarding(args.client)
        
        # Save configuration
        config_path = wizard.save_configuration()
        
        # Validate configuration
        if not wizard.validate_configuration():
            print("⚠️ Configuration has validation errors. Please review and fix before deployment.")
            if not args.config_only:
                deploy_anyway = questionary.confirm(
                    "Deploy anyway?", default=False
                ).ask() if interactive else False
                
                if not deploy_anyway:
                    print("Deployment skipped due to validation errors.")
                    sys.exit(1)
        
        # Deploy infrastructure if requested
        if args.deploy and not args.config_only:
            success = wizard.deploy_infrastructure(args.environment)
            if not success:
                print("❌ Deployment failed. Configuration has been saved for manual deployment.")
                sys.exit(1)
        
        # Success summary
        client_name = config["client"]["name"]
        print(f"\n🎉 Client onboarding completed successfully!")
        print(f"   Client: {client_name}")
        print(f"   Configuration: {config_path}")
        
        if args.deploy and not args.config_only:
            print(f"   Infrastructure deployed to: {args.environment}")
        
        print(f"\nNext steps:")
        print(f"1. Review configuration in {config_path}")
        print(f"2. Update AWS Secrets Manager with G4H credentials")
        if not args.deploy or args.config_only:
            print(f"3. Deploy infrastructure: python deploy.py deploy {client_name}")
        print(f"4. Configure DNS records for domains")
        print(f"5. Test the deployment")
        
    except KeyboardInterrupt:
        print("\n❌ Onboarding cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Onboarding failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
