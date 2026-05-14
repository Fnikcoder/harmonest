import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { USER_ROLES } from '../config/constants';

export interface AuthStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;
  public readonly authenticatedRole: iam.Role;
  public readonly unauthenticatedRole: iam.Role;
  public readonly userGroups: Record<string, cognito.CfnUserPoolGroup>;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Create User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: config.cognito.userPoolName,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        phone: true,
        username: false,
      },
      autoVerify: {
        email: true,
        phone: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        phoneNumber: {
          required: false,
          mutable: true,
        },
        givenName: {
          required: true,
          mutable: true,
        },
        familyName: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        role: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 20,
          mutable: true,
        }),
        firstName: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 50,
          mutable: true,
        }),
        lastName: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 50,
          mutable: true,
        }),
      },
      passwordPolicy: {
        minLength: config.cognito.passwordPolicy.minLength,
        requireLowercase: config.cognito.passwordPolicy.requireLowercase,
        requireUppercase: config.cognito.passwordPolicy.requireUppercase,
        requireDigits: config.cognito.passwordPolicy.requireNumbers,
        requireSymbols: config.cognito.passwordPolicy.requireSymbols,
      },
      mfa: cognito.Mfa.OFF,
      accountRecovery: cognito.AccountRecovery.EMAIL_AND_PHONE_WITHOUT_MFA,
      removalPolicy: config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Create User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: config.cognito.userPoolClientName,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: true,
        adminUserPassword: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
          cognito.OAuthScope.PHONE,
        ],
        callbackUrls: [
          `https://${config.domainName}/auth/callback`,
          'http://localhost:4200/auth/callback',
        ],
        logoutUrls: [
          `https://${config.domainName}/auth/signout`,
          'http://localhost:4200/auth/signout',
        ],
      },
      preventUserExistenceErrors: true,
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
    });

    // Create Identity Pool
    this.identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName: config.cognito.identityPoolName,
      allowUnauthenticatedIdentities: config.cognito.allowUnauthenticatedIdentities,
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
          serverSideTokenCheck: false,
        },
      ],
    });

    // Create IAM roles for authenticated and unauthenticated users
    this.authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
      roleName: `Harmonest-${config.environment}-Authenticated-Role`,
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      inlinePolicies: {
        AuthenticatedPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cognito-sync:*',
                'cognito-identity:*',
              ],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
              ],
              resources: [
                `arn:aws:s3:::${config.s3.bucketName}/users/\${cognito-identity.amazonaws.com:sub}/*`,
              ],
            }),
          ],
        }),
      },
    });

    this.unauthenticatedRole = new iam.Role(this, 'UnauthenticatedRole', {
      roleName: `Harmonest-${config.environment}-Unauthenticated-Role`,
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      inlinePolicies: {
        UnauthenticatedPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cognito-sync:*',
              ],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // Attach roles to Identity Pool
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: this.identityPool.ref,
      roles: {
        authenticated: this.authenticatedRole.roleArn,
        unauthenticated: this.unauthenticatedRole.roleArn,
      },
    });

    // Create User Groups
    this.userGroups = {};
    const roles = Object.values(USER_ROLES);
    
    roles.forEach((role) => {
      this.userGroups[role] = new cognito.CfnUserPoolGroup(this, `${role}Group`, {
        userPoolId: this.userPool.userPoolId,
        groupName: role,
        description: `${role.charAt(0).toUpperCase() + role.slice(1)} user group`,
        precedence: this.getRolePrecedence(role),
      });
    });
  }

  private getRolePrecedence(role: string): number {
    const precedenceMap: Record<string, number> = {
      [USER_ROLES.SUPER_ADMIN]: 1,
      [USER_ROLES.OWNER]: 2,
      [USER_ROLES.ADMIN]: 3,
      [USER_ROLES.SUPPORT]: 4,
      [USER_ROLES.USER]: 5,
      [USER_ROLES.GUEST]: 6,
    };
    return precedenceMap[role] || 10;
  }
}
