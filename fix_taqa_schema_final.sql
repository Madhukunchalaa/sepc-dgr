-- Run this SQL as a SUPERUSER (e.g., postgres) to fix TAQA data overflow issues
DO $$
DECLARE
    col_name TEXT;
BEGIN
    FOR col_name IN 
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'taqa_daily_input' AND data_type = 'numeric'
    LOOP
        EXECUTE format('ALTER TABLE taqa_daily_input ALTER COLUMN %I TYPE NUMERIC(24,6)', col_name);
    END LOOP;
END $$;

-- Also grant full control to dgr_user just in case
GRANT ALL PRIVILEGES ON TABLE taqa_daily_input TO dgr_user;
