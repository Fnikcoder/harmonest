#!/bin/bash

CONFIG_FILE="$(dirname "$0")/aws_config.json"
TMP_DIST_CONFIG="./cloudfront_temp_config.json"
TMP_DIST_OLD_CONFIG="./cloudfront_old_config.json"
TMP_DIST_OLD_BODY="./cloudfront_old_body.json"

# Extract AWS profile from config
AWS_PROFILE=$(awk '
  /"aws_profile"/ {
    match($0, /"aws_profile"[[:space:]]*:[[:space:]]*"([^"]+)"/, arr)
    if (arr[1]) {
      print arr[1]
      exit
    }
  }
' "$CONFIG_FILE")

if [ -z "$AWS_PROFILE" ]; then
  echo "❌ Could not find aws_profile in $CONFIG_FILE"
  exit 1
fi

read -p "Create/Update CloudFront for [prod/dev]? " ENV
if ! command -v jq &> /dev/null; then
  echo "❌ jq not found. Please install jq to run updates properly."
  exit 1
fi

# DEBUG
echo "DEBUG: keys in $CONFIG_FILE:"
cat "$CONFIG_FILE"

# Extract values from JSON using awk
BUCKET_NAME=""
DOMAIN_NAME=""
REGION=""
DISTRIBUTION_ID=""

while IFS= read -r line; do
  case "$line" in
    *"\"$ENV\""*) in_env=1 ;;
    *"bucket"*) if [ "$in_env" = 1 ]; then BUCKET_NAME=$(echo "$line" | sed -E 's/.*"bucket"\s*:\s*"([^"]+)".*/\1/'); fi ;;
    *"domain"*) if [ "$in_env" = 1 ]; then DOMAIN_NAME=$(echo "$line" | sed -E 's/.*"domain"\s*:\s*"([^"]+)".*/\1/'); fi ;;
    *"cloudfront_distribution_id"*) if [ "$in_env" = 1 ]; then DISTRIBUTION_ID=$(echo "$line" | sed -E 's/.*"cloudfront_distribution_id"\s*:\s*"([^"]+)".*/\1/'); fi ;;
    *"}"*) in_env=0 ;;
  esac
  if echo "$line" | grep -q '"region"'; then
    REGION=$(echo "$line" | sed -E 's/.*"region"\s*:\s*"([^"]+)".*/\1/')
  fi
done < "$CONFIG_FILE"

echo "📄 Loaded config: BUCKET=$BUCKET_NAME | DOMAIN=$DOMAIN_NAME | REGION=$REGION"

# Ensure S3 bucket exists
echo "📦 Ensuring S3 bucket ($BUCKET_NAME) exists..."
aws s3api create-bucket --bucket "$BUCKET_NAME" --region "$REGION" \
  --create-bucket-configuration LocationConstraint="$REGION" --profile $AWS_PROFILE 2>/dev/null

# Enable website hosting
echo "🌐 Enabling static website hosting..."
aws s3 website s3://"$BUCKET_NAME"/ --index-document index.html --error-document index.html --profile $AWS_PROFILE

# Public bucket policy
EXISTS=$(aws s3api get-bucket-policy --bucket "$BUCKET_NAME" --profile $AWS_PROFILE 2>/dev/null)
if [ -z "$EXISTS" ]; then
  echo "🔓 Setting public read policy..."
  aws s3api put-bucket-policy --bucket "$BUCKET_NAME" --profile $AWS_PROFILE --policy '{
    "Version":"2012-10-17",
    "Statement":[{
      "Sid":"PublicReadGetObject",
      "Effect":"Allow",
      "Principal": "*",
      "Action":["s3:GetObject"],
      "Resource":["arn:aws:s3:::'"$BUCKET_NAME"'/*"]
    }]
  }'
else
  echo "🔒 Bucket policy already exists. Skipping."
fi

# Find ACM cert
echo "🔍 Looking up ACM certificate for $DOMAIN_NAME..."
CERT_ARN=$(aws acm list-certificates --region us-east-1 \
  --query "CertificateSummaryList[?contains(SubjectAlternativeNameSummaries[], '$DOMAIN_NAME')].CertificateArn" \
  --output text --profile $AWS_PROFILE)

if [ -z "$CERT_ARN" ]; then
  echo "❌ No certificate found for $DOMAIN_NAME in us-east-1. Aborting."
  exit 1
fi

CALLER_REF=$(date +%s)

