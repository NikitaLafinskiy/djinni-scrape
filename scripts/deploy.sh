#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

REGION="${AWS_REGION:-eu-central-1}"
REPOSITORY="djinni-scrape"
TAG="$(git rev-parse --short HEAD)"
if ! git diff --quiet HEAD; then
    TAG="$TAG-dirty-$(date +%s)"
fi

terraform -chdir=.infra init -input=false >/dev/null

if ! aws ecr describe-repositories --region "$REGION" --repository-names "$REPOSITORY" >/dev/null 2>&1; then
    echo "creating the ECR repository"
    terraform -chdir=.infra apply -target=module.ecr -var "image_tag=$TAG" "$@"
fi

REPOSITORY_URL="$(aws ecr describe-repositories --region "$REGION" --repository-names "$REPOSITORY" --query 'repositories[0].repositoryUri' --output text)"

if aws ecr describe-images --region "$REGION" --repository-name "$REPOSITORY" --image-ids "imageTag=$TAG" >/dev/null 2>&1; then
    echo "image $TAG is already pushed"
else
    aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "${REPOSITORY_URL%%/*}"
    BUILD_FLAGS=()
    # Lambda rejects the OCI index manifest buildx writes when provenance attestations are on
    if docker buildx version >/dev/null 2>&1; then
        BUILD_FLAGS+=(--provenance=false)
    fi
    docker build --platform linux/amd64 "${BUILD_FLAGS[@]}" -t "$REPOSITORY_URL:$TAG" .
    docker push "$REPOSITORY_URL:$TAG"
fi

terraform -chdir=.infra apply -var "image_tag=$TAG" "$@"
