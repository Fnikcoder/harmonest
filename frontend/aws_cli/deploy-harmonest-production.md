# 🚀 Harmonest Production Deployment Guide

## Current Status ✅
- **SSL Certificate**: ISSUED for harmonest.de and dev.harmonest.de
- **Certificate ARN**: `arn:aws:acm:us-east-1:669597026882:certificate/95795cc3-cb98-4fd7-a862-1f0682fe3520`
- **AWS Account**: 669597026882
- **Region**: eu-central-1
- **Backend APIs**: Deployed and running
- **Configuration**: Updated for production

## S3 Bucket Names
- **Production**: `harmonest.de`
- **Development**: `dev.harmonest.de`

## Deployment Commands (Run in Order)

### Step 1: Verify Current Setup
```powershell
& "C:\Program Files\Git\bin\bash.exe" aws_cli/verify-production-setup.sh
```

### Step 2: Create Production S3 Bucket
```powershell
& "C:\Program Files\Git\bin\bash.exe" aws_cli/setup-s3-hosting.sh
```
- Choose option **2** for Production
- This creates bucket: `harmonest.de`

### Step 3: Create CloudFront Distribution
```powershell
& "C:\Program Files\Git\bin\bash.exe" aws_cli/setup-cloudfront.sh
```
- Choose option **2** for Production
- Uses existing SSL certificate
- Creates distribution for `harmonest.de`

### Step 4: Build and Deploy
```powershell
& "C:\Program Files\Git\bin\bash.exe" aws_cli/deploy-to-production.sh
```
- Choose option **2** for Production
- Builds Angular app for production
- Uploads to S3 bucket `harmonest.de`
- Creates CloudFront invalidation

## What Each Script Does

### `setup-s3-hosting.sh`
- Creates S3 bucket with domain name
- Configures static website hosting
- Sets up public access policies
- Configures CORS for API access

### `setup-cloudfront.sh`
- Creates CloudFront distribution
- Configures SSL certificate (already exists)
- Sets up custom domain aliases
- Configures caching and error handling
- Sets up SPA routing (404 → index.html)

### `deploy-to-production.sh`
- Updates build date in configuration
- Builds Angular app for production
- Uploads files to S3 with proper cache headers
- Creates CloudFront invalidation
- Provides deployment summary

## Expected Results

After successful deployment:
- **Production Site**: https://harmonest.de
- **Development Site**: https://dev.harmonest.de (if dev bucket created)
- **CloudFront**: Global CDN with SSL
- **S3**: Static hosting with proper policies

## DNS Configuration (Manual Step)

After CloudFront is created, you'll need to:
1. Get the CloudFront distribution domain name
2. Create CNAME record in your DNS provider:
   - `harmonest.de` → `[cloudfront-domain].cloudfront.net`
   - `www.harmonest.de` → `[cloudfront-domain].cloudfront.net`

## Monitoring

- **CloudWatch Logs**: Monitor Lambda functions
- **CloudFront Metrics**: Monitor CDN performance
- **S3 Access Logs**: Monitor website access
- **API Gateway**: Monitor backend API calls

## Rollback Plan

If issues occur:
1. Revert to previous S3 version
2. Create new CloudFront invalidation
3. Check CloudWatch logs for errors
4. Verify configuration files

## Security Notes

- SSL certificate is properly configured
- S3 bucket has public read access (required for static hosting)
- CloudFront enforces HTTPS redirects
- CORS is configured for API access
- All AWS resources use IAM roles for security

## Cost Optimization

- CloudFront PriceClass_100 (US, Canada, Europe)
- S3 Standard storage class
- CloudFront caching reduces origin requests
- Lambda functions are pay-per-use

## Next Steps After Deployment

1. Test all functionality on production
2. Set up monitoring and alerts
3. Configure backup strategies
4. Plan for scaling if needed
5. Set up CI/CD pipeline for future deployments
