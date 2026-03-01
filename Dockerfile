# --- Stage 1: Build the React frontend ---
FROM node:20-alpine AS client-build
WORKDIR /build
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY client/ ./
RUN npm run build

# --- Stage 2: Production server ---
FROM node:20-alpine
WORKDIR /app

COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev

COPY server/ ./

# Copy the built React app into the public folder Express serves
COPY --from=client-build /build/dist ./public

# Create the data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3000

ENV NODE_ENV=production
ENV DB_PATH=/app/data/mylists.db

CMD ["node", "index.js"]
