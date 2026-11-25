# Ambiente de desenvolvimento do Escape from Idle (Node com node:sqlite)
FROM node:24-bookworm-slim

# git para o vitest/oxfmt e para commitar de dentro do contêiner, se quiser
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY --chown=node:node . .

EXPOSE 8080
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
