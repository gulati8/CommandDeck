name: Deploy {{APP_NAME}}

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
    types: [opened, synchronize, closed]

permissions:
  contents: read
  packages: write

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test

  build-and-push:
    needs: test
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Determine tag
        id: tag
        run: |
          if [ "${{ github.event_name }}" = "pull_request" ]; then
            echo "tag=pr-${{ github.event.pull_request.number }}" >> "$GITHUB_OUTPUT"
          else
            echo "tag=latest" >> "$GITHUB_OUTPUT"
          fi

      - name: Build and push image
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ghcr.io/gulati8/{{APP_NAME}}:${{ steps.tag.outputs.tag }}
            ghcr.io/gulati8/{{APP_NAME}}:${{ github.sha }}

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Determine deploy target
        id: target
        run: |
          if [ "${{ github.event_name }}" = "pull_request" ]; then
            echo "app_name={{APP_NAME}}-pr-${{ github.event.pull_request.number }}" >> "$GITHUB_OUTPUT"
            echo "image_tag=pr-${{ github.event.pull_request.number }}" >> "$GITHUB_OUTPUT"
          else
            echo "app_name={{APP_NAME}}" >> "$GITHUB_OUTPUT"
            echo "image_tag=latest" >> "$GITHUB_OUTPUT"
          fi

      - name: Pull and restart on EC2
        run: |
          aws ssm send-command \
            --instance-ids "${{ secrets.EC2_INSTANCE_ID }}" \
            --document-name "AWS-RunShellScript" \
            --parameters 'commands=[
              "cd /srv/${{ steps.target.outputs.app_name }}",
              "docker compose pull",
              "docker compose up -d --remove-orphans"
            ]' \
            --output text

  cleanup-pr:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Remove PR environment
        run: |
          aws ssm send-command \
            --instance-ids "${{ secrets.EC2_INSTANCE_ID }}" \
            --document-name "AWS-RunShellScript" \
            --parameters 'commands=[
              "cd /srv/{{APP_NAME}}-pr-${{ github.event.pull_request.number }}",
              "docker compose down --remove-orphans 2>/dev/null || true",
              "rm -rf /srv/{{APP_NAME}}-pr-${{ github.event.pull_request.number }}"
            ]' \
            --output text
