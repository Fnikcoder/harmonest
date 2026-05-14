#!/usr/bin/env python3
"""
CDK Configuration Helper

This module provides CDK-specific configuration utilities for loading client
configurations and generating CDK context and resource names.
"""

import os
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional
from config_manager import ConfigManager, ConfigurationError


class CDKConfigHelper:
    """Helper class for CDK-specific configuration operations"""
    
    def __init__(self, config_root: Optional[str] = None):
        """Initialize the CDK configuration helper"""
        self.config_manager = ConfigManager(config_root)
    
    def get_client_from_context(self, app) -> str:
        """
        Get client name from CDK context
        
        Args:
            app: CDK App instance
            
        Returns:
            Client name
            
        Raises:
            ConfigurationError: If client not specified or not found
        """
        client_name = app.node.try_get_context("client")
        
        if not client_name:
            raise ConfigurationError(
                "Client name must be specified via CDK context. "
                "Use: cdk deploy --context client=<client-name>"
            )
        
        # Validate client exists
        available_clients = self.config_manager.list_clients()
        if client_name not in available_clients:
            raise ConfigurationError(
                f"Client '{client_name}' not found. Available clients: {', '.join(available_clients)}"
            )
        
        return client_name
    
    def get_environment_from_context(self, app) -> str:
        """
        Get environment name from CDK context
        
        Args:
            app: CDK App instance
            
        Returns:
            Environment name (defaults to 'prod')
        """
        return app.node.try_get_context("env") or "prod"
    
    def get_config_for_cdk(self, app) -> Dict[str, Any]:
        """
        Get merged configuration for CDK deployment
        
        Args:
            app: CDK App instance
            
        Returns:
            Merged configuration with CDK-specific additions
        """
        client_name = self.get_client_from_context(app)
        env_name = self.get_environment_from_context(app)
        
        config = self.config_manager.get_environment_config(client_name, env_name)
        
        # Add CDK-specific helpers
        config["cdk"] = {
            "client_name": client_name,
            "env_name": env_name,
            "stack_prefix": self._get_stack_prefix(client_name),
            "resource_prefix": self._get_resource_prefix(client_name, env_name)
        }
        
        return config
    
    def _get_stack_prefix(self, client_name: str) -> str:
        """Get standardized stack name prefix"""
        return client_name.title().replace("-", "")
    
    def _get_resource_prefix(self, client_name: str, env_name: str) -> str:
        """Get standardized resource name prefix"""
        if env_name == "prod":
            return client_name
        return f"{client_name}-{env_name}"
    
    def get_stack_name(self, client_name: str, env_name: str, stack_type: str) -> str:
        """
        Generate standardized stack names
        
        Args:
            client_name: Name of the client
            env_name: Environment name
            stack_type: Type of stack (Core, Api, Checkin, etc.)
            
        Returns:
            Standardized stack name
        """
        prefix = self._get_stack_prefix(client_name)
        suffix = env_name.title() if env_name != "prod" else "Prod"
        return f"{prefix}{stack_type}-{suffix}"
    
    def get_cors_origins(self, config: Dict[str, Any]) -> List[str]:
        """
        Get CORS origins from client configuration
        
        Args:
            config: Client configuration
            
        Returns:
            List of CORS origins
        """
        domains = config["client"]["domains"]
        origins = []
        
        # Add primary domains
        if "primary" in domains:
            origins.extend([
                f"https://{domains['primary']}",
                f"https://www.{domains['primary']}",
                f"https://checkin.{domains['primary']}",
                f"https://www.checkin.{domains['primary']}"
            ])
        
        # Add www domain if specified
        if "www" in domains:
            origins.append(f"https://{domains['www']}")

        
        # Add dev domain if specified
        if "dev" in domains:
            origins.extend([
                f"https://{domains['dev']}",
                f"https://www.{domains['dev']}",
                f"https://www.checkin.{domains['dev']}",
                f"https://checkin.{domains['dev']}"
            ])
        
        # Add staging domain if specified
        if "staging" in domains:
            origins.append(f"https://{domains['staging']}")
        
        # Add additional domains
        if "additional" in domains:
            for domain in domains["additional"]:
                origins.append(f"https://{domain}")
        
        # Add localhost for development
        origins.append("http://localhost:4200")
        origins.append("http://localhost:3000")
        origins.append("http://localhost:8080")
        origins.append(f"https://checkin.harmonest.de")
        origins.append(f"https://www.checkin.harmonest.de")
        return list(set(origins))  # Remove duplicates
    
    def get_lambda_environment_variables(self, config: Dict[str, Any]) -> Dict[str, str]:
        """
        Get Lambda environment variables from configuration
        
        Args:
            config: Client configuration
            
        Returns:
            Dictionary of environment variables
        """
        client = config["client"]
        env_vars = {}
        
        # G4H integration settings
        if "g4h" in client.get("integrations", {}):
            g4h = client["integrations"]["g4h"]
            env_vars.update({
                "G4H_ORIGIN": g4h.get("origin", "https://app.guestyforhosts.com"),
                "G4H_APP_VERSION": g4h.get("appVersion", "6.x"),
                "G4H_PLATFORM": g4h.get("platform", "browser--win32"),
                "G4H_DEVICE_UUID": g4h.get("deviceUuid", f"ypa-uuid-{client['name']}")
            })
        
        # Feature flags
        features = client.get("features", {})
        if "checkin" in features:
            checkin = features["checkin"]
            env_vars["CHECKIN_ENABLED"] = str(checkin.get("enabled", True)).lower()
            env_vars["CHECKIN_DEADLINE_HOURS"] = str(checkin.get("deadlineHours", 25))
            env_vars["QR_CODE_ENABLED"] = str(checkin.get("qrCodeEnabled", True)).lower()
        
        # Client identification
        env_vars["CLIENT_NAME"] = client["name"]
        env_vars["CLIENT_DISPLAY_NAME"] = client["displayName"]
        
        return env_vars
    
    def get_secret_names(self, client_name: str, env_name: str) -> Dict[str, str]:
        """
        Get standardized secret names
        
        Args:
            client_name: Name of the client
            env_name: Environment name
            
        Returns:
            Dictionary of secret names
        """
        return {
            "g4h_creds": f"{client_name}/{env_name}/guestyforhosts/creds",
            "g4h_session": f"{client_name}/{env_name}/guestyforhosts/webSession"
        }


