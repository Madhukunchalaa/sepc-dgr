FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN addgroup -S dgr && adduser -S dgr -G dgr
USER dgr
# PORT is injected by Railway at runtime — do not hardcode
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3002}/health || exit 1
CMD ["node", "src/index.js"]
