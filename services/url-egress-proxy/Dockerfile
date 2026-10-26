FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/url-egress-proxy .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/url-egress-proxy /url-egress-proxy
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/url-egress-proxy"]
