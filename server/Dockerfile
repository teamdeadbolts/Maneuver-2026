FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./
COPY server/prisma ./prisma/

RUN npm install
COPY server/ .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000
CMD npx prisma migrate deploy && node dist/index.js