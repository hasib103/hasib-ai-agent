package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"net/url"
	"strings"
	"testing"
)

type fakeResolver struct {
	responses [][]netip.Addr
	err       error
	calls     int
}

func (r *fakeResolver) LookupNetIP(_ context.Context, _ string, _ string) ([]netip.Addr, error) {
	r.calls++
	if r.err != nil {
		return nil, r.err
	}
	if len(r.responses) == 0 {
		return nil, nil
	}
	index := r.calls - 1
	if index >= len(r.responses) {
		index = len(r.responses) - 1
	}
	return r.responses[index], nil
}

func mustAddr(value string) netip.Addr {
	return netip.MustParseAddr(value)
}

func TestIsPublicAddressRejectsPrivateAndSpecialRanges(t *testing.T) {
	t.Parallel()
	for _, value := range []string{
		"0.0.0.0",
		"10.0.0.1",
		"100.64.0.1",
		"127.0.0.1",
		"169.254.1.1",
		"172.16.0.1",
		"192.0.2.1",
		"192.168.1.1",
		"198.18.0.1",
		"203.0.113.1",
		"224.0.0.1",
		"240.0.0.1",
		"::",
		"::1",
		"::ffff:127.0.0.1",
		"fc00::1",
		"fe80::1",
		"ff02::1",
		"2001:db8::1",
		"2002::1",
		"3fff::1",
	} {
		if isPublicAddress(mustAddr(value)) {
			t.Errorf("%s must not be treated as a public address", value)
		}
	}
}

func TestIsPublicAddressAcceptsGlobalAddresses(t *testing.T) {
	t.Parallel()
	for _, value := range []string{"93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"} {
		if !isPublicAddress(mustAddr(value)) {
			t.Errorf("%s should be treated as a public address", value)
		}
	}
}

func TestValidateTargetURL(t *testing.T) {
	t.Parallel()
	valid, err := validateTargetURL("https://Example.com/article?lang=bn#fragment")
	if err != nil {
		t.Fatalf("expected a valid URL: %v", err)
	}
	if valid.Host != "example.com" || valid.Fragment != "" {
		t.Fatalf("expected normalized hostname and removed fragment, got %q", valid.String())
	}

	invalid := []string{
		"javascript:alert(1)",
		"file:///etc/passwd",
		"https://user:pass@example.com/",
		"http://localhost/",
		"http://127.0.0.1/",
		"http://[::1]/",
		"https://service.internal/",
		"https://example.com:8443/",
		"https://example.com/?api_key=secret",
		"https://example.com/?X-Amz-Signature=secret",
		strings.Repeat("a", maxURLLength+1),
	}
	for _, value := range invalid {
		if _, err := validateTargetURL(value); err == nil {
			t.Errorf("expected URL to be rejected: %q", value)
		}
	}
}

func TestPinnedDialUsesValidatedIPWithoutSecondDNSLookup(t *testing.T) {
	t.Parallel()
	resolver := &fakeResolver{responses: [][]netip.Addr{
		{mustAddr("93.184.216.34")},
		{mustAddr("10.0.0.1")},
	}}
	var dialAddress string
	var peer net.Conn
	dial := func(_ context.Context, _ string, address string) (net.Conn, error) {
		dialAddress = address
		connection, remote := net.Pipe()
		peer = remote
		return connection, nil
	}

	connection, err := pinnedDialContext("example.com", resolver, dial)(
		context.Background(), "tcp", "example.com:443",
	)
	if err != nil {
		t.Fatalf("expected the validated public IP to be dialed: %v", err)
	}
	defer connection.Close()
	if peer != nil {
		defer peer.Close()
	}
	if resolver.calls != 1 {
		t.Fatalf("expected exactly one DNS lookup for the connection, got %d", resolver.calls)
	}
	if dialAddress != "93.184.216.34:443" {
		t.Fatalf("expected a pinned IP literal, got %q", dialAddress)
	}
}

