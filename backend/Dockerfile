FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache tini

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN chmod +x docker-entrypoint.sh \
  && mkdir -p uploads/tmp uploads/private src/public/images/uploads \
  && chown -R node:node /app

ENV NODE_ENV=production

USER node

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