if [ -n "$DISTRIBUTION_ID" ]; then
  # --- UPDATE existing distribution ---
  echo "♻️ Updating existing CloudFront distribution ($DISTRIBUTION_ID)..."

  # Get current distribution config + ETag
  aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" --profile $AWS_PROFILE > "$TMP_DIST_OLD_CONFIG"
  ETag=$(grep '"ETag"' "$TMP_DIST_OLD_CONFIG" | head -n1 | cut -d'"' -f4)
  jq -r '.DistributionConfig' "$TMP_DIST_OLD_CONFIG" > "$TMP_DIST_OLD_BODY"

  # Patch the distribution config JSON (aliases, origins, viewer cert, comment, caller ref)
  # Using jq here, but if jq not available, you can implement manual patching or install jq.
  jq --arg domain "$DOMAIN_NAME" --arg bucket "$BUCKET_NAME" --arg cert "$CERT_ARN" --arg comment "CloudFront distribution for $DOMAIN_NAME" \
    --argjson callerRef "$CALLER_REF" \
    '
    # Do NOT modify CallerReference when updating
    .Aliases = {Quantity:1, Items:[$domain]} |
    .Origins.Items[0].DomainName = ($bucket + ".s3-website." + $region + ".amazonaws.com") |
    .ViewerCertificate = {
      ACMCertificateArn: $cert,
      SSLSupportMethod: "sni-only",
      MinimumProtocolVersion: "TLSv1.2_2021"
    } |
    .Comment = $comment
    ' "$TMP_DIST_OLD_BODY" > "$TMP_DIST_CONFIG"

  aws cloudfront update-distribution \
    --id "$DISTRIBUTION_ID" \
    --if-match "$ETag" \
    --distribution-config file://"$TMP_DIST_CONFIG" \
    --profile $AWS_PROFILE

else
  # --- CREATE new distribution ---
  echo "🚀 Creating new CloudFront distribution..."

  cat > "$TMP_DIST_CONFIG" <<EOF
{
  "CallerReference": "$CALLER_REF",
  "Aliases": {
    "Quantity": 1,
    "Items": ["$DOMAIN_NAME"]
  },
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [{
      "Id": "origin-$DOMAIN_NAME",
      "DomainName": "$BUCKET_NAME.s3-website.$REGION.amazonaws.com",
      "CustomOriginConfig": {
        "HTTPPort": 80,
        "HTTPSPort": 443,
        "OriginProtocolPolicy": "http-only",
        "OriginSslProtocols": {
          "Quantity": 1,
          "Items": ["TLSv1.2"]
        }
      }
    }]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "origin-$DOMAIN_NAME",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["HEAD", "GET"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["HEAD", "GET"]
      }
    },
    "Compress": true,
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": { "Forward": "none" }
    },
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000
  },
  "ViewerCertificate": {
    "ACMCertificateArn": "$CERT_ARN",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021"
  },
  "Logging": {
    "Enabled": false,
    "IncludeCookies": false,
    "Bucket": "",
    "Prefix": ""
  },
  "WebACLId": "",
  "PriceClass": "PriceClass_100",
  "Enabled": true,
  "HttpVersion": "http2",
  "Comment": "CloudFront distribution for $DOMAIN_NAME"
}
EOF

  CREATE_OUTPUT=$(aws cloudfront create-distribution --distribution-config file://"$TMP_DIST_CONFIG" --profile $AWS_PROFILE)
  NEW_ID=$(echo "$CREATE_OUTPUT" | grep '"Id"' | head -n 1 | cut -d'"' -f4)
  echo "🆕 Created distribution ID: $NEW_ID"

  # Update config file without jq
  awk -v env="$ENV" -v id="$NEW_ID" '
    BEGIN {in_env=0}
    {
      if ($0 ~ "\""env"\"[[:space:]]*:[[:space:]]*{") in_env=1
      if (in_env && /cloudfront_distribution_id/) {
        sub(/"cloudfront_distribution_id"[^\n]+/, "\"cloudfront_distribution_id\": \"" id "\"")
        in_env=0
      }
      print
    }
    END {
      if (id && !found) {
        print "    \"cloudfront_distribution_id\": \"" id "\","
      }
    }
  ' "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"

  echo "💾 Distribution ID saved to $CONFIG_FILE"
fi

rm -f "$TMP_DIST_CONFIG" "$TMP_DIST_OLD_CONFIG" "$TMP_DIST_OLD_BODY"
echo "✅ Done."
read -n 1 -s -r -p "Press any key to close this window..."
echo
