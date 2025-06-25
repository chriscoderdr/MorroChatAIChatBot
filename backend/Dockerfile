# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm set fetch-retries 5 \
  && npm set fetch-retry-mintimeout 20000 \
  && npm set fetch-retry-maxtimeout 120000 \
  && until npm ci --omit=dev; do echo "Retrying npm ci..."; sleep 10; done
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/main.js"]
