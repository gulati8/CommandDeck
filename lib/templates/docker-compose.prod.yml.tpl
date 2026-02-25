services:
  {{APP_NAME}}:
    image: {{REGISTRY}}/{{APP_NAME}}:latest
    container_name: {{APP_NAME}}
    restart: unless-stopped
    env_file: .env
    networks:
      - proxy

networks:
  proxy:
    external: true
