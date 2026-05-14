#!/usr/bin/env python3
"""
Dynamic Documentation Generator

Generates client-specific documentation based on configuration settings.
"""

import os
import sys
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from jinja2 import Environment, FileSystemLoader, Template
import argparse

# Add config directory to Python path
project_root = Path(__file__).parent.parent
config_dir = project_root / "config"
sys.path.insert(0, str(config_dir))

from config.config_manager import ConfigManager, ConfigurationError


class DocumentationGenerator:
    """Generates dynamic documentation for clients"""
    
    def __init__(self, output_dir: Optional[str] = None):
        """Initialize the documentation generator"""
        self.config_manager = ConfigManager()
        self.docs_dir = Path(__file__).parent
        self.templates_dir = self.docs_dir / "templates"
        self.output_dir = Path(output_dir) if output_dir else self.docs_dir / "generated"
        
        # Ensure directories exist
        self.templates_dir.mkdir(exist_ok=True)
        self.output_dir.mkdir(exist_ok=True)
        
        # Set up Jinja2 environment
        self.jinja_env = Environment(
            loader=FileSystemLoader(str(self.templates_dir)),
            trim_blocks=True,
            lstrip_blocks=True
        )
        
        # Create default templates if they don't exist
        self._create_default_templates()
    
    def _create_default_templates(self):
        """Create default documentation templates"""
        templates = {
            "client_overview.md.j2": self._get_client_overview_template(),
            "api_documentation.md.j2": self._get_api_documentation_template(),
            "deployment_guide.md.j2": self._get_deployment_guide_template(),
            "configuration_reference.md.j2": self._get_configuration_reference_template(),
            "troubleshooting.md.j2": self._get_troubleshooting_template()
        }
        
        for template_name, content in templates.items():
            template_file = self.templates_dir / template_name
            if not template_file.exists():
                with open(template_file, 'w', encoding='utf-8') as f:
                    f.write(content)
    
    def _get_client_overview_template(self) -> str:
        """Get client overview template"""
        return """# {{ client.displayName }} - System Overview

## Client Information
- **Client Name:** {{ client.name }}
- **Display Name:** {{ client.displayName }}
- **Primary Domain:** {{ client.domains.primary }}
{% if client.description %}
- **Description:** {{ client.description }}
{% endif %}

## Contact Information
- **No-Reply Email:** {{ client.email.noreply }}
{% if client.email.support %}
- **Support Email:** {{ client.email.support }}
{% endif %}
{% if client.email.admin %}
- **Admin Email:** {{ client.email.admin }}
{% endif %}

## Domains
- **Primary:** {{ client.domains.primary }}
{% if client.domains.www %}
- **WWW:** {{ client.domains.www }}
{% endif %}
{% if client.domains.dev %}
- **Development:** {{ client.domains.dev }}
{% endif %}
{% if client.domains.staging %}
- **Staging:** {{ client.domains.staging }}
{% endif %}
{% if client.domains.api %}
- **API:** {{ client.domains.api }}
{% endif %}
{% if client.domains.admin %}
- **Admin:** {{ client.domains.admin }}
{% endif %}
{% if client.domains.additional %}
- **Additional Domains:**
{% for domain in client.domains.additional %}
  - {{ domain }}
{% endfor %}
{% endif %}

## Features
{% for feature_name, feature_config in client.features.items() %}
### {{ feature_name.title() }}
- **Enabled:** {{ "✅ Yes" if feature_config.enabled else "❌ No" }}
{% if feature_name == "checkin" and feature_config.enabled %}
- **Deadline Hours:** {{ feature_config.deadlineHours | default(25) }}
- **QR Code Enabled:** {{ "✅ Yes" if feature_config.qrCodeEnabled else "❌ No" }}
{% endif %}
{% if feature_name == "reservations" and feature_config.enabled %}
- **Sync Enabled:** {{ "✅ Yes" if feature_config.syncEnabled else "❌ No" }}
- **Sync Interval:** {{ feature_config.syncIntervalMinutes | default(30) }} minutes
{% endif %}
{% if feature_name == "listings" and feature_config.enabled %}
- **Sync Enabled:** {{ "✅ Yes" if feature_config.syncEnabled else "❌ No" }}
- **Public Listings:** {{ "✅ Yes" if feature_config.publicListings else "❌ No" }}
{% endif %}

{% endfor %}

## Environments
{% for env_name, env_config in environments.items() %}
### {{ env_name.upper() }}
- **Enabled:** {{ "✅ Yes" if env_config.enabled else "❌ No" }}
{% if env_config.scaling and env_config.scaling.lambda %}
- **Lambda Memory:** {{ env_config.scaling.lambda.memorySize | default(512) }}MB
- **Lambda Timeout:** {{ env_config.scaling.lambda.timeout | default(60) }}s
{% endif %}

{% endfor %}

## AWS Configuration
- **Profile:** {{ client.aws.profile }}
- **Region:** {{ client.aws.region }}
{% if client.aws.accountId %}
- **Account ID:** {{ client.aws.accountId }}
{% endif %}
{% if client.aws.kmsKeyId %}
- **KMS Key ID:** {{ client.aws.kmsKeyId }}
{% endif %}

---
*Generated on {{ generation_date }} for {{ client.name }}*
"""
    
    def _get_api_documentation_template(self) -> str:
        """Get API documentation template"""
        return """# {{ client.displayName }} - API Documentation

## Base URL
```
{{ api_base_url | default("https://" + client.domains.primary + "/api") }}
```

## Authentication
All API requests should include the following headers:
```
Content-Type: application/json
X-Client-Name: {{ client.name }}
```

## Check-in API
{% if client.features.checkin.enabled %}
### POST /checkin
Submit or validate check-in information.

#### Validate Reservation
```json
{
  "operation": "validate",
  "reservationCode": "ABC123",
  "guestFirstName": "John"
}
```

#### Submit Check-in
```json
{
  "operation": "submit",
  "reservationId": "RES001",
  "guestName": "John",
  "guestLastName": "Doe",
  "guestEmail": "john@example.com",
  "guestPhone": "+1234567890",
  "estimatedArrival": "14:00",
  "specialRequests": "Late check-in please"
}
```

### GET /checkin
Get check-in status for a reservation.

**Parameters:**
- `reservationId` (required): The reservation ID

### PUT /checkin
Update check-in information.

**Note:** Updates are not allowed within {{ client.features.checkin.deadlineHours | default(25) }} hours of check-in time.

```json
{
  "reservationId": "RES001",
  "guestPhone": "+1987654321",
  "specialRequests": "Updated request"
}
```
{% else %}
*Check-in feature is disabled for this client.*
{% endif %}

## Public Listings API
{% if client.features.listings.enabled %}
### GET /public/listings
Get public listings information.

**Response:**
```json
{
  "client": "{{ client.name }}",
  "dataSource": "{{ client.name }}_api",
  "totalGroups": 10,
  "totalRooms": 25,
  "lastUpdated": "2024-01-01T00:00:00Z",
  "success": true
}
```

{% if client.features.listings.publicListings %}
### GET /public/listings/search
Search available listings.

**Parameters:**
- `maxGuests`: Maximum number of guests
- `checkIn`: Check-in date (YYYY-MM-DD)
- `checkOut`: Check-out date (YYYY-MM-DD)

### GET /public/listings/{listingId}
Get details for a specific listing.
{% else %}
*Public listings are disabled for this client.*
{% endif %}
{% else %}
*Listings feature is disabled for this client.*
{% endif %}

## Email Verification API
### POST /email/verification
Send or verify email codes.

#### Send Verification Code
```json
{
  "operation": "send",
  "email": "user@{{ client.domains.primary }}",
  "type": "checkin"
}
```

#### Verify Code
```json
{
  "operation": "verify",
  "email": "user@{{ client.domains.primary }}",
  "code": "123456"
}
```

## Error Responses
All endpoints return errors in the following format:
```json
{
  "success": false,
  "message": "Error description",
  "errorCode": "ERROR_CODE",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Rate Limiting
API requests are rate-limited per client. Contact {{ client.email.support | default(client.email.noreply) }} if you need higher limits.

---
*Generated on {{ generation_date }} for {{ client.name }}*
"""
    
    def _get_deployment_guide_template(self) -> str:
        """Get deployment guide template"""
        return """# {{ client.displayName }} - Deployment Guide

## Prerequisites
- AWS CLI configured with profile: `{{ client.aws.profile }}`
- CDK installed and bootstrapped
- Python 3.12+ for Lambda functions
- Node.js 18+ for CDK

## Quick Deployment
```bash
# Deploy all stacks
python deploy.py deploy {{ client.name }} --env prod

# Deploy specific environment
python deploy.py deploy {{ client.name }} --env dev

# Dry run (synthesis only)
python deploy.py deploy {{ client.name }} --dry-run
```

## Manual Deployment
```bash
# Set context and deploy
cdk deploy --all \\
  --context client={{ client.name }} \\
  --context env=prod \\
  --profile {{ client.aws.profile }}
```

## Environment-Specific Deployment
{% for env_name, env_config in environments.items() %}
### {{ env_name.upper() }} Environment
{% if env_config.enabled %}
```bash
python deploy.py deploy {{ client.name }} --env {{ env_name }}
```

**Configuration:**
{% if env_config.scaling and env_config.scaling.lambda %}
- Lambda Memory: {{ env_config.scaling.lambda.memorySize | default(512) }}MB
- Lambda Timeout: {{ env_config.scaling.lambda.timeout | default(60) }}s
{% endif %}
{% else %}
*This environment is disabled.*
{% endif %}

{% endfor %}

## Resource Names
The following resources will be created:

### DynamoDB
- Table: `{{ client.name }}-main` (prod) or `{{ client.name }}-{env}-main`

### S3
- Bucket: `{{ client.name }}-storage` (prod) or `{{ client.name }}-{env}-storage`

### Lambda Functions
- Check-in: `{{ client.name }}-{env}-lambda_checkin`
{% if client.features.listings.enabled %}
- Listings Sync: `{{ client.name }}-{env}-lambda_listings_sync_g4h`
{% endif %}
{% if client.features.reservations.enabled %}
- Reservations Sync: `{{ client.name }}-{env}-lambda_reservations_sync_g4h`
{% endif %}

### API Gateway
- API: `{{ client.name }}-{env}-api`

### Secrets Manager
- G4H Credentials: `{{ client.name }}/{env}/guestyforhosts/creds`
- G4H Session: `{{ client.name }}/{env}/guestyforhosts/webSession`

## Post-Deployment Configuration

### 1. Update Secrets
```bash
# Update G4H credentials
aws secretsmanager put-secret-value \\
  --secret-id {{ client.name }}/prod/guestyforhosts/creds \\
  --secret-string '{"username":"your-username","password":"your-password"}' \\
  --profile {{ client.aws.profile }}
```

### 2. Configure DNS
Point your domains to the API Gateway:
- {{ client.domains.primary }} → API Gateway URL
{% if client.domains.api %}
- {{ client.domains.api }} → API Gateway URL
{% endif %}

### 3. Test Deployment
```bash
# Test API health
curl https://{{ client.domains.primary }}/health

# Test check-in validation
curl -X POST https://{{ client.domains.primary }}/checkin \\
  -H "Content-Type: application/json" \\
  -d '{"operation":"validate","reservationCode":"TEST123","guestFirstName":"Test"}'
```

## Monitoring
- CloudWatch Logs: `/aws/lambda/{{ client.name }}-{env}-*`
- CloudWatch Metrics: Custom metrics for {{ client.name }}
- API Gateway Logs: `/aws/apigateway/{{ client.name }}-{env}-api`

## Troubleshooting
See [Troubleshooting Guide](troubleshooting.md) for common issues and solutions.

---
*Generated on {{ generation_date }} for {{ client.name }}*
"""
    
    def _get_configuration_reference_template(self) -> str:
        """Get configuration reference template"""
        return """# {{ client.displayName }} - Configuration Reference

## Current Configuration
```json
{{ config_json | indent(width=2) }}
```

## Configuration Schema

### Client Section
- `name`: Unique client identifier (lowercase, alphanumeric, hyphens)
- `displayName`: Human-readable client name
- `description`: Optional client description
- `domains`: Domain configuration
- `email`: Email addresses for notifications
- `aws`: AWS-specific settings
- `features`: Feature flags and settings

### Domains
- `primary`: Main domain for the client (required)
- `www`: WWW subdomain
- `dev`: Development environment domain
- `staging`: Staging environment domain
- `api`: API-specific domain
- `admin`: Admin interface domain
- `additional`: Array of additional domains

### Email Configuration
- `noreply`: No-reply email address (required)
- `support`: Support email address
- `admin`: Admin email address
- `notifications`: Notifications email address
- `fromName`: Display name for outgoing emails

### AWS Configuration
- `profile`: AWS CLI profile name (required)
- `region`: AWS region (required)
- `accountId`: AWS account ID (optional)
- `kmsKeyId`: KMS key for encryption (optional)

### Features

#### Check-in Feature
```json
{
  "checkin": {
    "enabled": true,
    "deadlineHours": 25,
    "qrCodeEnabled": true,
    "documentUpload": {
      "enabled": true,
      "maxSizeMB": 10,
      "allowedTypes": ["pdf", "jpg", "png"]
    }
  }
}
```

#### Reservations Feature
```json
{
  "reservations": {
    "syncEnabled": true,
    "syncIntervalMinutes": 30
  }
}
```

#### Listings Feature
```json
{
  "listings": {
    "syncEnabled": true,
    "publicListings": false
  }
}
```

### Environments
Each environment can override base settings:

```json
{
  "environments": {
    "prod": {
      "enabled": true,
      "scaling": {
        "lambda": {
          "memorySize": 512,
          "timeout": 60
        }
      }
    },
    "dev": {
      "enabled": true,
      "scaling": {
        "lambda": {
          "memorySize": 256,
          "timeout": 30
        }
      }
    }
  }
}
```

## Validation Rules
- Client name must be unique across all clients
- Primary domain is required
- No-reply email is required
- AWS profile and region are required
- Feature settings must be valid JSON
- Environment names must be alphanumeric

## Configuration Management
```bash
# Validate configuration
python config_manager.py validate {{ client.name }}

# View configuration
python config_manager.py show {{ client.name }}

# Update configuration
# Edit config/clients/{{ client.name }}/config.json
# Then validate and deploy
```

---
*Generated on {{ generation_date }} for {{ client.name }}*
"""
    
    def _get_troubleshooting_template(self) -> str:
        """Get troubleshooting template"""
        return """# {{ client.displayName }} - Troubleshooting Guide

## Common Issues

### Deployment Issues

#### Stack Creation Failed
**Symptoms:** CDK deployment fails with resource creation errors

**Solutions:**
1. Check AWS credentials for profile `{{ client.aws.profile }}`
2. Verify permissions for CloudFormation, Lambda, DynamoDB, S3
3. Ensure region `{{ client.aws.region }}` is correct
4. Check for resource name conflicts

```bash
# Verify AWS configuration
aws sts get-caller-identity --profile {{ client.aws.profile }}

# Check CloudFormation events
aws cloudformation describe-stack-events \\
  --stack-name {{ client.name.title() }}Core-Prod \\
  --profile {{ client.aws.profile }}
```

#### Lambda Function Errors
**Symptoms:** Lambda functions fail to execute

**Solutions:**
1. Check CloudWatch logs: `/aws/lambda/{{ client.name }}-{env}-*`
2. Verify environment variables are set correctly
3. Check layer compatibility
4. Verify IAM permissions

```bash
# Check Lambda function configuration
aws lambda get-function \\
  --function-name {{ client.name }}-prod-lambda_checkin \\
  --profile {{ client.aws.profile }}

# View recent logs
aws logs tail /aws/lambda/{{ client.name }}-prod-lambda_checkin \\
  --follow --profile {{ client.aws.profile }}
```

### API Issues

#### 403 Forbidden Errors
**Symptoms:** API requests return 403 status

**Solutions:**
1. Check API Gateway resource policies
2. Verify CORS configuration
3. Check Lambda function permissions
4. Verify request headers include `X-Client-Name: {{ client.name }}`

#### 500 Internal Server Error
**Symptoms:** API requests return 500 status

**Solutions:**
1. Check Lambda function logs
2. Verify database connectivity
3. Check secrets manager access
4. Verify environment variables

```bash
# Test API directly
curl -X POST https://{{ client.domains.primary }}/checkin \\
  -H "Content-Type: application/json" \\
  -H "X-Client-Name: {{ client.name }}" \\
  -d '{"operation":"validate","reservationCode":"TEST","guestFirstName":"Test"}'
```

### Feature-Specific Issues

{% if client.features.checkin.enabled %}
#### Check-in Issues
**Deadline Enforcement:**
- Updates blocked {{ client.features.checkin.deadlineHours | default(25) }} hours before check-in
- Check reservation check-in time in database

**QR Code Generation:**
{% if client.features.checkin.qrCodeEnabled %}
- Verify QR code library is available in Lambda layer
- Check S3 bucket permissions for QR code storage
{% else %}
- QR code generation is disabled for this client
{% endif %}
{% endif %}

{% if client.features.reservations.enabled %}
#### Reservations Sync Issues
**Sync Frequency:** Every {{ client.features.reservations.syncIntervalMinutes | default(30) }} minutes

**Common Problems:**
- G4H API credentials expired
- Network connectivity issues
- Rate limiting from G4H API

```bash
# Check sync function logs
aws logs tail /aws/lambda/{{ client.name }}-prod-lambda_reservations_sync_g4h \\
  --follow --profile {{ client.aws.profile }}
```
{% endif %}

{% if client.features.listings.enabled %}
#### Listings Sync Issues
{% if client.features.listings.publicListings %}
**Public Listings:**
- Verify listings are marked as public in G4H
- Check API Gateway CORS settings
{% else %}
**Note:** Public listings are disabled for this client
{% endif %}

```bash
# Test listings endpoint
curl https://{{ client.domains.primary }}/public/listings
```
{% endif %}

### Database Issues

#### DynamoDB Access Errors
**Symptoms:** Lambda functions can't read/write to DynamoDB

**Solutions:**
1. Check IAM permissions for DynamoDB
2. Verify table name: `{{ client.name }}-main` (prod)
3. Check table exists and is active
4. Verify region settings

```bash
# Check table status
aws dynamodb describe-table \\
  --table-name {{ client.name }}-main \\
  --profile {{ client.aws.profile }}

# Check recent items
aws dynamodb scan \\
  --table-name {{ client.name }}-main \\
  --limit 5 \\
  --profile {{ client.aws.profile }}
```

### Secrets Manager Issues

#### G4H Authentication Failures
**Symptoms:** G4H API calls fail with authentication errors

**Solutions:**
1. Update G4H credentials in Secrets Manager
2. Check secret names: `{{ client.name }}/prod/guestyforhosts/creds`
3. Verify KMS permissions if using custom key

```bash
# Update G4H credentials
aws secretsmanager put-secret-value \\
  --secret-id {{ client.name }}/prod/guestyforhosts/creds \\
  --secret-string '{"username":"your-username","password":"your-password"}' \\
  --profile {{ client.aws.profile }}

# Test secret access
aws secretsmanager get-secret-value \\
  --secret-id {{ client.name }}/prod/guestyforhosts/creds \\
  --profile {{ client.aws.profile }}
```

## Monitoring and Alerts

### CloudWatch Metrics
- Lambda function duration and errors
- API Gateway request count and latency
- DynamoDB read/write capacity

### Log Analysis
```bash
# Search for errors in check-in function
aws logs filter-log-events \\
  --log-group-name /aws/lambda/{{ client.name }}-prod-lambda_checkin \\
  --filter-pattern "ERROR" \\
  --start-time $(date -d "1 hour ago" +%s)000 \\
  --profile {{ client.aws.profile }}
```

### Performance Monitoring
- Response times should be < 2000ms
- Success rate should be > 95%
- Memory usage should be < 80% of allocated

## Getting Help

### Contact Information
{% if client.email.support %}
- **Support:** {{ client.email.support }}
{% endif %}
{% if client.email.admin %}
- **Admin:** {{ client.email.admin }}
{% endif %}
- **Technical:** {{ client.email.noreply }}

### Escalation Process
1. Check this troubleshooting guide
2. Review CloudWatch logs
3. Contact support with specific error messages
4. Provide CloudFormation stack events if deployment-related

---
*Generated on {{ generation_date }} for {{ client.name }}*
"""
    
    def generate_client_documentation(self, client_name: str, environment: str = "prod") -> Dict[str, str]:
        """Generate all documentation for a specific client"""
        try:
            # Load client configuration
            config = self.config_manager.load_client_config(client_name)
            env_config = self.config_manager.get_environment_config(client_name, environment)
            
            # Prepare template context
            context = {
                "client": config["client"],
                "environments": config["environments"],
                "config_json": json.dumps(config, indent=2),
                "generation_date": self._get_current_date(),
                "api_base_url": self._get_api_base_url(config, environment)
            }
            
            # Generate documentation files
            docs = {}
            
            # Client overview
            template = self.jinja_env.get_template("client_overview.md.j2")
            docs["overview.md"] = template.render(**context)
            
            # API documentation
            template = self.jinja_env.get_template("api_documentation.md.j2")
            docs["api.md"] = template.render(**context)
            
            # Deployment guide
            template = self.jinja_env.get_template("deployment_guide.md.j2")
            docs["deployment.md"] = template.render(**context)
            
            # Configuration reference
            template = self.jinja_env.get_template("configuration_reference.md.j2")
            docs["configuration.md"] = template.render(**context)
            
            # Troubleshooting guide
            template = self.jinja_env.get_template("troubleshooting.md.j2")
            docs["troubleshooting.md"] = template.render(**context)
            
            return docs
            
        except ConfigurationError as e:
            raise Exception(f"Configuration error for client {client_name}: {e}")
        except Exception as e:
            raise Exception(f"Error generating documentation for client {client_name}: {e}")
    
    def save_client_documentation(self, client_name: str, environment: str = "prod") -> str:
        """Generate and save documentation for a client"""
        docs = self.generate_client_documentation(client_name, environment)
        
        # Create client-specific output directory
        client_output_dir = self.output_dir / client_name
        client_output_dir.mkdir(exist_ok=True)
        
        # Save all documentation files
        for filename, content in docs.items():
            file_path = client_output_dir / filename
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
        
        # Create index file
        index_content = self._generate_index(client_name, docs.keys())
        index_path = client_output_dir / "README.md"
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write(index_content)
        
        return str(client_output_dir)
    
    def generate_all_client_documentation(self) -> Dict[str, str]:
        """Generate documentation for all clients"""
        clients = self.config_manager.list_clients()
        results = {}
        
        for client_name in clients:
            try:
                output_dir = self.save_client_documentation(client_name)
                results[client_name] = output_dir
                print(f"Generated documentation for {client_name}: {output_dir}")
            except Exception as e:
                print(f"Error generating documentation for {client_name}: {e}")
                results[client_name] = f"Error: {e}"
        
        return results
    
    def _get_current_date(self) -> str:
        """Get current date for documentation"""
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    def _get_api_base_url(self, config: Dict[str, Any], environment: str) -> str:
        """Get API base URL for client"""
        domains = config["client"]["domains"]
        
        if "api" in domains:
            return f"https://{domains['api']}"
        else:
            return f"https://{domains['primary']}/api"
    
    def _generate_index(self, client_name: str, doc_files: List[str]) -> str:
        """Generate index file for client documentation"""
        config = self.config_manager.load_client_config(client_name)
        client_display_name = config["client"]["displayName"]
        
        lines = [
            f"# {client_display_name} Documentation",
            "",
            f"This directory contains auto-generated documentation for the {client_display_name} client configuration.",
            "",
            "## Documentation Files",
            ""
        ]
        
        doc_descriptions = {
            "overview.md": "Client overview and configuration summary",
            "api.md": "API documentation and endpoints",
            "deployment.md": "Deployment guide and instructions",
            "configuration.md": "Configuration reference and schema",
            "troubleshooting.md": "Troubleshooting guide and common issues"
        }
        
        for filename in sorted(doc_files):
            description = doc_descriptions.get(filename, "Documentation file")
            lines.append(f"- [{filename}](./{filename}) - {description}")
        
        lines.extend([
            "",
            "## Quick Links",
            f"- [Configuration File](../../config/clients/{client_name}/config.json)",
            f"- [Schema File](../../config/schema.json)",
            "",
            f"*Generated on {self._get_current_date()}*"
        ])
        
        return "\n".join(lines)


def main():
    """Main function for documentation generation"""
    parser = argparse.ArgumentParser(description="Generate dynamic client documentation")
    parser.add_argument("--client", help="Generate documentation for specific client")
    parser.add_argument("--environment", default="prod", help="Environment to document")
    parser.add_argument("--output", help="Output directory")
    parser.add_argument("--all", action="store_true", help="Generate documentation for all clients")
    
    args = parser.parse_args()
    
    generator = DocumentationGenerator(args.output)
    
    if args.all:
        print("Generating documentation for all clients...")
        results = generator.generate_all_client_documentation()
        
        print("\nGeneration Summary:")
        for client_name, result in results.items():
            if result.startswith("Error:"):
                print(f"  ❌ {client_name}: {result}")
            else:
                print(f"  ✅ {client_name}: {result}")
    
    elif args.client:
        print(f"Generating documentation for client: {args.client}")
        try:
            output_dir = generator.save_client_documentation(args.client, args.environment)
            print(f"Documentation generated: {output_dir}")
        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
