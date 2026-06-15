FROM node:22-alpine

WORKDIR /app

# Dependencias (solo producción; usa package-lock)
COPY package*.json ./
RUN npm ci --omit=dev

# Código y estáticos
COPY src ./src
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3010
EXPOSE 3010

# No-root
USER node

CMD ["node", "src/server.js"]
