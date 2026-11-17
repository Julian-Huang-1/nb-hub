BEGIN;
ALTER TABLE site ADD COLUMN short_id text;
ALTER TABLE deployment ADD COLUMN short_id text;
CREATE UNIQUE INDEX site_short_id_key ON site(short_id);
CREATE UNIQUE INDEX deployment_short_id_key ON deployment(short_id);

-- Only used during backfill; gen_random_uuid supplies cryptographic randomness.
CREATE FUNCTION pg_temp.site_short_id() RETURNS text LANGUAGE plpgsql AS $$
DECLARE
    result text := '';
BEGIN
    FOR i IN 1..10 LOOP
        result := result || substr('abcdefghijklmnopqrstuvwxyz234567',
            (get_byte(uuid_send(gen_random_uuid()), 0) % 32) + 1, 1);
    END LOOP;
    RETURN result;
END;
$$;
DO $$
DECLARE
    row_id uuid;
BEGIN
    FOR row_id IN SELECT id FROM site LOOP
        LOOP
            BEGIN
                UPDATE site SET short_id=pg_temp.site_short_id() WHERE id=row_id;
                EXIT;
            EXCEPTION WHEN unique_violation THEN
                -- Retry with a new random ID without aborting the migration.
            END;
        END LOOP;
    END LOOP;
    FOR row_id IN SELECT id FROM deployment LOOP
        LOOP
            BEGIN
                UPDATE deployment SET short_id=pg_temp.site_short_id() WHERE id=row_id;
                EXIT;
            EXCEPTION WHEN unique_violation THEN
            END;
        END LOOP;
    END LOOP;
END;
$$;
ALTER TABLE site ALTER COLUMN short_id SET NOT NULL;
ALTER TABLE deployment ALTER COLUMN short_id SET NOT NULL;
ALTER TABLE site ADD CONSTRAINT site_short_id_format CHECK (short_id ~ '^[a-z2-7]{10}$');
ALTER TABLE deployment ADD CONSTRAINT deployment_short_id_format CHECK (short_id ~ '^[a-z2-7]{10}$');
COMMIT;
