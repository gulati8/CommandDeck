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
          IMAGE_REF="ghcr.io/gulati8/{{APP_NAME}}:${IMAGE_TAG}"
          STAGING_DIR="/srv/{{APP_NAME}}"
          PR_DIR="/srv/${APP_NAME}"
          DB_IMAGE="{{DB_IMAGE}}"
          DB_SETUP_COMMANDS="{{DB_SETUP_COMMANDS}}"

          if [ -n "$DB_IMAGE" ]; then
            # Full-stack compose with isolated DB/Redis
            COMPOSE_CONTENT=$(cat <<'COMPOSE'
          services:
            postgres:
              image: {{DB_IMAGE}}
              container_name: ${APP_NAME}-db
              restart: unless-stopped
              environment:
                POSTGRES_DB: ${POSTGRES_DB}
                POSTGRES_USER: ${POSTGRES_USER}
                POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
              volumes:
                - db_data:/var/lib/postgresql/data
              networks:
                - internal
              healthcheck:
                test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
                interval: 5s
                timeout: 3s
                retries: 10

            redis:
              image: redis:7-alpine
              container_name: ${APP_NAME}-redis
              restart: unless-stopped
              networks:
                - internal

            backend:
              image: IMAGE_REF_PLACEHOLDER
              container_name: ${APP_NAME}-api
              restart: unless-stopped
              env_file: .env
              environment:
                DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${APP_NAME}-db:5432/${POSTGRES_DB}
                REDIS_URL: redis://${APP_NAME}-redis:6379
              depends_on:
                postgres:
                  condition: service_healthy
              networks:
                - internal
                - proxy

            frontend:
              image: IMAGE_REF_PLACEHOLDER
              container_name: ${APP_NAME}
              restart: unless-stopped
              env_file: .env
              depends_on:
                - backend
              networks:
                - proxy

          volumes:
            db_data:

          networks:
            internal:
              name: ${APP_NAME}_internal
            proxy:
              external: true
          COMPOSE
          )
            COMPOSE_CONTENT=$(echo "$COMPOSE_CONTENT" | sed "s|IMAGE_REF_PLACEHOLDER|${IMAGE_REF}|g")

            # Copy staging .env, override DB name and frontend URL
            ENV_SETUP="cp ${STAGING_DIR}/.env ${PR_DIR}/.env && sed -i 's/^POSTGRES_DB=.*/POSTGRES_DB={{APP_NAME}}_pr_\${PR_NUM}/' ${PR_DIR}/.env && sed -i 's|^FRONTEND_URL=.*|FRONTEND_URL=https://${APP_NAME}.gulatilabs.me|' ${PR_DIR}/.env"

            # Build DB setup commands
            DB_CMDS=""
            if [ -n "$DB_SETUP_COMMANDS" ]; then
              IFS=',' read -ra CMDS <<< "$DB_SETUP_COMMANDS"
              for cmd in "${CMDS[@]}"; do
                cmd=$(echo "$cmd" | xargs)
                DB_CMDS="${DB_CMDS}\"docker compose -f ${PR_DIR}/docker-compose.yml exec -T backend ${cmd}\","
              done
            fi

            aws ssm send-command \
              --instance-ids "${{ secrets.EC2_INSTANCE_ID }}" \
              --document-name "AWS-RunShellScript" \
              --parameters "commands=[
                \"mkdir -p ${PR_DIR}\",
                \"cat > ${PR_DIR}/docker-compose.yml << 'INNERCOMPOSE'\n${COMPOSE_CONTENT}\nINNERCOMPOSE\",
                \"${ENV_SETUP}\",
                \"grep -q '${APP_NAME}.gulatilabs.me' /srv/proxy/Caddyfile 2>/dev/null || printf '\\\\n${APP_NAME}.gulatilabs.me {\\\\n  reverse_proxy ${APP_NAME}:3000\\\\n}\\\\n' >> /srv/proxy/Caddyfile\",
                \"docker exec proxy-caddy-1 caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || docker exec caddy caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || true\"
              ]" \
              --output text
          else
            # App-only compose (no database needed)
            aws ssm send-command \
              --instance-ids "${{ secrets.EC2_INSTANCE_ID }}" \
              --document-name "AWS-RunShellScript" \
              --parameters "commands=[
                \"mkdir -p ${PR_DIR}\",
                \"cat > ${PR_DIR}/docker-compose.yml << 'COMPOSE'\\nservices:\\n  app:\\n    image: ${IMAGE_REF}\\n    container_name: ${APP_NAME}\\n    restart: unless-stopped\\n    networks:\\n      - proxy\\n\\nnetworks:\\n  proxy:\\n    external: true\\nCOMPOSE\",
                \"grep -q '${APP_NAME}.gulatilabs.me' /srv/proxy/Caddyfile 2>/dev/null || printf '\\\\n${APP_NAME}.gulatilabs.me {\\\\n  reverse_proxy ${APP_NAME}:3000\\\\n}\\\\n' >> /srv/proxy/Caddyfile\",
                \"docker exec proxy-caddy-1 caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || docker exec caddy caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || true\"
              ]" \
              --output text
          fi

      - name: Pull and restart on EC2
        run: |
          APP_NAME="${{ steps.target.outputs.app_name }}"
          APP_DIR="/srv/${APP_NAME}"
          DB_SETUP_COMMANDS="{{DB_SETUP_COMMANDS}}"

          PULL_CMDS="\"cd ${APP_DIR}\",\"docker compose pull\",\"docker compose up -d --remove-orphans\""

          # If this is a PR with DB setup commands, run them after compose up
          if [ "${{ steps.target.outputs.is_pr }}" = "true" ] && [ -n "$DB_SETUP_COMMANDS" ]; then
            IFS=',' read -ra CMDS <<< "$DB_SETUP_COMMANDS"
            for cmd in "${CMDS[@]}"; do
              cmd=$(echo "$cmd" | xargs)
              PULL_CMDS="${PULL_CMDS},\"docker compose -f ${APP_DIR}/docker-compose.yml exec -T backend ${cmd} || true\""
            done
          fi

          aws ssm send-command \
            --instance-ids "${{ secrets.EC2_INSTANCE_ID }}" \
            --document-name "AWS-RunShellScript" \
            --parameters "commands=[${PULL_CMDS}]" \
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
              \"cd /srv/${APP_NAME} && docker compose down --remove-orphans --volumes 2>/dev/null || true\",
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
