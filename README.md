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
