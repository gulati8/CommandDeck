FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --production

COPY lib/ ./lib/
COPY dashboard/ ./dashboard/

ENV NODE_ENV=production
ENV COMMANDDECK_STATE_DIR=/home/commanddeck/.commanddeck

USER node

EXPOSE 3002

CMD ["node", "dashboard/server.js"]
