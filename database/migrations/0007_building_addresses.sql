BEGIN;
ALTER TABLE buildings ADD COLUMN address text CHECK (address IS NULL OR length(address) <= 500);
COMMIT;
