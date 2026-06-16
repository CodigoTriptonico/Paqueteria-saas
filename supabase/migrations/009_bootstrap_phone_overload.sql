-- Evita ambigüedad entre bootstrap_organization con y sin owner_phone
drop function if exists public.bootstrap_organization(text, uuid, text, text, text, text);
