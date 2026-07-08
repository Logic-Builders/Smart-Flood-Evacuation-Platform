-- Idempotent seed for databases initialized before the anonymous-reporter row was added
-- to database.sql. Safe to run against an already-populated DB.
INSERT INTO flood_system.users (user_id, email, full_name, password_hash, role, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000099',
    'anonymous@public.flood-system.local',
    'Anonymous Public Reporter',
    'NO_LOGIN_ACCOUNT',
    'PUBLIC'::flood_system.user_role,
    TRUE
)
ON CONFLICT (user_id) DO NOTHING;
