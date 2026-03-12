FROM golang:1.25-alpine

WORKDIR /usr/src/app

RUN apk add --no-cache git gcc musl-dev
RUN go install github.com/air-verse/air@latest

COPY . .

WORKDIR /usr/src/app/services/auction-service

RUN go mod download

CMD ["air", "-c", ".air.toml"]
