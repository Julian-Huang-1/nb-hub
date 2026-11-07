// Package storage owns filesystem access for immutable static deployments.
package storage

import (
	"archive/zip"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
)

const MaxUpload int64 = 20 << 20
const MaxExpanded int64 = 50 << 20
const MaxFiles = 1000

var ErrInvalidArchive = errors.New("invalid or oversized site archive")
var ErrUploadTooLarge = errors.New("upload exceeds 20 MiB")

type Local struct{ Root string }

func New(root string) (*Local, error) {
	absolute, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	for _, dir := range []string{"staging", "releases", "work"} {
		if err := os.MkdirAll(filepath.Join(absolute, dir), 0700); err != nil {
			return nil, err
		}
	}
	return &Local{absolute}, nil
}
func (s *Local) Stage(id uuid.UUID) string { return filepath.Join(s.Root, "staging", id.String()) }
func (s *Local) Release(site, id uuid.UUID) string {
	return filepath.Join(s.Root, "releases", site.String(), id.String())
}
func ValidPath(name string) bool {
	return utf8.ValidString(name) && name != "" && len(name) <= 1024 && !strings.ContainsAny(name, "\\\x00:\r\n") && !strings.HasPrefix(name, "/") && path.Clean(name) == name && name != "." && name != ".." && !strings.HasPrefix(name, "../") && strings.Split(name, "/")[0] != ".nbhub"
}
func (s *Local) WriteUpload(ctx context.Context, id uuid.UUID, r io.Reader) error {
	f, err := os.OpenFile(s.Stage(id), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	_, err = io.Copy(f, io.LimitReader(&contextReader{ctx, r}, MaxUpload+1))
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	info, err := os.Stat(s.Stage(id))
	if err != nil {
		return err
	}
	if info.Size() > MaxUpload {
		return ErrUploadTooLarge
	}
	return nil
}

type contextReader struct {
	ctx context.Context
	r   io.Reader
}

func (r *contextReader) Read(p []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		return 0, err
	}
	return r.r.Read(p)
}

// Build always reconstructs into a fresh directory. A complete release is exposed
// by rename only after every file has passed validation.
func (s *Local) Build(ctx context.Context, site, id uuid.UUID, format, entry string) (int64, error) {
	if !ValidPath(entry) {
		return 0, ErrInvalidArchive
	}
	tmp, err := os.MkdirTemp(filepath.Join(s.Root, "work"), id.String()+"-")
	if err != nil {
		return 0, err
	}
	defer os.RemoveAll(tmp)
	var total int64
	write := func(name string, r io.Reader) error {
		if !ValidPath(name) {
			return ErrInvalidArchive
		}
		dest := filepath.Join(tmp, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(dest), 0700); err != nil {
			return err
		}
		f, err := os.OpenFile(dest, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
		if err != nil {
			return fmt.Errorf("%w: duplicate or conflicting path", ErrInvalidArchive)
		}
		n, copyErr := io.Copy(f, io.LimitReader(&contextReader{ctx, r}, MaxExpanded-total+1))
		closeErr := f.Close()
		total += n
		if copyErr != nil {
			return copyErr
		}
		if closeErr != nil {
			return closeErr
		}
		if total > MaxExpanded {
			return ErrInvalidArchive
		}
		return nil
	}
	switch format {
	case "html":
		f, err := os.Open(s.Stage(id))
		if err != nil {
			return 0, err
		}
		err = write(entry, f)
		f.Close()
		if err != nil {
			return 0, err
		}
	case "zip":
		z, err := zip.OpenReader(s.Stage(id))
		if err != nil {
			return 0, ErrInvalidArchive
		}
		defer z.Close()
		if len(z.File) > MaxFiles {
			return 0, ErrInvalidArchive
		}
		seen := map[string]bool{}
		for _, f := range z.File {
			name := strings.TrimSuffix(f.Name, "/")
			if !ValidPath(name) || seen[name] || f.Mode()&os.ModeSymlink != 0 || (!f.Mode().IsRegular() && !f.FileInfo().IsDir()) {
				return 0, ErrInvalidArchive
			}
			seen[name] = true
			if f.FileInfo().IsDir() {
				if err := os.MkdirAll(filepath.Join(tmp, filepath.FromSlash(name)), 0700); err != nil {
					return 0, ErrInvalidArchive
				}
				continue
			}
			if f.UncompressedSize64 > uint64(MaxExpanded-total) {
				return 0, ErrInvalidArchive
			}
			rc, err := f.Open()
			if err != nil {
				return 0, ErrInvalidArchive
			}
			err = write(name, rc)
			rc.Close()
			if err != nil {
				return 0, err
			}
		}
	default:
		return 0, ErrInvalidArchive
	}
	info, err := os.Stat(filepath.Join(tmp, filepath.FromSlash(entry)))
	if err != nil || !info.Mode().IsRegular() {
		return 0, ErrInvalidArchive
	}
	dest := s.Release(site, id)
	if err := os.MkdirAll(filepath.Dir(dest), 0700); err != nil {
		return 0, err
	}
	// A retry can encounter the completed output of an interrupted DB commit.
	if _, err := os.Stat(dest); err == nil {
		return treeSize(dest)
	}
	if err := os.Rename(tmp, dest); err != nil {
		return 0, err
	}
	return total, nil
}
func treeSize(root string) (int64, error) {
	var total int64
	err := filepath.WalkDir(root, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() {
			i, e := d.Info()
			if e != nil {
				return e
			}
			total += i.Size()
		}
		return nil
	})
	return total, err
}
func (s *Local) RemoveStage(id uuid.UUID) error {
	err := os.Remove(s.Stage(id))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}
func (s *Local) RemoveRelease(site, id uuid.UUID) error { return os.RemoveAll(s.Release(site, id)) }
