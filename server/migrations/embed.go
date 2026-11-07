package migrations

import "embed"

// Files travels with the migrator binary; deployment needs no source checkout.
//
//go:embed *
var Files embed.FS
