-- Advisor de segurança: funções auxiliares SECURITY DEFINER não devem ficar expostas na API.
-- Elas vão para o esquema "privado" (fora do Data API); políticas e funções continuam a usá-las.
create schema if not exists privado;
revoke all on schema privado from public;
grant usage on schema privado to anon, authenticated, service_role;

alter function public.is_admin() set schema privado;
alter function public.esta_banido() set schema privado;
alter function public.personagem_visivel(uuid) set schema privado;

do $$
declare r record; def text;
begin
  for r in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','privado') and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~ 'public\.(is_admin|esta_banido|personagem_visivel)\('
  loop
    def := regexp_replace(pg_get_functiondef(r.oid), 'public\.(is_admin|esta_banido|personagem_visivel)\(', 'privado.\1(', 'g');
    execute def;
  end loop;
end $$;

grant execute on function privado.is_admin(), privado.esta_banido(), privado.personagem_visivel(uuid) to anon, authenticated, service_role;

-- admin_emails: ninguém lê pela API (só funções do servidor)
create policy "admin_emails: ninguém lê pela API" on public.admin_emails for select to anon, authenticated using (false);
