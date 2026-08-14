FROM node:22-slim AS web
WORKDIR /w
COPY web/package*.json ./
RUN npm ci
COPY web ./
RUN npm run build

FROM rust:1.88-slim AS srv
WORKDIR /s
COPY server ./
RUN cargo build --release

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=srv /s/target/release/server /usr/local/bin/server
COPY --from=web /w/dist /app/web/dist
ENV STATIC_DIR=/app/web/dist PORT=8080
EXPOSE 8080
CMD ["server"]
