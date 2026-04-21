-- 1) Views
SELECT 'views' AS section, table_name AS name
FROM information_schema.views
WHERE table_schema='public'
ORDER BY table_name;

-- 2) User functions
SELECT 'functions' AS section, routine_name AS name
FROM information_schema.routines
WHERE routine_schema='public'
  AND routine_type='FUNCTION'
ORDER BY routine_name;

-- 3) RLS policy counts per table
SELECT 'policy_counts' AS section, tablename AS name, COUNT(*)::text AS value
FROM pg_policies
WHERE schemaname='public'
GROUP BY tablename
ORDER BY tablename;

-- 4) Trigger counts per table
SELECT 'trigger_counts' AS section, event_object_table AS name, COUNT(*)::text AS value
FROM information_schema.triggers
WHERE trigger_schema='public'
GROUP BY event_object_table
ORDER BY event_object_table;

-- 5) Index counts per table (excluding pkey)
SELECT 'index_counts' AS section, tablename AS name, COUNT(*)::text AS value
FROM pg_indexes
WHERE schemaname='public'
  AND indexname NOT LIKE '%_pkey'
GROUP BY tablename
ORDER BY tablename;

-- 6) Installed extensions
SELECT 'extensions' AS section, extname AS name, extversion AS value
FROM pg_extension
ORDER BY extname;

-- 7) Realtime publication tables
SELECT 'realtime_publication' AS section, schemaname || '.' || tablename AS name
FROM pg_publication_tables
WHERE pubname='supabase_realtime'
ORDER BY schemaname, tablename;

-- 8) Approx row counts
SELECT 'approx_rows' AS section, relname AS name, n_live_tup::text AS value
FROM pg_stat_user_tables
WHERE schemaname='public'
ORDER BY relname;