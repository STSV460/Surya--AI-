#!/usr/bin/env bash
# Prints the CNAME records you must add in Hostinger hPanel for ACM DNS validation
set -euo pipefail
source "$(dirname "$0")/config.env"

echo "==> ACM DNS Validation Records"
echo "    Add ALL of these as CNAME records in Hostinger hPanel → DNS Zone"
echo ""

for CERT_ARN in "$REGIONAL_CERT_ARN" "$GLOBAL_CERT_ARN"; do
  CERT_REGION=$(echo "$CERT_ARN" | grep -o 'us-east-1' || echo "$REGION")
  [[ "$CERT_ARN" == *"us-east-1"* ]] && R="us-east-1" || R="$REGION"

  echo "--- Cert: $CERT_ARN (region: $R) ---"
  aws acm describe-certificate \
    --certificate-arn "$CERT_ARN" \
    --region "$R" \
    --query 'Certificate.DomainValidationOptions[*].[ResourceRecord.Name, ResourceRecord.Value]' \
    --output table
  echo ""
done

echo "After adding CNAMEs, check status:"
echo "  aws acm describe-certificate --certificate-arn $REGIONAL_CERT_ARN --region $REGION --query 'Certificate.Status'"
echo "  aws acm describe-certificate --certificate-arn $GLOBAL_CERT_ARN   --region us-east-1 --query 'Certificate.Status'"
