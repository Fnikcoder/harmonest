#!/usr/bin/env python3
"""
Multi-Tenant Monitoring and Alerting Setup

Creates client-specific monitoring dashboards and alerting rules
that scale across multiple tenants while maintaining isolation.
"""

import os
import sys
import json
import boto3
from pathlib import Path
from typing import Dict, List, Any, Optional
import argparse

# Add config directory to Python path
project_root = Path(__file__).parent.parent
config_dir = project_root / "config"
sys.path.insert(0, str(config_dir))

from config.config_manager import ConfigManager, ConfigurationError


class MonitoringSetup:
    """Multi-tenant monitoring and alerting setup"""
    
    def __init__(self, dry_run: bool = False):
        """Initialize monitoring setup"""
        self.config_manager = ConfigManager()
        self.dry_run = dry_run
        
        # Monitoring configuration
        self.default_thresholds = {
            "lambda_duration_ms": 10000,  # 10 seconds
            "lambda_error_rate_percent": 5,
            "api_latency_ms": 2000,  # 2 seconds
            "api_error_rate_percent": 5,
            "dynamodb_throttle_count": 10,
            "s3_error_rate_percent": 1
        }
    
    def setup_client_monitoring(self, client_name: str, environment: str = "prod") -> Dict[str, Any]:
        """Set up monitoring for a specific client"""
        try:
            # Load client configuration
            config = self.config_manager.load_client_config(client_name)
            aws_profile = config["client"]["aws"]["profile"]
            aws_region = config["client"]["aws"]["region"]
            
            # Initialize AWS clients
            session = boto3.Session(profile_name=aws_profile, region_name=aws_region)
            cloudwatch = session.client('cloudwatch')
            sns = session.client('sns')
            
            results = {
                "client_name": client_name,
                "environment": environment,
                "dashboards": [],
                "alarms": [],
                "topics": []
            }
            
            # Create SNS topics for alerts
            topic_arns = self._create_sns_topics(sns, client_name, environment, config)
            results["topics"] = topic_arns
            
            # Create CloudWatch dashboard
            dashboard_name = self._create_dashboard(cloudwatch, client_name, environment, config)
            results["dashboards"].append(dashboard_name)
            
            # Create CloudWatch alarms
            alarms = self._create_alarms(cloudwatch, client_name, environment, config, topic_arns)
            results["alarms"] = alarms
            
            print(f"✅ Monitoring setup completed for {client_name}/{environment}")
            return results
            
        except Exception as e:
            print(f"❌ Failed to setup monitoring for {client_name}/{environment}: {e}")
            raise
    
    def _create_sns_topics(self, sns_client, client_name: str, environment: str, 
                          config: Dict[str, Any]) -> Dict[str, str]:
        """Create SNS topics for different alert types"""
        topics = {}
        
        # Get email addresses from configuration
        email_config = config["client"].get("email", {})
        support_email = email_config.get("support", email_config.get("noreply"))
        admin_email = email_config.get("admin", support_email)
        
        topic_configs = [
            {
                "name": f"{client_name}-{environment}-critical-alerts",
                "display_name": f"{config['client']['displayName']} Critical Alerts",
                "emails": [admin_email] if admin_email else []
            },
            {
                "name": f"{client_name}-{environment}-warning-alerts", 
                "display_name": f"{config['client']['displayName']} Warning Alerts",
                "emails": [support_email] if support_email else []
            },
            {
                "name": f"{client_name}-{environment}-info-alerts",
                "display_name": f"{config['client']['displayName']} Info Alerts", 
                "emails": [support_email] if support_email else []
            }
        ]
        
        for topic_config in topic_configs:
            if self.dry_run:
                print(f"[DRY RUN] Would create SNS topic: {topic_config['name']}")
                topics[topic_config['name']] = f"arn:aws:sns:region:account:{topic_config['name']}"
                continue
            
            try:
                # Create topic
                response = sns_client.create_topic(Name=topic_config["name"])
                topic_arn = response["TopicArn"]
                topics[topic_config["name"]] = topic_arn
                
                # Set display name
                sns_client.set_topic_attributes(
                    TopicArn=topic_arn,
                    AttributeName="DisplayName",
                    AttributeValue=topic_config["display_name"]
                )
                
                # Subscribe email addresses
                for email in topic_config["emails"]:
                    if email:
                        sns_client.subscribe(
                            TopicArn=topic_arn,
                            Protocol="email",
                            Endpoint=email
                        )
                        print(f"  📧 Subscribed {email} to {topic_config['name']}")
                
                print(f"  ✅ Created SNS topic: {topic_config['name']}")
                
            except Exception as e:
                print(f"  ❌ Failed to create SNS topic {topic_config['name']}: {e}")
        
        return topics
    
    def _create_dashboard(self, cloudwatch_client, client_name: str, environment: str,
                         config: Dict[str, Any]) -> str:
        """Create CloudWatch dashboard for client"""
        dashboard_name = f"{client_name}-{environment}-monitoring"
        
        # Build dashboard widgets
        widgets = []
        
        # Lambda metrics
        if config["client"].get("features", {}).get("checkin", {}).get("enabled"):
            widgets.extend(self._get_lambda_widgets(client_name, environment, "checkin"))
        
        if config["client"].get("features", {}).get("reservations", {}).get("enabled"):
            widgets.extend(self._get_lambda_widgets(client_name, environment, "reservations_sync_g4h"))
        
        if config["client"].get("features", {}).get("listings", {}).get("enabled"):
            widgets.extend(self._get_lambda_widgets(client_name, environment, "listings_sync_g4h"))
        
        # API Gateway metrics
        widgets.extend(self._get_api_gateway_widgets(client_name, environment))
        
        # DynamoDB metrics
        widgets.extend(self._get_dynamodb_widgets(client_name, environment))
        
        # S3 metrics
        widgets.extend(self._get_s3_widgets(client_name, environment))
        
        dashboard_body = {
            "widgets": widgets
        }
        
        if self.dry_run:
            print(f"[DRY RUN] Would create dashboard: {dashboard_name}")
            return dashboard_name
        
        try:
            cloudwatch_client.put_dashboard(
                DashboardName=dashboard_name,
                DashboardBody=json.dumps(dashboard_body)
            )
            print(f"  ✅ Created CloudWatch dashboard: {dashboard_name}")
            return dashboard_name
            
        except Exception as e:
            print(f"  ❌ Failed to create dashboard {dashboard_name}: {e}")
            raise
    
    def _get_lambda_widgets(self, client_name: str, environment: str, function_type: str) -> List[Dict]:
        """Get Lambda function monitoring widgets"""
        function_name = f"{client_name}-{environment}-lambda_{function_type}"
        
        return [
            {
                "type": "metric",
                "x": 0, "y": 0, "width": 12, "height": 6,
                "properties": {
                    "metrics": [
                        ["AWS/Lambda", "Duration", "FunctionName", function_name],
                        [".", "Invocations", ".", "."],
                        [".", "Errors", ".", "."],
                        [".", "Throttles", ".", "."]
                    ],
                    "period": 300,
                    "stat": "Average",
                    "region": "us-east-1",
                    "title": f"Lambda: {function_type}",
                    "view": "timeSeries"
                }
            },
            {
                "type": "metric",
                "x": 12, "y": 0, "width": 12, "height": 6,
                "properties": {
                    "metrics": [
                        ["AWS/Lambda", "ConcurrentExecutions", "FunctionName", function_name],
                        [".", "DeadLetterErrors", ".", "."]
                    ],
                    "period": 300,
                    "stat": "Maximum",
                    "region": "us-east-1",
                    "title": f"Lambda Concurrency: {function_type}",
                    "view": "timeSeries"
                }
            }
        ]
    
    def _get_api_gateway_widgets(self, client_name: str, environment: str) -> List[Dict]:
        """Get API Gateway monitoring widgets"""
        api_name = f"{client_name}-{environment}-api"
        
        return [
            {
                "type": "metric",
                "x": 0, "y": 6, "width": 12, "height": 6,
                "properties": {
                    "metrics": [
                        ["AWS/ApiGateway", "Count", "ApiName", api_name],
                        [".", "Latency", ".", "."],
                        [".", "4XXError", ".", "."],
                        [".", "5XXError", ".", "."]
                    ],
                    "period": 300,
                    "stat": "Sum",
                    "region": "us-east-1",
                    "title": "API Gateway Metrics",
                    "view": "timeSeries"
                }
            }
        ]
    
    def _get_dynamodb_widgets(self, client_name: str, environment: str) -> List[Dict]:
        """Get DynamoDB monitoring widgets"""
        table_name = f"{client_name}-main" if environment == "prod" else f"{client_name}-{environment}-main"
        
        return [
            {
                "type": "metric",
                "x": 12, "y": 6, "width": 12, "height": 6,
                "properties": {
                    "metrics": [
                        ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", table_name],
                        [".", "ConsumedWriteCapacityUnits", ".", "."],
                        [".", "ThrottledRequests", ".", "."],
                        [".", "SystemErrors", ".", "."]
                    ],
                    "period": 300,
                    "stat": "Sum",
                    "region": "us-east-1",
                    "title": "DynamoDB Metrics",
                    "view": "timeSeries"
                }
            }
        ]
    
    def _get_s3_widgets(self, client_name: str, environment: str) -> List[Dict]:
        """Get S3 monitoring widgets"""
        bucket_name = f"{client_name}-storage" if environment == "prod" else f"{client_name}-{environment}-storage"
        
        return [
            {
                "type": "metric",
                "x": 0, "y": 12, "width": 12, "height": 6,
                "properties": {
                    "metrics": [
                        ["AWS/S3", "NumberOfObjects", "BucketName", bucket_name, "StorageType", "AllStorageTypes"],
                        [".", "BucketSizeBytes", ".", ".", ".", "."]
                    ],
                    "period": 86400,
                    "stat": "Average",
                    "region": "us-east-1",
                    "title": "S3 Storage Metrics",
                    "view": "timeSeries"
                }
            }
        ]
    
    def _create_alarms(self, cloudwatch_client, client_name: str, environment: str,
                      config: Dict[str, Any], topic_arns: Dict[str, str]) -> List[str]:
        """Create CloudWatch alarms for client"""
        alarms = []
        
        # Get topic ARNs
        critical_topic = topic_arns.get(f"{client_name}-{environment}-critical-alerts")
        warning_topic = topic_arns.get(f"{client_name}-{environment}-warning-alerts")
        
        # Lambda alarms
        if config["client"].get("features", {}).get("checkin", {}).get("enabled"):
            alarms.extend(self._create_lambda_alarms(
                cloudwatch_client, client_name, environment, "checkin", 
                critical_topic, warning_topic
            ))
        
        # API Gateway alarms
        alarms.extend(self._create_api_gateway_alarms(
            cloudwatch_client, client_name, environment,
            critical_topic, warning_topic
        ))
        
        # DynamoDB alarms
        alarms.extend(self._create_dynamodb_alarms(
            cloudwatch_client, client_name, environment,
            critical_topic, warning_topic
        ))
        
        return alarms
    
    def _create_lambda_alarms(self, cloudwatch_client, client_name: str, environment: str,
                             function_type: str, critical_topic: str, warning_topic: str) -> List[str]:
        """Create Lambda function alarms"""
        function_name = f"{client_name}-{environment}-lambda_{function_type}"
        alarms = []
        
        alarm_configs = [
            {
                "name": f"{function_name}-high-duration",
                "description": f"High duration for {function_name}",
                "metric_name": "Duration",
                "threshold": self.default_thresholds["lambda_duration_ms"],
                "comparison": "GreaterThanThreshold",
                "topic": warning_topic,
                "statistic": "Average"
            },
            {
                "name": f"{function_name}-high-error-rate",
                "description": f"High error rate for {function_name}",
                "metric_name": "Errors",
                "threshold": self.default_thresholds["lambda_error_rate_percent"],
                "comparison": "GreaterThanThreshold", 
                "topic": critical_topic,
                "statistic": "Sum"
            }
        ]
        
        for alarm_config in alarm_configs:
            if self.dry_run:
                print(f"[DRY RUN] Would create alarm: {alarm_config['name']}")
                alarms.append(alarm_config['name'])
                continue
            
            try:
                cloudwatch_client.put_metric_alarm(
                    AlarmName=alarm_config["name"],
                    AlarmDescription=alarm_config["description"],
                    ActionsEnabled=True,
                    AlarmActions=[alarm_config["topic"]] if alarm_config["topic"] else [],
                    MetricName=alarm_config["metric_name"],
                    Namespace="AWS/Lambda",
                    Statistic=alarm_config["statistic"],
                    Dimensions=[
                        {"Name": "FunctionName", "Value": function_name}
                    ],
                    Period=300,
                    EvaluationPeriods=2,
                    Threshold=alarm_config["threshold"],
                    ComparisonOperator=alarm_config["comparison"]
                )
                alarms.append(alarm_config["name"])
                print(f"  ✅ Created alarm: {alarm_config['name']}")
                
            except Exception as e:
                print(f"  ❌ Failed to create alarm {alarm_config['name']}: {e}")
        
        return alarms
    
    def _create_api_gateway_alarms(self, cloudwatch_client, client_name: str, environment: str,
                                  critical_topic: str, warning_topic: str) -> List[str]:
        """Create API Gateway alarms"""
        api_name = f"{client_name}-{environment}-api"
        alarms = []
        
        alarm_configs = [
            {
                "name": f"{api_name}-high-latency",
                "description": f"High latency for {api_name}",
                "metric_name": "Latency",
                "threshold": self.default_thresholds["api_latency_ms"],
                "comparison": "GreaterThanThreshold",
                "topic": warning_topic,
                "statistic": "Average"
            },
            {
                "name": f"{api_name}-high-5xx-errors",
                "description": f"High 5XX error rate for {api_name}",
                "metric_name": "5XXError",
                "threshold": 10,
                "comparison": "GreaterThanThreshold",
                "topic": critical_topic,
                "statistic": "Sum"
            }
        ]
        
        for alarm_config in alarm_configs:
            if self.dry_run:
                print(f"[DRY RUN] Would create alarm: {alarm_config['name']}")
                alarms.append(alarm_config['name'])
                continue
            
            try:
                cloudwatch_client.put_metric_alarm(
                    AlarmName=alarm_config["name"],
                    AlarmDescription=alarm_config["description"],
                    ActionsEnabled=True,
                    AlarmActions=[alarm_config["topic"]] if alarm_config["topic"] else [],
                    MetricName=alarm_config["metric_name"],
                    Namespace="AWS/ApiGateway",
                    Statistic=alarm_config["statistic"],
                    Dimensions=[
                        {"Name": "ApiName", "Value": api_name}
                    ],
                    Period=300,
                    EvaluationPeriods=2,
                    Threshold=alarm_config["threshold"],
                    ComparisonOperator=alarm_config["comparison"]
                )
                alarms.append(alarm_config["name"])
                print(f"  ✅ Created alarm: {alarm_config['name']}")
                
            except Exception as e:
                print(f"  ❌ Failed to create alarm {alarm_config['name']}: {e}")
        
        return alarms
    
    def _create_dynamodb_alarms(self, cloudwatch_client, client_name: str, environment: str,
                               critical_topic: str, warning_topic: str) -> List[str]:
        """Create DynamoDB alarms"""
        table_name = f"{client_name}-main" if environment == "prod" else f"{client_name}-{environment}-main"
        alarms = []
        
        alarm_configs = [
            {
                "name": f"{table_name}-throttled-requests",
                "description": f"Throttled requests for {table_name}",
                "metric_name": "ThrottledRequests",
                "threshold": self.default_thresholds["dynamodb_throttle_count"],
                "comparison": "GreaterThanThreshold",
                "topic": critical_topic,
                "statistic": "Sum"
            }
        ]
        
        for alarm_config in alarm_configs:
            if self.dry_run:
                print(f"[DRY RUN] Would create alarm: {alarm_config['name']}")
                alarms.append(alarm_config['name'])
                continue
            
            try:
                cloudwatch_client.put_metric_alarm(
                    AlarmName=alarm_config["name"],
                    AlarmDescription=alarm_config["description"],
                    ActionsEnabled=True,
                    AlarmActions=[alarm_config["topic"]] if alarm_config["topic"] else [],
                    MetricName=alarm_config["metric_name"],
                    Namespace="AWS/DynamoDB",
                    Statistic=alarm_config["statistic"],
                    Dimensions=[
                        {"Name": "TableName", "Value": table_name}
                    ],
                    Period=300,
                    EvaluationPeriods=1,
                    Threshold=alarm_config["threshold"],
                    ComparisonOperator=alarm_config["comparison"]
                )
                alarms.append(alarm_config["name"])
                print(f"  ✅ Created alarm: {alarm_config['name']}")
                
            except Exception as e:
                print(f"  ❌ Failed to create alarm {alarm_config['name']}: {e}")
        
        return alarms
    
    def setup_all_clients_monitoring(self, environment: str = "prod") -> Dict[str, Any]:
        """Set up monitoring for all clients"""
        clients = self.config_manager.list_clients()
        results = {}
        
        for client_name in clients:
            try:
                result = self.setup_client_monitoring(client_name, environment)
                results[client_name] = result
            except Exception as e:
                print(f"❌ Failed to setup monitoring for {client_name}: {e}")
                results[client_name] = {"error": str(e)}
        
        return results


