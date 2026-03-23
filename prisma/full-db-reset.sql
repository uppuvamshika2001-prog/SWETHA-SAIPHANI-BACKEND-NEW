-- ============================================================
-- FULL DATABASE RESET SCRIPT (PROCEED WITH CAUTION)
-- Run this BEFORE pg_restore to clear EVERYTHING in the public schema.
-- This ensures no conflicting types, tables, or constraints exist.
-- ============================================================

DO $$ DECLARE
    r RECORD;
BEGIN
    -- 1. Drop all tables in the public schema with CASCADE
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;

    -- 2. Drop all sequences in the public schema
    FOR r IN (SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'S' AND n.nspname = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.relname) || ' CASCADE';
    END LOOP;

    -- 3. Drop all types/enums in the public schema
    FOR r IN (SELECT typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e') LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
END $$;
