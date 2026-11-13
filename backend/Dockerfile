# syntax=docker/dockerfile:1
FROM golang:1.27-bookworm@sha256:4fa7c968ba93f1635670522dbb01a2c78150443e1385746924566079f36570ea AS go-build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download && go mod verify
COPY cmd/ ./cmd/
COPY internal/ ./internal/
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/signora ./cmd/server

FROM node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS node-dependencies
WORKDIR /deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=10000 \
    UPLOAD_DIR=/var/lib/signora/uploads \
    SIGNED_DIR=/var/lib/signora/signed
WORKDIR /app
COPY --from=go-build /out/signora /usr/local/bin/signora
COPY --from=node-dependencies /deps/node_modules ./node_modules
COPY scripts/stamp_pdf.js ./scripts/stamp_pdf.js
COPY deploy/validate-env.mjs ./deploy/validate-env.mjs
COPY schema.sql ./schema.sql
RUN mkdir -p /var/lib/signora/uploads /var/lib/signora/signed \
    && chown -R node:node /var/lib/signora
USER node
EXPOSE 10000
# exec makes the Go server PID 1 so Render termination signals reach it.
# Secrets are runtime environment variables, never Docker build arguments.
CMD ["sh", "-c", "node deploy/validate-env.mjs && exec /usr/local/bin/signora"]
