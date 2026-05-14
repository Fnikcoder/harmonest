
# HarmoNest User Management System

A comprehensive AWS Cognito-based user management system with role-based access control, built with CDK and designed for Angular TypeScript frontend integration.

## 🏗️ Architecture Overview

- **AWS Cognito User Pool**: Authentication and user management
- **AWS Cognito Identity Pool**: AWS resource access
- **API Gateway**: RESTful API endpoints
- **Lambda Functions**: Business logic and authorization
- **DynamoDB**: Data storage
- **Role-Based Access Control**: 5-tier permission system

## 🔐 Authentication Configuration

### Cognito Configuration
```typescript
export const cognitoConfig = {
  userPoolId: 'eu-central-1_oOMDUFanW',
  userPoolWebClientId: '4jm7vgta4tc7r5chltr4eb4kqj',
  region: 'eu-central-1',
  identityPoolId: 'eu-central-1:434a4973-03f1-4074-929b-de185a7cd4ac'
};

export const apiConfig = {
  baseUrl: 'https://8y8k22wgzj.execute-api.eu-central-1.amazonaws.com/prod',
  region: 'eu-central-1'
};
```

### Angular AWS Amplify Setup
```bash
npm install aws-amplify @aws-amplify/ui-angular
```

```typescript
// app.module.ts
import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    region: 'eu-central-1',
    userPoolId: 'eu-central-1_oOMDUFanW',
    userPoolWebClientId: '4jm7vgta4tc7r5chltr4eb4kqj',
    identityPoolId: 'eu-central-1:434a4973-03f1-4074-929b-de185a7cd4ac'
  }
});
```

## 👥 User Roles & Permissions

| Role | Level | Permissions |
|------|-------|-------------|
| `guest` | 1 | View public content |
| `support` | 2 | Handle support tickets, view user data |
| `admin` | 3 | Manage users, view admin panels |
| `super_admin` | 4 | System administration, AWS resources |
| `owner` | 5 | Full system access |

## 🔑 Test Admin Credentials

```typescript
const testCredentials = {
  admin: {
    email: 'support@harmonest.de',
    password: 'HarmoNest2024!',
    role: 'admin'
  },
  superAdmin: {
    email: 'fnikcoder@gmail.com',
    password: 'HarmoNest2024!',
    role: 'super_admin'
  }
};
```

## 🚀 Quick Start

### **Prerequisites**
- AWS CLI configured with appropriate credentials
- Python 3.12+
- AWS CDK CLI installed
- Virtual environment activated

### **Setup**
```bash
# Clone and navigate to project
cd harmonest/cdk

# Activate virtual environment (Windows)
.venv\Scripts\activate.bat

# Install dependencies
pip install -r requirements.txt

# Synthesize CloudFormation templates
cdk synth
```

### **Deployment**

**Development Environment:**
```bash
cdk deploy --all --context env=dev --profile harmonestadmin
```

**Production Environment:**
```bash
cdk deploy --all --context env=prod --profile harmonestadmin
```

**Deploy Specific Stack:**
```bash
cdk deploy HarmonestCheckin-prod --context env=prod --profile harmonestadmin
```

## 📋 API Endpoints

### **Check-in API**
- **Base URL**: `https://179a2g0pgk.execute-api.eu-central-1.amazonaws.com/prod/`
- **Endpoint**: `/checkin`
- **Documentation**: See `CHECKIN_API_DOCUMENTATION.md`

### **Operations**
1. **Validate Reservation**: `POST /checkin` with `operation: "validate"`
2. **Submit Check-in**: `POST /checkin` with `operation: "submit"`
3. **Get Status**: `GET /checkin?reservationCode=123456`

## 🗄️ Database Design

### **Single Table Design**
All data stored in one DynamoDB table: `harmonest-{env}-table`

**Entity Types:**
- **Reservations**: `PK: RESERVATION#{id}`, `SK: META`
- **Check-ins**: `PK: CHECKIN#{reservationId}`, `SK: META`
- **Groups**: `PK: GROUP#{id}`, `SK: META`
- **Listings**: `PK: LISTING#{id}`, `SK: META`

