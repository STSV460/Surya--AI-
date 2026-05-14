#!/usr/bin/env bash
# Push Surya AI runtime secrets to AWS Secrets Manager.
#
# This script intentionally contains no secret values. Export each required
# variable in your shell or load them from a local, git-ignored file before
# running it.
set -euo pipefail

REGION="${REGION:-ap-south-1}"
PREFIX="${SECRET_PREFIX:-surya-ai}"

required=(
  NEXTAUTH_SECRET
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  GITHUB_CLIENT_ID
  GITHUB_CLIENT_SECRET
  INSFORGE_API_KEY
  INSFORGE_ANON_KEY
  ELEVENLABS_API_KEY
  SARVAM_API_KEY
  FAL_KEY
  REPLICATE_API_TOKEN
  GOOGLE_AI_API_KEY
  TOKEN_ENCRYPTION_KEY
)

put_secret() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    echo "Missing required env var: $name" >&2
    exit 1
  fi

  aws secretsmanager create-secret \
    --name "${PREFIX}/${name}" \
    --secret-string "$value" \
    --region "$REGION" >/dev/null 2>&1 || \
  aws secretsmanager update-secret \
    --secret-id "${PREFIX}/${name}" \
    --secret-string "$value" \
    --region "$REGION" >/dev/null
}

echo "Pushing ${#required[@]} secrets to AWS Secrets Manager in ${REGION}..."
for name in "${required[@]}"; do
  put_secret "$name"
done
echo "Done. Rotate any values that were previously exposed before deploying."
