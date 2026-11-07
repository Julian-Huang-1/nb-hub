package sitecli

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type APIError struct {
	Status        int
	Code, Message string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("%s: %s (HTTP %d)", e.Code, e.Message, e.Status)
}

type Client struct {
	BaseURL, Token string
	HTTP           *http.Client
}

func NewClient(base, token string) (*Client, error) {
	u, err := url.Parse(base)
	if err != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (u.Path != "" && u.Path != "/") || (u.Scheme != "http" && u.Scheme != "https") {
		return nil, fmt.Errorf("server must be an HTTP(S) origin")
	}
	if strings.TrimSpace(token) == "" {
		return nil, fmt.Errorf("set NB_HUB_TOKEN to a personal access token")
	}
	return &Client{strings.TrimRight(base, "/"), token, &http.Client{Timeout: 3 * time.Minute, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}}, nil
}
func (c *Client) Do(ctx context.Context, method, path string, body any, out any) error {
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(b)
	}
	return c.request(ctx, method, path, reader, "application/json", "", out)
}
func (c *Client) request(ctx context.Context, method, path string, body io.Reader, typ, key string, out any) error {
	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Content-Type", typ)
	if key != "" {
		req.Header.Set("Idempotency-Key", key)
	}
	res, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		var e struct {
			Code  string `json:"code"`
			Error string `json:"error"`
		}
		_ = json.NewDecoder(io.LimitReader(res.Body, 8192)).Decode(&e)
		if e.Code == "" {
			e.Code = "request_failed"
		}
		if e.Error == "" {
			e.Error = http.StatusText(res.StatusCode)
		}
		return &APIError{res.StatusCode, e.Code, e.Error}
	}
	if out == nil || res.StatusCode == 204 {
		return nil
	}
	return json.NewDecoder(io.LimitReader(res.Body, 2<<20)).Decode(out)
}
