-- Consulta para verificar se alguma função no banco ainda referencia fee_percentage
SELECT p.proname as func_name, n.nspname as schema_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
AND pg_get_functiondef(p.oid) LIKE '%fee_percentage%'; 