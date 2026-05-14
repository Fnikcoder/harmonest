#!/usr/bin/env python3
"""
Client Configuration Manager

This module provides functionality to load, validate, and manage client configurations
for the multi-tenant hotel management system.
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional, List
import jsonschema
from jsonschema import validate, ValidationError


class ConfigurationError(Exception):
    """Custom exception for configuration-related errors"""
    pass


class ConfigManager:
    """Manages client configurations with validation and environment support"""
    
    def __init__(self, config_root: Optional[str] = None):
        """
        Initialize the configuration manager
        
        Args:
            config_root: Root directory for configurations (defaults to ./config)
        """
        if config_root is None:
            # Get the directory where this script is located
            script_dir = Path(__file__).parent
            config_root = script_dir
        
        self.config_root = Path(config_root)
        self.clients_dir = self.config_root / "clients"
        self.schema_dir = self.config_root / "schema"
        self.schema_file = self.schema_dir / "client-config.schema.json"
        
        # Load schema once
        self._schema = self._load_schema()
    
    def _load_schema(self) -> Dict[str, Any]:
        """Load the JSON schema for client configuration validation"""
        try:
            with open(self.schema_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            raise ConfigurationError(f"Schema file not found: {self.schema_file}")
        except json.JSONDecodeError as e:
            raise ConfigurationError(f"Invalid JSON in schema file: {e}")
    
    def list_clients(self) -> List[str]:
        """Get a list of all available client names"""
        if not self.clients_dir.exists():
            return []
        
        clients = []
        for client_dir in self.clients_dir.iterdir():
            if client_dir.is_dir() and (client_dir / "config.json").exists():
                clients.append(client_dir.name)
        
        return sorted(clients)
    
    def load_client_config(self, client_name: str, validate_config: bool = True) -> Dict[str, Any]:
        """
        Load configuration for a specific client
        
        Args:
            client_name: Name of the client
            validate_config: Whether to validate against schema
            
        Returns:
            Client configuration dictionary
            
        Raises:
            ConfigurationError: If client not found or configuration invalid
        """
        client_dir = self.clients_dir / client_name
        config_file = client_dir / "config.json"
        
        if not config_file.exists():
            raise ConfigurationError(f"Client configuration not found: {client_name}")
        
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
        except json.JSONDecodeError as e:
            raise ConfigurationError(f"Invalid JSON in client config {client_name}: {e}")
        
        if validate_config:
            self.validate_config(config, client_name)
        
        return config
    
    def save_client_config(self, client_name: str, config: Dict[str, Any], validate_config: bool = True) -> None:
        """
        Save configuration for a specific client
        
        Args:
            client_name: Name of the client
            config: Configuration dictionary
            validate_config: Whether to validate against schema
            
        Raises:
            ConfigurationError: If configuration is invalid
        """
        if validate_config:
            self.validate_config(config, client_name)
        
        client_dir = self.clients_dir / client_name
        client_dir.mkdir(parents=True, exist_ok=True)
        
        config_file = client_dir / "config.json"
        
        try:
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
        except Exception as e:
            raise ConfigurationError(f"Failed to save client config {client_name}: {e}")
    
    def validate_config(self, config: Dict[str, Any], client_name: str = "unknown") -> None:
        """
        Validate a configuration against the schema
        
        Args:
            config: Configuration to validate
            client_name: Name of client (for error messages)
            
        Raises:
            ConfigurationError: If configuration is invalid
        """
        try:
            validate(instance=config, schema=self._schema)
        except ValidationError as e:
            raise ConfigurationError(f"Invalid configuration for client {client_name}: {e.message}")
    
    def get_environment_config(self, client_name: str, env_name: str) -> Dict[str, Any]:
        """
        Get merged configuration for a specific client and environment
        
        Args:
            client_name: Name of the client
            env_name: Environment name (dev, staging, prod, etc.)
            
        Returns:
            Merged configuration with environment overrides applied
        """
        config = self.load_client_config(client_name)
        
        if env_name not in config.get("environments", {}):
            raise ConfigurationError(f"Environment '{env_name}' not found for client '{client_name}'")
        
        env_config = config["environments"][env_name]
        
        if not env_config.get("enabled", True):
            raise ConfigurationError(f"Environment '{env_name}' is disabled for client '{client_name}'")
        
        # Create merged configuration
        merged = config.copy()
        merged["current_environment"] = env_name
        
        # Apply environment-specific overrides
        if "aws" in env_config:
            merged["client"]["aws"].update(env_config["aws"])
        
        if "domains" in env_config:
            merged["client"]["domains"].update(env_config["domains"])
        
        if "features" in env_config:
            # Deep merge features
            for feature_name, feature_config in env_config["features"].items():
                if feature_name in merged["client"]["features"]:
                    merged["client"]["features"][feature_name].update(feature_config)
                else:
                    merged["client"]["features"][feature_name] = feature_config
        
        # Add environment-specific settings
        merged["environment"] = env_config
        
        return merged
    
    def get_resource_name(self, client_name: str, env_name: str, resource_type: str, suffix: str = "") -> str:
        """
        Generate standardized resource names
        
        Args:
            client_name: Name of the client
            env_name: Environment name
            resource_type: Type of resource (table, bucket, lambda, etc.)
            suffix: Optional suffix
            
        Returns:
            Standardized resource name
        """
        parts = [client_name]
        
        if env_name != "prod":
            parts.append(env_name)
        
        parts.append(resource_type)
        
        if suffix:
            parts.append(suffix)
        
        return "-".join(parts)
    
    def get_ssm_parameter_name(self, client_name: str, env_name: str, parameter_path: str) -> str:
        """
        Generate standardized SSM parameter names
        
        Args:
            client_name: Name of the client
            env_name: Environment name
            parameter_path: Parameter path (e.g., "table/name")
            
        Returns:
            Standardized SSM parameter name
        """
        return f"/{client_name}/{env_name}/{parameter_path}"
    
    def create_example_client(self, client_name: str) -> Dict[str, Any]:
        """
        Create an example client configuration
        
        Args:
            client_name: Name of the new client
            
        Returns:
            Example configuration dictionary
        """
        example_config = {
            "client": {
                "name": client_name,
                "displayName": client_name.title(),
                "description": f"Hotel management system for {client_name.title()}",
                "domains": {
                    "primary": f"{client_name}.com",
                    "www": f"www.{client_name}.com",
                    "dev": f"dev.{client_name}.com"
                },
                "email": {
                    "noreply": f"noreply@{client_name}.com",
                    "support": f"support@{client_name}.com",
                    "fromName": client_name.title()
                },
                "aws": {
                    "profile": f"{client_name}admin",
                    "region": "eu-central-1"
                },
                "integrations": {
                    "g4h": {
                        "origin": "https://app.guestyforhosts.com",
                        "appVersion": "6.x",
                        "platform": "browser--win32",
                        "deviceUuid": f"ypa-uuid-{client_name}"
                    }
                },
                "features": {
                    "checkin": {
                        "enabled": True,
                        "deadlineHours": 25,
                        "qrCodeEnabled": True,
                        "documentUpload": {
                            "enabled": True,
                            "maxSizeMB": 10,
                            "allowedTypes": ["image/jpeg", "image/png", "application/pdf"]
                        }
                    },
                    "reservations": {
                        "syncEnabled": True,
                        "syncIntervalMinutes": 30
                    },
                    "listings": {
                        "syncEnabled": True,
                        "publicListings": False
                    }
                }
            },
            "environments": {
                "dev": {
                    "enabled": True,
                    "scaling": {
                        "lambda": {
                            "memorySize": 256,
                            "timeout": 30
                        }
                    }
                },
                "prod": {
                    "enabled": True,
                    "scaling": {
                        "lambda": {
                            "memorySize": 512,
                            "timeout": 60
                        }
                    }
                }
            }
        }
        
        return example_config


def main():
    """CLI interface for configuration management"""
    if len(sys.argv) < 2:
        print("Usage: python config_manager.py <command> [args...]")
        print("Commands:")
        print("  list                    - List all clients")
        print("  validate <client>       - Validate client configuration")
        print("  show <client> [env]     - Show client configuration")
        print("  create <client>         - Create example client configuration")
        return
    
    config_manager = ConfigManager()
    command = sys.argv[1]
    
    try:
        if command == "list":
            clients = config_manager.list_clients()
            print("Available clients:")
            for client in clients:
                print(f"  - {client}")
        
        elif command == "validate":
            if len(sys.argv) < 3:
                print("Usage: python config_manager.py validate <client>")
                return
            
            client_name = sys.argv[2]
            config = config_manager.load_client_config(client_name, validate_config=True)
            print(f"✓ Configuration for '{client_name}' is valid")
        
        elif command == "show":
            if len(sys.argv) < 3:
                print("Usage: python config_manager.py show <client> [env]")
                return
            
            client_name = sys.argv[2]
            env_name = sys.argv[3] if len(sys.argv) > 3 else None
            
            if env_name:
                config = config_manager.get_environment_config(client_name, env_name)
            else:
                config = config_manager.load_client_config(client_name)
            
            print(json.dumps(config, indent=2))
        
        elif command == "create":
            if len(sys.argv) < 3:
                print("Usage: python config_manager.py create <client>")
                return
            
            client_name = sys.argv[2]
            example_config = config_manager.create_example_client(client_name)
            config_manager.save_client_config(client_name, example_config)
            print(f"✓ Created example configuration for '{client_name}'")
        
        else:
            print(f"Unknown command: {command}")
    
    except ConfigurationError as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
