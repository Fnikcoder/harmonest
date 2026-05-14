#!/bin/bash

# Create IAM User Roles and Policies for Harmonest
# Creates role-based access policies for: guest, user, support, admin, owner, super_admin
# Supports both dev and prod environments

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/aws_config.json"

# Load AWS profile from config
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ AWS config file not found: $CONFIG_FILE${NC}"
    exit 1
fi

AWS_PROFILE=$(jq -r '.aws_profile // "harmonestadmin"' "$CONFIG_FILE")
REGION=$(jq -r '.region // "eu-central-1"' "$CONFIG_FILE")

echo -e "${BLUE}🔐 Harmonest IAM User Roles and Policies Setup${NC}"
echo "=================================================="
echo

# Prompt for environment
echo "Select environment:"
echo "1) dev"
echo "2) prod"
read -p "Enter choice (1-2): " env_choice

case $env_choice in
    1)
        ENV="dev"
        ;;
    2)
        ENV="prod"
        ;;
    *)
        echo -e "${RED}❌ Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac

# Load Cognito configuration
COGNITO_CONFIG_FILE="$SCRIPT_DIR/cognito_config_${ENV}.json"

if [ ! -f "$COGNITO_CONFIG_FILE" ]; then
    echo -e "${RED}❌ Cognito config file not found: $COGNITO_CONFIG_FILE${NC}"
    echo -e "${YELLOW}💡 Run ./create_cognito_infrastructure.sh first${NC}"
    exit 1
fi

USER_POOL_ID=$(jq -r '.userPoolId' "$COGNITO_CONFIG_FILE")
IDENTITY_POOL_ID=$(jq -r '.identityPoolId' "$COGNITO_CONFIG_FILE")
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --profile "$AWS_PROFILE")

echo -e "${BLUE}📋 Environment: ${ENV}${NC}"
echo -e "${BLUE}📋 User Pool ID: ${USER_POOL_ID}${NC}"
echo -e "${BLUE}📋 Identity Pool ID: ${IDENTITY_POOL_ID}${NC}"
echo -e "${BLUE}📋 Account ID: ${ACCOUNT_ID}${NC}"
echo

echo -e "${BLUE}🔧 Creating role-based IAM policies...${NC}"

# Step 1: Create Guest Role Policy
echo -e "${YELLOW}Creating Guest role policy...${NC}"

# Check if policy already exists
GUEST_POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/Harmonest-${ENV}-Guest-Policy"
aws iam get-policy --policy-arn "$GUEST_POLICY_ARN" --profile "$AWS_PROFILE" --region "$REGION" >/dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Guest policy already exists: Harmonest-${ENV}-Guest-Policy${NC}"
else
    echo -e "${BLUE}Creating new Guest policy...${NC}"

