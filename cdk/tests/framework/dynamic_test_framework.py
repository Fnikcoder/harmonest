#!/usr/bin/env python3
"""
Dynamic Testing Framework for Multi-Tenant Hotel Management System

This framework automatically generates and executes tests for different client configurations,
ensuring that the system works correctly across all tenant variations.
"""

import os
import sys
import json
import pytest
import boto3
import requests
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from unittest.mock import Mock, patch

# Add config directory to Python path
project_root = Path(__file__).parent.parent.parent
config_dir = project_root / "config"
sys.path.insert(0, str(config_dir))

from config.config_manager import ConfigManager, ConfigurationError


@dataclass
class TestEnvironment:
    """Test environment configuration"""
    client_name: str
    env_name: str
    config: Dict[str, Any]
    aws_profile: str
    api_base_url: Optional[str] = None
    deployed: bool = False


class DynamicTestFramework:
    """Framework for testing multiple client configurations"""
    
    def __init__(self, test_data_dir: Optional[str] = None):
        """Initialize the testing framework"""
        self.config_manager = ConfigManager()
        self.test_data_dir = Path(test_data_dir) if test_data_dir else Path(__file__).parent / "test_data"
        self.test_environments: List[TestEnvironment] = []
        self.mock_data: Dict[str, Any] = {}
        
        # Ensure test data directory exists
        self.test_data_dir.mkdir(parents=True, exist_ok=True)
        
        # Load mock data
        self._load_mock_data()
    
    def _load_mock_data(self):
        """Load mock data for testing"""
        mock_data_file = self.test_data_dir / "mock_data.json"
        if mock_data_file.exists():
            with open(mock_data_file, 'r') as f:
                self.mock_data = json.load(f)
        else:
            # Create default mock data
            self.mock_data = {
                "reservations": [
                    {
                        "reservationId": "TEST001",
                        "reservationCode": "ABC123",
                        "guestName": "John",
                        "guestLastName": "Doe",
                        "checkInDate": "2024-01-15",
                        "checkOutDate": "2024-01-17",
                        "status": 1,
                        "listingId": "LISTING001"
                    }
                ],
                "listings": [
                    {
                        "listingId": "LISTING001",
                        "title": "Test Property",
                        "address": "123 Test Street",
                        "rooms": 2,
                        "maxGuests": 4
                    }
                ]
            }
            self._save_mock_data()
    
    def _save_mock_data(self):
        """Save mock data to file"""
        mock_data_file = self.test_data_dir / "mock_data.json"
        with open(mock_data_file, 'w') as f:
            json.dump(self.mock_data, f, indent=2)
    
    def discover_test_environments(self) -> List[TestEnvironment]:
        """Discover all available test environments"""
        environments = []
        clients = self.config_manager.list_clients()
        
        for client_name in clients:
            try:
                config = self.config_manager.load_client_config(client_name)
                aws_profile = config["client"]["aws"]["profile"]
                
                # Test each environment for this client
                for env_name in config["environments"].keys():
                    env_config = self.config_manager.get_environment_config(client_name, env_name)
                    
                    if env_config["environments"][env_name].get("enabled", True):
                        test_env = TestEnvironment(
                            client_name=client_name,
                            env_name=env_name,
                            config=env_config,
                            aws_profile=aws_profile
                        )
                        environments.append(test_env)
                        
            except ConfigurationError as e:
                print(f"Warning: Skipping client {client_name} due to configuration error: {e}")
        
        self.test_environments = environments
        return environments
    
    def check_deployment_status(self, test_env: TestEnvironment) -> bool:
        """Check if a test environment is deployed"""
        try:
            # Use AWS CLI to check if stacks exist
            session = boto3.Session(profile_name=test_env.aws_profile)
            cf_client = session.client('cloudformation')
            
            # Check for core stack
            stack_name = f"{test_env.client_name.title()}Core-{test_env.env_name.title()}"
            if test_env.env_name == "prod":
                stack_name = f"{test_env.client_name.title()}Core-Prod"
            
            try:
                cf_client.describe_stacks(StackName=stack_name)
                test_env.deployed = True
                
                # Try to get API Gateway URL
                try:
                    ssm_client = session.client('ssm')
                    api_url_param = f"/{test_env.client_name}/{test_env.env_name}/api/url"
                    response = ssm_client.get_parameter(Name=api_url_param)
                    test_env.api_base_url = response['Parameter']['Value']
                except:
                    pass
                
                return True
            except cf_client.exceptions.ClientError:
                test_env.deployed = False
                return False
                
        except Exception as e:
            print(f"Error checking deployment status for {test_env.client_name}/{test_env.env_name}: {e}")
            return False
    
    def generate_test_cases(self, test_env: TestEnvironment) -> List[Dict[str, Any]]:
        """Generate test cases for a specific environment"""
        test_cases = []
        config = test_env.config
        
        # Configuration validation tests
        test_cases.append({
            "name": f"test_config_validation_{test_env.client_name}_{test_env.env_name}",
            "type": "config_validation",
            "environment": test_env,
            "description": "Validate client configuration"
        })
        
        # Feature flag tests
        features = config["client"].get("features", {})
        for feature_name, feature_config in features.items():
            if feature_config.get("enabled", True):
                test_cases.append({
                    "name": f"test_feature_{feature_name}_{test_env.client_name}_{test_env.env_name}",
                    "type": "feature_test",
                    "environment": test_env,
                    "feature": feature_name,
                    "description": f"Test {feature_name} feature functionality"
                })
        
        # API endpoint tests (if deployed)
        if test_env.deployed and test_env.api_base_url:
            test_cases.append({
                "name": f"test_api_endpoints_{test_env.client_name}_{test_env.env_name}",
                "type": "api_test",
                "environment": test_env,
                "description": "Test API endpoints"
            })
        
        # Lambda function tests
        test_cases.append({
            "name": f"test_lambda_functions_{test_env.client_name}_{test_env.env_name}",
            "type": "lambda_test",
            "environment": test_env,
            "description": "Test Lambda function configuration"
        })
        
        # Database tests
        test_cases.append({
            "name": f"test_database_{test_env.client_name}_{test_env.env_name}",
            "type": "database_test",
            "environment": test_env,
            "description": "Test database configuration and access"
        })
        
        return test_cases
    
    def execute_config_validation_test(self, test_case: Dict[str, Any]) -> Dict[str, Any]:
        """Execute configuration validation test"""
        test_env = test_case["environment"]
        
        try:
            # Validate configuration
            self.config_manager.validate_config(test_env.config)
            
            # Check required fields
            required_fields = [
                "client.name",
                "client.displayName",
                "client.domains.primary",
                "client.email.noreply",
                "client.aws.profile",
                "client.aws.region"
            ]
            
            for field_path in required_fields:
                keys = field_path.split(".")
                value = test_env.config
                for key in keys:
                    value = value.get(key)
                    if value is None:
                        raise ValueError(f"Missing required field: {field_path}")
            
            return {
                "status": "PASSED",
                "message": "Configuration validation successful"
            }
            
        except Exception as e:
            return {
                "status": "FAILED",
                "message": f"Configuration validation failed: {e}"
            }
    
    def execute_feature_test(self, test_case: Dict[str, Any]) -> Dict[str, Any]:
        """Execute feature-specific test"""
        test_env = test_case["environment"]
        feature_name = test_case["feature"]
        
        try:
            features = test_env.config["client"].get("features", {})
            feature_config = features.get(feature_name, {})
            
            if not feature_config.get("enabled", True):
                return {
                    "status": "SKIPPED",
                    "message": f"Feature {feature_name} is disabled"
                }
            
            # Feature-specific validation
            if feature_name == "checkin":
                deadline_hours = feature_config.get("deadlineHours", 25)
                if not isinstance(deadline_hours, int) or deadline_hours < 1:
                    raise ValueError("Invalid deadline hours configuration")
            
            elif feature_name == "reservations":
                sync_interval = feature_config.get("syncIntervalMinutes", 30)
                if not isinstance(sync_interval, int) or sync_interval < 5:
                    raise ValueError("Invalid sync interval configuration")
            
            return {
                "status": "PASSED",
                "message": f"Feature {feature_name} configuration is valid"
            }
            
        except Exception as e:
            return {
                "status": "FAILED",
                "message": f"Feature test failed: {e}"
            }
    
    def execute_api_test(self, test_case: Dict[str, Any]) -> Dict[str, Any]:
        """Execute API endpoint test"""
        test_env = test_case["environment"]
        
        if not test_env.api_base_url:
            return {
                "status": "SKIPPED",
                "message": "API URL not available"
            }
        
        try:
            # Test health endpoint (if available)
            health_url = f"{test_env.api_base_url}/health"
            response = requests.get(health_url, timeout=10)
            
            if response.status_code == 200:
                return {
                    "status": "PASSED",
                    "message": "API endpoints are accessible"
                }
            else:
                return {
                    "status": "FAILED",
                    "message": f"API health check failed: {response.status_code}"
                }
                
        except Exception as e:
            return {
                "status": "FAILED",
                "message": f"API test failed: {e}"
            }
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all tests for all environments"""
        results = {
            "summary": {
                "total_environments": 0,
                "total_tests": 0,
                "passed": 0,
                "failed": 0,
                "skipped": 0
            },
            "environments": {}
        }
        
        environments = self.discover_test_environments()
        results["summary"]["total_environments"] = len(environments)
        
        for test_env in environments:
            print(f"Testing environment: {test_env.client_name}/{test_env.env_name}")
            
            # Check deployment status
            self.check_deployment_status(test_env)
            
            # Generate and execute test cases
            test_cases = self.generate_test_cases(test_env)
            env_results = {
                "client_name": test_env.client_name,
                "env_name": test_env.env_name,
                "deployed": test_env.deployed,
                "api_url": test_env.api_base_url,
                "tests": {}
            }
            
            for test_case in test_cases:
                test_name = test_case["name"]
                test_type = test_case["type"]
                
                print(f"  Running test: {test_name}")
                
                # Execute test based on type
                if test_type == "config_validation":
                    result = self.execute_config_validation_test(test_case)
                elif test_type == "feature_test":
                    result = self.execute_feature_test(test_case)
                elif test_type == "api_test":
                    result = self.execute_api_test(test_case)
                else:
                    result = {
                        "status": "SKIPPED",
                        "message": f"Test type {test_type} not implemented"
                    }
                
                env_results["tests"][test_name] = result
                results["summary"]["total_tests"] += 1
                
                if result["status"] == "PASSED":
                    results["summary"]["passed"] += 1
                elif result["status"] == "FAILED":
                    results["summary"]["failed"] += 1
                else:
                    results["summary"]["skipped"] += 1
            
            results["environments"][f"{test_env.client_name}/{test_env.env_name}"] = env_results
        
        return results
    
    def generate_test_report(self, results: Dict[str, Any], output_file: Optional[str] = None) -> str:
        """Generate a test report"""
        report_lines = []
        
        # Summary
        summary = results["summary"]
        report_lines.append("# Dynamic Multi-Tenant Testing Report")
        report_lines.append("")
        report_lines.append("## Summary")
        report_lines.append(f"- Total Environments: {summary['total_environments']}")
        report_lines.append(f"- Total Tests: {summary['total_tests']}")
        report_lines.append(f"- Passed: {summary['passed']}")
        report_lines.append(f"- Failed: {summary['failed']}")
        report_lines.append(f"- Skipped: {summary['skipped']}")
        report_lines.append("")
        
        # Environment details
        report_lines.append("## Environment Results")
        report_lines.append("")
        
        for env_key, env_result in results["environments"].items():
            report_lines.append(f"### {env_key}")
            report_lines.append(f"- Client: {env_result['client_name']}")
            report_lines.append(f"- Environment: {env_result['env_name']}")
            report_lines.append(f"- Deployed: {'✅' if env_result['deployed'] else '❌'}")
            if env_result['api_url']:
                report_lines.append(f"- API URL: {env_result['api_url']}")
            report_lines.append("")
            
            # Test results
            for test_name, test_result in env_result["tests"].items():
                status_icon = {
                    "PASSED": "✅",
                    "FAILED": "❌",
                    "SKIPPED": "⏭️"
                }.get(test_result["status"], "❓")
                
                report_lines.append(f"- {status_icon} {test_name}: {test_result['message']}")
            
            report_lines.append("")
        
        report_content = "\n".join(report_lines)
        
        if output_file:
            with open(output_file, 'w') as f:
                f.write(report_content)
        
        return report_content


def main():
    """Main function for running the dynamic test framework"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Dynamic Multi-Tenant Testing Framework")
    parser.add_argument("--client", help="Test specific client only")
    parser.add_argument("--env", help="Test specific environment only")
    parser.add_argument("--report", help="Output report file")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    framework = DynamicTestFramework()
    
    if args.client:
        # Filter to specific client
        environments = framework.discover_test_environments()
        environments = [env for env in environments if env.client_name == args.client]
        if args.env:
            environments = [env for env in environments if env.env_name == args.env]
        framework.test_environments = environments
    
    print("Starting dynamic multi-tenant testing...")
    results = framework.run_all_tests()
    
    # Generate report
    report_file = args.report or "test_report.md"
    report = framework.generate_test_report(results, report_file)
    
    if args.verbose:
        print("\n" + report)
    
    print(f"\nTest report saved to: {report_file}")
    
    # Exit with error code if any tests failed
    if results["summary"]["failed"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
