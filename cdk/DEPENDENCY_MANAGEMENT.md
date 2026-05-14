# Dependency Management Guide

## 📦 Overview

This project uses a **two-tier dependency management system**:
- **Lambda Layer**: Shared dependencies used across multiple functions
- **Function-specific**: Dependencies unique to individual functions

## 🏗️ Structure

```
cdk/
├── layer-src/python/
│   ├── requirements.txt          # Shared dependencies
│   ├── common/                   # Custom shared modules
│   └── [installed packages]      # pip install -t . results
└── functions/
    ├── access_notification/
    │   └── requirements.txt      # Function-specific only
    ├── auth/
    │   └── requirements.txt      # Function-specific only
    └── [other functions]/
```

## 📋 Current Dependencies

### Layer Dependencies (Shared)
Located in `layer-src/python/requirements.txt`:
- `boto3==1.34.0` - AWS SDK
- `botocore==1.34.0` - AWS SDK core
- `requests==2.31.0` - HTTP library
- `pydantic==2.10.4` - Data validation
- `PyJWT==2.8.0` - JWT tokens
- `cryptography==41.0.7` - Cryptographic functions

### Function-Specific Dependencies

**access_notification:**
- `qrcode[pil]==7.4.2` - QR code generation
- `Pillow==10.0.1` - Image processing

**auth:**
- No additional dependencies (uses layer only)

## 🔧 Adding New Dependencies

### For Shared Dependencies (Multiple Functions)

1. **Add to layer requirements:**
```bash
cd layer-src/python
echo "new-package==1.2.3" >> requirements.txt
```

2. **Install to layer:**
```bash
pip install -r requirements.txt -t . --upgrade
```

3. **Deploy layer:**
```bash
cd ../../
cdk deploy *Layer* --profile harmonestadmin
```

### For Function-Specific Dependencies

1. **Add to function requirements:**
```bash
cd functions/your-function
echo "function-specific-package==1.0.0" >> requirements.txt
```

2. **Deploy function:**
```bash
cd ../../
cdk deploy *YourFunction* --profile harmonestadmin
```

## 🧪 Testing Dependencies

### Test Layer Dependencies
```bash
cd layer-src/python
python -c "import boto3, requests, pydantic; print('✅ Layer imports work')"
```

### Test Function Dependencies
```bash
cd functions/access_notification
python -c "import qrcode, PIL; print('✅ Function imports work')"
```

### Test Complete Import Chain
```bash
cd functions/access_notification
python test_imports.py
```

## 🚀 Deployment Commands

### Deploy All (Layer + Functions)
```bash
cdk deploy --all --context client=harmonest --context env=prod --profile harmonestadmin
```

### Deploy Layer Only
```bash
cdk deploy HarmonestLayer-prod --context client=harmonest --context env=prod --profile harmonestadmin
```

### Deploy Specific Function
```bash
cdk deploy HarmonestAccessNotification-prod --context client=harmonest --context env=prod --profile harmonestadmin
```

## ⚠️ Important Notes

1. **Layer Size Limit**: AWS Lambda layers have a 250MB limit (unzipped)
2. **Version Pinning**: Always pin exact versions to avoid deployment issues
3. **CDK Dependencies**: CDK packages should NOT be in Lambda layer (too large)
4. **Upgrade Strategy**: Use `--upgrade` flag when updating layer dependencies
5. **Testing**: Always test imports after dependency changes
6. **⚠️ CRITICAL**: When cleaning layer, NEVER delete the `common/` directory - it contains custom modules!

## 🔍 Troubleshooting

### Import Errors
- Check if dependency is in correct requirements.txt
- Verify layer is attached to function in CDK
- Test locally with `test_imports.py`

### Version Conflicts
- Use exact version pinning
- Check for conflicting transitive dependencies
- Consider moving conflicting packages to function-specific

### Deployment Issues
- Check layer size limits
- Verify AWS permissions
- Use `cdk diff` to preview changes

## 📚 Best Practices

1. **Minimize Layer Size**: Only include truly shared dependencies
2. **Pin Versions**: Always use exact version numbers
3. **Test Locally**: Use test scripts before deployment
4. **Document Changes**: Update this guide when adding dependencies
5. **Regular Updates**: Keep dependencies updated for security