cat > /tmp/guest-role-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BasicCognitoAccess",
      "Effect": "Allow",
      "Action": [
        "mobileanalytics:PutEvents",
        "cognito-sync:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "PublicPropertyAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-${ENV}-properties",
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-${ENV}-properties/index/*"
      ],
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:Attributes": [
            "propertyId", "name", "description", "location", "amenities",
            "images", "pricing", "availability", "status"
          ]
        }
      }
    },
    {
      "Sid": "PublicBookingAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-${ENV}-bookings"
      ],
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:Attributes": [
            "bookingId", "propertyId", "checkInDate", "checkOutDate", "status"
          ]
        }
      }
    },
    {
      "Sid": "PublicS3Access",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": [
        "arn:aws:s3:::harmonest-${ENV}-public/*",
        "arn:aws:s3:::harmonest-${ENV}-properties/*"
      ]
    }
  ]
}
EOF

    aws iam create-policy \
      --policy-name "Harmonest-${ENV}-Guest-Policy" \
      --policy-document file:///tmp/guest-role-policy.json \
      --description "Guest access policy for Harmonest ${ENV} environment" \
      --profile "$AWS_PROFILE" \
      --region "$REGION"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Guest policy created successfully${NC}"
    else
        echo -e "${RED}❌ Failed to create Guest policy${NC}"
    fi
fi

# Step 2: Create User Role Policy
echo -e "${YELLOW}Creating User role policy...${NC}"

cat > /tmp/user-role-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BasicCognitoAccess",
      "Effect": "Allow",
      "Action": [
        "mobileanalytics:PutEvents",
        "cognito-sync:*",
        "cognito-identity:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "PropertyAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-${ENV}-properties",
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-${ENV}-properties/index/*"
      ]
    },
    {
      "Sid": "UserBookingAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-${ENV}-bookings",
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-${ENV}-bookings/index/*"
      ],
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:LeadingKeys": ["\${cognito-identity.amazonaws.com:sub}"]
        }
      }
    },
    {
      "Sid": "UserProfileAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-${ENV}-users"
      ],
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:LeadingKeys": ["\${cognito-identity.amazonaws.com:sub}"]
        }
      }
    },
    {
      "Sid": "UserS3Access",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::harmonest-${ENV}-public/*",
        "arn:aws:s3:::harmonest-${ENV}-properties/*",
        "arn:aws:s3:::harmonest-${ENV}-user-uploads/\${cognito-identity.amazonaws.com:sub}/*"
      ]
    }
  ]
}
EOF

aws iam create-policy \
  --policy-name "Harmonest-${ENV}-User-Policy" \
  --policy-document file:///tmp/user-role-policy.json \
  --description "User access policy for Harmonest ${ENV} environment" \
  --profile "$AWS_PROFILE" \
  --region "$REGION" || echo "Policy may already exist"

# Step 3: Create Support Role Policy
echo -e "${YELLOW}Creating Support role policy...${NC}"

cat > /tmp/support-role-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BasicCognitoAccess",
      "Effect": "Allow",
      "Action": [
        "mobileanalytics:PutEvents",
        "cognito-sync:*",
        "cognito-identity:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "FullPropertyAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:UpdateItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-${ENV}-properties",
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-${ENV}-properties/index/*"
      ]
    },
    {
      "Sid": "BookingManagement",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-${ENV}-bookings",
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-${ENV}-bookings/index/*"
      ]
    },
    {
      "Sid": "UserSupportAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:UpdateItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-${ENV}-users",
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-${ENV}-users/index/*"
      ]
    },
    {
      "Sid": "LimitedCognitoUserAccess",
      "Effect": "Allow",
      "Action": [
        "cognito-idp:AdminGetUser",
        "cognito-idp:ListUsers"
      ],
      "Resource": [
        "arn:aws:cognito-idp:${REGION}:${ACCOUNT_ID}:userpool/${USER_POOL_ID}"
      ]
    },
    {
      "Sid": "SupportS3Access",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::harmonest-${ENV}-*/*",
        "arn:aws:s3:::harmonest-${ENV}-*"
      ]
    }
  ]
}
EOF

aws iam create-policy \
  --policy-name "Harmonest-${ENV}-Support-Policy" \
  --policy-document file:///tmp/support-role-policy.json \
  --description "Support access policy for Harmonest ${ENV} environment" \
  --profile "$AWS_PROFILE" \
  --region "$REGION" || echo "Policy may already exist"

# Step 4: Create Admin Role Policy
echo -e "${YELLOW}Creating Admin role policy...${NC}"

cat > /tmp/admin-role-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BasicCognitoAccess",
      "Effect": "Allow",
      "Action": [
        "mobileanalytics:PutEvents",
        "cognito-sync:*",
        "cognito-identity:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "FullDynamoDBAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-${ENV}-*",
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-${ENV}-*/index/*"
      ]
    },
    {
      "Sid": "CognitoUserManagement",
      "Effect": "Allow",
      "Action": [
        "cognito-idp:ListUsers",
        "cognito-idp:AdminGetUser",
        "cognito-idp:AdminCreateUser",
        "cognito-idp:AdminUpdateUserAttributes",
        "cognito-idp:AdminEnableUser",
        "cognito-idp:AdminDisableUser",
        "cognito-idp:AdminSetUserPassword",
        "cognito-idp:AdminResetUserPassword",
        "cognito-idp:AdminConfirmSignUp"
      ],
      "Resource": [
        "arn:aws:cognito-idp:${REGION}:${ACCOUNT_ID}:userpool/${USER_POOL_ID}"
      ]
    },
    {
      "Sid": "FullS3Access",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:GetBucketVersioning"
      ],
      "Resource": [
        "arn:aws:s3:::harmonest-${ENV}-*/*",
        "arn:aws:s3:::harmonest-${ENV}-*"
      ]
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ],
      "Resource": [
        "arn:aws:logs:${REGION}:${ACCOUNT_ID}:log-group:/aws/harmonest/${ENV}/*"
      ]
    }
  ]
}
EOF