### **Global Secondary Index**
- **ReservationCodeIndex**: For fast reservation lookup by code
- **Partition Key**: `reservationCode`
- **Projection**: ALL

## 🔄 Data Flow

### **Reservation Sync**
```
G4H API → Reservations Lambda (every 30 min) → DynamoDB
```

### **Check-in Process**
```
Frontend → Validate → Collect Guest Info → Submit → Complete
```

### **QR Code Generation**
```
Check-in Complete → EventBridge Schedule → QR Lambda → Guest Notification
```

## 🧪 Testing

### **Postman Collection**
See `CHECKIN_API_DOCUMENTATION.md` for complete API examples.

**Quick Test:**
```bash
# Validate reservation
curl -X POST https://179a2g0pgk.execute-api.eu-central-1.amazonaws.com/prod/checkin \
  -H "Content-Type: application/json" \
  -d '{"operation":"validate","reservationCode":"123456","guestFirstName":"test"}'
```

### **Local Development**
```bash
# Run tests
python -m pytest tests/

# Check CloudWatch logs
aws logs tail /aws/lambda/harmonest-prod-lambda_checkin --follow
```

## 📁 Project Structure

```
cdk/
├── app.py                 # CDK app entry point
├── cdk/                   # Stack definitions
│   ├── core_stack.py      # Base infrastructure
│   ├── api_stack.py       # API Gateway and Lambda
│   ├── checkin_stack.py   # Check-in functionality
│   └── s3_stack.py        # S3 storage
├── functions/             # Lambda function code
│   ├── checkin/           # Check-in handler
│   ├── reservations/      # Reservation sync
│   ├── qr/               # QR code generation
│   └── common/           # Shared utilities
├── layers/               # Lambda layers
└── tests/               # Test files
```

## 🔧 Configuration

### **Environment Variables**
- `ENV`: Environment (dev/prod)
- `TABLE_NAME`: DynamoDB table name
- `BUCKET_NAME`: S3 bucket for file storage
- `G4H_SECRET_NAME`: Secrets Manager secret name

### **Secrets Manager**
Store G4H API credentials in AWS Secrets Manager:
```json
{
  "username": "your-g4h-username",
  "password": "your-g4h-password",
  "base_url": "https://api.g4h.com"
}
```

## 📊 Monitoring

### **CloudWatch Logs**
- `/aws/lambda/harmonest-{env}-lambda_checkin`
- `/aws/lambda/harmonest-{env}-lambda_reservations_sync_g4h`
- `/aws/lambda/harmonest-{env}-lambda_qr_code_generator`

### **Metrics**
- Lambda invocations, errors, duration
- DynamoDB read/write capacity
- S3 storage usage
- API Gateway request count

## 🚨 Troubleshooting

### **Common Issues**
1. **Reservation Not Found**: Check if reservation exists in G4H and sync is working
2. **Permission Errors**: Verify IAM roles have correct DynamoDB permissions
3. **File Upload Fails**: Check S3 bucket permissions and file size limits
4. **QR Code Not Generated**: Verify EventBridge rules and Lambda permissions

### **Debug Commands**
```bash
# Manual reservation sync
aws lambda invoke --function-name harmonest-prod-lambda_reservations_sync_g4h response.json

# Check DynamoDB data
aws dynamodb scan --table-name harmonest-prod-table --max-items 5

# View recent logs
aws logs tail /aws/lambda/harmonest-prod-lambda_checkin --since 1h
```

## 📚 Documentation

- **API Documentation**: `CHECKIN_API_DOCUMENTATION.md`
- **Architecture Diagrams**: `docs/architecture/`
- **Deployment Guide**: `docs/deployment/`

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Test locally
4. Deploy to dev environment
5. Create pull request

## 📞 Support

For technical issues or questions, contact the development team.

cdk deploy HarmonestAccessNotification-Prod --context client=harmonest --context env=prod --profile harmonestadmin     