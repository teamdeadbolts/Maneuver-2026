FROM node:24-alpine

WORKDIR /app

COPY . .

WORKDIR /app/server
RUN npm install

RUN npx prisma generate
RUN npm run build

EXPOSE 3000
CMD npx prisma migrate deploy && npm start