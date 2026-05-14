#!/usr/bin/env bash
# ============================================================
# Surya AI — One-time AWS Infrastructure Setup
# Run once to create: ECR, VPC, ECS, ALB, ACM certs
# Usage: bash aws/infra-setup.sh
# ============================================================
set -euo pipefail

REGION="ap-south-1"
APP_NAME="surya-ai"
DOMAIN="suryaai.in"

echo "==> Getting AWS Account ID..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "    Account: $ACCOUNT_ID | Region: $REGION"

# ── 1. ECR Repository ────────────────────────────────────────
echo ""
echo "==> [1/9] Creating ECR repository..."
aws ecr create-repository \
  --repository-name "$APP_NAME" \
  --region "$REGION" \
  --image-scanning-configuration scanOnPush=true \
  --query 'repository.repositoryUri' --output text 2>/dev/null || echo "     ECR repo already exists"

ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${APP_NAME}"
echo "    ECR URI: $ECR_URI"

# ── 2. VPC + Subnets ─────────────────────────────────────────
echo ""
echo "==> [2/9] Getting default VPC..."
VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=isDefault,Values=true" \
  --query 'Vpcs[0].VpcId' --output text --region "$REGION")
echo "    VPC: $VPC_ID"

SUBNET_IDS=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'Subnets[*].SubnetId' --output text --region "$REGION")
SUBNET_ARRAY=(${SUBNET_IDS})
echo "    Subnets: ${SUBNET_ARRAY[*]}"

# ── 3. Security Groups ───────────────────────────────────────
echo ""
echo "==> [3/9] Creating security groups..."

# ALB security group — public traffic
ALB_SG_ID=$(aws ec2 create-security-group \
  --group-name "${APP_NAME}-alb-sg" \
  --description "ALB security group for $APP_NAME" \
  --vpc-id "$VPC_ID" \
  --region "$REGION" \
  --query 'GroupId' --output text 2>/dev/null || \
  aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${APP_NAME}-alb-sg" \
    --query 'SecurityGroups[0].GroupId' --output text --region "$REGION")

aws ec2 authorize-security-group-ingress --group-id "$ALB_SG_ID" --protocol tcp --port 80 --cidr 0.0.0.0/0 --region "$REGION" 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id "$ALB_SG_ID" --protocol tcp --port 443 --cidr 0.0.0.0/0 --region "$REGION" 2>/dev/null || true
echo "    ALB SG: $ALB_SG_ID"

# ECS security group — only ALB can reach containers
ECS_SG_ID=$(aws ec2 create-security-group \
  --group-name "${APP_NAME}-ecs-sg" \
  --description "ECS task security group for $APP_NAME" \
  --vpc-id "$VPC_ID" \
  --region "$REGION" \
  --query 'GroupId' --output text 2>/dev/null || \
  aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${APP_NAME}-ecs-sg" \
    --query 'SecurityGroups[0].GroupId' --output text --region "$REGION")

aws ec2 authorize-security-group-ingress --group-id "$ECS_SG_ID" --protocol tcp --port 3000 --source-group "$ALB_SG_ID" --region "$REGION" 2>/dev/null || true
echo "    ECS SG: $ECS_SG_ID"

# ── 4. ECS Cluster ───────────────────────────────────────────
echo ""
echo "==> [4/9] Creating ECS cluster..."
aws ecs create-cluster \
  --cluster-name "${APP_NAME}-cluster" \
  --capacity-providers FARGATE \
  --region "$REGION" \
  --query 'cluster.clusterArn' --output text 2>/dev/null || echo "     Cluster already exists"

# ── 5. IAM Role for ECS Task ─────────────────────────────────
echo ""
echo "==> [5/9] Creating ECS task execution role..."
aws iam create-role \
  --role-name "${APP_NAME}-task-execution-role" \
  --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{
      "Effect":"Allow",
      "Principal":{"Service":"ecs-tasks.amazonaws.com"},
      "Action":"sts:AssumeRole"
    }]
  }' 2>/dev/null || echo "     Role already exists"

aws iam attach-role-policy \
  --role-name "${APP_NAME}-task-execution-role" \
  --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy" 2>/dev/null || true
echo "    Role: ${APP_NAME}-task-execution-role"

# ── 6. CloudWatch Log Group ──────────────────────────────────
echo ""
echo "==> [6/9] Creating CloudWatch log group..."
aws logs create-log-group --log-group-name "/ecs/${APP_NAME}" --region "$REGION" 2>/dev/null || echo "     Log group already exists"

