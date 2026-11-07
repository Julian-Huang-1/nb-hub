package sitecli

import (
	"archive/zip"
	"context"
	"fmt"
	"io"
	"io/fs"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Julian-Huang-1/nb-hub/server/internal/service"
	"github.com/Julian-Huang-1/nb-hub/server/internal/storage"
)

func packagePath(source string) (filename string, cleanup func(), err error) {
	info, err := os.Lstat(source)
	if err != nil {
		return "", nil, err
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return "", nil, fmt.Errorf("source must not be a symlink")
	}
	if !info.IsDir() {
		ext := strings.ToLower(filepath.Ext(source))
		if !info.Mode().IsRegular() || (ext != ".html" && ext != ".htm" && ext != ".zip") {
			return "", nil, fmt.Errorf("source must be HTML, ZIP or a directory")
		}
		if info.Size() > storage.MaxUpload {
			return "", nil, fmt.Errorf("upload exceeds 20 MiB")
		}
		return source, func() {}, nil
	}
	f, err := os.CreateTemp("", "nb-hub-deploy-*.zip")
	if err != nil {
		return "", nil, err
	}
	ok := false
	defer func() {
		f.Close()
		if !ok {
			os.Remove(f.Name())
		}
	}()
	root, err := os.OpenRoot(source)
	if err != nil {
		return "", nil, err
	}
	defer root.Close()
	z := zip.NewWriter(f)
	var total int64
	count := 0
	err = fs.WalkDir(root.FS(), ".", func(name string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if name == "." {
			return nil
		}
		if d.IsDir() {
			if d.Name() == ".git" || d.Name() == "node_modules" {
				return fs.SkipDir
			}
			return nil
		}
		if d.Type()&os.ModeSymlink != 0 || d.Name() == ".env" || strings.HasPrefix(d.Name(), ".env.") {
			return nil
		}
		if !storage.ValidPath(name) {
			return fmt.Errorf("invalid asset path: %s", name)
		}
		file, err := root.Open(name)
		if err != nil {
			return err
		}
		defer file.Close()
		info, err := file.Stat()
		if err != nil {
			return err
		}
		if !info.Mode().IsRegular() {
			return fmt.Errorf("asset is not a regular file: %s", name)
		}
		count++
		if count > storage.MaxFiles || info.Size() > storage.MaxExpanded-total {
			return fmt.Errorf("directory exceeds deployment limits")
		}
		h := &zip.FileHeader{Name: name, Method: zip.Deflate}
		h.SetMode(0600)
		h.SetModTime(time.Date(1980, 1, 1, 0, 0, 0, 0, time.UTC))
		dest, err := z.CreateHeader(h)
		if err != nil {
			return err
		}
		n, err := io.Copy(dest, io.LimitReader(file, storage.MaxExpanded-total+1))
		total += n
		if total > storage.MaxExpanded {
			return fmt.Errorf("directory exceeds 50 MiB")
		}
		return err
	})
	closeErr := z.Close()
	if err != nil {
		return "", nil, err
	}
	if closeErr != nil {
		return "", nil, closeErr
	}
	info, err = f.Stat()
	if err != nil {
		return "", nil, err
	}
	if info.Size() > storage.MaxUpload {
		return "", nil, fmt.Errorf("archive exceeds 20 MiB")
	}
	if err = f.Close(); err != nil {
		return "", nil, err
	}
	ok = true
	return f.Name(), func() { os.Remove(f.Name()) }, nil
}
func (c *Client) Upload(ctx context.Context, site, source, entry, message, key string) (service.Deployment, error) {
	filename, cleanup, err := packagePath(source)
	if err != nil {
		return service.Deployment{}, err
	}
	defer cleanup()
	file, err := os.Open(filename)
	if err != nil {
		return service.Deployment{}, err
	}
	defer file.Close()
	reader, writer := io.Pipe()
	form := multipart.NewWriter(writer)
	done := make(chan error, 1)
	go func() {
		err := form.WriteField("entrypoint", entry)
		if err == nil {
			err = form.WriteField("message", message)
		}
		if err == nil {
			var part io.Writer
			part, err = form.CreateFormFile("file", filepath.Base(filename))
			if err == nil {
				_, err = io.Copy(part, file)
			}
		}
		if err == nil {
			err = form.Close()
		}
		writer.CloseWithError(err)
		done <- err
	}()
	var result service.Deployment
	err = c.request(ctx, "POST", "/api/v1/sites/"+site+"/deployments", reader, form.FormDataContentType(), key, &result)
	reader.CloseWithError(err)
	writeErr := <-done
	if err != nil {
		return result, err
	}
	return result, writeErr
}
