package main

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	maxURLLength       = 2048
	maxRequestBodySize = 4096
	maxPageBytes       = 256 * 1024
	requestTimeout     = 8 * time.Second
)

type fetchRequest struct {
	URL                      string `json:"url"`
	MaxBytes                 int    `json:"maxBytes"`
	FollowRedirects          bool   `json:"followRedirects"`
	RejectNonPublicAddresses bool   `json:"rejectNonPublicAddresses"`
	PinResolvedAddress       bool   `json:"pinResolvedAddress"`
}

type fetchResult struct {
	status        int
	contentType   string
	contentLength int64
	body          []byte
}

type ipResolver interface {
	LookupNetIP(ctx context.Context, network, host string) ([]netip.Addr, error)
}

type dialContextFunc func(ctx context.Context, network, address string) (net.Conn, error)

var fetchSlots = make(chan struct{}, 8)

var globalIPv6 = netip.MustParsePrefix("2000::/3")

var blockedPrefixes = mustPrefixes([]string{
	"0.0.0.0/8",
	"10.0.0.0/8",
	"100.64.0.0/10",
	"127.0.0.0/8",
	"169.254.0.0/16",
	"172.16.0.0/12",
	"192.0.0.0/24",
	"192.0.2.0/24",
	"192.88.99.0/24",
	"192.168.0.0/16",
	"198.18.0.0/15",
	"198.51.100.0/24",
	"203.0.113.0/24",
	"224.0.0.0/4",
	"240.0.0.0/4",
	"2001::/23",
	"2001:db8::/32",
	"2002::/16",
	"3fff::/20",
})

func mustPrefixes(values []string) []netip.Prefix {
	prefixes := make([]netip.Prefix, 0, len(values))
	for _, value := range values {
		prefixes = append(prefixes, netip.MustParsePrefix(value))
	}
	return prefixes
}

func isPublicAddress(address netip.Addr) bool {
	if !address.IsValid() || address.Zone() != "" {
		return false
	}
	address = address.Unmap()
	if address.Is4() {
		if !address.IsGlobalUnicast() || address.IsPrivate() || address.IsLoopback() ||
			address.IsLinkLocalUnicast() || address.IsMulticast() || address.IsUnspecified() {
			return false
		}
	} else if address.Is6() {
		if !globalIPv6.Contains(address) || address.IsPrivate() || address.IsLoopback() ||
			address.IsLinkLocalUnicast() || address.IsMulticast() || address.IsUnspecified() {
			return false
		}
	} else {
		return false
	}

	for _, prefix := range blockedPrefixes {
		if prefix.Addr().Is4() == address.Is4() && prefix.Contains(address) {
			return false
		}
	}
	return true
}

func resolvePublicAddresses(ctx context.Context, resolver ipResolver, hostname string) ([]netip.Addr, error) {
	addresses, err := resolver.LookupNetIP(ctx, "ip", hostname)
	if err != nil {
		return nil, fmt.Errorf("public DNS lookup failed")
	}
	if len(addresses) == 0 {
		return nil, fmt.Errorf("hostname has no A or AAAA records")
	}

	unique := make([]netip.Addr, 0, len(addresses))
	seen := make(map[netip.Addr]struct{}, len(addresses))
	for _, address := range addresses {
		address = address.Unmap()
		if !isPublicAddress(address) {
			return nil, fmt.Errorf("hostname resolves to a non-public IP address")
		}
		if _, exists := seen[address]; exists {
			continue
		}
		seen[address] = struct{}{}
		unique = append(unique, address)
	}
	return unique, nil
}

// pinnedDialContext resolves the hostname once per new connection and dials the validated IP
// directly. net/http still sees the original URL hostname, so Host and TLS SNI/certificate
// verification continue to use that hostname rather than the pinned IP.
func pinnedDialContext(hostname string, resolver ipResolver, dial dialContextFunc) dialContextFunc {
	expectedHost := strings.TrimSuffix(strings.ToLower(hostname), ".")
	return func(ctx context.Context, network, address string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(address)
		if err != nil {
			return nil, fmt.Errorf("invalid outbound address")
		}
		if strings.TrimSuffix(strings.ToLower(host), ".") != expectedHost {
			return nil, fmt.Errorf("outbound host changed unexpectedly")
		}
		addresses, err := resolvePublicAddresses(ctx, resolver, expectedHost)
		if err != nil {
			return nil, err
		}

		var dialErrors []error
		for _, ip := range addresses {
			conn, dialErr := dial(ctx, network, net.JoinHostPort(ip.String(), port))
			if dialErr == nil {
				return conn, nil
			}
			dialErrors = append(dialErrors, dialErr)
		}
		return nil, fmt.Errorf("unable to connect to a validated public address: %w", errors.Join(dialErrors...))
	}
}

