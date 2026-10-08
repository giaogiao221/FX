FROM node:22.22.0-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server/ ./
COPY data/ /app/data/
USER node
EXPOSE 3001
CMD ["node", "index.js"]