# ── 7. ALB ───────────────────────────────────────────────────
echo ""
echo "==> [7/9] Creating Application Load Balancer..."
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name "${APP_NAME}-alb" \
  --subnets "${SUBNET_ARRAY[@]}" \
  --security-groups "$ALB_SG_ID" \
  --scheme internet-facing \
  --type application \
  --region "$REGION" \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null || \
  aws elbv2 describe-load-balancers \
    --names "${APP_NAME}-alb" \
    --query 'LoadBalancers[0].LoadBalancerArn' --output text --region "$REGION")

ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns "$ALB_ARN" \
  --query 'LoadBalancers[0].DNSName' --output text --region "$REGION")
echo "    ALB ARN: $ALB_ARN"
echo "    ALB DNS: $ALB_DNS"

# Target Group
TG_ARN=$(aws elbv2 create-target-group \
  --name "${APP_NAME}-tg" \
  --protocol HTTP \
  --port 3000 \
  --vpc-id "$VPC_ID" \
  --target-type ip \
  --health-check-path "/api/health" \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region "$REGION" \
  --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || \
  aws elbv2 describe-target-groups \
    --names "${APP_NAME}-tg" \
    --query 'TargetGroups[0].TargetGroupArn' --output text --region "$REGION")
echo "    Target Group: $TG_ARN"

# HTTP listener → redirect to HTTPS
aws elbv2 create-listener \
  --load-balancer-arn "$ALB_ARN" \
  --protocol HTTP --port 80 \
  --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}' \
  --region "$REGION" 2>/dev/null || echo "     HTTP listener already exists"

# ── 8. ACM Certificates ──────────────────────────────────────
echo ""
echo "==> [8/9] Requesting ACM certificates..."

# Regional cert (ap-south-1) for ALB
REGIONAL_CERT_ARN=$(aws acm request-certificate \
  --domain-name "$DOMAIN" \
  --subject-alternative-names "www.$DOMAIN" \
  --validation-method DNS \
  --region "$REGION" \
  --query 'CertificateArn' --output text)
echo "    Regional cert (ALB): $REGIONAL_CERT_ARN"

# Global cert (us-east-1) for CloudFront — MUST be us-east-1
GLOBAL_CERT_ARN=$(aws acm request-certificate \
  --domain-name "$DOMAIN" \
  --subject-alternative-names "www.$DOMAIN" \
  --validation-method DNS \
  --region us-east-1 \
  --query 'CertificateArn' --output text)
echo "    Global cert (CloudFront): $GLOBAL_CERT_ARN"

echo ""
echo "  ⚠️  ACTION REQUIRED — DNS Validation:"
echo "  Wait ~60 seconds then run: bash aws/get-cert-dns-records.sh"
echo "  Add the CNAME records it shows into Hostinger hPanel → DNS Zone."
echo "  Certs will auto-validate once CNAMEs propagate (5-30 min)."

# ── 9. Save config for other scripts ─────────────────────────
echo ""
echo "==> [9/9] Saving config to aws/config.env..."
cat > aws/config.env <<EOF
ACCOUNT_ID=$ACCOUNT_ID
REGION=$REGION
APP_NAME=$APP_NAME
DOMAIN=$DOMAIN
ECR_URI=$ECR_URI
VPC_ID=$VPC_ID
ALB_ARN=$ALB_ARN
ALB_DNS=$ALB_DNS
TG_ARN=$TG_ARN
ALB_SG_ID=$ALB_SG_ID
ECS_SG_ID=$ECS_SG_ID
SUBNET_IDS="${SUBNET_ARRAY[*]}"
REGIONAL_CERT_ARN=$REGIONAL_CERT_ARN
GLOBAL_CERT_ARN=$GLOBAL_CERT_ARN
EOF
echo "    Saved."

echo ""
echo "✅ Infrastructure setup complete!"
echo ""
echo "Next steps:"
echo "  1. Run: bash aws/get-cert-dns-records.sh"
echo "  2. Add CNAME records to Hostinger (DNS validation)"
echo "  3. Wait for certs to be ISSUED (~5-30 min)"
echo "  4. Run: bash aws/setup-cloudfront.sh"
echo "  5. Run: bash aws/deploy.sh  (first deploy)"
