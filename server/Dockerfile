FROM node:24-alpine AS builder

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm install

COPY server/prisma ./server/prisma/
RUN cd server && npx prisma generate

COPY . .
RUN cd server && npm run build

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/server/package*.json ./
COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/prisma ./prisma
COPY --from=builder /app/server/prisma.config.ts ./


EXPOSE 3000
CMD npx prisma db push && npm run start
