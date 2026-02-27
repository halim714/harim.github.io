# ws-proxy/Dockerfile
# Meki WS Proxy — Node.js 20 Alpine, non-root user, port 8080

FROM node:20-alpine

# Create non-root user
RUN addgroup -S wsgroup && adduser -S wsuser -G wsgroup

WORKDIR /app

# Copy package files and install production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source
COPY src/ ./src/

# Change ownership to non-root user
RUN chown -R wsuser:wsgroup /app

USER wsuser

EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "src/index.js"]
