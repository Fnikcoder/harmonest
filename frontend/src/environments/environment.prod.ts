// Legacy environment file - now using centralized configuration
// This file is kept for backward compatibility and build process
// All configuration values are now loaded from master-config.json via ConfigService

export const environment = {
  production: true,
  // Note: These values are now loaded dynamically from master-config.json
  // Use ConfigService.getConfig() to access current configuration
  configSource: 'master-config.json',

  // Minimal fallback values for build process
  apiUrl: 'https://api.harmonest.com',
  emailVerificationEnabled: {
    signup: true,
    booking: true
  },
  developmentMode: false,
  stripe: {
    publishableKey: 'pk_live_fallback'
  },
  paypal: {
    clientId: 'live_paypal_fallback'
  },
  cognito: {
    region: 'eu-central-1',
    userPoolId: 'fallback',
    userPoolWebClientId: 'fallback',
    identityPoolId: 'fallback',
    oauth: {
      domain: '',
      scope: ['openid', 'email', 'profile'],
      redirectSignIn: 'https://harmonest.de/auth/callback',
      redirectSignOut: 'https://harmonest.de/auth/logout',
      responseType: 'code'
    }
  }
};
