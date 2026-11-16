package main

import (
	"bytes"
	"fmt"
	"testing"
)

func TestVersionWithoutCredentials(t *testing.T) {
	t.Setenv("NB_HUB_TOKEN", "")
	root := newRoot()
	var out bytes.Buffer
	root.SetOut(&out)
	root.SetArgs([]string{"--version"})
	if err := root.Execute(); err != nil {
		t.Fatal(err)
	}
	want := fmt.Sprintf("nb-hub %s (commit %s, built %s)\n", version, commit, buildDate)
	if out.String() != want {
		t.Fatalf("got %q, want %q", out.String(), want)
	}
}
