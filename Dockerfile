FROM node:22-alpine

WORKDIR /app

# Dependencias (solo producción; usa package-lock)
COPY package*.json ./
RUN npm ci --omit=dev

# Código y estáticos
COPY src ./src
COPY public ./public

# Directorio de datos persistente (registro de entradas), escribible por 'node'
RUN mkdir -p /app/data && chown -R node:node /app/data

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3010
EXPOSE 3010

# No-root
USER node

CMD ["node", "src/server.js"]
