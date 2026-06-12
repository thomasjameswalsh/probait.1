CREATE TABLE IF NOT EXISTS postcode_districts (
    district_norm text PRIMARY KEY,
    feature jsonb NOT NULL,
    geom geometry(MultiPolygon, 4326) NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
    );

CREATE OR REPLACE TRIGGER postcode_districts_set_updated_at
    BEFORE UPDATE ON postcode_districts
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS postcode_districts_geom_idx
ON postcode_districts USING gist (geom);