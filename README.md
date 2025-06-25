# MorroChat – Full Stack AI Chatbot Platform

A modern, production-ready AI chatbot platform inspired by the natural beauty of Morro de Montecristi. Built with a NestJS backend, Vite/React frontend, and MongoDB, all orchestrated with Docker Compose.

---

## 🏗️ Project Structure

```
/ (root)
├── backend/      # NestJS API (Node.js)
├── frontend/     # Vite + React (TypeScript)
├── docker-compose.yml
└── README.md     # (this file)
```

---

## Domain



## Test

### Test Questions:
- How's the weather in Santo Domingo, Dominican Republic (you can replace with any city, country)
- What time is in Bangkok, Thailand (You can replace with any city, country)
- When was soluciones gbh founded (you can replace with any company name)
- Tell me the current time in Santo Domingo, Dominican Republic and compare it with the current time in Buenos Aires, Argentina

### Test cuestions for document
Upload document in sample-data/sample_data_account_details
- what is this document about?
- what details does it have?
- what is the ach route in the file?
- what is the bank in the file?

### Test Domain
set in .env a chat topic like
`CHAT_DEFAULT_TOPIC="Dominican Food"`
- Talk me about beisbol (if the topic is not beisbol)
- Talk me about dominican food
- How do I cook mangú


## 🚀 Quick Start (with Docker Compose)

1. **Clone the repository:**
   ```sh
   git clone <your-repo-url>
   cd hackett
   ```

2. **Build and start all services:**
   ```sh
   docker-compose up --build
   ```

   This will:
   - Build the backend and frontend Docker images
   - Start MongoDB, backend, and frontend containers
   - Expose the following URLs for development:

     | Service   | URL                        | Description                |
     |-----------|----------------------------|----------------------------|
     | Frontend  | http://localhost:5173      | MorroChat UI (React/Vite)  |
     | Backend   | http://localhost:3000      | NestJS API                 |
     | MongoDB   | mongodb://root:example@localhost:27017/morrochat?authSource=admin | Database connection string |

3. **Stop all services:**
   ```sh
   docker-compose down
   ```

---

## 🔗 Service URLs (Docker)

| Service   | URL                        | Description                |
|-----------|----------------------------|----------------------------|
| Frontend  | http://localhost:5173      | MorroChat UI (React/Vite)  |
| Backend   | http://localhost:3000      | NestJS API                 |
| MongoDB   | mongodb://root:example@localhost:27017/morrochat?authSource=admin | Database connection string |

---

## 🧩 Services Overview

### 1. Backend (NestJS)
- **Location:** `/backend`
- **Docker:** Multi-stage build for production
- **Environment:**
  - `MONGODB_URI` (see `/backend/.env.example`)
- **API Docs:** (if enabled) http://localhost:3000/api

### 2. Frontend (Vite + React)
- **Location:** `/frontend`
- **Docker:** Multi-stage build, served via Nginx
- **Dev:** `npm run dev` in `/frontend`

### 3. Database (MongoDB)
- **Image:** `mongo:7`
- **Data:** persisted in Docker volume `mongo_data`
- **Credentials:**
  - user: `root`
  - pass: `example`
  - db: `morrochat`

---

## 🛠️ Local Development (without Docker)

### Backend
```sh
cd backend
cp .env.example .env
npm install
npm run start:dev
```

### Frontend
```sh
cd frontend
npm install
npm run dev
```

### MongoDB
- Install and run MongoDB locally, or use Docker Compose just for the database.

---

## 🐳 Docker Compose Details

- **`docker-compose.yml`** orchestrates all services.
- **Hot reload** is for local dev only; Docker images are production-optimized.
- **Environment variables** are passed via Compose and `.env` files.

---

## 🔒 Security & Best Practices
- Production images use multi-stage builds (no dev dependencies in final image)
- Sensitive files (`.env`, `node_modules`, `dist`) are excluded via `.dockerignore`
- MongoDB credentials are set via environment variables

---

## 📦 Useful Commands

- **Build all images:**
  ```sh
  docker-compose build
  ```
- **Stop all services:**
  ```sh
  docker-compose down
  ```
- **View logs:**
  ```sh
  docker-compose logs -f
  ```

---

## 🌊 MorroChat Brand & UI
- Inspired by Morro de Montecristi, Dominican Republic
- Modern, serene, and trustworthy design
- See `/frontend` for full UI/UX implementation details

---

## 📄 License
This project is for demonstration and educational purposes.
