BEGIN;
ALTER TABLE floors ADD COLUMN name text;
ALTER TABLE floors ADD COLUMN type text NOT NULL DEFAULT 'residential';
ALTER TABLE floors ADD CONSTRAINT floors_type_check CHECK (type IN ('residential', 'commercial', 'parking'));
ALTER TABLE apartments ADD COLUMN type text NOT NULL DEFAULT 'residential';
ALTER TABLE apartments ADD COLUMN position integer NOT NULL DEFAULT 0;
ALTER TABLE apartments ADD CONSTRAINT apartments_type_check CHECK (type IN ('residential', 'commercial', 'parking'));
ALTER TABLE apartments ADD CONSTRAINT apartments_position_check CHECK (position >= 0);
-- Backfill deterministically; existing business labels and IDs remain untouched.
WITH ordered AS (
 SELECT id, row_number() OVER (PARTITION BY floor_id ORDER BY number COLLATE "C", id) - 1 AS position FROM apartments
)
UPDATE apartments SET position = ordered.position FROM ordered WHERE apartments.id = ordered.id;
COMMIT;
