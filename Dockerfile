# Optional: run DocuMind AI in a container for local development.
# The official deployment is Vercel only (Neon Postgres + Vercel Blob + Gemini via environment variables).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app ./
EXPOSE 3000
# Needs DATABASE_URL, AUTH_SECRET, GEMINI_API_KEY, BLOB_READ_WRITE_TOKEN, ADMIN_TOKEN at runtime.
CMD ["sh", "-c", "node scripts/migrate.mjs && npx next start -p $PORT"]
