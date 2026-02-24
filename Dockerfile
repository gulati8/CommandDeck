FROM node:20-bookworm-slim

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    jq \
    tmux \
    curl \
    openssh-client \
    unzip \
    gnupg \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update && apt-get install -y --no-install-recommends gh \
  && rm -rf /var/lib/apt/lists/*

# AWS CLI v2
RUN curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscli.zip \
  && unzip -q /tmp/awscli.zip -d /tmp \
  && /tmp/aws/install \
  && rm -rf /tmp/awscli.zip /tmp/aws

# Docker CLI (client only, for managing host containers via mounted socket)
RUN apt-get update && apt-get install -y --no-install-recommends docker.io \
  && rm -rf /var/lib/apt/lists/*

# Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code \
  && mkdir -p /etc/claude-code \
  && echo '{}' > /etc/claude-code/managed-settings.json

# Create non-root user
RUN groupadd -r commanddeck && useradd -r -g commanddeck -m -s /bin/bash commanddeck

# Pre-create directory structure
RUN mkdir -p \
    /home/commanddeck/.commanddeck/standards \
    /home/commanddeck/.commanddeck/crew \
    /home/commanddeck/.commanddeck/playbooks \
    /home/commanddeck/.commanddeck/proposed \
    /home/commanddeck/.commanddeck/projects \
    /home/commanddeck/.commanddeck/scripts \
    /home/commanddeck/.claude/debug \
    /home/commanddeck/projects \
  && chown -R commanddeck:commanddeck /home/commanddeck

# Copy app code
WORKDIR /home/commanddeck/app
COPY package.json package-lock.json* ./
RUN npm ci --production && chown -R commanddeck:commanddeck node_modules

COPY --chown=commanddeck:commanddeck . .

# Copy hooks to scripts dir
RUN cp -r hooks/* /home/commanddeck/.commanddeck/scripts/ 2>/dev/null || true \
  && chown -R commanddeck:commanddeck /home/commanddeck/.commanddeck/scripts

# Environment
ENV COMMANDDECK_STATE_DIR=/home/commanddeck/.commanddeck
ENV COMMANDDECK_PROJECT_DIR=/home/commanddeck/projects
ENV NODE_ENV=production

USER commanddeck

EXPOSE 3001

ENTRYPOINT ["/home/commanddeck/app/entrypoint.sh"]
CMD ["node", "q.js"]