aws iam create-policy \
  --policy-name "Harmonest-${ENV}-Admin-Policy" \
  --policy-document file:///tmp/admin-role-policy.json \
  --description "Admin access policy for Harmonest ${ENV} environment" \
  --profile "$AWS_PROFILE" \
  --region "$REGION" || echo "Policy may already exist"

# Step 5: Create Owner Role Policy
echo -e "${YELLOW}Creating Owner role policy...${NC}"

cat > /tmp/owner-role-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BasicCognitoAccess",
      "Effect": "Allow",
      "Action": [
        "mobileanalytics:PutEvents",
        "cognito-sync:*",
        "cognito-identity:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "FullDynamoDBAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:*"
      ],
      "Resource": [
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-${ENV}-*",
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-${ENV}-*/index/*"
      ]
    },
    {
      "Sid": "FullCognitoUserManagement",
      "Effect": "Allow",
      "Action": [
        "cognito-idp:*"
      ],
      "Resource": [
        "arn:aws:cognito-idp:${REGION}:${ACCOUNT_ID}:userpool/${USER_POOL_ID}"
      ]
    },
    {
      "Sid": "FullS3Access",
      "Effect": "Allow",
      "Action": [
        "s3:*"
      ],
      "Resource": [
        "arn:aws:s3:::harmonest-${ENV}-*/*",
        "arn:aws:s3:::harmonest-${ENV}-*"
      ]
    },
    {
      "Sid": "CloudWatchAccess",
      "Effect": "Allow",
      "Action": [
        "logs:*",
        "cloudwatch:*"
      ],
      "Resource": [
        "arn:aws:logs:${REGION}:${ACCOUNT_ID}:log-group:/aws/harmonest/${ENV}/*",
        "arn:aws:cloudwatch:${REGION}:${ACCOUNT_ID}:*"
      ]
    },
    {
      "Sid": "IAMRoleManagement",
      "Effect": "Allow",
      "Action": [
        "iam:GetRole",
        "iam:GetRolePolicy",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies"
      ],
      "Resource": [
        "arn:aws:iam::${ACCOUNT_ID}:role/Cognito_harmonest_${ENV}_*",
        "arn:aws:iam::${ACCOUNT_ID}:role/Harmonest-${ENV}-*"
      ]
    }
  ]
}
EOF

aws iam create-policy \
  --policy-name "Harmonest-${ENV}-Owner-Policy" \
  --policy-document file:///tmp/owner-role-policy.json \
  --description "Owner access policy for Harmonest ${ENV} environment" \
  --profile "$AWS_PROFILE" \
  --region "$REGION" || echo "Policy may already exist"

# Step 6: Create Super Admin Role Policy
echo -e "${YELLOW}Creating Super Admin role policy...${NC}"

cat > /tmp/super-admin-role-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "FullCognitoAccess",
      "Effect": "Allow",
      "Action": [
        "cognito-idp:*",
        "cognito-identity:*",
        "cognito-sync:*",
        "mobileanalytics:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "FullDynamoDBAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:*"
      ],
      "Resource": [
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-*",
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-*/index/*"
      ]
    },
    {
      "Sid": "FullS3Access",
      "Effect": "Allow",
      "Action": [
        "s3:*"
      ],
      "Resource": [
        "arn:aws:s3:::harmonest-*/*",
        "arn:aws:s3:::harmonest-*"
      ]
    },
    {
      "Sid": "CloudWatchFullAccess",
      "Effect": "Allow",
      "Action": [
        "logs:*",
        "cloudwatch:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "IAMManagement",
      "Effect": "Allow",
      "Action": [
        "iam:GetRole",
        "iam:GetRolePolicy",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:UpdateAssumeRolePolicy"
      ],
      "Resource": [
        "arn:aws:iam::${ACCOUNT_ID}:role/Cognito_harmonest_*",
        "arn:aws:iam::${ACCOUNT_ID}:role/Harmonest-*"
      ]
    },
    {
      "Sid": "CrossEnvironmentAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:ListTables",
        "s3:ListAllMyBuckets",
        "cognito-idp:ListUserPools",
        "cognito-identity:ListIdentityPools"
      ],
      "Resource": "*"
    }
  ]
}
EOF

aws iam create-policy \
  --policy-name "Harmonest-${ENV}-SuperAdmin-Policy" \
  --policy-document file:///tmp/super-admin-role-policy.json \
  --description "Super Admin access policy for Harmonest ${ENV} environment" \
  --profile "$AWS_PROFILE" \
  --region "$REGION" || echo "Policy may already exist"