func validateTargetURL(raw string) (*url.URL, error) {
	if strings.TrimSpace(raw) == "" || len(raw) > maxURLLength {
		return nil, fmt.Errorf("URL must be between 1 and %d characters", maxURLLength)
	}
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed == nil {
		return nil, fmt.Errorf("invalid URL")
	}
	parsed.Scheme = strings.ToLower(parsed.Scheme)
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, fmt.Errorf("only HTTP and HTTPS URLs are supported")
	}
	if parsed.User != nil || parsed.Opaque != "" || parsed.Hostname() == "" {
		return nil, fmt.Errorf("URL credentials or opaque URLs are not allowed")
	}

	hostname := strings.TrimSuffix(strings.ToLower(parsed.Hostname()), ".")
	if strings.Contains(hostname, ":") || strings.HasPrefix(hostname, "[") {
		return nil, fmt.Errorf("IP-literal hosts are not allowed")
	}
	if address, parseErr := netip.ParseAddr(hostname); parseErr == nil && address.IsValid() {
		return nil, fmt.Errorf("IP-literal hosts are not allowed")
	}
	if !strings.Contains(hostname, ".") || hostname == "localhost" ||
		strings.HasSuffix(hostname, ".localhost") || strings.HasSuffix(hostname, ".local") ||
		strings.HasSuffix(hostname, ".internal") || strings.HasSuffix(hostname, ".onion") ||
		strings.HasSuffix(hostname, ".test") || strings.HasSuffix(hostname, ".invalid") ||
		strings.HasSuffix(hostname, ".example") {
		return nil, fmt.Errorf("a public DNS hostname is required")
	}

	port := parsed.Port()
	if port != "" && !((parsed.Scheme == "http" && port == "80") || (parsed.Scheme == "https" && port == "443")) {
		return nil, fmt.Errorf("only standard HTTP/HTTPS ports are supported")
	}
	if port == "" {
		parsed.Host = hostname
	} else {
		parsed.Host = net.JoinHostPort(hostname, port)
	}

	sensitiveKeys := map[string]struct{}{
		"token": {}, "secret": {}, "password": {}, "passwd": {}, "key": {},
		"api_key": {}, "access_token": {}, "refresh_token": {}, "session": {},
		"signature": {}, "sig": {}, "authorization": {}, "auth": {}, "credential": {},
		"client_secret": {}, "x_amz_signature": {}, "x_amz_credential": {},
		"x_goog_signature": {}, "x_goog_credential": {},
	}
	for key := range parsed.Query() {
		normalized := strings.ReplaceAll(strings.ToLower(key), "-", "_")
		if _, exists := sensitiveKeys[normalized]; exists {
			return nil, fmt.Errorf("sensitive query parameters are not allowed")
		}
	}
	parsed.Fragment = ""
	parsed.RawFragment = ""
	return parsed, nil
}

func supportedContentType(value string) bool {
	contentType := strings.ToLower(strings.TrimSpace(strings.Split(value, ";")[0]))
	switch contentType {
	case "text/html", "application/xhtml+xml", "text/plain", "application/json",
		"text/xml", "application/xml", "text/csv":
		return true
	default:
		return false
	}
}

func fetchPublicTarget(ctx context.Context, target *url.URL, resolver ipResolver, dial dialContextFunc, byteLimit int64) (fetchResult, error) {
	dialer := pinnedDialContext(target.Hostname(), resolver, dial)
	transport := &http.Transport{
		Proxy:                 nil,
		DialContext:           dialer,
		DisableKeepAlives:     true,
		TLSHandshakeTimeout:   5 * time.Second,
		ResponseHeaderTimeout: 5 * time.Second,
	}
	defer transport.CloseIdleConnections()

	client := &http.Client{
		Transport: transport,
		Timeout:   requestTimeout,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), nil)
	if err != nil {
		return fetchResult{}, fmt.Errorf("could not create upstream request")
	}
	request.Header.Set("Accept", "text/html, text/plain, application/json, application/xhtml+xml, text/xml, application/xml, text/csv")
	request.Header.Set("User-Agent", "HasibAI-ReadOnly-URL-Analyzer/1.0")

	response, err := client.Do(request)
	if err != nil {
		return fetchResult{}, fmt.Errorf("public page request failed")
	}
	defer response.Body.Close()

	result := fetchResult{
		status:        response.StatusCode,
		contentType:   response.Header.Get("Content-Type"),
		contentLength: response.ContentLength,
	}
	if response.StatusCode >= 300 && response.StatusCode < 400 {
		return result, nil
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return result, nil
	}
	if !supportedContentType(result.contentType) {
		return result, nil
	}
	if result.contentLength > byteLimit {
		return result, nil
	}

	body, err := io.ReadAll(io.LimitReader(response.Body, byteLimit+1))
	if err != nil {
		return fetchResult{}, fmt.Errorf("public page body read failed")
	}
	if int64(len(body)) > byteLimit {
		result.contentLength = int64(len(body))
		return result, nil
	}
	result.body = body
	if result.contentLength < 0 {
		result.contentLength = int64(len(body))
	}
	return result, nil
}

