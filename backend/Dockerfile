# ---- Build Stage ----
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm set fetch-retries 5 \
  && npm set fetch-retry-mintimeout 20000 \
  && npm set fetch-retry-maxtimeout 120000 \
  && until npm ci; do echo "Retrying npm ci..."; sleep 10; done
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:20-slim
WORKDIR /app
# Install dynamic linker for onnxruntime-node (multi-arch: works for x86_64 and arm64)
RUN apt-get update && apt-get install -y libc6 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist    
COPY --from=builder /app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/main.js"]
