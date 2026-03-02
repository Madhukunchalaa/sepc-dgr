FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN addgroup -S dgr && adduser -S dgr -G dgr
USER dgr
EXPOSE 3004
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3004/health || exit 1
CMD ["node", "src/index.js"]
