package utils

import (
	"net/http/httptest"
	"testing"
)

func TestClientIP(t *testing.T) {
	for _, tc := range []struct{ name, remote, want string }{
		{"IPv4 peer", "192.0.2.1:54321", "192.0.2.1"},
		{"IPv6 peer", "[2001:db8::1]:54321", "2001:db8::1"},
		{"bare IPv4", "192.0.2.2", "192.0.2.2"},
		{"bare IPv6", "2001:db8::2", "2001:db8::2"},
		{"invalid peer", "invalid:123", ""},
		{"empty peer", "", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/", nil)
			r.RemoteAddr = tc.remote
			r.Header.Set("X-Forwarded-For", "203.0.113.99")
			r.Header.Set("X-Real-IP", "203.0.113.99")
			if got := ClientIP(r); got != tc.want {
				t.Fatalf("ClientIP() = %q, want %q", got, tc.want)
			}
		})
	}
}
