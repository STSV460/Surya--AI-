#!/usr/bin/env bash
# ============================================================
# Surya AI — Deploy to AWS ECS
# Builds Docker image, pushes to ECR, updates ECS service
# Usage: bash aws/deploy.sh [image-tag]
# ============================================================
set -euo pipefail
source "$(dirname "$0")/config.env"

IMAGE_TAG="${1:-$(git rev-parse --short HEAD 2>/dev/null || echo 'latest')}"
IMAGE_URI="${ECR_URI}:${IMAGE_TAG}"
IMAGE_LATEST="${ECR_URI}:latest"

echo "==> Surya AI Deploy"
echo "    Tag:    $IMAGE_TAG"
echo "    Image:  $IMAGE_URI"
echo ""

# ── 1. ECR Login ─────────────────────────────────────────────
echo "==> [1/5] ECR login..."
aws ecr get-login-password --region "$REGION" | \
  docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

# ── 2. Docker Build ──────────────────────────────────────────
echo ""
echo "==> [2/5] Building Docker image..."
cd "$(dirname "$0")/.."
docker build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_APP_URL="https://${DOMAIN}" \
  --build-arg NEXT_PUBLIC_APP_NAME="Surya AI" \
  -t "$IMAGE_URI" \
  -t "$IMAGE_LATEST" \
  .

# ── 3. Push to ECR ───────────────────────────────────────────
echo ""
echo "==> [3/5] Pushing to ECR..."
docker push "$IMAGE_URI"
docker push "$IMAGE_LATEST"

# ── 4. Register Task Definition ──────────────────────────────
echo ""
echo "==> [4/5] Registering ECS task definition..."
TASK_DEF=$(cat aws/task-definition.json | sed "s/ACCOUNT_ID/${ACCOUNT_ID}/g")
NEW_TASK_DEF_ARN=$(echo "$TASK_DEF" | \
  aws ecs register-task-definition \
    --cli-input-json file:///dev/stdin \
    --region "$REGION" \
    --query 'taskDefinition.taskDefinitionArn' --output text)
echo "    New task def: $NEW_TASK_DEF_ARN"

# ── 5. Update ECS Service ────────────────────────────────────
echo ""
echo "==> [5/5] Updating ECS service..."

# Create service if it doesn't exist yet
SERVICE_EXISTS=$(aws ecs describe-services \
  --cluster "${APP_NAME}-cluster" \
  --services "${APP_NAME}-service" \
  --region "$REGION" \
  --query 'services[0].status' --output text 2>/dev/null || echo "MISSING")

SUBNET_LIST=$(echo "$SUBNET_IDS" | tr ' ' ',')

if [[ "$SERVICE_EXISTS" == "MISSING" || "$SERVICE_EXISTS" == "INACTIVE" || "$SERVICE_EXISTS" == "None" ]]; then
  echo "    Creating ECS service (first deploy)..."
  aws ecs create-service \
    --cluster "${APP_NAME}-cluster" \
    --service-name "${APP_NAME}-service" \
    --task-definition "$NEW_TASK_DEF_ARN" \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_LIST}],securityGroups=[${ECS_SG_ID}],assignPublicIp=ENABLED}" \
    --load-balancers "targetGroupArn=${TG_ARN},containerName=${APP_NAME},containerPort=3000" \
    --region "$REGION"
else
  echo "    Updating existing ECS service..."
  aws ecs update-service \
    --cluster "${APP_NAME}-cluster" \
    --service "${APP_NAME}-service" \
    --task-definition "$NEW_TASK_DEF_ARN" \
    --force-new-deployment \
    --region "$REGION"
fi

# ── CloudFront Invalidation ───────────────────────────────────
if [[ -n "${CF_ID:-}" ]]; then
  echo ""
  echo "==> CloudFront cache invalidation..."
  aws cloudfront create-invalidation \
    --distribution-id "$CF_ID" \
    --paths "/*" \
    --query 'Invalidation.Id' --output text
fi

echo ""
echo "✅ Deploy triggered! ECS will pull the new image and restart."
echo "   Watch: https://ap-south-1.console.aws.amazon.com/ecs/v2/clusters/${APP_NAME}-cluster/services/${APP_NAME}-service"
echo ""
echo "   Wait ~2 min then verify:"
echo "   curl https://${DOMAIN}/api/health"
