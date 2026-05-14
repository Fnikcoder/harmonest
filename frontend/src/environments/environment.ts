// Legacy environment file - now using centralized configuration
// This file is kept for backward compatibility and build process
// All configuration values are now loaded from master-config.json via ConfigService

export const environment = {
  production: false,
  // Note: These values are now loaded dynamically from master-config.json
  // Use ConfigService.getConfig() to access current configuration
  configSource: 'master-config.json',

  // Minimal fallback values for build process
  apiUrl: 'http://localhost:3000/api',
  emailVerificationEnabled: {
    signup: true,
    booking: true
  },
  developmentMode: true,
  stripe: {
    publishableKey: 'pk_test_fallback'
  },
  paypal: {
    clientId: 'test_paypal_fallback'
  },
  cognito: {
    region: 'eu-central-1',
    userPoolId: 'fallback',
    userPoolWebClientId: 'fallback',
    identityPoolId: 'fallback',
    oauth: {
      domain: '',
      scope: ['openid', 'email', 'profile'],
      redirectSignIn: 'http://localhost:4200/auth/callback',
      redirectSignOut: 'http://localhost:4200/auth/logout',
      responseType: 'code'
    }
  }
};
