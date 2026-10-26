FROM node:22-alpine

RUN apk add --no-cache tzdata

WORKDIR /app

# 1. Install root dependencies
COPY package.json package-lock.json ./
RUN npm ci

# 2. Install frontend dependencies and build Angular UI
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci
COPY frontend ./frontend
RUN npm run build:ui

# 3. Copy application backend code & configs
COPY tsconfig.json .env.example drizzle.config.ts ./
COPY core ./core
COPY eneba ./eneba
COPY server ./server
COPY drizzle ./drizzle

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=80
ENV TZ=America/Los_Angeles

EXPOSE 80

CMD ["npx", "tsx", "server/index.ts"]
