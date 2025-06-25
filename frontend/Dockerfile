# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm set fetch-retries 5 \
  && npm set fetch-retry-mintimeout 20000 \
  && npm set fetch-retry-maxtimeout 120000 \
  && until npm ci; do echo "Retrying npm ci..."; sleep 10; done
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
