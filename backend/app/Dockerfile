# Multi-stage: build Go API binary
FROM golang:1.23-alpine AS builder

WORKDIR /src
ENV GOTOOLCHAIN=auto
RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /api ./cmd/api

# Runtime image
FROM alpine:3.20

RUN apk add --no-cache ca-certificates wget
WORKDIR /app

COPY --from=builder /api /app/api

ENV PORT=8080
EXPOSE 8080

CMD ["/app/api"]
