package storage

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/uuid"
)

type zeroReader struct{}

func (zeroReader) Read(b []byte) (int, error) { clear(b); return len(b), nil }
func archive(t *testing.T, names []string, symlink bool, oversized bool) []byte {
	t.Helper()
	var b bytes.Buffer
	z := zip.NewWriter(&b)
	for _, name := range names {
		h := &zip.FileHeader{Name: name, Method: zip.Deflate}
		h.SetMode(0600)
		if symlink {
			h.SetMode(os.ModeSymlink | 0700)
		}
		f, err := z.CreateHeader(h)
		if err != nil {
			t.Fatal(err)
		}
		if oversized {
			_, err = io.CopyN(f, zeroReader{}, MaxExpanded+1)
		} else {
			_, err = io.WriteString(f, "<html>hello</html>")
		}
		if err != nil {
			t.Fatal(err)
		}
	}
	if err := z.Close(); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}
func TestArchiveBoundaries(t *testing.T) {
	for _, tt := range []struct {
		name       string
		files      []string
		link, bomb bool
	}{
		{"traversal", []string{"../outside"}, false, false}, {"absolute", []string{"/index.html"}, false, false}, {"backslash", []string{"a\\index.html"}, false, false}, {"duplicate", []string{"index.html", "index.html"}, false, false}, {"symlink", []string{"index.html"}, true, false}, {"reserved", []string{".nbhub/access"}, false, false}, {"missing entry", []string{"other.html"}, false, false}, {"zip bomb", []string{"index.html"}, false, true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			s, err := New(t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			site, id := uuid.New(), uuid.New()
			if err = s.WriteUpload(context.Background(), id, bytes.NewReader(archive(t, tt.files, tt.link, tt.bomb))); err != nil {
				t.Fatal(err)
			}
			if _, err = s.Build(context.Background(), site, id, "zip", "index.html"); err == nil {
				t.Fatal("unsafe archive accepted")
			}
			if _, err = os.Stat(s.Release(site, id)); !os.IsNotExist(err) {
				t.Fatal("failed build exposed files")
			}
			entries, _ := os.ReadDir(filepath.Join(s.Root, "work"))
			if len(entries) != 0 {
				t.Fatal("work files leaked")
			}
		})
	}
}
func TestBuildNestedAndRetry(t *testing.T) {
	s, _ := New(t.TempDir())
	site, id := uuid.New(), uuid.New()
	ctx := context.Background()
	payload := archive(t, []string{"index.html", "assets/main.js"}, false, false)
	if err := s.WriteUpload(ctx, id, bytes.NewReader(payload)); err != nil {
		t.Fatal(err)
	}
	size, err := s.Build(ctx, site, id, "zip", "index.html")
	if err != nil || size == 0 {
		t.Fatal(size, err)
	}
	again, err := s.Build(ctx, site, id, "zip", "index.html")
	if err != nil || again != size {
		t.Fatal(again, err)
	}
	b, err := os.ReadFile(filepath.Join(s.Release(site, id), "assets/main.js"))
	if err != nil || !strings.Contains(string(b), "hello") {
		t.Fatal(err)
	}
}
func TestUploadLimitAndCancellation(t *testing.T) {
	s, _ := New(t.TempDir())
	if err := s.WriteUpload(context.Background(), uuid.New(), io.LimitReader(zeroReader{}, MaxUpload+1)); !errors.Is(err, ErrUploadTooLarge) {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := s.WriteUpload(ctx, uuid.New(), strings.NewReader("html")); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
}
