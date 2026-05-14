"""
Frontend Configuration Generator
Generates public configuration for frontend applications from client config
"""
import json
import os
from typing import Dict, Any, Optional
from config_manager import ConfigManager


class FrontendConfigGenerator:
    """Generate frontend-safe configuration from client config"""
    
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
    
    def generate_frontend_config(self, client_name: str, env_name: str, 
                                aws_resources: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Generate frontend configuration from client config
        
        Args:
            client_name: Name of the client
            env_name: Environment name
            aws_resources: AWS resource identifiers (User Pool ID, etc.)
            
        Returns:
            Frontend-safe configuration dictionary
        """
        # Load client configuration
        config = self.config_manager.get_environment_config(client_name, env_name)
        client = config["client"]
        
        # Build frontend config
        frontend_config = {
            "client": {
                "name": client["name"],
                "displayName": client["displayName"],
                "description": client.get("description", ""),
                "environment": env_name
            },
            "api": self._build_api_config(client, env_name),
            "auth": self._build_auth_config(client, env_name, aws_resources),
            "features": self._build_features_config(client),
            "ui": self._build_ui_config(client),
            "integrations": self._build_integrations_config(client),
            "limits": self._build_limits_config(client)
        }
        
        return frontend_config
    
    def _build_api_config(self, client: Dict[str, Any], env_name: str) -> Dict[str, Any]:
        """Build API configuration"""
        domains = client.get("domains", {})
        
        # Determine API base URL
        if env_name == "prod":
            api_domain = domains.get("api", f"api.{domains.get('primary', 'example.com')}")
        else:
            api_domain = domains.get("api", f"api-{env_name}.{domains.get('primary', 'example.com')}")
        
        return {
            "baseUrl": f"https://{api_domain}",
            "version": "v1",
            "timeout": 30000,
            "endpoints": {
                "auth": "/auth",
                "users": "/admin/users",
                "listings": "/listings",
                "reservations": "/reservations",
                "checkin": "/checkin",
                "ttlock": "/ttlock",
                "config": "/system/config"
            }
        }
    
    def _build_auth_config(self, client: Dict[str, Any], env_name: str, 
                          aws_resources: Optional[Dict[str, str]]) -> Dict[str, Any]:
        """Build authentication configuration"""
        domains = client.get("domains", {})
        aws_config = client.get("aws", {})
        
        # Determine redirect URLs
        if env_name == "prod":
            admin_domain = domains.get("admin", f"admin.{domains.get('primary', 'example.com')}")
        else:
            admin_domain = domains.get("admin", f"admin-{env_name}.{domains.get('primary', 'example.com')}")
        
        auth_config = {
            "cognito": {
                "region": aws_config.get("region", "eu-central-1"),
                "redirectSignIn": f"https://{admin_domain}/auth/callback",
                "redirectSignOut": f"https://{admin_domain}/auth/logout",
                "scope": ["email", "openid", "profile"],
                "responseType": "code"
            },
            "tokenStorage": "localStorage",
            "autoRefresh": True,
            "sessionTimeout": 3600  # 1 hour
        }
        
        # Add AWS resource IDs if provided
        if aws_resources:
            auth_config["cognito"].update({
                "userPoolId": aws_resources.get("user_pool_id"),
                "userPoolWebClientId": aws_resources.get("user_pool_client_id"),
                "domain": aws_resources.get("cognito_domain")
            })
        
        return auth_config
    
    def _build_features_config(self, client: Dict[str, Any]) -> Dict[str, Any]:
        """Build features configuration"""
        features = client.get("features", {})
        
        return {
            "userManagement": features.get("userManagement", {}).get("enabled", True),
            "listingsManagement": features.get("listingsManagement", {}).get("enabled", True),
            "ttlockIntegration": features.get("ttlock", {}).get("enabled", True),
            "guestySync": features.get("guestySync", {}).get("enabled", True),
            "analytics": features.get("analytics", {}).get("enabled", True),
            "multiLanguage": features.get("multiLanguage", {}).get("enabled", False),
            "notifications": features.get("notifications", {}).get("enabled", True),
            "fileUpload": features.get("fileUpload", {}).get("enabled", True)
        }
    
    def _build_ui_config(self, client: Dict[str, Any]) -> Dict[str, Any]:
        """Build UI configuration"""
        branding = client.get("branding", {})
        
        return {
            "theme": client.get("name", "default"),
            "branding": {
                "primaryColor": branding.get("primaryColor", "#2563eb"),
                "secondaryColor": branding.get("secondaryColor", "#64748b"),
                "logo": branding.get("logo", {}).get("url", ""),
                "favicon": branding.get("favicon", "")
            },
            "layout": {
                "sidebar": "collapsible",
                "header": "fixed",
                "footer": "minimal"
            },
            "dateFormat": "DD/MM/YYYY",
            "timeFormat": "24h",
            "currency": "EUR",
            "language": "en"
        }
    
    def _build_integrations_config(self, client: Dict[str, Any]) -> Dict[str, Any]:
        """Build integrations configuration (public keys only)"""
        integrations = client.get("integrations", {})
        
        config = {}
        
        # Google Maps (public API key for frontend)
        if "googleMaps" in integrations:
            maps_config = integrations["googleMaps"]
            config["googleMaps"] = {
                "enabled": maps_config.get("enabled", False),
                "apiKey": maps_config.get("publicApiKey", "")  # Public key only
            }
        
        # Analytics (public tracking IDs)
        if "analytics" in integrations:
            analytics_config = integrations["analytics"]
            config["analytics"] = {
                "googleAnalytics": analytics_config.get("googleAnalytics", ""),
                "hotjar": analytics_config.get("hotjar", ""),
                "mixpanel": analytics_config.get("mixpanel", "")
            }
        
        # Payment (public keys only)
        if "payment" in integrations:
            payment_config = integrations["payment"]
            if "stripe" in payment_config:
                config["stripe"] = {
                    "publishableKey": payment_config["stripe"].get("publishableKey", "")
                }
        
        return config
    
    def _build_limits_config(self, client: Dict[str, Any]) -> Dict[str, Any]:
        """Build limits configuration"""
        features = client.get("features", {})
        
        return {
            "fileUpload": {
                "maxSize": features.get("fileUpload", {}).get("maxSize", 10485760),  # 10MB
                "allowedTypes": features.get("fileUpload", {}).get("allowedTypes", [
                    "image/jpeg", "image/png", "image/gif", "application/pdf"
                ])
            },
            "pagination": {
                "defaultPageSize": 20,
                "maxPageSize": 100
            },
            "api": {
                "requestTimeout": 30000,
                "retryAttempts": 3
            }
        }
    
    def save_frontend_config(self, client_name: str, env_name: str, 
                           aws_resources: Optional[Dict[str, str]] = None,
                           output_path: Optional[str] = None) -> str:
        """
        Generate and save frontend configuration to file
        
        Args:
            client_name: Name of the client
            env_name: Environment name
            aws_resources: AWS resource identifiers
            output_path: Output file path (optional)
            
        Returns:
            Path to saved configuration file
        """
        config = self.generate_frontend_config(client_name, env_name, aws_resources)
        
        if not output_path:
            output_path = f"config/clients/{client_name}/frontend-config-{env_name}.json"
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Save configuration
        with open(output_path, 'w') as f:
            json.dump(config, f, indent=2)
        
        return output_path


def generate_frontend_config_for_deployment(client_name: str, env_name: str, 
                                          aws_resources: Dict[str, str]) -> Dict[str, Any]:
    """
    Convenience function for CDK deployment
    
    Args:
        client_name: Name of the client
        env_name: Environment name
        aws_resources: AWS resource identifiers from CDK
        
    Returns:
        Frontend configuration dictionary
    """
    config_manager = ConfigManager()
    generator = FrontendConfigGenerator(config_manager)
    
    return generator.generate_frontend_config(client_name, env_name, aws_resources)


if __name__ == "__main__":
    # Example usage
    config_manager = ConfigManager()
    generator = FrontendConfigGenerator(config_manager)
    
    # Generate config for harmonest dev environment
    aws_resources = {
        "user_pool_id": "eu-central-1_XXXXXXXXX",
        "user_pool_client_id": "xxxxxxxxxxxxxxxxxxxxxxxxxx",
        "cognito_domain": "harmonest-auth.auth.eu-central-1.amazoncognito.com"
    }
    
    config_path = generator.save_frontend_config("harmonest", "dev", aws_resources)
    print(f"Frontend config saved to: {config_path}")
