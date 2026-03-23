FROM node:20-alpine AS base
WORKDIR /app

COPY services/api/package*.json ./
RUN npm ci --no-audit --no-fund

COPY services/api/ ./
COPY data ./data
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
