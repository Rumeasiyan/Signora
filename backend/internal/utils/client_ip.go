package utils

import (
	"net"
	"net/http"
)

// ClientIP returns the peer IP for audit records. Forwarded headers require a
// trusted proxy configuration and are not accepted directly from clients.
func ClientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	if ip := net.ParseIP(host); ip != nil {
		return ip.String()
	}
	return ""
}