# Step 7: Create Role-based Groups in Cognito User Pool
echo -e "${BLUE}👥 Step 7: Creating Cognito User Groups...${NC}"

# Create Guest group
aws cognito-idp create-group \
  --group-name "guest" \
  --user-pool-id "$USER_POOL_ID" \
  --description "Guest users with limited access" \
  --profile "$AWS_PROFILE" \
  --region "$REGION" || echo "Group may already exist"

# Create User group
aws cognito-idp create-group \
  --group-name "user" \
  --user-pool-id "$USER_POOL_ID" \
  --description "Regular users with booking access" \
  --profile "$AWS_PROFILE" \
  --region "$REGION" || echo "Group may already exist"

# Create Support group
aws cognito-idp create-group \
  --group-name "support" \
  --user-pool-id "$USER_POOL_ID" \
  --description "Support staff with customer service access" \
  --profile "$AWS_PROFILE" \
  --region "$REGION" || echo "Group may already exist"

# Create Admin group
aws cognito-idp create-group \
  --group-name "admin" \
  --user-pool-id "$USER_POOL_ID" \
  --description "Administrators with full system access" \
  --profile "$AWS_PROFILE" \
  --region "$REGION" || echo "Group may already exist"

# Create Owner group
aws cognito-idp create-group \
  --group-name "owner" \
  --user-pool-id "$USER_POOL_ID" \
  --description "Property owners with management access" \
  --profile "$AWS_PROFILE" \
  --region "$REGION" || echo "Group may already exist"

# Create Super Admin group
aws cognito-idp create-group \
  --group-name "super_admin" \
  --user-pool-id "$USER_POOL_ID" \
  --description "Super administrators with full system control" \
  --profile "$AWS_PROFILE" \
  --region "$REGION" || echo "Group may already exist"

# Step 8: Save policy information
echo -e "${BLUE}💾 Step 8: Saving policy configuration...${NC}"

POLICY_CONFIG_FILE="$SCRIPT_DIR/iam_policies_${ENV}.json"

cat > "$POLICY_CONFIG_FILE" << EOF
{
  "environment": "$ENV",
  "region": "$REGION",
  "accountId": "$ACCOUNT_ID",
  "userPoolId": "$USER_POOL_ID",
  "identityPoolId": "$IDENTITY_POOL_ID",
  "policies": {
    "guest": "Harmonest-${ENV}-Guest-Policy",
    "user": "Harmonest-${ENV}-User-Policy",
    "support": "Harmonest-${ENV}-Support-Policy",
    "admin": "Harmonest-${ENV}-Admin-Policy",
    "owner": "Harmonest-${ENV}-Owner-Policy",
    "super_admin": "Harmonest-${ENV}-SuperAdmin-Policy"
  },
  "groups": [
    "guest",
    "user",
    "support",
    "admin",
    "owner",
    "super_admin"
  ],
  "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

# Clean up temporary files
rm -f /tmp/*-role-policy.json

echo
echo -e "${GREEN}🎉 IAM User Roles and Policies Setup Complete!${NC}"
echo
echo -e "${BLUE}📋 Summary:${NC}"
echo "  • Environment: $ENV"
echo "  • Policies Created: 6 role-based policies"
echo "  • Groups Created: 6 Cognito user groups"
echo "  • Configuration saved to: $POLICY_CONFIG_FILE"
echo
echo -e "${BLUE}📋 Created Policies:${NC}"
echo "  • Harmonest-${ENV}-Guest-Policy (Read-only public access)"
echo "  • Harmonest-${ENV}-User-Policy (User bookings and profile)"
echo "  • Harmonest-${ENV}-Support-Policy (Customer support access)"
echo "  • Harmonest-${ENV}-Admin-Policy (Full system administration)"
echo "  • Harmonest-${ENV}-Owner-Policy (Property owner management)"
echo "  • Harmonest-${ENV}-SuperAdmin-Policy (Full system control)"
echo
echo -e "${BLUE}📋 Created Groups:${NC}"
echo "  • guest, user, support, admin, owner, super_admin"
echo
echo -e "${YELLOW}⚠️  Next Steps:${NC}"
echo "1. Users will be automatically assigned to groups based on their custom:role attribute"
echo "2. Test the role-based access in your application"
echo "3. Use ./manage_cognito_users.sh to assign users to appropriate roles"
echo
echo -e "${GREEN}✅ Role-based access control is now configured!${NC}"
