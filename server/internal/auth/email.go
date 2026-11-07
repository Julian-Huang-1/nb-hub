package auth

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/mail"
	"net/smtp"
	"strings"
	"time"
)

type EmailSender struct {
	Config Config
	Client *http.Client
}

func (s *EmailSender) Send(ctx context.Context, to, code string) error {
	c := s.Config
	text := "Your nb-hub verification code is " + code + ". It expires in 10 minutes."
	if c.ResendKey != "" {
		if _, err := mail.ParseAddress(c.ResendFrom); err != nil {
			return fmt.Errorf("invalid RESEND_FROM_EMAIL")
		}
		body, _ := json.Marshal(map[string]any{"from": c.ResendFrom, "to": []string{to}, "subject": "nb-hub sign-in code", "text": text})
		request, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
		if err != nil {
			return err
		}
		request.Header.Set("Authorization", "Bearer "+c.ResendKey)
		request.Header.Set("Content-Type", "application/json")
		client := s.Client
		if client == nil {
			client = &http.Client{Timeout: 10 * time.Second}
		}
		response, err := client.Do(request)
		if err != nil {
			return err
		}
		defer response.Body.Close()
		io.Copy(io.Discard, io.LimitReader(response.Body, 4096))
		if response.StatusCode < 200 || response.StatusCode >= 300 {
			return fmt.Errorf("mail provider returned %d", response.StatusCode)
		}
		return nil
	}
	from, err := mail.ParseAddress(c.SMTPFrom)
	if err != nil || strings.ContainsAny(c.SMTPFrom, "\r\n") {
		return fmt.Errorf("invalid SMTP_FROM_EMAIL")
	}
	connection, err := (&net.Dialer{Timeout: 10 * time.Second}).DialContext(ctx, "tcp", net.JoinHostPort(c.SMTPHost, c.SMTPPort))
	if err != nil {
		return err
	}
	defer connection.Close()
	connection.SetDeadline(time.Now().Add(15 * time.Second))
	client, err := smtp.NewClient(connection, c.SMTPHost)
	if err != nil {
		return err
	}
	defer client.Close()
	if supported, _ := client.Extension("STARTTLS"); supported {
		if err := client.StartTLS(&tls.Config{ServerName: c.SMTPHost, MinVersion: tls.VersionTLS12}); err != nil {
			return err
		}
	} else if c.Production || c.SMTPUser != "" {
		return fmt.Errorf("SMTP server must support STARTTLS")
	}
	if c.SMTPUser != "" {
		if err := client.Auth(smtp.PlainAuth("", c.SMTPUser, c.SMTPPassword, c.SMTPHost)); err != nil {
			return err
		}
	}
	if err := client.Mail(from.Address); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}
	writer, err := client.Data()
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(writer, "From: %s\r\nTo: %s\r\nSubject: nb-hub sign-in code\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s\r\n", c.SMTPFrom, to, text)
	if err != nil {
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}
	return client.Quit()
}
