#!/usr/bin/env python3
"""
Multi-Tenant Deployment Pipeline

Comprehensive deployment pipeline for managing multiple client configurations
with proper isolation, validation, and rollback capabilities.
"""

import os
import sys
import json
import subprocess
import time
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
import argparse

# Add config directory to Python path
project_root = Path(__file__).parent.parent
config_dir = project_root / "config"
sys.path.insert(0, str(config_dir))

from config.config_manager import ConfigManager, ConfigurationError


class DeploymentStatus(Enum):
    """Deployment status enumeration"""
    PENDING = "pending"
    VALIDATING = "validating"
    DEPLOYING = "deploying"
    DEPLOYED = "deployed"
    FAILED = "failed"
    ROLLING_BACK = "rolling_back"
    ROLLED_BACK = "rolled_back"


@dataclass
class DeploymentStep:
    """Individual deployment step"""
    name: str
    description: str
    command: str
    timeout: int = 300
    retry_count: int = 0
    max_retries: int = 2
    status: DeploymentStatus = DeploymentStatus.PENDING
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    output: str = ""
    error: str = ""
    
    @property
    def duration(self) -> float:
        if self.start_time and self.end_time:
            return self.end_time - self.start_time
        return 0.0


@dataclass
class DeploymentPlan:
    """Complete deployment plan for a client"""
    client_name: str
    environment: str
    config: Dict[str, Any]
    steps: List[DeploymentStep] = field(default_factory=list)
    status: DeploymentStatus = DeploymentStatus.PENDING
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    rollback_plan: Optional['DeploymentPlan'] = None
    
    @property
    def duration(self) -> float:
        if self.start_time and self.end_time:
            return self.end_time - self.start_time
        return 0.0
    
    @property
    def success_rate(self) -> float:
        if not self.steps:
            return 0.0
        successful = sum(1 for step in self.steps if step.status == DeploymentStatus.DEPLOYED)
        return (successful / len(self.steps)) * 100


