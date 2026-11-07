# Database migrations

Add sequential pairs such as `000001_create_example.up.sql` and
`000001_create_example.down.sql` when the first persisted product workflow exists.
No business tables are created by this scaffold.

Files are embedded in the migrator binary. `make migrate` applies pending up
migrations; production Compose runs the same binary before starting the API.
The runner uses golang-migrate with PostgreSQL advisory locking and its
`schema_migrations` version/dirty record. With no SQL files it checks connectivity
and exits successfully without creating tables.

Applied migrations are immutable. Add another version to change the schema.
For atomic multi-statement changes use explicit `BEGIN; ... COMMIT;` in the SQL.
Operations such as `CREATE INDEX CONCURRENTLY` must run outside a transaction.
If a migration fails, inspect the database, repair the partial change and dirty
version deliberately before retrying; the deployment does not automatically force
or roll back a version. Take a backup before production schema changes.

The application exposes only forward migrations. Destructive rollback and force
operations are operator recovery actions using the golang-migrate CLI with an
explicit database target. Never use development reset against production.
