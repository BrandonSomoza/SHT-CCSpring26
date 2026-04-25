FROM node:22-slim

WORKDIR /app

# Install backend dependencies
RUN npm install express ws cors

COPY backend/ ./backend/
COPY frontend/ ./frontend/

EXPOSE 8080

CMD ["node", "backend/index.js"]