class DeploymentPipeline:
    """Multi-tenant deployment pipeline"""
    
    def __init__(self, dry_run: bool = False, verbose: bool = False):
        """Initialize the deployment pipeline"""
        self.config_manager = ConfigManager()
        self.dry_run = dry_run
        self.verbose = verbose
        self.deployment_history: List[DeploymentPlan] = []
        
        # Pipeline configuration
        self.parallel_deployments = 3
        self.deployment_timeout = 1800  # 30 minutes
        self.health_check_timeout = 300  # 5 minutes
    
    def create_deployment_plan(self, client_name: str, environment: str, 
                             stacks: Optional[List[str]] = None) -> DeploymentPlan:
        """Create a deployment plan for a client"""
        try:
            # Load and validate configuration
            config = self.config_manager.load_client_config(client_name)
            env_config = self.config_manager.get_environment_config(client_name, environment)
            
            # Validate configuration
            self.config_manager.validate_config(config)
            
            plan = DeploymentPlan(
                client_name=client_name,
                environment=environment,
                config=config
            )
            
            # Add deployment steps
            self._add_validation_steps(plan)
            self._add_infrastructure_steps(plan, stacks)
            self._add_configuration_steps(plan)
            self._add_health_check_steps(plan)
            self._add_cleanup_steps(plan)
            
            return plan
            
        except Exception as e:
            raise Exception(f"Failed to create deployment plan for {client_name}/{environment}: {e}")
    
    def _add_validation_steps(self, plan: DeploymentPlan):
        """Add validation steps to deployment plan"""
        client_name = plan.client_name
        environment = plan.environment
        
        # Configuration validation
        plan.steps.append(DeploymentStep(
            name="validate_config",
            description="Validate client configuration",
            command=f"python config/config_manager.py validate {client_name}",
            timeout=60
        ))
        
        # AWS credentials validation
        aws_profile = plan.config["client"]["aws"]["profile"]
        plan.steps.append(DeploymentStep(
            name="validate_aws",
            description="Validate AWS credentials and permissions",
            command=f"aws sts get-caller-identity --profile {aws_profile}",
            timeout=30
        ))
        
        # CDK bootstrap check
        plan.steps.append(DeploymentStep(
            name="check_bootstrap",
            description="Check CDK bootstrap status",
            command=f"cdk doctor --profile {aws_profile}",
            timeout=60
        ))
    
    def _add_infrastructure_steps(self, plan: DeploymentPlan, stacks: Optional[List[str]]):
        """Add infrastructure deployment steps"""
        client_name = plan.client_name
        environment = plan.environment
        aws_profile = plan.config["client"]["aws"]["profile"]
        
        # CDK synthesis
        plan.steps.append(DeploymentStep(
            name="cdk_synth",
            description="Synthesize CDK stacks",
            command=f"cdk synth --context client={client_name} --context env={environment} --profile {aws_profile}",
            timeout=120
        ))
        
        # Stack deployment
        if stacks:
            stack_list = " ".join(stacks)
            deploy_cmd = f"cdk deploy {stack_list}"
        else:
            deploy_cmd = "cdk deploy --all"
        
        deploy_cmd += f" --context client={client_name} --context env={environment}"
        deploy_cmd += f" --profile {aws_profile} --require-approval never --progress events"
        
        plan.steps.append(DeploymentStep(
            name="cdk_deploy",
            description="Deploy CDK stacks",
            command=deploy_cmd,
            timeout=1200,  # 20 minutes
            max_retries=1
        ))
    
    def _add_configuration_steps(self, plan: DeploymentPlan):
        """Add configuration steps"""
        client_name = plan.client_name
        environment = plan.environment
        aws_profile = plan.config["client"]["aws"]["profile"]
        
        # Update secrets if needed
        plan.steps.append(DeploymentStep(
            name="update_secrets",
            description="Update secrets in AWS Secrets Manager",
            command=f"python scripts/update-secrets.py --client {client_name} --env {environment} --profile {aws_profile}",
            timeout=120
        ))
        
        # Warm up Lambda functions
        plan.steps.append(DeploymentStep(
            name="warm_lambdas",
            description="Warm up Lambda functions",
            command=f"python scripts/warm-lambdas.py --client {client_name} --env {environment} --profile {aws_profile}",
            timeout=180
        ))
    
    def _add_health_check_steps(self, plan: DeploymentPlan):
        """Add health check steps"""
        client_name = plan.client_name
        environment = plan.environment
        
        # API health check
        plan.steps.append(DeploymentStep(
            name="health_check",
            description="Perform health checks on deployed services",
            command=f"python scripts/health-check.py --client {client_name} --env {environment}",
            timeout=300,
            max_retries=3
        ))
        
        # Integration tests
        plan.steps.append(DeploymentStep(
            name="integration_tests",
            description="Run integration tests",
            command=f"python -m pytest tests/test_integration.py --client {client_name} --env {environment} -v",
            timeout=600
        ))
    
    def _add_cleanup_steps(self, plan: DeploymentPlan):
        """Add cleanup steps"""
        # Clean up temporary files
        plan.steps.append(DeploymentStep(
            name="cleanup",
            description="Clean up temporary files and resources",
            command="python scripts/cleanup.py",
            timeout=60
        ))
    
    def execute_step(self, step: DeploymentStep) -> bool:
        """Execute a single deployment step"""
        step.start_time = time.time()
        step.status = DeploymentStatus.DEPLOYING
        
        if self.verbose:
            print(f"  Executing: {step.description}")
            print(f"  Command: {step.command}")
        
        if self.dry_run:
            print(f"  [DRY RUN] Would execute: {step.command}")
            step.status = DeploymentStatus.DEPLOYED
            step.end_time = time.time()
            return True
        
        try:
            # Execute command with timeout
            result = subprocess.run(
                step.command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=step.timeout
            )
            
            step.output = result.stdout
            step.error = result.stderr
            step.end_time = time.time()
            
            if result.returncode == 0:
                step.status = DeploymentStatus.DEPLOYED
                return True
            else:
                step.status = DeploymentStatus.FAILED
                if self.verbose:
                    print(f"  Error: {step.error}")
                return False
                
        except subprocess.TimeoutExpired:
            step.status = DeploymentStatus.FAILED
            step.error = f"Command timed out after {step.timeout} seconds"
            step.end_time = time.time()
            return False
        except Exception as e:
            step.status = DeploymentStatus.FAILED
            step.error = str(e)
            step.end_time = time.time()
            return False
    
    def execute_deployment_plan(self, plan: DeploymentPlan) -> bool:
        """Execute a complete deployment plan"""
        plan.start_time = time.time()
        plan.status = DeploymentStatus.DEPLOYING
        
        print(f"Executing deployment plan for {plan.client_name}/{plan.environment}")
        print(f"Total steps: {len(plan.steps)}")
        
        success = True
        
        for i, step in enumerate(plan.steps, 1):
            print(f"\nStep {i}/{len(plan.steps)}: {step.description}")
            
            # Retry logic
            step_success = False
            for attempt in range(step.max_retries + 1):
                if attempt > 0:
                    print(f"  Retry attempt {attempt}/{step.max_retries}")
                    step.retry_count = attempt
                
                step_success = self.execute_step(step)
                
                if step_success:
                    print(f"  ✅ Completed in {step.duration:.1f}s")
                    break
                else:
                    print(f"  ❌ Failed: {step.error}")
                    if attempt < step.max_retries:
                        print(f"  Retrying in 10 seconds...")
                        time.sleep(10)
            
            if not step_success:
                success = False
                print(f"  ❌ Step failed after {step.max_retries + 1} attempts")
                break
        
        plan.end_time = time.time()
        plan.status = DeploymentStatus.DEPLOYED if success else DeploymentStatus.FAILED
        
        # Add to deployment history
        self.deployment_history.append(plan)
        
        return success
    
    def create_rollback_plan(self, original_plan: DeploymentPlan) -> DeploymentPlan:
        """Create a rollback plan for a failed deployment"""
        rollback_plan = DeploymentPlan(
            client_name=original_plan.client_name,
            environment=original_plan.environment,
            config=original_plan.config
        )
        
        # Add rollback steps (reverse order of deployment)
        client_name = original_plan.client_name
        environment = original_plan.environment
        aws_profile = original_plan.config["client"]["aws"]["profile"]
        
        # Rollback infrastructure
        rollback_plan.steps.append(DeploymentStep(
            name="rollback_stacks",
            description="Rollback CDK stacks to previous version",
            command=f"cdk deploy --previous-parameters --context client={client_name} --context env={environment} --profile {aws_profile}",
            timeout=900
        ))
        
        # Restore previous configuration
        rollback_plan.steps.append(DeploymentStep(
            name="restore_config",
            description="Restore previous configuration",
            command=f"python scripts/restore-config.py --client {client_name} --env {environment}",
            timeout=120
        ))
        
        # Health check after rollback
        rollback_plan.steps.append(DeploymentStep(
            name="rollback_health_check",
            description="Verify system health after rollback",
            command=f"python scripts/health-check.py --client {client_name} --env {environment}",
            timeout=300
        ))
        
        return rollback_plan
    
    def deploy_client(self, client_name: str, environment: str = "prod", 
                     stacks: Optional[List[str]] = None, auto_rollback: bool = True) -> bool:
        """Deploy a single client with optional rollback"""
        try:
            # Create deployment plan
            plan = self.create_deployment_plan(client_name, environment, stacks)
            
            # Execute deployment
            success = self.execute_deployment_plan(plan)
            
            if not success and auto_rollback:
                print(f"\n🔄 Deployment failed. Initiating rollback for {client_name}/{environment}")
                
                # Create and execute rollback plan
                rollback_plan = self.create_rollback_plan(plan)
                rollback_success = self.execute_deployment_plan(rollback_plan)
                
                if rollback_success:
                    print(f"✅ Rollback completed successfully for {client_name}/{environment}")
                    plan.status = DeploymentStatus.ROLLED_BACK
                else:
                    print(f"❌ Rollback failed for {client_name}/{environment}")
                    plan.status = DeploymentStatus.FAILED
            
            return success
            
        except Exception as e:
            print(f"❌ Deployment error for {client_name}/{environment}: {e}")
            return False
    
    def deploy_multiple_clients(self, client_configs: List[Dict[str, Any]], 
                               parallel: bool = False) -> Dict[str, bool]:
        """Deploy multiple clients"""
        results = {}
        
        if parallel and len(client_configs) > 1:
            # Parallel deployment (simplified - would use threading in real implementation)
            print(f"🚀 Starting parallel deployment of {len(client_configs)} clients")
            
            for config in client_configs:
                client_name = config["client_name"]
                environment = config.get("environment", "prod")
                stacks = config.get("stacks")
                
                success = self.deploy_client(client_name, environment, stacks)
                results[f"{client_name}/{environment}"] = success
        else:
            # Sequential deployment
            print(f"🚀 Starting sequential deployment of {len(client_configs)} clients")
            
            for config in client_configs:
                client_name = config["client_name"]
                environment = config.get("environment", "prod")
                stacks = config.get("stacks")
                
                print(f"\n{'='*60}")
                print(f"Deploying {client_name}/{environment}")
                print(f"{'='*60}")
                
                success = self.deploy_client(client_name, environment, stacks)
                results[f"{client_name}/{environment}"] = success
                
                if not success:
                    print(f"❌ Deployment failed for {client_name}/{environment}")
                    # Optionally stop on first failure
                    # break
        
        return results
    
    def generate_deployment_report(self) -> str:
        """Generate a deployment report"""
        if not self.deployment_history:
            return "No deployments in history."
        
        report_lines = []
        report_lines.append("# Deployment Pipeline Report")
        report_lines.append("")
        report_lines.append(f"**Generated:** {time.strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append(f"**Total Deployments:** {len(self.deployment_history)}")
        report_lines.append("")
        
        # Summary statistics
        successful = sum(1 for plan in self.deployment_history if plan.status == DeploymentStatus.DEPLOYED)
        failed = sum(1 for plan in self.deployment_history if plan.status == DeploymentStatus.FAILED)
        rolled_back = sum(1 for plan in self.deployment_history if plan.status == DeploymentStatus.ROLLED_BACK)
        
        report_lines.append("## Summary")
        report_lines.append(f"- **Successful:** {successful}")
        report_lines.append(f"- **Failed:** {failed}")
        report_lines.append(f"- **Rolled Back:** {rolled_back}")
        report_lines.append(f"- **Success Rate:** {(successful / len(self.deployment_history) * 100):.1f}%")
        report_lines.append("")
        
        # Detailed results
        report_lines.append("## Deployment Details")
        report_lines.append("")
        report_lines.append("| Client/Env | Status | Duration | Steps | Success Rate |")
        report_lines.append("|------------|--------|----------|-------|--------------|")
        
        for plan in self.deployment_history:
            status_icon = {
                DeploymentStatus.DEPLOYED: "✅",
                DeploymentStatus.FAILED: "❌",
                DeploymentStatus.ROLLED_BACK: "🔄"
            }.get(plan.status, "❓")
            
            report_lines.append(
                f"| {plan.client_name}/{plan.environment} | {status_icon} {plan.status.value} | "
                f"{plan.duration:.1f}s | {len(plan.steps)} | {plan.success_rate:.1f}% |"
            )
        
        report_lines.append("")
        
        return "\n".join(report_lines)


def main():
    """Main function for deployment pipeline"""
    parser = argparse.ArgumentParser(description="Multi-Tenant Deployment Pipeline")
    parser.add_argument("--client", help="Deploy specific client")
    parser.add_argument("--env", default="prod", help="Environment to deploy")
    parser.add_argument("--stacks", nargs="+", help="Specific stacks to deploy")
    parser.add_argument("--all", action="store_true", help="Deploy all clients")
    parser.add_argument("--parallel", action="store_true", help="Deploy clients in parallel")
    parser.add_argument("--dry-run", action="store_true", help="Dry run mode")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    parser.add_argument("--no-rollback", action="store_true", help="Disable automatic rollback")
    parser.add_argument("--report", help="Generate deployment report to file")
    
    args = parser.parse_args()
    
    # Initialize pipeline
    pipeline = DeploymentPipeline(dry_run=args.dry_run, verbose=args.verbose)
    
    if args.all:
        # Deploy all clients
        config_manager = ConfigManager()
        clients = config_manager.list_clients()
        
        client_configs = []
        for client_name in clients:
            client_configs.append({
                "client_name": client_name,
                "environment": args.env,
                "stacks": args.stacks
            })
        
        results = pipeline.deploy_multiple_clients(client_configs, args.parallel)
        
        # Print summary
        print(f"\n{'='*60}")
        print("DEPLOYMENT SUMMARY")
        print(f"{'='*60}")
        
        for client_env, success in results.items():
            status = "✅ SUCCESS" if success else "❌ FAILED"
            print(f"{client_env}: {status}")
    
    elif args.client:
        # Deploy specific client
        success = pipeline.deploy_client(
            args.client, 
            args.env, 
            args.stacks, 
            auto_rollback=not args.no_rollback
        )
        
        if success:
            print(f"\n✅ Deployment successful for {args.client}/{args.env}")
        else:
            print(f"\n❌ Deployment failed for {args.client}/{args.env}")
            sys.exit(1)
    
    else:
        parser.print_help()
        return
    
    # Generate report if requested
    if args.report:
        report = pipeline.generate_deployment_report()
        with open(args.report, 'w') as f:
            f.write(report)
        print(f"\nDeployment report saved to: {args.report}")


if __name__ == "__main__":
    main()
