# Client Configuration System

This directory contains the client configuration system for the multi-tenant hotel management platform. It provides a centralized way to manage client-specific settings, domains, integrations, and deployment configurations.

## 🏗️ Architecture

### Directory Structure
```
config/
├── README.md                    # This file
├── requirements.txt             # Python dependencies
├── config_manager.py           # Core configuration management
├── cdk_config.py               # CDK-specific configuration helpers
├── schema/
│   └── client-config.schema.json  # JSON schema for validation
├── clients/
│   ├── harmonest/
│   │   └── config.json         # HarmoNest client configuration
│   └── example-client/
│       └── config.json         # Example client configuration
└── web-apps/                   # Configuration management web applications
    ├── react-config-app/       # React version
    └── vue-config-app/         # Vue.js version
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd config
pip install -r requirements.txt
```

### 2. List Available Clients
```bash
python config_manager.py list
```

### 3. Validate Client Configuration
```bash
python config_manager.py validate harmonest
```

### 4. View Client Configuration
```bash
# View full configuration
python config_manager.py show harmonest

# View environment-specific configuration
python config_manager.py show harmonest prod
```

### 5. Create New Client
```bash
python config_manager.py create myclient
```

## 📋 Configuration Schema

The configuration system uses a comprehensive JSON schema that defines:

### Client Information
- **name**: Unique identifier (used in resource naming)
- **displayName**: Human-readable name
- **description**: Optional description

### Domains
- **primary**: Main domain
- **www**: WWW subdomain
- **dev**: Development domain
- **staging**: Staging domain
- **api**: API domain
- **admin**: Admin panel domain
- **additional**: Array of additional domains

### Email Configuration
- **noreply**: No-reply email address
- **support**: Support email
- **admin**: Admin email
- **notifications**: Notifications email
- **fromName**: Display name for outgoing emails

### AWS Configuration
- **profile**: AWS CLI profile name
- **region**: AWS region
- **accountId**: AWS account ID
- **kmsKeyId**: KMS key for encryption

### Branding
- **primaryColor**: Primary brand color (hex)
- **secondaryColor**: Secondary brand color (hex)
- **logo**: Logo configuration (URL, dimensions)
- **favicon**: Favicon URL

### Integrations
- **g4h**: Guesty for Hosts settings
- **analytics**: Analytics tracking IDs
- **payment**: Payment processor settings

### Features
- **checkin**: Check-in functionality settings
- **reservations**: Reservation sync settings
- **listings**: Listings management settings

### Environment-Specific Overrides
Each environment (dev, staging, prod) can override:
- AWS settings
- Domain configurations
- Feature flags
- Scaling parameters

## 🔧 Usage in CDK

### Basic Usage
```python
from config.cdk_config import get_cdk_config

app = cdk.App()
config = get_cdk_config(app)

# Access client information
client_name = config["cdk"]["client_name"]
env_name = config["cdk"]["env_name"]

# Generate resource names
table_name = config_manager.get_resource_name(client_name, env_name, "table")
```

### Stack Naming
```python
from config.cdk_config import CDKConfigHelper

helper = CDKConfigHelper()
stack_name = helper.get_stack_name("harmonest", "prod", "Core")
# Result: "HarmonestCore-Prod"
```

### CORS Configuration
```python
cors_origins = helper.get_cors_origins(config)
# Returns list of allowed origins based on client domains
```

### Lambda Environment Variables
```python
env_vars = helper.get_lambda_environment_variables(config)
# Returns dictionary of environment variables for Lambda functions
```

## 🌐 Deployment

### Deploy Specific Client
```bash
# Deploy all stacks for harmonest production
cdk deploy --all --context client=harmonest --context env=prod

# Deploy specific stack
cdk deploy HarmonestCore-Prod --context client=harmonest --context env=prod
```

### Deploy Different Environment
```bash
# Deploy to development environment
cdk deploy --all --context client=harmonest --context env=dev
```

### Deploy Different Client
```bash
# Deploy new client
cdk deploy --all --context client=newclient --context env=prod
```

## 🛠️ Configuration Management

### Python API
```python
from config.config_manager import ConfigManager

# Initialize manager
config_manager = ConfigManager()

# Load client configuration
config = config_manager.load_client_config("harmonest")

# Get environment-specific configuration
env_config = config_manager.get_environment_config("harmonest", "prod")

# Validate configuration
config_manager.validate_config(config)

# Save configuration
config_manager.save_client_config("newclient", new_config)
```

### CLI Commands
```bash
# List all clients
python config_manager.py list

# Validate client configuration
python config_manager.py validate <client>

# Show configuration
python config_manager.py show <client> [env]

# Create example client
python config_manager.py create <client>

# Test CDK configuration
python cdk_config.py <client> <env>
```

## 🔒 Security Considerations

### Sensitive Data
- AWS credentials should be stored in AWS profiles, not in configuration files
- API keys and secrets should be stored in AWS Secrets Manager
- Configuration files should not contain sensitive information

### Access Control
- Configuration files should be version controlled
- Production configurations should require approval for changes
- Environment-specific secrets should be isolated

## 📝 Adding New Clients

### 1. Create Configuration
```bash
python config_manager.py create newclient
```

### 2. Edit Configuration
Edit `config/clients/newclient/config.json` with client-specific settings:
- Update domains
- Configure email addresses
- Set AWS profile and region
- Configure integrations
- Set feature flags

### 3. Validate Configuration
```bash
python config_manager.py validate newclient
```

### 4. Deploy Infrastructure
```bash
cdk deploy --all --context client=newclient --context env=prod
```

## 🧪 Testing Configuration

### Validate Schema
```bash
python config_manager.py validate <client>
```

### Test CDK Integration
```bash
python cdk_config.py <client> <env>
```

### Dry Run Deployment
```bash
cdk synth --context client=<client> --context env=<env>
```

## 🔄 Migration from Hardcoded Values

The system is designed to migrate existing "harmonest" deployments:

1. **Backward Compatibility**: Existing resources continue to work
2. **Gradual Migration**: Stacks can be migrated one at a time
3. **Resource Preservation**: Existing data and resources are preserved
4. **Rollback Support**: Can revert to previous deployment if needed

## 📚 Web Applications

Two web applications are provided for configuration management:

### React Application
- Modern React with TypeScript
- Material-UI components
- Real-time validation
- JSON editor with syntax highlighting

### Vue.js Application
- Vue 3 with Composition API
- Vuetify components
- Form validation
- Configuration wizard

Both applications provide:
- Client configuration CRUD operations
- Schema validation
- Environment management
- Configuration export/import
- Deployment status monitoring

## 🤝 Contributing

When adding new configuration options:

1. Update the JSON schema in `schema/client-config.schema.json`
2. Update the example configurations
3. Add validation logic if needed
4. Update documentation
5. Test with existing clients

## 📞 Support

For configuration system issues:
1. Check schema validation errors
2. Verify client configuration syntax
3. Test with CLI tools
4. Check CDK context parameters
