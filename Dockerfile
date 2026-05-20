FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY public ./public
COPY server.js ./

RUN addgroup -S birdtrip && adduser -S birdtrip -G birdtrip \
  && chown -R birdtrip:birdtrip /app
USER birdtrip

EXPOSE 4177
CMD ["node", "server.js"]
