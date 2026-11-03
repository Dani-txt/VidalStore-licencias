FROM node:24-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY data ./data
EXPOSE 3003
CMD ["node", "dist/main.js"]
