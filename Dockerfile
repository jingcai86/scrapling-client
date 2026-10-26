FROM node:20-alpine

RUN apk add --no-cache tzdata

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json .env.example ./
COPY core ./core
COPY eneba ./eneba
COPY server ./server

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=80
ENV TZ=America/Los_Angeles

EXPOSE 80

CMD ["npx", "tsx", "server/index.ts"]
