-- Murim: Céu Partido — funções do jogo (RPC) e automações.

-- ───────── Progresso automático: PE sobe → estágio sobe (sem atravessar o gargalo) ─────────
create or replace function public.progresso_automatico()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  r public.reinos;
  alvo text;
  ordem text[] := array['inicial','intermediario','superior'];
  i int;
  prox int;
begin
  if new.pe is not distinct from old.pe or new.reino <> old.reino then return new; end if;
  select * into r from public.reinos where chave = new.reino;
  if r.pe_inicial is null then return new; end if;
  alvo := case when new.pe >= r.pe_superior then 'superior' when new.pe >= r.pe_intermediario then 'intermediario' else 'inicial' end;
  i := array_position(ordem, new.estagio);
  while array_position(ordem, alvo) > i loop
    i := i + 1;
    new.estagio := ordem[i];
    new.pa := new.pa + r.pa_por_estagio;
    -- abre o próximo meridiano principal (1..12)
    select min(g) into prox from generate_series(1,12) g where not (g = any(new.meridianos));
    if prox is not null then new.meridianos := array_append(new.meridianos, prox); end if;
    insert into public.diario (personagem, tipo, texto)
      values (new.id, 'estagio', format('Alcançou %s %s.', r.nome, case ordem[i] when 'intermediario' then 'Intermediário' else 'Superior' end));
  end loop;
  return new;
end $$;
create trigger progresso_automatico before update of pe on public.personagens
  for each row execute function public.progresso_automatico();

-- ───────── Corrupção 100: o personagem enlouquece e vira NPC ─────────
create or replace function public.corrupcao_total()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.corrupcao >= 100 and old.corrupcao < 100 and new.vivo then
    new.vivo := false;
    new.morto_em := now();
    new.causa_morte := 'Enlouqueceu: a Corrupção chegou a 100. Agora é um NPC da administração.';
    insert into public.mural (tipo, titulo, corpo, personagem)
      values ('morte', format('%s se perdeu para o demônio interior', new.nome), new.causa_morte, new.id);
    insert into public.diario (personagem, tipo, texto) values (new.id, 'morte', new.causa_morte);
  end if;
  return new;
end $$;
create trigger corrupcao_total before update of corrupcao on public.personagens
  for each row execute function public.corrupcao_total();