func TestPinnedDialRejectsMixedPublicAndPrivateDNSAnswers(t *testing.T) {
	t.Parallel()
	resolver := &fakeResolver{responses: [][]netip.Addr{{
		mustAddr("93.184.216.34"),
		mustAddr("10.0.0.5"),
	}}}
	dialCalls := 0
	dial := func(context.Context, string, string) (net.Conn, error) {
		dialCalls++
		return nil, nil
	}
	_, err := pinnedDialContext("example.com", resolver, dial)(
		context.Background(), "tcp", "example.com:443",
	)
	if err == nil {
		t.Fatal("expected mixed public/private DNS answers to be rejected")
	}
	if dialCalls != 0 {
		t.Fatalf("must not dial when any DNS answer is private; got %d dial calls", dialCalls)
	}
}

func TestFetchPublicTargetDoesNotFollowRedirects(t *testing.T) {
	t.Parallel()
	followed := false
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path == "/followed" {
			followed = true
			writer.WriteHeader(http.StatusOK)
			_, _ = io.WriteString(writer, "must not be fetched")
			return
		}
		http.Redirect(writer, request, "http://127.0.0.1/private", http.StatusFound)
	}))
	defer server.Close()

	resolver := &fakeResolver{responses: [][]netip.Addr{{mustAddr("93.184.216.34")}}}
	dial := func(ctx context.Context, network, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, network, server.Listener.Addr().String())
	}
	target, _ := url.Parse("http://example.com/")
	result, err := fetchPublicTarget(context.Background(), target, resolver, dial, maxPageBytes)
	if err != nil {
		t.Fatalf("unexpected fetch error: %v", err)
	}
	if result.status != http.StatusFound {
		t.Fatalf("expected redirect status to be returned without following, got %d", result.status)
	}
	if followed {
		t.Fatal("the redirect destination must never be requested")
	}
}

func TestFetchPublicTargetCapsResponseBytes(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "text/plain")
		_, _ = writer.Write(bytes.Repeat([]byte("x"), maxPageBytes+1024))
	}))
	defer server.Close()

	resolver := &fakeResolver{responses: [][]netip.Addr{{mustAddr("93.184.216.34")}}}
	dial := func(ctx context.Context, network, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, network, server.Listener.Addr().String())
	}
	target, _ := url.Parse("http://example.com/")
	result, err := fetchPublicTarget(context.Background(), target, resolver, dial, maxPageBytes)
	if err != nil {
		t.Fatalf("unexpected fetch error: %v", err)
	}
	if result.contentLength <= maxPageBytes {
		t.Fatalf("expected over-limit response length to be reported, got %d", result.contentLength)
	}
	if len(result.body) != 0 {
		t.Fatalf("over-limit body must not be forwarded, got %d bytes", len(result.body))
	}
}

func TestFetchHandlerRequiresAuthAndSafeOptions(t *testing.T) {
	t.Parallel()
	handler := newFetchHandler("a-high-entropy-test-token-value-123456", &fakeResolver{}, nil)
	body, _ := json.Marshal(fetchRequest{
		URL:                      "https://example.com/",
		MaxBytes:                 maxPageBytes,
		FollowRedirects:          false,
		RejectNonPublicAddresses: true,
		PinResolvedAddress:       true,
	})

	unauthorized := httptest.NewRecorder()
	handler.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodPost, "/fetch", bytes.NewReader(body)))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("expected unauthorized response, got %d", unauthorized.Code)
	}

	unsafeBody, _ := json.Marshal(fetchRequest{
		URL:                      "https://example.com/",
		MaxBytes:                 maxPageBytes,
		FollowRedirects:          true,
		RejectNonPublicAddresses: true,
		PinResolvedAddress:       true,
	})
	request := httptest.NewRequest(http.MethodPost, "/fetch", bytes.NewReader(unsafeBody))
	request.Header.Set("Authorization", "Bearer a-high-entropy-test-token-value-123456")
	request.Header.Set("Content-Type", "application/json")
	unsafe := httptest.NewRecorder()
	handler.ServeHTTP(unsafe, request)
	if unsafe.Code != http.StatusBadRequest {
		t.Fatalf("expected unsafe fetch options to be rejected, got %d", unsafe.Code)
	}
}