def get_cdk_config(app) -> Dict[str, Any]:
    """
    Convenience function to get CDK configuration
    
    Args:
        app: CDK App instance
        
    Returns:
        Configuration dictionary for CDK
    """
    helper = CDKConfigHelper()
    return helper.get_config_for_cdk(app)


def main():
    """CLI interface for CDK configuration testing"""
    if len(sys.argv) < 3:
        print("Usage: python cdk_config.py <client> <env>")
        print("Example: python cdk_config.py harmonest prod")
        return
    
    client_name = sys.argv[1]
    env_name = sys.argv[2]
    
    try:
        # Mock CDK app context
        class MockApp:
            def __init__(self, client: str, env: str):
                self._context = {"client": client, "env": env}
            
            @property
            def node(self):
                return self
            
            def try_get_context(self, key: str):
                return self._context.get(key)
        
        app = MockApp(client_name, env_name)
        helper = CDKConfigHelper()
        config = helper.get_config_for_cdk(app)
        
        print("CDK Configuration:")
        print(f"  Client: {config['cdk']['client_name']}")
        print(f"  Environment: {config['cdk']['env_name']}")
        print(f"  Stack Prefix: {config['cdk']['stack_prefix']}")
        print(f"  Resource Prefix: {config['cdk']['resource_prefix']}")
        print()
        
        print("Stack Names:")
        for stack_type in ["Core", "Layer", "Secrets", "S3", "Api", "Checkin"]:
            stack_name = helper.get_stack_name(client_name, env_name, stack_type)
            print(f"  {stack_type}: {stack_name}")
        print()
        
        print("CORS Origins:")
        origins = helper.get_cors_origins(config)
        for origin in origins:
            print(f"  - {origin}")
        print()
        
        print("Lambda Environment Variables:")
        env_vars = helper.get_lambda_environment_variables(config)
        for key, value in env_vars.items():
            print(f"  {key}={value}")
        print()
        
        print("Secret Names:")
        secrets = helper.get_secret_names(client_name, env_name)
        for key, value in secrets.items():
            print(f"  {key}: {value}")
    
    except ConfigurationError as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
