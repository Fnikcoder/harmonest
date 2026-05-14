# Harmonest Credential & Configuration Management

## 🔐 Backend Credentials (AWS Secrets Manager)
**Location**: AWS Secrets Manager  
**Access**: Backend Lambda functions only  
**Pattern**: `{client_name}/{env_name}/{service}/{credential_type}`

### Core Secrets Structure:
```
harmonest/
├── dev/
│   ├── guestyforhosts/
│   │   ├── creds              # {"email": "user@example.com", "password": "secret"}
│   │   └── webSession         # {"utoken": "...", "stoken": "...", "cookies": "..."}
│   ├── ttlock/
│   │   ├── api-credentials    # {"clientId": "...", "clientSecret": "...", "accessToken": "..."}
│   │   └── webhook-secret     # {"secret": "webhook_verification_secret"}
│   ├── qrlock/
│   │   ├── api-credentials    # {"email": "user@example.com", "password": "password"}
│   │   └── webhook-secret     # {"secret": "webhook_verification_secret"}
│   ├── database/
│   │   └── encryption-key     # {"key": "database_encryption_key"}
│   ├── email/
│   │   ├── smtp-credentials   # {"host": "...", "port": 587, "username": "...", "password": "..."}
│   │   └── api-keys          # {"sendgrid": "...", "ses": "..."}
│   ├── payment/
│   │   ├── stripe            # {"publishableKey": "pk_...", "secretKey": "sk_...", "webhookSecret": "whsec_..."}
│   │   └── paypal            # {"clientId": "...", "clientSecret": "..."}
│   └── external-apis/
│       ├── google-maps       # {"apiKey": "..."}
│       ├── analytics         # {"googleAnalytics": "GA-...", "mixpanel": "..."}
│       └── sms               # {"twilio": {"accountSid": "...", "authToken": "...", "phoneNumber": "..."}}
├── staging/ (same structure)
└── prod/ (same structure)
```

## 🌐 Frontend Configuration (Public)
**Location**: Client config JSON + Environment variables  
**Access**: Frontend applications  
**Security**: No sensitive data, only public configuration

### Frontend Config Structure:
```json
{
  "api": {
    "baseUrl": "https://api.harmonest.de",
    "version": "v1",
    "timeout": 30000,
    "endpoints": {
      "auth": "/auth",
      "users": "/admin/users",
      "listings": "/listings",
      "reservations": "/reservations",
      "checkin": "/checkin",
      "ttlock": "/ttlock"
    }
  },
  "auth": {
    "cognito": {
      "region": "eu-central-1",
      "userPoolId": "eu-central-1_XXXXXXXXX",
      "userPoolWebClientId": "xxxxxxxxxxxxxxxxxxxxxxxxxx",
      "domain": "harmonest-auth.auth.eu-central-1.amazoncognito.com",
      "redirectSignIn": "https://admin.harmonest.de/auth/callback",
      "redirectSignOut": "https://admin.harmonest.de/auth/logout",
      "scope": ["email", "openid", "profile"],
      "responseType": "code"
    },
    "tokenStorage": "localStorage",
    "autoRefresh": true
  },
  "features": {
    "userManagement": true,
    "listingsManagement": true,
    "ttlockIntegration": true,
    "guestySync": true,
    "analytics": true,
    "multiLanguage": false
  },
  "ui": {
    "theme": "harmonest",
    "branding": {
      "primaryColor": "#2563eb",
      "secondaryColor": "#64748b",
      "logo": "https://cdn.harmonest.de/logo.png",
      "favicon": "https://cdn.harmonest.de/favicon.ico"
    },
    "layout": {
      "sidebar": "collapsible",
      "header": "fixed",
      "footer": "minimal"
    }
  },
  "integrations": {
    "googleMaps": {
      "enabled": true,
      "apiKey": "PUBLIC_MAPS_API_KEY_FOR_FRONTEND"
    },
    "analytics": {
      "googleAnalytics": "GA-XXXXXXXXX",
      "hotjar": "XXXXXXX"
    }
  },
  "limits": {
    "fileUpload": {
      "maxSize": 10485760,
      "allowedTypes": ["image/jpeg", "image/png", "application/pdf"]
    },
    "pagination": {
      "defaultPageSize": 20,
      "maxPageSize": 100
    }
  }
}
```

## 🔧 Environment Variables (Lambda Functions)
**Location**: CDK deployment, sourced from client config + secrets  
**Access**: Backend Lambda functions  

### Lambda Environment Variables:
```python
# From client config (public)
CLIENT_NAME = "harmonest"
CLIENT_DISPLAY_NAME = "HarmoNest"
CLIENT_DOMAIN_PRIMARY = "harmonest.de"
CLIENT_EMAIL_NOREPLY = "noreply@harmonest.com"
CLIENT_BRANDING_PRIMARY_COLOR = "#2563eb"

# AWS Resources (generated during deployment)
USER_POOL_ID = "eu-central-1_XXXXXXXXX"
USER_POOL_CLIENT_ID = "xxxxxxxxxxxxxxxxxxxxxxxxxx"
DYNAMODB_TABLE_NAME = "harmonest-main-table-prod"
S3_BUCKET_NAME = "harmonest-uploads-prod"

# Secret ARNs (for runtime secret retrieval)
G4H_CREDS_SECRET_ARN = "arn:aws:secretsmanager:eu-central-1:669597026882:secret:harmonest/prod/guestyforhosts/creds-XXXXXX"
TTLOCK_CREDS_SECRET_ARN = "arn:aws:secretsmanager:eu-central-1:669597026882:secret:harmonest/prod/ttlock/api-credentials-XXXXXX"

# Feature flags
FEATURE_TTLOCK_ENABLED = "true"
FEATURE_GUESTY_SYNC_ENABLED = "true"
FEATURE_EMAIL_NOTIFICATIONS_ENABLED = "true"
```