func writeJSONError(writer http.ResponseWriter, status int, message string) {
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.Header().Set("Cache-Control", "no-store")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(map[string]string{"error": message})
}

func newFetchHandler(token string, resolver ipResolver, dial dialContextFunc) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Cache-Control", "no-store")
		if request.Method != http.MethodPost {
			writer.Header().Set("Allow", http.MethodPost)
			writeJSONError(writer, http.StatusMethodNotAllowed, "POST required")
			return
		}
		if token == "" || subtle.ConstantTimeCompare([]byte(request.Header.Get("Authorization")), []byte("Bearer "+token)) != 1 {
			writeJSONError(writer, http.StatusUnauthorized, "Unauthorized")
			return
		}
		if !strings.HasPrefix(strings.ToLower(request.Header.Get("Content-Type")), "application/json") {
			writeJSONError(writer, http.StatusUnsupportedMediaType, "application/json required")
			return
		}
		if request.ContentLength > maxRequestBodySize {
			writeJSONError(writer, http.StatusRequestEntityTooLarge, "Request body too large")
			return
		}

		request.Body = http.MaxBytesReader(writer, request.Body, maxRequestBodySize)
		decoder := json.NewDecoder(request.Body)
		decoder.DisallowUnknownFields()
		var input fetchRequest
		if err := decoder.Decode(&input); err != nil {
			var maxBytesError *http.MaxBytesError
			if errors.As(err, &maxBytesError) {
				writeJSONError(writer, http.StatusRequestEntityTooLarge, "Request body too large")
			} else {
				writeJSONError(writer, http.StatusBadRequest, "Invalid request")
			}
			return
		}
		var extra any
		if err := decoder.Decode(&extra); err != io.EOF {
			writeJSONError(writer, http.StatusBadRequest, "Invalid request")
			return
		}
		if input.MaxBytes < 1 || input.MaxBytes > maxPageBytes ||
			input.FollowRedirects || !input.RejectNonPublicAddresses || !input.PinResolvedAddress {
			writeJSONError(writer, http.StatusBadRequest, "Unsafe fetch options rejected")
			return
		}

		target, err := validateTargetURL(input.URL)
		if err != nil {
			writeJSONError(writer, http.StatusBadRequest, err.Error())
			return
		}

		select {
		case fetchSlots <- struct{}{}:
			defer func() { <-fetchSlots }()
		default:
			writeJSONError(writer, http.StatusServiceUnavailable, "URL fetch capacity is temporarily full")
			return
		}

		ctx, cancel := context.WithTimeout(request.Context(), requestTimeout)
		defer cancel()
		result, err := fetchPublicTarget(ctx, target, resolver, dial, int64(input.MaxBytes))
		if err != nil {
			writeJSONError(writer, http.StatusBadGateway, "Public page fetch failed")
			return
		}

		writer.Header().Set("Content-Type", "application/octet-stream")
		writer.Header().Set("X-Upstream-Status", strconv.Itoa(result.status))
		writer.Header().Set("X-Upstream-Content-Type", result.contentType)
		writer.Header().Set("X-Upstream-Content-Length", strconv.FormatInt(result.contentLength, 10))
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write(result.body)
	})
}

func main() {
	token := strings.TrimSpace(os.Getenv("PUBLIC_URL_FETCH_PROXY_TOKEN"))
	if len(token) < 32 {
		log.Fatal("PUBLIC_URL_FETCH_PROXY_TOKEN must be a high-entropy secret of at least 32 characters")
	}
	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "8080"
	}

	dialer := &net.Dialer{Timeout: 5 * time.Second, KeepAlive: -1}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet {
			writer.Header().Set("Allow", http.MethodGet)
			writeJSONError(writer, http.StatusMethodNotAllowed, "GET required")
			return
		}
		writer.Header().Set("Content-Type", "application/json; charset=utf-8")
		writer.Header().Set("Cache-Control", "no-store")
		_ = json.NewEncoder(writer).Encode(map[string]string{"status": "ok"})
	})
	mux.Handle("/fetch", newFetchHandler(token, net.DefaultResolver, dialer.DialContext))

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       8 * time.Second,
		WriteTimeout:      12 * time.Second,
		IdleTimeout:       30 * time.Second,
	}
	log.Printf("URL egress proxy listening on port %s", port)
	log.Fatal(server.ListenAndServe())
}
