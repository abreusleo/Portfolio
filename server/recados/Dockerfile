FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# The SQLite driver is modernc, which is Go all the way down, and the three
# moderation lists are go:embed. Nothing here needs cgo, and the binary that
# comes out carries its own word lists.
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/recados .
# Docker seeds a fresh named volume from the image path it is mounted over,
# ownership included. Shipping /data owned by the runtime user is what lets the
# non-root process create the database on a first run.
RUN mkdir -p /out/data

# :nonroot runs as uid 65532 — the default tag runs as root, which a static Go
# binary serving HTTP has no need to be.
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build --chown=65532:65532 /out/recados /app/recados
COPY --from=build --chown=65532:65532 /out/data /data
USER 65532:65532
EXPOSE 8080
ENV RECADOS_ADDR=:8080 RECADOS_DB=/data/recados.db
ENTRYPOINT ["/app/recados"]
