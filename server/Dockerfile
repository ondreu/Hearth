# The gallery server, as two stages and one file.
#
# Build context is the *repository root*, not `server/` — the server bundles the
# plugin's own package engine (see `server/esbuild.config.mjs`), so it needs
# `src/` as well as `server/`:
#
#     docker build -f server/Dockerfile -t hearth-gallery .
#
# The runtime stage carries `dist/index.js` and nothing else: no `node_modules`,
# no source, no package manager. Everything the server needs at runtime is
# either bundled into that file or built into Node.

# ---- Build -----------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /build

# Dependencies first, so a change to the source doesn't re-download them.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY src ./src
COPY server ./server
RUN node server/esbuild.config.mjs

# ---- Run -------------------------------------------------------------------
FROM node:24-alpine
WORKDIR /app

# `node`, not root. The image has nothing to write outside /data, and /data is
# a volume owned by this user.
RUN mkdir -p /data && chown node:node /data
USER node

COPY --from=build --chown=node:node /build/server/dist/index.js ./index.js

ENV NODE_ENV=production \
    DB_PATH=/data/gallery.db \
    PORT=8787 \
    HOST=0.0.0.0
EXPOSE 8787
VOLUME ["/data"]

# The database is one file in here. Back this up and you have backed up the
# gallery — see docs/gallery-hosting.md.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
	CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/v1/info').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "index.js"]
