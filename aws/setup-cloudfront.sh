#!/usr/bin/env bash
# Creates CloudFront distribution pointing to ALB, with suryaai.in custom domain
# Run AFTER both ACM certs show status ISSUED
set -euo pipefail
source "$(dirname "$0")/config.env"

echo "==> Checking certs are ISSUED..."
REGIONAL_STATUS=$(aws acm describe-certificate --certificate-arn "$REGIONAL_CERT_ARN" --region "$REGION" --query 'Certificate.Status' --output text)
GLOBAL_STATUS=$(aws acm describe-certificate --certificate-arn "$GLOBAL_CERT_ARN" --region us-east-1 --query 'Certificate.Status' --output text)

if [[ "$REGIONAL_STATUS" != "ISSUED" || "$GLOBAL_STATUS" != "ISSUED" ]]; then
  echo "❌ Certs not ISSUED yet. Regional=$REGIONAL_STATUS | Global=$GLOBAL_STATUS"
  echo "   Add CNAME records to Hostinger first, then wait 5-30 min."
  exit 1
fi
echo "    Both certs ISSUED ✓"

# Attach HTTPS listener to ALB (needs regional cert)
echo ""
echo "==> Adding HTTPS listener to ALB..."
aws elbv2 create-listener \
  --load-balancer-arn "$ALB_ARN" \
  --protocol HTTPS --port 443 \
  --certificates CertificateArn="$REGIONAL_CERT_ARN" \
  --default-actions Type=forward,TargetGroupArn="$TG_ARN" \
  --region "$REGION" 2>/dev/null || echo "     HTTPS listener already exists"

# CloudFront origin shield secret (ALB only accepts CF traffic)
CF_SECRET="surya-ai-cf-$(openssl rand -hex 8)"

echo ""
echo "==> Creating CloudFront distribution..."
CF_DIST=$(aws cloudfront create-distribution \
  --distribution-config "{
    \"CallerReference\": \"surya-ai-$(date +%s)\",
    \"Aliases\": {\"Quantity\": 2, \"Items\": [\"$DOMAIN\", \"www.$DOMAIN\"]},
    \"DefaultRootObject\": \"\",
    \"Origins\": {
      \"Quantity\": 1,
      \"Items\": [{
        \"Id\": \"${APP_NAME}-alb\",
        \"DomainName\": \"$ALB_DNS\",
        \"CustomOriginConfig\": {
          \"HTTPPort\": 80,
          \"HTTPSPort\": 443,
          \"OriginProtocolPolicy\": \"http-only\"
        },
        \"CustomHeaders\": {
          \"Quantity\": 1,
          \"Items\": [{
            \"HeaderName\": \"X-CF-Secret\",
            \"HeaderValue\": \"$CF_SECRET\"
          }]
        }
      }]
    },
    \"CacheBehaviors\": {
      \"Quantity\": 2,
      \"Items\": [
        {
          \"PathPattern\": \"/api/*\",
          \"TargetOriginId\": \"${APP_NAME}-alb\",
          \"ViewerProtocolPolicy\": \"redirect-to-https\",
          \"AllowedMethods\": {\"Quantity\": 7, \"Items\": [\"GET\",\"HEAD\",\"OPTIONS\",\"PUT\",\"POST\",\"PATCH\",\"DELETE\"], \"CachedMethods\": {\"Quantity\": 2, \"Items\": [\"GET\",\"HEAD\"]}},
          \"CachePolicyId\": \"4135ea2d-6df8-44a3-9df3-4b5a84be39ad\",
          \"OriginRequestPolicyId\": \"b689b0a8-53d0-40ab-baf2-68738e2966ac\",
          \"ResponseHeadersPolicyId\": \"5cc3b908-e619-4b99-88e5-2cf7f45965bd\",
          \"Compress\": true
        },
        {
          \"PathPattern\": \"/_next/static/*\",
          \"TargetOriginId\": \"${APP_NAME}-alb\",
          \"ViewerProtocolPolicy\": \"redirect-to-https\",
          \"AllowedMethods\": {\"Quantity\": 2, \"Items\": [\"GET\",\"HEAD\"], \"CachedMethods\": {\"Quantity\": 2, \"Items\": [\"GET\",\"HEAD\"]}},
          \"CachePolicyId\": \"658327ea-f89d-4fab-a63d-7e88639e58f6\",
          \"Compress\": true
        }
      ]
    },
    \"DefaultCacheBehavior\": {
      \"TargetOriginId\": \"${APP_NAME}-alb\",
      \"ViewerProtocolPolicy\": \"redirect-to-https\",
      \"AllowedMethods\": {\"Quantity\": 7, \"Items\": [\"GET\",\"HEAD\",\"OPTIONS\",\"PUT\",\"POST\",\"PATCH\",\"DELETE\"], \"CachedMethods\": {\"Quantity\": 2, \"Items\": [\"GET\",\"HEAD\"]}},
      \"CachePolicyId\": \"4135ea2d-6df8-44a3-9df3-4b5a84be39ad\",
      \"OriginRequestPolicyId\": \"b689b0a8-53d0-40ab-baf2-68738e2966ac\",
      \"Compress\": true
    },
    \"ViewerCertificate\": {
      \"ACMCertificateArn\": \"$GLOBAL_CERT_ARN\",
      \"SSLSupportMethod\": \"sni-only\",
      \"MinimumProtocolVersion\": \"TLSv1.2_2021\"
    },
    \"HttpVersion\": \"http2\",
    \"PriceClass\": \"PriceClass_All\",
    \"Enabled\": true,
    \"Comment\": \"Surya AI production distribution\"
  }" \
  --query 'Distribution.[Id,DomainName]' --output text)

CF_ID=$(echo "$CF_DIST" | awk '{print $1}')
CF_DOMAIN=$(echo "$CF_DIST" | awk '{print $2}')

echo "    CloudFront ID:     $CF_ID"
echo "    CloudFront Domain: $CF_DOMAIN"

# Save to config
echo "CF_ID=$CF_ID" >> aws/config.env
echo "CF_DOMAIN=$CF_DOMAIN" >> aws/config.env
echo "CF_SECRET=$CF_SECRET" >> aws/config.env

echo ""
echo "✅ CloudFront created!"
echo ""
echo "⚠️  ACTION REQUIRED — Hostinger hPanel DNS:"
echo "   1. Delete existing A record for @ (root)"
echo "   2. Add CNAME:  @   →  $CF_DOMAIN"
echo "   3. Add CNAME:  www →  $CF_DOMAIN"
echo ""
echo "Then run: bash aws/deploy.sh"
