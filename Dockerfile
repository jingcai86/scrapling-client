FROM node:20-alpine

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

EXPOSE 80

CMD ["npx", "tsx", "server/index.ts"]