def main():
    """Main function for monitoring setup"""
    parser = argparse.ArgumentParser(description="Multi-Tenant Monitoring Setup")
    parser.add_argument("--client", help="Setup monitoring for specific client")
    parser.add_argument("--environment", default="prod", help="Environment (default: prod)")
    parser.add_argument("--all", action="store_true", help="Setup monitoring for all clients")
    parser.add_argument("--dry-run", action="store_true", help="Dry run mode")
    
    args = parser.parse_args()
    
    # Initialize monitoring setup
    monitoring = MonitoringSetup(dry_run=args.dry_run)
    
    if args.all:
        print("Setting up monitoring for all clients...")
        results = monitoring.setup_all_clients_monitoring(args.environment)
        
        # Print summary
        print(f"\n{'='*60}")
        print("MONITORING SETUP SUMMARY")
        print(f"{'='*60}")
        
        for client_name, result in results.items():
            if "error" in result:
                print(f"❌ {client_name}: {result['error']}")
            else:
                print(f"✅ {client_name}: {len(result.get('alarms', []))} alarms, {len(result.get('dashboards', []))} dashboards")
    
    elif args.client:
        print(f"Setting up monitoring for client: {args.client}")
        result = monitoring.setup_client_monitoring(args.client, args.environment)
        
        print(f"\n✅ Monitoring setup completed for {args.client}")
        print(f"   Dashboards: {len(result.get('dashboards', []))}")
        print(f"   Alarms: {len(result.get('alarms', []))}")
        print(f"   SNS Topics: {len(result.get('topics', []))}")
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