-- ───────── Criar e excluir personagem ─────────
create or replace function public.criar_personagem(p_nome text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  perf public.perfis;
  novo uuid;
  ativos int;
begin
  if uid is null then raise exception 'Entre na sua conta.'; end if;
  select * into perf from public.perfis where id = uid;
  if perf.banido then raise exception 'Conta suspensa.'; end if;
  if not perf.quiz_aprovado then raise exception 'Complete o tutorial "Primeira vez aqui?" antes de criar a ficha.'; end if;
  select count(*) into ativos from public.personagens where dono = uid and excluido_em is null and vivo;
  if ativos >= 2 then raise exception 'Cada jogador pode ter no máximo 2 personagens vivos.'; end if;
  insert into public.personagens (dono, nome, leituras, leitura_liberada_em)
  values (uid, btrim(p_nome),
    case when perf.ultima_exclusao_em is not null and perf.ultima_exclusao_em > now() - interval '30 days' then 0 else 1 end,
    case when perf.ultima_exclusao_em is not null and perf.ultima_exclusao_em > now() - interval '30 days' then perf.ultima_exclusao_em + interval '30 days' else null end)
  returning id into novo;
  insert into public.diario (personagem, tipo, texto) values (novo, 'criacao', 'Ficha iniciada.');
  return novo;
end $$;

create or replace function public.excluir_personagem(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  update public.personagens set excluido_em = now() where id = p_id and dono = uid and excluido_em is null;
  if not found then raise exception 'Personagem não encontrado.'; end if;
  update public.perfis set ultima_exclusao_em = now() where id = uid;
end $$;

-- ───────── Tutorial: o quiz libera a criação de ficha ─────────
create or replace function public.aprovar_quiz(p_respostas jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  gabarito jsonb := '{"q1":"b","q2":"c","q3":"a","q4":"c","q5":"b","q6":"a"}';
  acertos int := 0;
  k text;
begin
  if (select auth.uid()) is null then raise exception 'Entre na sua conta.'; end if;
  for k in select jsonb_object_keys(gabarito) loop
    if p_respostas->>k = gabarito->>k then acertos := acertos + 1; end if;
  end loop;
  if acertos >= 5 then
    update public.perfis set quiz_aprovado = true where id = (select auth.uid());
  end if;
  return jsonb_build_object('acertos', acertos, 'total', 6, 'aprovado', acertos >= 5);
end $$;

-- ───────── Envio de treinos e missões ─────────
create or replace function public.contar_linhas(t text)
returns int language sql immutable set search_path = ''
as $$ select count(*)::int from regexp_split_to_table(coalesce(t,''), E'\n') l where btrim(l, E' \t\r') <> ''; $$;

create or replace function public.enviar_texto(p_personagem uuid, p_tipo text, p_titulo text, p_foco text, p_texto text)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  c public.personagens;
  r public.reinos;
  n int := public.contar_linhas(p_texto);
  minimo int;
  inicio_semana timestamptz := date_trunc('week', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  usados int;
  novo bigint;
begin
  if public.esta_banido() then raise exception 'Conta suspensa.'; end if;
  select * into c from public.personagens where id = p_personagem and dono = uid and excluido_em is null;
  if c.id is null then raise exception 'Personagem não encontrado.'; end if;
  if c.status <> 'aprovada' or not c.vivo then raise exception 'Só personagens aprovados e vivos enviam textos.'; end if;
  minimo := case p_tipo when 'treino' then 80 when 'missao_facil' then 40 when 'missao_media' then 60 when 'missao_dificil' then 80 when 'pedido_avanco' then 40 end;
  if minimo is null then raise exception 'Tipo de envio inválido.'; end if;
  if n < minimo then raise exception 'Este envio precisa de pelo menos % linhas (o texto tem %).', minimo, n; end if;
  if p_tipo = 'treino' then
    if coalesce(btrim(p_foco),'') = '' then raise exception 'Defina o foco do treino.'; end if;
    select count(*) into usados from public.envios where personagem = c.id and tipo = 'treino' and status <> 'recusado' and criado_em >= inicio_semana;
    if usados >= 3 then raise exception 'Limite de 3 treinos por semana atingido.'; end if;
  elsif p_tipo like 'missao_%' then
    select count(*) into usados from public.envios where personagem = c.id and tipo like 'missao_%' and status <> 'recusado' and criado_em >= inicio_semana;
    if usados >= 2 then raise exception 'Limite de 2 missões autonarradas por semana atingido.'; end if;
  else
    select * into r from public.reinos where ordem = (select ordem + 1 from public.reinos where chave = c.reino);
    if c.estagio <> 'superior' or r.pe_inicial is null or c.pe < r.pe_inicial then
      raise exception 'Pedido de avanço só no estágio Superior e com o PE do próximo reino.';
    end if;
    if c.gargalo_liberado then raise exception 'O gargalo já está liberado: faça a rolagem oficial.'; end if;
    if exists (select 1 from public.envios where personagem = c.id and tipo = 'pedido_avanco' and status = 'pendente') then
      raise exception 'Já há um pedido de avanço na fila.';
    end if;
  end if;
  insert into public.envios (personagem, dono, tipo, titulo, foco, texto, linhas)
  values (c.id, uid, p_tipo, btrim(p_titulo), nullif(btrim(p_foco),''), p_texto, n)
  returning id into novo;
  return novo;
end $$;

-- ───────── Admin: revisar envio ─────────
create or replace function public.revisar_envio(p_envio bigint, p_aprovar boolean, p_pe int default null, p_taeis int default null, p_nota text default null, p_mods jsonb default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  e public.envios;
  c public.personagens;
  r public.reinos;
  v_pe int := 0;
  mult numeric := 1;
begin
  if not public.is_admin() then raise exception 'Somente administradores.'; end if;
  select * into e from public.envios where id = p_envio for update;
  if e.status <> 'pendente' then raise exception 'Envio já revisado.'; end if;
  perform set_config('app.motivo', coalesce(p_nota, 'revisão de envio'), true);
  if not p_aprovar then
    update public.envios set status = 'recusado', nota_admin = p_nota, revisado_por = (select auth.uid()), revisado_em = now() where id = e.id;
    return;
  end if;
  select * into c from public.personagens where id = e.personagem for update;
  select * into r from public.reinos where chave = c.reino;
  if e.tipo = 'treino' then
    if c.corpo = 'corpo_mortal' then mult := mult + 0.10; end if;
    if c.ficha->'talentos'->'vantagens' ? 'prodigio_marcial' then mult := mult + 0.20; end if;
    v_pe := round(r.pe_treino * mult);
  elsif e.tipo = 'missao_facil' then v_pe := 150;
  elsif e.tipo = 'missao_media' then v_pe := 250;
  elsif e.tipo = 'missao_dificil' then v_pe := 350;
  end if;
  v_pe := coalesce(p_pe, v_pe);
  update public.envios set status = 'aprovado', pe_concedido = v_pe, taeis_concedidos = coalesce(p_taeis,0), nota_admin = p_nota,
    revisado_por = (select auth.uid()), revisado_em = now() where id = e.id;
  if e.tipo = 'pedido_avanco' then
    update public.personagens set gargalo_liberado = true, gargalo_mods = coalesce(p_mods, '{}'::jsonb) where id = c.id;
    insert into public.diario (personagem, tipo, texto) values (c.id, 'gargalo', format('Pedido de avanço aprovado: "%s". O gargalo está aberto.', e.titulo));
  else
    update public.personagens set pe = pe + v_pe, taeis = taeis + coalesce(p_taeis,0) where id = c.id;
    insert into public.diario (personagem, tipo, texto)
      values (c.id, case when e.tipo = 'treino' then 'treino' else 'missao' end, format('%s aprovado: "%s" (+%s PE).', case when e.tipo='treino' then 'Treino' else 'Missão' end, e.titulo, v_pe));
  end if;
end $$;

-- ───────── Admin: ajustes com motivo ─────────
create or replace function public.ajustar_personagem(p_id uuid, p_mudancas jsonb, p_motivo text)
returns void language plpgsql security definer set search_path = ''
as $$
declare d int;
begin
  if not public.is_admin() then raise exception 'Somente administradores.'; end if;
  if coalesce(btrim(p_motivo),'') = '' then raise exception 'Informe o motivo do ajuste.'; end if;
  perform set_config('app.motivo', p_motivo, true);
  update public.personagens set
    pe = greatest(0, pe + coalesce((p_mudancas->>'pe')::int, 0)),
    pa = pa + coalesce((p_mudancas->>'pa')::int, 0),
    taeis = taeis + coalesce((p_mudancas->>'taeis')::int, 0),
    fama = greatest(0, fama + coalesce((p_mudancas->>'fama')::int, 0)),
    infamia = greatest(0, infamia + coalesce((p_mudancas->>'infamia')::int, 0)),
    corrupcao = least(100, greatest(0, corrupcao + coalesce((p_mudancas->>'corrupcao')::int, 0))),
    contribuicao = contribuicao + coalesce((p_mudancas->>'contribuicao')::int, 0),
    leituras = greatest(0, leituras + coalesce((p_mudancas->>'leituras')::int, 0)),
    regiao = coalesce(p_mudancas->>'regiao', regiao),
    alcunha = coalesce(p_mudancas->>'alcunha', alcunha),
    ferimentos = coalesce(p_mudancas->'ferimentos', ferimentos),
    inventario = coalesce(p_mudancas->'inventario', inventario),
    afinidades = coalesce(p_mudancas->'afinidades', afinidades),
    meridianos = coalesce(array(select jsonb_array_elements_text(p_mudancas->'meridianos')::int), meridianos)
  where id = p_id;
  if not found then raise exception 'Personagem não encontrado.'; end if;
  d := coalesce((p_mudancas->>'leituras')::int, 0);
  if d <> 0 then
    insert into public.leituras_concedidas (personagem, quantidade, motivo, concedido_por) values (p_id, d, p_motivo, (select auth.uid()));
  end if;
  insert into public.diario (personagem, tipo, texto) values (p_id, 'ajuste', format('Ajuste da administração: %s', p_motivo));
end $$;

-- ───────── Admin: aprovar/recusar ficha (valores iniciais calculados pelo servidor `jogo`) ─────────
create or replace function public.recusar_ficha(p_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Somente administradores.'; end if;
  perform set_config('app.motivo', p_motivo, true);
  update public.personagens set status = 'recusada', motivo_recusa = p_motivo where id = p_id and status = 'aguardando';
  if not found then raise exception 'A ficha não está aguardando aprovação.'; end if;
end $$;

-- ───────── Admin: morte, banimento, conquistas ─────────
create or replace function public.registrar_morte(p_id uuid, p_causa text)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.personagens;
begin
  if not public.is_admin() then raise exception 'Somente administradores.'; end if;
  perform set_config('app.motivo', p_causa, true);
  update public.personagens set vivo = false, morto_em = now(), causa_morte = p_causa where id = p_id and vivo returning * into c;
  if c.id is null then raise exception 'Personagem não encontrado ou já morto.'; end if;
  insert into public.mural (tipo, titulo, corpo, personagem, criado_por)
    values ('morte', format('%s tombou', coalesce(c.alcunha, c.nome)), p_causa, c.id, (select auth.uid()));
  insert into public.diario (personagem, tipo, texto) values (c.id, 'morte', p_causa);
end $$;

create or replace function public.banir_conta(p_perfil uuid, p_banido boolean, p_motivo text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Somente administradores.'; end if;
  if p_perfil = (select auth.uid()) then raise exception 'Você não pode banir a si mesmo.'; end if;
  perform set_config('app.motivo', p_motivo, true);
  update public.perfis set banido = p_banido where id = p_perfil;
end $$;

create or replace function public.conceder_conquista(p_personagem uuid, p_chave text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Somente administradores.'; end if;
  insert into public.conquistas (personagem, chave) values (p_personagem, p_chave) on conflict do nothing;
end $$;

-- ───────── Jogador: distribuir PA (respeita o teto do reino) ─────────
create or replace function public.distribuir_pa(p_id uuid, p_atributos jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  c public.personagens;
  teto int;
  total int := 0;
  k text;
  v int;
  atual int;
  novos jsonb;
begin
  select * into c from public.personagens where id = p_id and dono = (select auth.uid()) and excluido_em is null for update;
  if c.id is null then raise exception 'Personagem não encontrado.'; end if;
  if c.status <> 'aprovada' or not c.vivo then raise exception 'Só personagens aprovados e vivos.'; end if;
  select teto_atributo into teto from public.reinos where chave = c.reino;
  novos := c.ficha->'atributos';
  for k, v in select key, value::int from jsonb_each_text(p_atributos) loop
    if k not in ('forca','agilidade','resistencia','precisao','vigor') then raise exception 'Atributo inválido: %', k; end if;
    if v < 0 then raise exception 'Valores negativos não são permitidos.'; end if;
    atual := coalesce((novos->>k)::int, 0) + v;
    if atual > teto then raise exception 'O teto do seu reino é % por atributo.', teto; end if;
    novos := jsonb_set(novos, array[k], to_jsonb(atual));
    total := total + v;
  end loop;
  if total > c.pa then raise exception 'Você tem % PA e tentou gastar %.', c.pa, total; end if;
  update public.personagens set pa = pa - total, ficha = jsonb_set(ficha, '{atributos}', novos) where id = c.id;
  insert into public.diario (personagem, tipo, texto) values (c.id, 'pa', format('Distribuiu %s PA.', total));
end $$;

-- ───────── Jogador: escolher entre o resultado antigo e o novo ─────────
create or replace function public.escolher_leitura(p_leitura bigint, p_manter_novo boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  l public.leituras;
begin
  select * into l from public.leituras where id = p_leitura and dono = (select auth.uid());
  if l.id is null or not l.precisa_escolha then raise exception 'Leitura não encontrada.'; end if;
  if exists (select 1 from public.escolhas_leitura where leitura = l.id) then raise exception 'Esta escolha já foi feita.'; end if;
  insert into public.escolhas_leitura (leitura, manteve_novo) values (l.id, p_manter_novo);
  if p_manter_novo then
    if l.tipo = 'corpo' then update public.personagens set corpo = l.resultado where id = l.personagem;
    elsif l.tipo = 'raiz' then update public.personagens set raiz = jsonb_build_object('tipo', l.resultado, 'elementos', coalesce(l.detalhes->'elementos','[]'::jsonb)) where id = l.personagem;
    else update public.personagens set linhagem_rara = l.resultado where id = l.personagem;
    end if;
    insert into public.diario (personagem, tipo, texto) values (l.personagem, 'leitura', 'Escolheu manter o novo resultado da Leitura do Destino.');
  end if;
end $$;

-- ───────── Servidor (`jogo`): aplicar leitura com controle de concorrência ─────────
create or replace function public.aplicar_leitura(
  p_personagem uuid, p_tipo text, p_raridade text, p_resultado text, p_nome text, p_detalhes jsonb,
  p_rolagem int, p_garantida boolean, p_fios_antes int, p_fios_depois int, p_concessao text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  c public.personagens;
  precisa boolean := false;
  novo_id bigint;
  ocupado boolean;
begin
  select * into c from public.personagens where id = p_personagem for update;
  if c.id is null or c.excluido_em is not null or not c.vivo then raise exception 'personagem_invalido'; end if;
  if c.fios <> p_fios_antes then raise exception 'conflito'; end if;
  -- concessão de leitura atrasada (anti-reroll) ou Sorte do Céu
  if c.leituras = 0 then
    if p_concessao = 'liberada' and c.leitura_liberada_em is not null and c.leitura_liberada_em <= now() then
      c.leituras := 1; c.leitura_liberada_em := null;
      insert into public.leituras_concedidas (personagem, quantidade, motivo) values (c.id, 1, 'Leitura de criação liberada após 30 dias');
    elsif p_concessao = 'sorte' and not c.sorte_usada and c.ficha->'talentos'->'vantagens' ? 'sorte_do_ceu' then
      c.leituras := 1; c.sorte_usada := true;
      insert into public.leituras_concedidas (personagem, quantidade, motivo) values (c.id, 1, 'Talento Sorte do Céu');
    else
      raise exception 'sem_leituras';
    end if;
  end if;
  if p_raridade = 'mitico' then
    perform pg_advisory_xact_lock(hashtext('mitico:' || p_resultado));
    select exists (
      select 1 from public.personagens o where o.corpo = p_resultado and o.vivo and o.excluido_em is null and o.id <> c.id
      union all
      select 1 from public.leituras l join public.personagens o on o.id = l.personagem
        where l.resultado = p_resultado and l.precisa_escolha and o.vivo and o.excluido_em is null
          and not exists (select 1 from public.escolhas_leitura e where e.leitura = l.id)
    ) into ocupado;
    if ocupado then raise exception 'mitico_ocupado'; end if;
  end if;

  if p_tipo = 'corpo' then
    if p_resultado <> 'corpo_mortal' and c.corpo <> 'corpo_mortal' and c.corpo <> p_resultado then precisa := true;
    elsif p_resultado <> 'corpo_mortal' then c.corpo := p_resultado;
    end if;
  elsif p_tipo = 'raiz' then
    if p_resultado <> 'comum' and c.raiz->>'tipo' <> 'comum' then precisa := true;
    elsif p_resultado <> 'comum' then c.raiz := jsonb_build_object('tipo', p_resultado, 'elementos', coalesce(p_detalhes->'elementos','[]'::jsonb));
    end if;
  else
    if p_resultado <> 'nenhuma' and c.linhagem_rara is not null and c.linhagem_rara <> p_resultado then precisa := true;
    elsif p_resultado <> 'nenhuma' then c.linhagem_rara := p_resultado;
    end if;
  end if;

  update public.personagens set leituras = c.leituras - 1, leitura_liberada_em = c.leitura_liberada_em, sorte_usada = c.sorte_usada,
    fios = p_fios_depois, corpo = c.corpo, raiz = c.raiz, linhagem_rara = c.linhagem_rara
  where id = c.id;

  insert into public.leituras (personagem, dono, tipo, raridade, resultado, detalhes, rolagem, garantida, precisa_escolha)
  values (c.id, c.dono, p_tipo, p_raridade, p_resultado, p_detalhes || jsonb_build_object('nome', p_nome), p_rolagem, p_garantida, precisa)
  returning id into novo_id;

  insert into public.diario (personagem, tipo, texto)
    values (c.id, 'leitura', format('Leitura do Destino (%s): %s.', p_tipo, p_nome));
  if p_tipo = 'corpo' and p_raridade in ('epico','lendario','mitico') then
    insert into public.conquistas (personagem, chave) values (c.id, 'corpo_epico') on conflict do nothing;
  end if;
  if p_tipo = 'corpo' and p_raridade in ('lendario','mitico') then
    insert into public.mural (tipo, titulo, corpo, personagem)
    values (p_raridade,
      format('%s: %s despertou no destino de %s', case when p_raridade = 'mitico' then 'MÍTICO' else 'Lendário' end, p_nome, c.nome),
      case when p_raridade = 'mitico' then 'O céu escureceu sobre as Planícies. Um corpo que nasce uma vez a cada geração apareceu.' else 'Um corpo lendário foi lido. Mestres de Pico já sentem a perturbação.' end,
      c.id);
  end if;
  return jsonb_build_object('id', novo_id, 'precisa_escolha', precisa, 'leituras_restantes', c.leituras - 1);
end $$;

-- ───────── Servidor (`jogo`): aplicar gargalo e desvio ─────────
create or replace function public.aplicar_gargalo(
  p_personagem uuid, p_dados int[], p_mods jsonb, p_total int, p_resultado text, p_desvio_dados int[], p_desvio_face int)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  c public.personagens;
  rn public.reinos;
  ra public.reinos;
  avanca boolean := p_resultado = 'avanco' or (p_resultado = 'desvio' and p_desvio_face = 6);
  prox int;
begin
  select * into c from public.personagens where id = p_personagem for update;
  if not c.gargalo_liberado then raise exception 'gargalo_fechado'; end if;
  if c.gargalo_bloqueado_ate is not null and c.gargalo_bloqueado_ate > now() then raise exception 'gargalo_bloqueado'; end if;
  select * into ra from public.reinos where chave = c.reino;
  select * into rn from public.reinos where ordem = ra.ordem + 1;

  insert into public.rolagens (personagem, dono, tipo, dados, modificadores, total, resultado)
  values (c.id, c.dono, 'gargalo', p_dados, p_mods, p_total, p_resultado);
  if p_resultado = 'desvio' then
    insert into public.rolagens (personagem, dono, tipo, dados, modificadores, total, resultado)
    values (c.id, c.dono, 'desvio', p_desvio_dados, '{}'::jsonb, p_desvio_face, 'face_' || p_desvio_face);
  end if;

  c.primeiro_gargalo_feito := true;
  if p_resultado = 'falha' then
    c.gargalo_bloqueado_ate := now() + interval '7 days';
    insert into public.diario (personagem, tipo, texto) values (c.id, 'gargalo', format('Gargalo: %s no 3d6 (total %s). Falhou sem dano; nova tentativa em 1 semana.', array_to_string(p_dados, '+'), p_total));
  elsif p_resultado = 'desvio' and p_desvio_face <> 6 then
    c.gargalo_liberado := false;
    case p_desvio_face
      when 1 then c.ferimentos := c.ferimentos || jsonb_build_array(jsonb_build_object('tipo','dantian_rachado','texto','−30% de Qi até médico de Pico','desde',now()));
      when 2 then c.ferimentos := c.ferimentos || jsonb_build_array(jsonb_build_object('tipo','membro','texto','Membro inutilizado','ate',now() + interval '14 days'));
      when 3 then c.corrupcao := least(100, c.corrupcao + 20);
      when 4 then c.ferimentos := c.ferimentos || jsonb_build_array(jsonb_build_object('tipo','interno','texto','Ferimento Interno grave','ate',now() + interval '7 days'));
      when 5 then c.pe := greatest(0, c.pe - 1000);
    end case;
    insert into public.diario (personagem, tipo, texto) values (c.id, 'desvio', format('DESVIO DE QI (face %s) no gargalo.', p_desvio_face));
  end if;

  if avanca then
    if p_resultado = 'desvio' then c.corrupcao := least(100, c.corrupcao + 10); end if;
    c.qi_max := round(rn.qi_ao_entrar::numeric * c.qi_max / ra.qi_ao_entrar);
    c.reino := rn.chave;
    c.estagio := 'inicial';
    c.pa := c.pa + rn.pa_por_estagio;
    c.pe := c.pe + 500;
    c.leituras := c.leituras + 1;
    c.gargalo_liberado := false;
    c.gargalo_mods := '{}'::jsonb;
    c.gargalo_bloqueado_ate := null;
    select min(g) into prox from generate_series(1,12) g where not (g = any(c.meridianos));
    if prox is not null then c.meridianos := array_append(c.meridianos, prox); end if;
    insert into public.leituras_concedidas (personagem, quantidade, motivo) values (c.id, 1, 'Avanço de reino');
    insert into public.mural (tipo, titulo, corpo, personagem)
      values ('promocao', format('%s rompeu o gargalo: agora é %s', coalesce(c.alcunha, c.nome), rn.nome), format('3d6 = %s (total %s).', array_to_string(p_dados, ' + '), p_total), c.id);
    insert into public.conquistas (personagem, chave) values (c.id, 'primeiro_avanco') on conflict do nothing;
    insert into public.diario (personagem, tipo, texto) values (c.id, 'avanco', format('Rompeu o gargalo e entrou em %s. +500 PE, +1 Leitura do Destino.', rn.nome));
  end if;

  update public.personagens set reino = c.reino, estagio = c.estagio, pa = c.pa, pe = c.pe, qi_max = c.qi_max, leituras = c.leituras,
    corrupcao = c.corrupcao, ferimentos = c.ferimentos, meridianos = c.meridianos, gargalo_liberado = c.gargalo_liberado,
    gargalo_mods = c.gargalo_mods, gargalo_bloqueado_ate = c.gargalo_bloqueado_ate, primeiro_gargalo_feito = c.primeiro_gargalo_feito
  where id = c.id;
  return jsonb_build_object('avancou', avanca, 'reino', c.reino);
end $$;

-- ───────── Servidor (`jogo`): aprovar ficha com valores calculados ─────────
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
end $$;

-- ───────── Admin: fechar a semana (salários, custo de vida, maldição) ─────────
create or replace function public.fechar_semana()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare n int := 0;
begin
  if not public.is_admin() then raise exception 'Somente administradores.'; end if;
  perform set_config('app.motivo', 'Fechamento semanal', true);
  -- discípulos +30; Guarda do Dragão Negro +50; sem abrigo −10 (sem dinheiro: Cansado)
  update public.personagens set taeis = taeis
      + case when origem = 'discipulo' then 30 else 0 end
      + case when seita = 'dragao_negro' then 50 else 0 end
      - case when origem in ('andarilho','medico') or seita = 'andarilhos' then 10 else 0 end,
    ferimentos = case when (origem in ('andarilho','medico') or seita = 'andarilhos') and taeis < 10
      then ferimentos || '[{"tipo":"cansado","texto":"Cansado (−10%): não pagou o custo de vida"}]'::jsonb else ferimentos end,
    corrupcao = least(100, corrupcao + case when ficha->'talentos'->'desvantagens' ? 'maldicao_sangue' then 1 else 0 end)
  where status = 'aprovada' and vivo and excluido_em is null;
  get diagnostics n = row_count;
  update public.personagens set taeis = least(taeis, 500) where seita = 'sandalias_palha' and taeis > 500;
  update public.personagens set taeis = greatest(taeis, 0) where taeis < 0;
  return jsonb_build_object('personagens', n);
end $$;

-- ───────── Admin: estatísticas ─────────
create or replace function public.estatisticas()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Somente administradores.'; end if;
  return jsonb_build_object(
    'jogadores', (select count(*) from public.perfis),
    'ativos_7d', (select count(distinct dono) from public.envios where criado_em > now() - interval '7 days'),
    'personagens', (select jsonb_object_agg(status, n) from (select status, count(*) n from public.personagens where excluido_em is null group by status) s),
    'por_reino', (select jsonb_agg(jsonb_build_object('reino', r.nome, 'n', coalesce(x.n,0), 'pe_medio', coalesce(x.m,0)) order by r.ordem)
                  from public.reinos r left join (select reino, count(*) n, round(avg(pe)) m from public.personagens where status='aprovada' and vivo and excluido_em is null group by reino) x on x.reino = r.chave),
    'por_faccao', (select jsonb_object_agg(coalesce(faccao,'—'), n) from (select faccao, count(*) n from public.personagens where status='aprovada' and vivo and excluido_em is null group by faccao) f),
    'por_corpo', (select jsonb_object_agg(corpo, n) from (select corpo, count(*) n from public.personagens where excluido_em is null group by corpo) b),
    'leituras', (select jsonb_object_agg(raridade, n) from (select raridade, count(*) n from public.leituras where tipo='corpo' group by raridade) l),
    'pendentes', jsonb_build_object(
      'fichas', (select count(*) from public.personagens where status='aguardando' and excluido_em is null),
      'envios', (select count(*) from public.envios where status='pendente'))
  );
end $$;

-- ───────── Permissões de execução ─────────
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_admin(), public.esta_banido(), public.personagem_visivel(uuid), public.contar_linhas(text) to anon, authenticated;
grant execute on function
  public.criar_personagem(text), public.excluir_personagem(uuid), public.aprovar_quiz(jsonb),
  public.enviar_texto(uuid, text, text, text, text), public.distribuir_pa(uuid, jsonb), public.escolher_leitura(bigint, boolean),
  public.revisar_envio(bigint, boolean, int, int, text, jsonb), public.ajustar_personagem(uuid, jsonb, text),
  public.recusar_ficha(uuid, text), public.registrar_morte(uuid, text), public.banir_conta(uuid, boolean, text),
  public.conceder_conquista(uuid, text), public.fechar_semana(), public.estatisticas()
to authenticated;
-- aplicar_leitura, aplicar_gargalo e aprovar_ficha: só o servidor (service_role) executa.
grant execute on function public.aplicar_leitura(uuid, text, text, text, text, jsonb, int, boolean, int, int, text),
  public.aplicar_gargalo(uuid, int[], jsonb, int, text, int[], int), public.aprovar_ficha(uuid, jsonb, uuid) to service_role;
