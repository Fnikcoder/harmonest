# common/__init__.py
"""
Common utilities for Multi-Tenant Hotel Management System Lambdas.
Modules:
- g4h: Guesty session (legacy Guesty-for-hosts or Okta for app.guesty.com; see G4H_AUTH_MODE)
- guesty_adapters: map Guesty app API payloads to legacy-shaped rawData plus rawDataGuestyApp
- ddb: DynamoDB single-table helpers
- log: Logging setup
- config: Client configuration management
"""
__version__ = "2.0.0"
