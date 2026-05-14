# Configuration System

This project now uses a centralized configuration system based on `master-config.json` and the `ConfigService`.

## Overview

All configuration values are now centralized in:
- **Primary**: `src/assets/config/master-config.json` - Main configuration file
- **Service**: `src/app/services/config.service.ts` - Configuration service
- **Legacy**: Environment files are kept for build compatibility but use fallback values

## Configuration Structure

The master configuration includes:

### Client Information
- Client ID, name, domain
- Deployment region
- Subdomains

### Environment Settings
- Environment type (dev/prod)
- Debug mode
- Analytics settings

### AWS Configuration
- **Cognito**: User Pool, Client ID, Identity Pool, OAuth settings
- **DynamoDB**: Table names, regions, endpoints
- **S3**: Bucket names, regions
- **API Gateway**: Base URLs, regions, stages

### API Endpoints
- Check-in API
- Email verification API
- Booking API
- Payment API

### Payment Configuration
- Stripe settings (publishable keys)
- PayPal settings (client IDs)
- Currency and tax rates

### Social Providers
- Google OAuth
- Facebook OAuth
- Apple OAuth

### Feature Flags
- Authentication features (MFA, social login, email verification)
- Booking features (guest booking, instant booking)
- Check-in features (online check-in, ID verification, QR codes)

### Content & Localization
- Homepage content
- Supported languages
- Currency settings

## Usage

### In Services (Recommended)

```typescript
import { ConfigService } from '../services/config.service';

@Injectable()
export class MyService {
  constructor(private configService: ConfigService) {}

  someMethod() {
    const config = this.configService.getConfig();
    const awsConfig = this.configService.getAwsConfig();
    const apiUrl = this.configService.getApiUrl('checkin');
  }
}
```

### Reactive Configuration

```typescript
this.configService.getConfigObservable().subscribe(config => {
  if (config) {
    // Use configuration
  }
});
```

### Environment-Specific Values

The configuration automatically adapts based on the `environment.type` field:
- `dev` - Development settings
- `prod` - Production settings

## Migration from Legacy Config

### Deprecated Files (Still Available for Compatibility)
- `src/app/config/aws.config.ts` - Use `ConfigService.getAwsConfig()` instead
- `src/app/config/auth.config.ts` - Use `ConfigService.getAuthConfig()` instead
- `src/app/config/api-endpoints.config.ts` - Use `ConfigService.getApiUrl()` instead
- `src/app/config/checkin-api.config.ts` - Use `ConfigService.getApiUrl('checkin')` instead
- `src/environments/environment.ts` - Use `ConfigService.getConfig()` instead

### Migration Steps

1. **Replace direct imports** of config files with `ConfigService` injection
2. **Update service constructors** to inject `ConfigService`
3. **Replace hardcoded values** with dynamic config loading
4. **Test configuration loading** in both dev and prod environments

## Configuration Management

### Development
- Edit `src/assets/config/master-config.json` directly
- Use the configurator UI (if available) at `localhost:4200/configurator`
- Configuration changes are hot-reloaded

### Production
- Deploy updated `master-config.json` with your application
- Use environment-specific build processes to swap config files
- Consider using AWS Parameter Store or similar for sensitive values

## Security Considerations

### Sensitive Values
- Never commit real API keys or secrets to version control
- Use placeholder values in the repository
- Replace with real values during deployment
- Consider using AWS Secrets Manager for production

### Client-Side Exposure
- All values in `master-config.json` are exposed to the client
- Only include public configuration values
- Use server-side configuration for sensitive settings

## Environment Switching

To switch between dev and prod:

1. **Update environment.type** in `master-config.json`:
   ```json
   {
     "environment": {
       "type": "prod"  // or "dev"
     }
   }
   ```

2. **Update resource names** to match your environment:
   ```json
   {
     "technical": {
       "aws": {
         "dynamodb": {
           "tableName": "harmonest-prod-main"  // or "harmonest-dev-main"
         }
       }
     }
   }
   ```

## Troubleshooting

### Configuration Not Loading
1. Check browser console for errors
2. Verify `master-config.json` is accessible at `/assets/config/master-config.json`
3. Ensure JSON syntax is valid
4. Check network tab for 404 errors

### Service Injection Issues
1. Ensure `ConfigService` is imported in your module
2. Check that services are properly injected in constructors
3. Verify service dependencies are available

### Environment-Specific Issues
1. Verify `environment.type` matches your intended environment
2. Check that resource names match your AWS resources
3. Ensure API endpoints are correct for your environment

## Best Practices

1. **Always use ConfigService** for new code
2. **Subscribe to config changes** for reactive updates
3. **Handle null/undefined config** gracefully
4. **Use environment-specific resource naming**
5. **Keep sensitive values out of client-side config**
6. **Document configuration changes** in your deployment process
