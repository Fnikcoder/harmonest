#!/usr/bin/env python3
"""
Dynamic Deployment Script for Multi-Tenant Hotel Management System

This script provides a convenient way to deploy client configurations
using the new dynamic configuration system. It integrates with the
comprehensive deployment pipeline for advanced features.
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path

# Add config directory to Python path
config_dir = Path(__file__).parent / "config"
sys.path.insert(0, str(config_dir))

from config.config_manager import ConfigManager, ConfigurationError

# Import pipeline for advanced deployment features
try:
    from scripts.pipeline import DeploymentPipeline
    PIPELINE_AVAILABLE = True
except ImportError:
    PIPELINE_AVAILABLE = False


def run_command(command, check=True):
    """Run a shell command and return the result"""
    print(f"Running: {command}")
    try:
        result = subprocess.run(command, shell=True, check=check, capture_output=True, text=True)
        if result.stdout:
            print(result.stdout)
        return result
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {e}")
        if e.stderr:
            print(f"Error output: {e.stderr}")
        raise


def validate_client_config(client_name):
    """Validate client configuration before deployment"""
    config_manager = ConfigManager()
    
    try:
        config = config_manager.load_client_config(client_name)
        print(f"✓ Configuration for '{client_name}' is valid")
        return config
    except ConfigurationError as e:
        print(f"✗ Configuration validation failed: {e}")
        return None


def deploy_client(client_name, env_name, stacks=None, profile=None, dry_run=False, use_pipeline=False):
    """Deploy a specific client configuration"""

    # Use advanced pipeline if available and requested
    if use_pipeline and PIPELINE_AVAILABLE:
        pipeline = DeploymentPipeline(dry_run=dry_run, verbose=True)
        return pipeline.deploy_client(client_name, env_name, stacks)

    # Validate configuration first
    config = validate_client_config(client_name)
    if not config:
        return False

    # Get AWS profile from config if not provided
    if not profile:
        profile = config["client"]["aws"]["profile"]

    # Build CDK command
    cdk_cmd = ["cdk"]

    if dry_run:
        cdk_cmd.append("synth")
    else:
        cdk_cmd.append("deploy")

    # Add stacks or deploy all
    if stacks:
        cdk_cmd.extend(stacks)
    else:
        cdk_cmd.append("--all")

    # Add context parameters
    cdk_cmd.extend([
        "--context", f"client={client_name}",
        "--context", f"env={env_name}",
        "--profile", profile
    ])

    # Add additional flags for deployment
    if not dry_run:
        cdk_cmd.extend([
            "--require-approval", "never",  # Auto-approve for automation
            "--progress", "events"
        ])

    command = " ".join(cdk_cmd)

    try:
        run_command(command)
        if dry_run:
            print(f"✓ Synthesis successful for {client_name} ({env_name})")
        else:
            print(f"✓ Deployment successful for {client_name} ({env_name})")
        return True
    except subprocess.CalledProcessError:
        print(f"✗ Deployment failed for {client_name} ({env_name})")
        return False


def list_clients():
    """List all available clients"""
    config_manager = ConfigManager()
    clients = config_manager.list_clients()
    
    if not clients:
        print("No clients configured.")
        return
    
    print("Available clients:")
    for client in clients:
        try:
            config = config_manager.load_client_config(client)
            display_name = config["client"]["displayName"]
            environments = list(config["environments"].keys())
            print(f"  - {client} ({display_name})")
            print(f"    Environments: {', '.join(environments)}")
        except Exception as e:
            print(f"  - {client} (error loading config: {e})")


def bootstrap_aws_environment(client_name, env_name):
    """Bootstrap AWS environment for CDK"""
    config = validate_client_config(client_name)
    if not config:
        return False
    
    profile = config["client"]["aws"]["profile"]
    region = config["client"]["aws"]["region"]
    account_id = config["client"]["aws"].get("accountId")
    
    print(f"Bootstrapping AWS environment for {client_name} ({env_name})")
    print(f"Profile: {profile}, Region: {region}")
    
    bootstrap_cmd = [
        "cdk", "bootstrap",
        "--profile", profile
    ]
    
    if account_id:
        bootstrap_cmd.extend([f"{account_id}/{region}"])
    
    command = " ".join(bootstrap_cmd)
    
    try:
        run_command(command)
        print(f"✓ Bootstrap successful for {client_name}")
        return True
    except subprocess.CalledProcessError:
        print(f"✗ Bootstrap failed for {client_name}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Deploy multi-tenant hotel management system")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # List command
    list_parser = subparsers.add_parser("list", help="List available clients")
    
    # Deploy command
    deploy_parser = subparsers.add_parser("deploy", help="Deploy client configuration")
    deploy_parser.add_argument("client", help="Client name")
    deploy_parser.add_argument("--env", default="prod", help="Environment (default: prod)")
    deploy_parser.add_argument("--stacks", nargs="+", help="Specific stacks to deploy")
    deploy_parser.add_argument("--profile", help="AWS profile (overrides config)")
    deploy_parser.add_argument("--dry-run", action="store_true", help="Synthesize only, don't deploy")
    deploy_parser.add_argument("--pipeline", action="store_true", help="Use advanced deployment pipeline")
    
    # Bootstrap command
    bootstrap_parser = subparsers.add_parser("bootstrap", help="Bootstrap AWS environment")
    bootstrap_parser.add_argument("client", help="Client name")
    bootstrap_parser.add_argument("--env", default="prod", help="Environment (default: prod)")
    
    # Validate command
    validate_parser = subparsers.add_parser("validate", help="Validate client configuration")
    validate_parser.add_argument("client", help="Client name")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    try:
        if args.command == "list":
            list_clients()
        
        elif args.command == "deploy":
            success = deploy_client(
                args.client,
                args.env,
                args.stacks,
                args.profile,
                args.dry_run,
                args.pipeline
            )
            sys.exit(0 if success else 1)
        
        elif args.command == "bootstrap":
            success = bootstrap_aws_environment(args.client, args.env)
            sys.exit(0 if success else 1)
        
        elif args.command == "validate":
            config = validate_client_config(args.client)
            sys.exit(0 if config else 1)
    
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
