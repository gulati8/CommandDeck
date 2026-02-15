FROM node:20-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production

COPY . .

EXPOSE {{PORT}}
CMD ["node", "index.js"]
