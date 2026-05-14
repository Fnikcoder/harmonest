#!/usr/bin/env python3
"""
Configuration Validation Pipeline

Comprehensive validation system for client configurations that ensures
all configurations are valid, deployable, and follow best practices.
"""

import os
import sys
import json
import boto3
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import argparse
import re

# Add config directory to Python path
project_root = Path(__file__).parent.parent
config_dir = project_root / "config"
sys.path.insert(0, str(config_dir))

from config.config_manager import ConfigManager, ConfigurationError


class ValidationLevel(Enum):
    """Validation severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class ValidationResult:
    """Result of a validation check"""
    level: ValidationLevel
    category: str
    message: str
    details: Optional[str] = None
    suggestion: Optional[str] = None
    
    @property
    def is_blocking(self) -> bool:
        """Check if this validation result blocks deployment"""
        return self.level in [ValidationLevel.ERROR, ValidationLevel.CRITICAL]


@dataclass
class ValidationReport:
    """Complete validation report for a client"""
    client_name: str
    results: List[ValidationResult] = field(default_factory=list)
    
    @property
    def has_errors(self) -> bool:
        """Check if report has any errors"""
        return any(result.is_blocking for result in self.results)
    
    @property
    def error_count(self) -> int:
        """Count of error-level results"""
        return sum(1 for result in self.results if result.level == ValidationLevel.ERROR)
    
    @property
    def warning_count(self) -> int:
        """Count of warning-level results"""
        return sum(1 for result in self.results if result.level == ValidationLevel.WARNING)
    
    @property
    def critical_count(self) -> int:
        """Count of critical-level results"""
        return sum(1 for result in self.results if result.level == ValidationLevel.CRITICAL)


class ConfigurationValidator:
    """Comprehensive configuration validator"""
    
    def __init__(self, strict_mode: bool = False):
        """Initialize the validator"""
        self.config_manager = ConfigManager()
        self.strict_mode = strict_mode
        
        # Validation rules
        self.domain_pattern = re.compile(r'^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$')
        self.email_pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
        self.client_name_pattern = re.compile(r'^[a-z0-9][a-z0-9\-]*[a-z0-9]$')
    
    def validate_client(self, client_name: str) -> ValidationReport:
        """Validate a complete client configuration"""
        report = ValidationReport(client_name=client_name)
        
        try:
            # Load configuration
            config = self.config_manager.load_client_config(client_name)
            
            # Run all validation checks
            self._validate_basic_structure(config, report)
            self._validate_client_info(config, report)
            self._validate_domains(config, report)
            self._validate_email_configuration(config, report)
            self._validate_aws_configuration(config, report)
            self._validate_features(config, report)
            self._validate_environments(config, report)
            self._validate_integrations(config, report)
            self._validate_security_settings(config, report)
            self._validate_naming_conventions(config, report)
            self._validate_cross_references(config, report)
            
            # AWS-specific validations (if credentials available)
            self._validate_aws_resources(config, report)
            
        except ConfigurationError as e:
            report.results.append(ValidationResult(
                level=ValidationLevel.CRITICAL,
                category="configuration",
                message=f"Configuration loading failed: {e}"
            ))
        except Exception as e:
            report.results.append(ValidationResult(
                level=ValidationLevel.CRITICAL,
                category="system",
                message=f"Validation system error: {e}"
            ))
        
        return report
    
    def _validate_basic_structure(self, config: Dict[str, Any], report: ValidationReport):
        """Validate basic configuration structure"""
        required_sections = ["client", "environments"]
        
        for section in required_sections:
            if section not in config:
                report.results.append(ValidationResult(
                    level=ValidationLevel.CRITICAL,
                    category="structure",
                    message=f"Missing required section: {section}",
                    suggestion=f"Add '{section}' section to configuration"
                ))
    
    def _validate_client_info(self, config: Dict[str, Any], report: ValidationReport):
        """Validate client information"""
        if "client" not in config:
            return
        
        client = config["client"]
        
        # Required fields
        required_fields = ["name", "displayName", "domains", "email", "aws"]
        for field in required_fields:
            if field not in client:
                report.results.append(ValidationResult(
                    level=ValidationLevel.ERROR,
                    category="client_info",
                    message=f"Missing required client field: {field}",
                    suggestion=f"Add '{field}' to client configuration"
                ))
        
        # Validate client name
        if "name" in client:
            name = client["name"]
            if not self.client_name_pattern.match(name):
                report.results.append(ValidationResult(
                    level=ValidationLevel.ERROR,
                    category="client_info",
                    message=f"Invalid client name format: {name}",
                    details="Client name must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric",
                    suggestion="Use format: 'my-client-name'"
                ))
            
            if len(name) > 50:
                report.results.append(ValidationResult(
                    level=ValidationLevel.WARNING,
                    category="client_info",
                    message=f"Client name is very long: {len(name)} characters",
                    suggestion="Consider using a shorter client name"
                ))
        
        # Validate display name
        if "displayName" in client:
            display_name = client["displayName"]
            if len(display_name) > 100:
                report.results.append(ValidationResult(
                    level=ValidationLevel.WARNING,
                    category="client_info",
                    message=f"Display name is very long: {len(display_name)} characters"
                ))
    
    def _validate_domains(self, config: Dict[str, Any], report: ValidationReport):
        """Validate domain configuration"""
        if "client" not in config or "domains" not in config["client"]:
            return
        
        domains = config["client"]["domains"]
        
        # Primary domain is required
        if "primary" not in domains:
            report.results.append(ValidationResult(
                level=ValidationLevel.ERROR,
                category="domains",
                message="Missing required primary domain",
                suggestion="Add 'primary' domain to domains configuration"
            ))
        
        # Validate all domain formats
        for domain_type, domain in domains.items():
            if isinstance(domain, str):
                if not self.domain_pattern.match(domain):
                    report.results.append(ValidationResult(
                        level=ValidationLevel.ERROR,
                        category="domains",
                        message=f"Invalid domain format for {domain_type}: {domain}",
                        suggestion="Use valid domain format (e.g., example.com)"
                    ))
            elif isinstance(domain, list):
                for i, d in enumerate(domain):
                    if not self.domain_pattern.match(d):
                        report.results.append(ValidationResult(
                            level=ValidationLevel.ERROR,
                            category="domains",
                            message=f"Invalid domain format in {domain_type}[{i}]: {d}"
                        ))
        
        # Check for domain conflicts
        all_domains = []
        for domain_type, domain in domains.items():
            if isinstance(domain, str):
                all_domains.append(domain)
            elif isinstance(domain, list):
                all_domains.extend(domain)
        
        if len(all_domains) != len(set(all_domains)):
            report.results.append(ValidationResult(
                level=ValidationLevel.WARNING,
                category="domains",
                message="Duplicate domains found in configuration",
                suggestion="Remove duplicate domain entries"
            ))
    
    def _validate_email_configuration(self, config: Dict[str, Any], report: ValidationReport):
        """Validate email configuration"""
        if "client" not in config or "email" not in config["client"]:
            return
        
        email_config = config["client"]["email"]
        
        # No-reply email is required
        if "noreply" not in email_config:
            report.results.append(ValidationResult(
                level=ValidationLevel.ERROR,
                category="email",
                message="Missing required no-reply email address",
                suggestion="Add 'noreply' email to email configuration"
            ))
        
        # Validate email formats
        for email_type, email_addr in email_config.items():
            if isinstance(email_addr, str) and email_addr:
                if not self.email_pattern.match(email_addr):
                    report.results.append(ValidationResult(
                        level=ValidationLevel.ERROR,
                        category="email",
                        message=f"Invalid email format for {email_type}: {email_addr}",
                        suggestion="Use valid email format (e.g., user@domain.com)"
                    ))
        
        # Check if emails match domain
        if "noreply" in email_config and "primary" in config["client"].get("domains", {}):
            noreply_email = email_config["noreply"]
            primary_domain = config["client"]["domains"]["primary"]
            
            if not noreply_email.endswith(f"@{primary_domain}"):
                report.results.append(ValidationResult(
                    level=ValidationLevel.WARNING,
                    category="email",
                    message=f"No-reply email domain doesn't match primary domain",
                    details=f"Email: {noreply_email}, Domain: {primary_domain}",
                    suggestion="Consider using an email address on the primary domain"
                ))
    
    def _validate_aws_configuration(self, config: Dict[str, Any], report: ValidationReport):
        """Validate AWS configuration"""
        if "client" not in config or "aws" not in config["client"]:
            return
        
        aws_config = config["client"]["aws"]
        
        # Required fields
        required_fields = ["profile", "region"]
        for field in required_fields:
            if field not in aws_config:
                report.results.append(ValidationResult(
                    level=ValidationLevel.ERROR,
                    category="aws",
                    message=f"Missing required AWS field: {field}",
                    suggestion=f"Add '{field}' to AWS configuration"
                ))
        
        # Validate region format
        if "region" in aws_config:
            region = aws_config["region"]
            if not re.match(r'^[a-z]{2}-[a-z]+-\d+$', region):
                report.results.append(ValidationResult(
                    level=ValidationLevel.WARNING,
                    category="aws",
                    message=f"Unusual AWS region format: {region}",
                    suggestion="Use standard AWS region format (e.g., us-east-1)"
                ))
        
        # Validate account ID format if present
        if "accountId" in aws_config:
            account_id = aws_config["accountId"]
            if not re.match(r'^\d{12}$', str(account_id)):
                report.results.append(ValidationResult(
                    level=ValidationLevel.ERROR,
                    category="aws",
                    message=f"Invalid AWS account ID format: {account_id}",
                    suggestion="Use 12-digit AWS account ID"
                ))
    
    def _validate_features(self, config: Dict[str, Any], report: ValidationReport):
        """Validate feature configuration"""
        if "client" not in config or "features" not in config["client"]:
            return
        
        features = config["client"]["features"]
        
        # Validate checkin feature
        if "checkin" in features:
            checkin = features["checkin"]
            if "deadlineHours" in checkin:
                deadline = checkin["deadlineHours"]
                if not isinstance(deadline, int) or deadline < 1 or deadline > 168:
                    report.results.append(ValidationResult(
                        level=ValidationLevel.ERROR,
                        category="features",
                        message=f"Invalid checkin deadline hours: {deadline}",
                        suggestion="Use value between 1 and 168 hours (1 week)"
                    ))
        
        # Validate reservations feature
        if "reservations" in features:
            reservations = features["reservations"]
            if "syncIntervalMinutes" in reservations:
                interval = reservations["syncIntervalMinutes"]
                if not isinstance(interval, int) or interval < 5 or interval > 1440:
                    report.results.append(ValidationResult(
                        level=ValidationLevel.ERROR,
                        category="features",
                        message=f"Invalid sync interval: {interval} minutes",
                        suggestion="Use value between 5 and 1440 minutes (1 day)"
                    ))
    
    def _validate_environments(self, config: Dict[str, Any], report: ValidationReport):
        """Validate environment configuration"""
        if "environments" not in config:
            return
        
        environments = config["environments"]
        
        # At least one environment should be enabled
        enabled_envs = [env for env, cfg in environments.items() if cfg.get("enabled", True)]
        if not enabled_envs:
            report.results.append(ValidationResult(
                level=ValidationLevel.WARNING,
                category="environments",
                message="No environments are enabled",
                suggestion="Enable at least one environment"
            ))
        
        # Validate environment names
        valid_env_names = ["dev", "test", "staging", "prod", "production"]
        for env_name in environments.keys():
            if env_name not in valid_env_names:
                report.results.append(ValidationResult(
                    level=ValidationLevel.WARNING,
                    category="environments",
                    message=f"Non-standard environment name: {env_name}",
                    suggestion=f"Consider using standard names: {', '.join(valid_env_names)}"
                ))
    
    def _validate_integrations(self, config: Dict[str, Any], report: ValidationReport):
        """Validate integration configuration"""
        if "client" not in config or "integrations" not in config["client"]:
            return
        
        integrations = config["client"]["integrations"]
        
        # Validate G4H integration
        if "g4h" in integrations:
            g4h = integrations["g4h"]
            if "origin" in g4h:
                origin = g4h["origin"]
                if not origin.startswith("https://"):
                    report.results.append(ValidationResult(
                        level=ValidationLevel.WARNING,
                        category="integrations",
                        message=f"G4H origin should use HTTPS: {origin}",
                        suggestion="Use HTTPS URL for security"
                    ))
    
    def _validate_security_settings(self, config: Dict[str, Any], report: ValidationReport):
        """Validate security-related settings"""
        # Check for sensitive data in configuration
        config_str = json.dumps(config).lower()
        
        sensitive_patterns = [
            (r'password', "Possible password in configuration"),
            (r'secret', "Possible secret in configuration"),
            (r'key.*[a-zA-Z0-9]{20,}', "Possible API key in configuration"),
            (r'token', "Possible token in configuration")
        ]
        
        for pattern, message in sensitive_patterns:
            if re.search(pattern, config_str):
                report.results.append(ValidationResult(
                    level=ValidationLevel.WARNING,
                    category="security",
                    message=message,
                    suggestion="Move sensitive data to AWS Secrets Manager"
                ))
    
    def _validate_naming_conventions(self, config: Dict[str, Any], report: ValidationReport):
        """Validate naming conventions"""
        if "client" not in config:
            return
        
        client = config["client"]
        client_name = client.get("name", "")
        
        # Check for reserved names
        reserved_names = ["aws", "amazon", "microsoft", "google", "admin", "root", "system"]
        if client_name.lower() in reserved_names:
            report.results.append(ValidationResult(
                level=ValidationLevel.ERROR,
                category="naming",
                message=f"Client name uses reserved word: {client_name}",
                suggestion="Choose a different client name"
            ))
        
        # Check for potential conflicts with AWS services
        aws_services = ["lambda", "s3", "dynamodb", "apigateway", "cloudformation"]
        if any(service in client_name.lower() for service in aws_services):
            report.results.append(ValidationResult(
                level=ValidationLevel.WARNING,
                category="naming",
                message=f"Client name contains AWS service name: {client_name}",
                suggestion="Consider using a more specific client name"
            ))
    
    def _validate_cross_references(self, config: Dict[str, Any], report: ValidationReport):
        """Validate cross-references within configuration"""
        # Check that email domains match configured domains
        if "client" in config:
            client = config["client"]
            domains = client.get("domains", {})
            emails = client.get("email", {})
            
            all_domains = []
            for domain_value in domains.values():
                if isinstance(domain_value, str):
                    all_domains.append(domain_value)
                elif isinstance(domain_value, list):
                    all_domains.extend(domain_value)
            
            for email_type, email_addr in emails.items():
                if isinstance(email_addr, str) and "@" in email_addr:
                    email_domain = email_addr.split("@")[1]
                    if email_domain not in all_domains:
                        report.results.append(ValidationResult(
                            level=ValidationLevel.INFO,
                            category="cross_reference",
                            message=f"Email domain not in configured domains: {email_domain}",
                            details=f"Email: {email_addr}"
                        ))
    
    def _validate_aws_resources(self, config: Dict[str, Any], report: ValidationReport):
        """Validate AWS resources and permissions"""
        if "client" not in config or "aws" not in config["client"]:
            return
        
        aws_config = config["client"]["aws"]
        profile = aws_config.get("profile")
        
        if not profile:
            return
        
        try:
            # Test AWS credentials
            session = boto3.Session(profile_name=profile)
            sts_client = session.client('sts')
            
            # Get caller identity
            identity = sts_client.get_caller_identity()
            
            # Validate account ID if specified
            if "accountId" in aws_config:
                expected_account = str(aws_config["accountId"])
                actual_account = identity["Account"]
                
                if expected_account != actual_account:
                    report.results.append(ValidationResult(
                        level=ValidationLevel.ERROR,
                        category="aws_resources",
                        message=f"AWS account ID mismatch",
                        details=f"Expected: {expected_account}, Actual: {actual_account}",
                        suggestion="Update accountId in configuration or use correct AWS profile"
                    ))
            
            # Test basic permissions
            try:
                cf_client = session.client('cloudformation')
                cf_client.list_stacks(MaxItems=1)
                
                report.results.append(ValidationResult(
                    level=ValidationLevel.INFO,
                    category="aws_resources",
                    message="AWS credentials and basic permissions validated"
                ))
                
            except Exception as e:
                report.results.append(ValidationResult(
                    level=ValidationLevel.WARNING,
                    category="aws_resources",
                    message="Limited AWS permissions detected",
                    details=str(e),
                    suggestion="Ensure AWS profile has necessary permissions for deployment"
                ))
        
        except Exception as e:
            report.results.append(ValidationResult(
                level=ValidationLevel.ERROR,
                category="aws_resources",
                message=f"AWS credentials validation failed",
                details=str(e),
                suggestion="Check AWS profile configuration and credentials"
            ))
    
    def validate_all_clients(self) -> Dict[str, ValidationReport]:
        """Validate all client configurations"""
        clients = self.config_manager.list_clients()
        reports = {}
        
        for client_name in clients:
            try:
                report = self.validate_client(client_name)
                reports[client_name] = report
            except Exception as e:
                # Create error report for failed validation
                error_report = ValidationReport(client_name=client_name)
                error_report.results.append(ValidationResult(
                    level=ValidationLevel.CRITICAL,
                    category="system",
                    message=f"Validation failed: {e}"
                ))
                reports[client_name] = error_report
        
        return reports
    
    def generate_validation_report(self, reports: Dict[str, ValidationReport]) -> str:
        """Generate a comprehensive validation report"""
        report_lines = []
        
        report_lines.append("# Configuration Validation Report")
        report_lines.append("")
        report_lines.append(f"**Generated:** {self._get_current_timestamp()}")
        report_lines.append(f"**Total Clients:** {len(reports)}")
        report_lines.append("")
        
        # Summary statistics
        total_errors = sum(report.error_count for report in reports.values())
        total_warnings = sum(report.warning_count for report in reports.values())
        total_critical = sum(report.critical_count for report in reports.values())
        clients_with_errors = sum(1 for report in reports.values() if report.has_errors)
        
        report_lines.append("## Summary")
        report_lines.append(f"- **Clients with Errors:** {clients_with_errors}/{len(reports)}")
        report_lines.append(f"- **Total Critical Issues:** {total_critical}")
        report_lines.append(f"- **Total Errors:** {total_errors}")
        report_lines.append(f"- **Total Warnings:** {total_warnings}")
        report_lines.append("")
        
        # Client-specific results
        report_lines.append("## Client Validation Results")
        report_lines.append("")
        
        for client_name, report in sorted(reports.items()):
            status_icon = "❌" if report.has_errors else "✅"
            report_lines.append(f"### {status_icon} {client_name}")
            
            if not report.results:
                report_lines.append("- No issues found")
            else:
                # Group by category
                categories = {}
                for result in report.results:
                    if result.category not in categories:
                        categories[result.category] = []
                    categories[result.category].append(result)
                
                for category, results in sorted(categories.items()):
                    report_lines.append(f"\n**{category.title()}:**")
                    for result in results:
                        level_icon = {
                            ValidationLevel.INFO: "ℹ️",
                            ValidationLevel.WARNING: "⚠️",
                            ValidationLevel.ERROR: "❌",
                            ValidationLevel.CRITICAL: "🚨"
                        }.get(result.level, "❓")
                        
                        report_lines.append(f"- {level_icon} {result.message}")
                        if result.suggestion:
                            report_lines.append(f"  - *Suggestion: {result.suggestion}*")
            
            report_lines.append("")
        
        return "\n".join(report_lines)
    
    def _get_current_timestamp(self) -> str:
        """Get current timestamp for reports"""
        import datetime
        return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def main():
    """Main function for configuration validation"""
    parser = argparse.ArgumentParser(description="Configuration Validation Pipeline")
    parser.add_argument("--client", help="Validate specific client")
    parser.add_argument("--all", action="store_true", help="Validate all clients")
    parser.add_argument("--strict", action="store_true", help="Strict validation mode")
    parser.add_argument("--report", help="Output report file")
    parser.add_argument("--format", choices=["text", "json"], default="text", help="Output format")
    parser.add_argument("--fail-on-error", action="store_true", help="Exit with error code if validation fails")
    
    args = parser.parse_args()
    
    # Initialize validator
    validator = ConfigurationValidator(strict_mode=args.strict)
    
    if args.all:
        # Validate all clients
        print("Validating all client configurations...")
        reports = validator.validate_all_clients()
        
        # Generate report
        if args.format == "json":
            # JSON output (simplified)
            json_report = {}
            for client_name, report in reports.items():
                json_report[client_name] = {
                    "has_errors": report.has_errors,
                    "error_count": report.error_count,
                    "warning_count": report.warning_count,
                    "critical_count": report.critical_count,
                    "results": [
                        {
                            "level": result.level.value,
                            "category": result.category,
                            "message": result.message,
                            "suggestion": result.suggestion
                        }
                        for result in report.results
                    ]
                }
            
            output = json.dumps(json_report, indent=2)
        else:
            output = validator.generate_validation_report(reports)
        
        # Save or print report
        if args.report:
            with open(args.report, 'w') as f:
                f.write(output)
            print(f"Validation report saved to: {args.report}")
        else:
            print(output)
        
        # Check for errors
        has_errors = any(report.has_errors for report in reports.values())
        if has_errors and args.fail_on_error:
            print("\n❌ Validation failed - some clients have errors")
            sys.exit(1)
        else:
            print(f"\n✅ Validation completed - {len(reports)} clients checked")
    
    elif args.client:
        # Validate specific client
        print(f"Validating client: {args.client}")
        report = validator.validate_client(args.client)
        
        # Print results
        if not report.results:
            print("✅ No issues found")
        else:
            for result in report.results:
                level_icon = {
                    ValidationLevel.INFO: "ℹ️",
                    ValidationLevel.WARNING: "⚠️",
                    ValidationLevel.ERROR: "❌",
                    ValidationLevel.CRITICAL: "🚨"
                }.get(result.level, "❓")
                
                print(f"{level_icon} [{result.category}] {result.message}")
                if result.suggestion:
                    print(f"   Suggestion: {result.suggestion}")
        
        # Exit with error if validation failed
        if report.has_errors and args.fail_on_error:
            sys.exit(1)
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
