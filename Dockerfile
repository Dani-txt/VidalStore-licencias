# vidalstore-licencias: dos etapas sobre node:24-slim (Paso 7 de la E2).
# Etapa 1: compila con todas las dependencias, incluidas las de desarrollo (typescript).
FROM node:24-slim AS build
WORKDIR /app

# Primero solo las dependencias: mientras package-lock.json no cambie, Docker reusa esta capa.
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Etapa 2: solo lo que corre en produccion, sin ser root.
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --chown=node:node data ./data
USER node
EXPOSE 3003
CMD ["node", "dist/main.js"]
