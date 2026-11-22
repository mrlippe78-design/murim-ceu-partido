-- O projeto foi criado sem "conceder acesso automático a tabelas novas".
-- A Edge Function usa a chave de servidor (service_role), que também precisa de permissão explícita.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
grant usage on all sequences in schema public to authenticated;
