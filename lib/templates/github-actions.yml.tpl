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
  pull-requests: read

jobs:
  test:
    runs-on: ubuntu-latest
    if: github.event.action != 'closed'
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
            PR_NUM="${{ github.event.pull_request.number }}"
            echo "app_name={{APP_NAME}}-pr-${PR_NUM}" >> "$GITHUB_OUTPUT"
            echo "image_tag=pr-${PR_NUM}" >> "$GITHUB_OUTPUT"
            echo "is_pr=true" >> "$GITHUB_OUTPUT"
            echo "uat_url=https://{{APP_NAME}}-pr-${PR_NUM}.gulatilabs.me" >> "$GITHUB_OUTPUT"
          else
            echo "app_name={{APP_NAME}}" >> "$GITHUB_OUTPUT"
            echo "image_tag=latest" >> "$GITHUB_OUTPUT"
            echo "is_pr=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Set up PR environment on EC2
        if: steps.target.outputs.is_pr == 'true'
        run: |
          APP_NAME="${{ steps.target.outputs.app_name }}"
          IMAGE_TAG="${{ steps.target.outputs.image_tag }}"

          # Create docker-compose.yml and Caddy entry on EC2
          aws ssm send-command \
            --instance-ids "${{ secrets.EC2_INSTANCE_ID }}" \
            --document-name "AWS-RunShellScript" \
            --parameters "commands=[
              \"mkdir -p /srv/${APP_NAME}\",
              \"cat > /srv/${APP_NAME}/docker-compose.yml << 'COMPOSE'\\nservices:\\n  app:\\n    image: ghcr.io/gulati8/{{APP_NAME}}:${IMAGE_TAG}\\n    container_name: ${APP_NAME}\\n    restart: unless-stopped\\n    networks:\\n      - proxy\\n\\nnetworks:\\n  proxy:\\n    external: true\\nCOMPOSE\",
              \"grep -q '${APP_NAME}.gulatilabs.me' /srv/proxy/Caddyfile 2>/dev/null || printf '\\\\n${APP_NAME}.gulatilabs.me {\\\\n  reverse_proxy ${APP_NAME}:3000\\\\n}\\\\n' >> /srv/proxy/Caddyfile\",
              \"docker exec proxy-caddy-1 caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || docker exec caddy caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || true\"
            ]" \
            --output text

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

      - name: Notify Slack of UAT deployment
        if: steps.target.outputs.is_pr == 'true'
        env:
          SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # Parse Slack thread metadata from PR body
          PR_BODY=$(gh pr view ${{ github.event.pull_request.number }} \
            --json body -q .body \
            --repo "${{ github.repository }}")

          CHANNEL=$(echo "$PR_BODY" | sed -n 's/.*commanddeck:slack_channel=\([^ <]*\).*/\1/p')
          THREAD=$(echo "$PR_BODY" | sed -n 's/.*commanddeck:slack_thread_ts=\([^ <]*\).*/\1/p')

          if [ -n "$CHANNEL" ] && [ -n "$THREAD" ]; then
            UAT_URL="${{ steps.target.outputs.uat_url }}"
            PR_URL="https://github.com/${{ github.repository }}/pull/${{ github.event.pull_request.number }}"

            curl -s -X POST https://slack.com/api/chat.postMessage \
              -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
              -H "Content-type: application/json" \
              -d "{
                \"channel\": \"${CHANNEL}\",
                \"thread_ts\": \"${THREAD}\",
                \"text\": \"🚀 UAT deployed and ready for review:\\n${UAT_URL}\\n\\nPR: ${PR_URL}\"
              }"
          fi

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
          APP_NAME="{{APP_NAME}}-pr-${{ github.event.pull_request.number }}"

          aws ssm send-command \
            --instance-ids "${{ secrets.EC2_INSTANCE_ID }}" \
            --document-name "AWS-RunShellScript" \
            --parameters "commands=[
              \"cd /srv/${APP_NAME} && docker compose down --remove-orphans 2>/dev/null || true\",
              \"rm -rf /srv/${APP_NAME}\",
              \"sed '/${APP_NAME}\\.gulatilabs\\.me/,/}/d' /srv/proxy/Caddyfile > /srv/proxy/Caddyfile.tmp && cat /srv/proxy/Caddyfile.tmp > /srv/proxy/Caddyfile && rm /srv/proxy/Caddyfile.tmp || true\",
              \"docker exec proxy-caddy-1 caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || docker exec caddy caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || true\"
            ]" \
            --output text

      - name: Notify Slack of cleanup
        env:
          SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          PR_BODY=$(gh pr view ${{ github.event.pull_request.number }} \
            --json body -q .body \
            --repo "${{ github.repository }}" 2>/dev/null || true)

          CHANNEL=$(echo "$PR_BODY" | sed -n 's/.*commanddeck:slack_channel=\([^ <]*\).*/\1/p')
          THREAD=$(echo "$PR_BODY" | sed -n 's/.*commanddeck:slack_thread_ts=\([^ <]*\).*/\1/p')

          MERGED="${{ github.event.pull_request.merged }}"
          if [ "$MERGED" = "true" ]; then
            MSG="✅ PR merged and deployed to production. UAT environment cleaned up."
          else
            MSG="🗑️ PR closed. UAT environment cleaned up."
          fi

          if [ -n "$CHANNEL" ] && [ -n "$THREAD" ]; then
            curl -s -X POST https://slack.com/api/chat.postMessage \
              -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
              -H "Content-type: application/json" \
              -d "{
                \"channel\": \"${CHANNEL}\",
                \"thread_ts\": \"${THREAD}\",
                \"text\": \"${MSG}\"
              }"
          fi
