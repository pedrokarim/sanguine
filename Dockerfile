# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Étape 1 — build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable

# Les dépendances sont copiées seules d'abord : tant que le lockfile ne change pas,
# Docker réutilise cette couche et le build ne réinstalle rien.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
# La planche des sprites, construite à part pour ne pas casser l'autonomie de dist/.
RUN pnpm planche

# ---------------------------------------------------------------------------
# Étape 2 — service
# ---------------------------------------------------------------------------
# Le jeu est 100 % statique : ni Node, ni base de données, ni variable d'environnement
# à l'exécution. L'image finale ne contient donc que nginx et ~170 ko de fichiers.
FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/dist-planche /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
