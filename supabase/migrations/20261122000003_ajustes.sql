-- Ajustes: conquista "Primeiro Passo" na aprovação da ficha e índices de apoio.
create or replace function public.aprovar_ficha(p_id uuid, p_valores jsonb, p_admin uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.personagens;
begin
  update public.personagens set status = 'aprovada', aprovado_em = now(), motivo_recusa = null,
    faccao = p_valores->>'faccao', seita = p_valores->>'seita', origem = p_valores->>'origem', linhagem = p_valores->>'linhagem',
    taeis = (p_valores->>'taeis')::int, corrupcao = (p_valores->>'corrupcao')::int, infamia = (p_valores->>'infamia')::int,
    qi_max = (p_valores->>'qi_max')::int, regiao = coalesce(regiao, p_valores->>'regiao')
  where id = p_id and status = 'aguardando' returning * into c;
  if c.id is null then raise exception 'A ficha não está aguardando aprovação.'; end if;
  insert into public.admin_log (admin, acao, tabela, alvo, depois, motivo) values (p_admin, 'APROVAR', 'personagens', p_id::text, p_valores, 'Ficha aprovada');
  insert into public.diario (personagem, tipo, texto) values (c.id, 'aprovacao', 'Ficha aprovada: o personagem entrou no Jianghu.');
  insert into public.conquistas (personagem, chave) values (c.id, 'primeiro_passo') on conflict do nothing;
end $$;
revoke execute on function public.aprovar_ficha(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.aprovar_ficha(uuid, jsonb, uuid) to service_role;

-- índices para as chaves estrangeiras usadas em junções (recomendação do advisor de desempenho)
create index if not exists envios_revisado_por_idx on public.envios (revisado_por);
create index if not exists leituras_concedidas_concedido_por_idx on public.leituras_concedidas (concedido_por);
create index if not exists mural_personagem_idx on public.mural (personagem);
create index if not exists mural_criado_por_idx on public.mural (criado_por);
create index if not exists listas_personagem_idx on public.listas (personagem);
create index if not exists personagens_legado_de_idx on public.personagens (legado_de);
create index if not exists personagens_reino_idx on public.personagens (reino);
