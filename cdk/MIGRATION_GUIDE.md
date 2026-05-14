# Migration Guide: From Hardcoded to Dynamic Configuration

This guide explains how to migrate from the hardcoded "harmonest" system to the new dynamic client configuration system.

## 🎯 Overview

The new system allows you to:
- Deploy multiple clients with different configurations
- Manage client-specific settings (domains, emails, AWS settings)
- Use a single codebase for all clients
- Configure deployments through JSON files and web interfaces

## 🔄 Migration Steps

### 1. Backup Current Deployment

Before migrating, ensure you have a backup of your current deployment:

```bash
# Export current stack information
cdk list --profile harmonestadmin > current-stacks.txt

# Backup current configuration
aws ssm get-parameters-by-path --path "/harmonest" --profile harmonestadmin > current-ssm-params.json
```

### 2. Install Configuration System

```bash
# Install Python dependencies for configuration management
cd config
pip install -r requirements.txt

# Validate the harmonest configuration
python config_manager.py validate harmonest
```

### 3. Test New Deployment System

First, test with synthesis (dry run):

```bash
# Test synthesis with new system
python deploy.py deploy harmonest --env prod --dry-run

# Or use CDK directly
cdk synth --context client=harmonest --context env=prod --profile harmonestadmin
```

### 4. Deploy Using New System

Once synthesis works, deploy the new system:

```bash
# Deploy all stacks with new naming
python deploy.py deploy harmonest --env prod

# Or deploy specific stacks
python deploy.py deploy harmonest --env prod --stacks HarmonestCore-Prod HarmonestApi-Prod
```

### 5. Verify Migration

After deployment, verify that everything works:

```bash
# Check that all stacks are deployed
cdk list --context client=harmonest --context env=prod --profile harmonestadmin

# Test API endpoints
curl https://your-api-gateway-url/prod/checkin

# Check CloudWatch logs
aws logs tail /aws/lambda/harmonest-prod-lambda_checkin --follow --profile harmonestadmin
```

## 📋 Configuration Changes

### Before (Hardcoded)
```python
# Old app.py
core = CoreStack(app, f"HarmonestCore-{env_name}", env=env, env_name=env_name)
```

### After (Dynamic)
```python
# New app.py
config = get_cdk_config(app)
core = CoreStack(app, helper.get_stack_name(client_name, env_name, "Core"), env=env, config=config)
```

### Resource Naming Changes

| Resource Type | Old Name | New Name |
|---------------|----------|----------|
| DynamoDB Table | `harmonest-main` | `{client}-main` |
| S3 Bucket | `harmonest-storage` | `{client}-storage` |
| Lambda Function | `harmonest-{env}-lambda_checkin` | `{client}-{env}-lambda_checkin` |
| SSM Parameters | `/harmonest/{env}/...` | `/{client}/{env}/...` |

## 🚀 Deployment Commands

### Old System
```bash
cdk deploy --all --context env=prod --profile harmonestadmin
```

### New System
```bash
# Using deployment script (recommended)
python deploy.py deploy harmonest --env prod

# Using CDK directly
cdk deploy --all --context client=harmonest --context env=prod --profile harmonestadmin
```

## 🔧 Configuration Management

### Web Interface
Start the configuration web applications:

```bash
# Start API server
cd config/web-apps
python api-server.py --debug

# Start React app (in another terminal)
cd config/web-apps/react-config-app
npm install && npm start

# Or start Vue app (in another terminal)
cd config/web-apps/vue-config-app
npm install && npm run serve
```

### Command Line
```bash
# List all clients
python config_manager.py list

# View client configuration
python config_manager.py show harmonest

# Validate configuration
python config_manager.py validate harmonest

# Create new client
python config_manager.py create newclient
```

## 🆕 Adding New Clients

### 1. Create Configuration
```bash
# Create new client configuration
python config_manager.py create myclient

# Or use the web interface
# Navigate to http://localhost:3000 (React) or http://localhost:8080 (Vue)
```

### 2. Customize Settings
Edit the configuration file or use the web interface:
- Update domains
- Configure email addresses
- Set AWS profile and region
- Configure features and integrations

### 3. Deploy New Client
```bash
# Bootstrap AWS environment (first time only)
python deploy.py bootstrap myclient --env prod

# Deploy infrastructure
python deploy.py deploy myclient --env prod
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Configuration Validation Errors
```bash
# Check configuration syntax
python config_manager.py validate harmonest

# View detailed error messages
python deploy.py validate harmonest
```

#### 2. CDK Context Issues
```bash
# Clear CDK context cache
cdk context --clear

# Re-run with fresh context
cdk synth --context client=harmonest --context env=prod
```

#### 3. Stack Name Conflicts
If you have existing stacks with old names, you may need to:
- Deploy new stacks with new names
- Migrate data if necessary
- Delete old stacks

#### 4. SSM Parameter Issues
```bash
# Check if parameters exist
aws ssm get-parameters-by-path --path "/harmonest/prod" --profile harmonestadmin

# Compare with new parameter structure
aws ssm get-parameters-by-path --path "/harmonest/prod" --profile harmonestadmin
```

### Rollback Procedure

If you need to rollback to the old system:

1. **Keep Old Stacks**: Don't delete the old stacks until migration is complete
2. **Revert Code**: Use git to revert to the previous version
3. **Redeploy**: Deploy using the old system

```bash
# Revert to previous commit
git checkout <previous-commit>

# Deploy old system
cdk deploy --all --context env=prod --profile harmonestadmin
```

## 📊 Monitoring Migration

### Check Deployment Status
```bash
# List all stacks
python deploy.py list

# Check specific client
cdk list --context client=harmonest --context env=prod
```

### Verify Resources
```bash
# Check DynamoDB tables
aws dynamodb list-tables --profile harmonestadmin

# Check Lambda functions
aws lambda list-functions --profile harmonestadmin

# Check S3 buckets
aws s3 ls --profile harmonestadmin
```

### Monitor Logs
```bash
# Check deployment logs
aws cloudformation describe-stacks --stack-name HarmonestCore-Prod --profile harmonestadmin

# Monitor Lambda logs
aws logs tail /aws/lambda/harmonest-prod-lambda_checkin --follow --profile harmonestadmin
```

## ✅ Post-Migration Checklist

- [ ] All stacks deployed successfully
- [ ] API endpoints responding correctly
- [ ] Lambda functions executing without errors
- [ ] DynamoDB tables accessible
- [ ] S3 buckets configured with correct CORS
- [ ] Secrets Manager secrets accessible
- [ ] CloudWatch logs being generated
- [ ] Configuration web interface working
- [ ] New client creation tested
- [ ] Documentation updated

## 🔮 Next Steps

After successful migration:

1. **Create Additional Clients**: Test the system with new client configurations
2. **Automate Deployments**: Set up CI/CD pipelines using the new deployment script
3. **Monitor Performance**: Set up monitoring and alerting for all clients
4. **Train Team**: Ensure team members understand the new configuration system
5. **Document Processes**: Create operational runbooks for client management

## 📞 Support

If you encounter issues during migration:

1. Check the troubleshooting section above
2. Review configuration validation errors
3. Check AWS CloudFormation events for deployment issues
4. Verify AWS permissions and profiles
5. Test with synthesis before actual deployment

For additional help, refer to:
- `config/README.md` - Configuration system documentation
- `config/web-apps/README.md` - Web interface documentation
- CDK documentation for stack-specific issues
