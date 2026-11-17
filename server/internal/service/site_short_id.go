package service

import (
	"crypto/rand"
	"encoding/base32"
	"errors"

	"github.com/jackc/pgx/v5"
)

func newSiteShortID() (string, error) {
	var entropy [7]byte
	if _, err := rand.Read(entropy[:]); err != nil {
		return "", err
	}
	// Ten Base32 characters carry 50 uniformly random bits.
	return base32.NewEncoding("abcdefghijklmnopqrstuvwxyz234567").EncodeToString(entropy[:])[:10], nil
}

// Inserts use ON CONFLICT (short_id) DO NOTHING so a collision does not
// abort the surrounding transaction. Other constraint errors are returned.
func createWithShortID[T any](insert func(string) (T, error)) (T, error) {
	for range 10 {
		id, err := newSiteShortID()
		if err != nil {
			var zero T
			return zero, err
		}
		value, err := insert(id)
		if !errors.Is(err, pgx.ErrNoRows) {
			return value, err
		}
	}
	var zero T
	return zero, errors.New("short ID collision retry limit reached")
}
