# MTG Fannable Cards: the web app and the CLI in one image (T-S9, D29).
#
#   docker run -p 3000:3000 -v fannable-data:/data ghcr.io/verbatiama/mtgfanablecards
#   docker run -i --rm -v fannable-data:/data -v "$PWD/out:/app/out" \
#     ghcr.io/verbatiama/mtgfanablecards cli - < deck.txt
#
# See docs/self-hosting.md.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run web:build && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
# docker-entrypoint.sh sets NODE_OPTIONS for the heap size (LOW_MEMORY, T-S13).
ENV NODE_ENV=production \
    DATA_DIR=/data \
    ART_CACHE_DIR=/data/art \
    SET_CACHE_DIR=/data/sets
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/web/dist ./web/dist
COPY package.json docker-entrypoint.sh ./
COPY src ./src
COPY res ./res
RUN mkdir -p /data /app/out && chown node:node /data /app/out
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["server"]
