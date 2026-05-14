"""
Client Configuration Utilities for Lambda Functions

This module provides utilities for Lambda functions to access client-specific
configuration through environment variables.
"""

import os
import json
from typing import Dict, Any, Optional


class ClientConfig:
    """Client configuration helper for Lambda functions"""
    
    def __init__(self):
        """Initialize client configuration from environment variables"""
        self._config = self._load_from_env()
    
    def _load_from_env(self) -> Dict[str, Any]:
        """Load configuration from environment variables"""
        config = {
            "client": {
                "name": os.getenv("CLIENT_NAME", "Harmonest"),
                "displayName": os.getenv("CLIENT_DISPLAY_NAME", "HarmoNest"),
            },
            "domains": {
                "primary": os.getenv("CLIENT_DOMAIN_PRIMARY", "harmonest.de"),
            },
            "email": {
                "noreply": os.getenv("CLIENT_EMAIL_NOREPLY", "noreply@harmonest.de"),
                "support": os.getenv("CLIENT_EMAIL_SUPPORT", "support@harmonest.de"),
                "fromName": os.getenv("CLIENT_EMAIL_FROM_NAME", "noreply@harmonest.de"),
            },
            "branding": {
                "primaryColor": os.getenv("CLIENT_BRANDING_PRIMARY_COLOR", "#2563eb"),
                "secondaryColor": os.getenv("CLIENT_BRANDING_SECONDARY_COLOR", "#64748b"),
            },
            "features": {
                "checkin": {
                    "enabled": os.getenv("CHECKIN_ENABLED", "true").lower() == "true",
                    "deadlineHours": int(os.getenv("CHECKIN_DEADLINE_HOURS", "25")),
                    "qrCodeEnabled": os.getenv("QR_CODE_ENABLED", "true").lower() == "true",
                },
                "reservations": {
                    "syncEnabled": os.getenv("RESERVATIONS_SYNC_ENABLED", "true").lower() == "true",
                    "syncInterval": int(os.getenv("RESERVATIONS_SYNC_INTERVAL", "30")),
                },
                "listings": {
                    "syncEnabled": os.getenv("LISTINGS_SYNC_ENABLED", "true").lower() == "true",
                    "publicListings": os.getenv("PUBLIC_LISTINGS_ENABLED", "false").lower() == "true",
                },
            },
            "g4h": {
                "origin": os.getenv("G4H_ORIGIN", "https://app.guestyforhosts.com"),
                "appVersion": os.getenv("G4H_APP_VERSION", "6.x"),
                "platform": os.getenv("G4H_PLATFORM", "browser--win32"),
                "deviceUuid": os.getenv("G4H_DEVICE_UUID", "ypa-uuid-lambda"),
            }
        }
        
        # Remove None values
        return self._clean_config(config)
    
    def _clean_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Remove None values from configuration"""
        if isinstance(config, dict):
            return {k: self._clean_config(v) for k, v in config.items() if v is not None}
        return config
    
    @property
    def client_name(self) -> str:
        """Get client name"""
        return self._config["client"]["name"]
    
    @property
    def client_display_name(self) -> str:
        """Get client display name"""
        return self._config["client"]["displayName"]
    
    @property
    def primary_domain(self) -> str:
        """Get primary domain"""
        return self._config["domains"]["primary"]
    
    @property
    def noreply_email(self) -> str:
        """Get no-reply email address"""
        return self._config["email"]["noreply"]
    
    @property
    def support_email(self) -> Optional[str]:
        """Get support email address"""
        return self._config["email"].get("support")
    
    @property
    def from_name(self) -> Optional[str]:
        """Get email from name"""
        return self._config["email"].get("fromName")
    
    @property
    def primary_color(self) -> str:
        """Get primary brand color"""
        return self._config["branding"]["primaryColor"]
    
    @property
    def secondary_color(self) -> str:
        """Get secondary brand color"""
        return self._config["branding"]["secondaryColor"]
    
    def is_feature_enabled(self, feature: str, subfeature: Optional[str] = None) -> bool:
        """Check if a feature is enabled"""
        features = self._config.get("features", {})
        
        if subfeature:
            return features.get(feature, {}).get(subfeature, False)
        
        return features.get(feature, {}).get("enabled", False)
    
    def get_feature_config(self, feature: str) -> Dict[str, Any]:
        """Get configuration for a specific feature"""
        return self._config.get("features", {}).get(feature, {})
    
    def get_g4h_config(self) -> Dict[str, Any]:
        """Get Guesty for Hosts configuration"""
        return self._config.get("g4h", {})
    
    def get_email_template_vars(self) -> Dict[str, str]:
        """Get variables for email templates"""
        return {
            "client_name": self.client_name,
            "client_display_name": self.client_display_name,
            "primary_domain": self.primary_domain,
            "support_email": self.support_email or f"support@{self.primary_domain}",
            "from_name": self.from_name or self.client_display_name,
            "primary_color": self.primary_color,
            "secondary_color": self.secondary_color,
        }
    
    def get_api_response_metadata(self) -> Dict[str, str]:
        """Get metadata for API responses"""
        return {
            "client": self.client_name,
            "dataSource": f"{self.client_name}_api",
            "version": "2.0",
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """Get full configuration as dictionary"""
        return self._config.copy()


# Global instance for easy access
client_config = ClientConfig()


def get_client_config() -> ClientConfig:
    """Get the global client configuration instance"""
    return client_config


def get_client_name() -> str:
    """Get client name (convenience function)"""
    return client_config.client_name


def get_client_display_name() -> str:
    """Get client display name (convenience function)"""
    return client_config.client_display_name


def is_feature_enabled(feature: str, subfeature: Optional[str] = None) -> bool:
    """Check if a feature is enabled (convenience function)"""
    return client_config.is_feature_enabled(feature, subfeature)


def get_email_template_vars() -> Dict[str, str]:
    """Get email template variables (convenience function)"""
    return client_config.get_email_template_vars()


def get_api_metadata() -> Dict[str, str]:
    """Get API response metadata (convenience function)"""
    return client_config.get_api_response_metadata()


# Example usage:
# from common.config import get_client_config, is_feature_enabled, get_email_template_vars
#
# config = get_client_config()
# if is_feature_enabled("checkin"):
#     deadline_hours = config.get_feature_config("checkin").get("deadlineHours", 25)
#
# template_vars = get_email_template_vars()
# email_subject = f"{template_vars['client_display_name']} - Verification Code"
