-- Murim: Céu Partido — esquema base
-- Tabelas, funções auxiliares, gatilhos de guarda e log. RLS em todas as tabelas.
-- Valores de jogo só mudam por admin ou por funções do servidor.

create extension if not exists pgcrypto with schema extensions;

-- ───────────────────────── Configuração dos reinos ─────────────────────────
create table public.reinos (
  chave text primary key,
  ordem int not null unique,
  nome text not null,
  pe_inicial int,          -- PE acumulado para o estágio Inicial
  pe_intermediario int,
  pe_superior int,
  pa_por_estagio int not null,
  qi_ao_entrar int not null,
  teto_atributo int,
  pe_treino int,
  pe_missao_narrada int
);
insert into public.reinos values
 ('terceira','1','Terceira Classe',0,1000,2500,200,1000,1600,150,300),
 ('segunda','2','Segunda Classe',5000,7500,10500,300,2000,2400,200,450),
 ('primeira','3','Primeira Classe',15000,19500,25000,400,3500,3400,300,650),
 ('pico','4','Pico',33000,41000,50000,500,6000,4800,400,900),
 ('transcendente','5','Transcendente',62000,75000,90000,600,9000,6500,500,1200),
 ('profundo','6','Profundo',110000,130000,155000,800,13000,8500,600,1500),
 ('vida_morte','7','Vida e Morte',null,null,null,0,20000,null,null,null);

-- ───────────────────────── Perfis ─────────────────────────
create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome_exibicao text not null check (char_length(nome_exibicao) between 2 and 40),
  papel text not null default 'player' check (papel in ('player','admin')),
  banido boolean not null default false,
  quiz_aprovado boolean not null default false,
  ultima_exclusao_em timestamptz,
  criado_em timestamptz not null default now()
);

-- E-mails que viram admin no cadastro. Preenchida fora do repositório (ver README).
create table public.admin_emails (email text primary key);

-- ───────────────────────── Personagens ─────────────────────────
create table public.personagens (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null references public.perfis(id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 60),
  alcunha text check (alcunha is null or char_length(alcunha) <= 60),
  status text not null default 'rascunho' check (status in ('rascunho','aguardando','aprovada','recusada')),
  motivo_recusa text,
  ficha jsonb not null default '{}'::jsonb,
  -- estado de jogo (só admin/servidor altera)
  faccao text,
  seita text,
  origem text,
  linhagem text,
  linhagem_rara text,
  corpo text not null default 'corpo_mortal',
  raiz jsonb not null default '{"tipo":"comum","elementos":[]}'::jsonb,
  reino text not null default 'terceira' references public.reinos(chave),
  estagio text not null default 'inicial' check (estagio in ('inicial','intermediario','superior')),
  pe int not null default 0 check (pe >= 0),
  pa int not null default 0,
  qi_max int not null default 1000,
  taeis int not null default 100,
  corrupcao int not null default 0 check (corrupcao between 0 and 100),
  fama int not null default 0,
  infamia int not null default 0,
  ferimentos jsonb not null default '[]'::jsonb,
  meridianos int[] not null default '{}',
  inventario jsonb not null default '[]'::jsonb,
  afinidades jsonb not null default '{}'::jsonb,
  contribuicao int not null default 0,
  regiao text,
  leituras int not null default 0 check (leituras >= 0),
  leitura_liberada_em timestamptz,
  fios int not null default 0,
  sorte_usada boolean not null default false,
  gargalo_liberado boolean not null default false,
  gargalo_mods jsonb not null default '{}'::jsonb,
  gargalo_bloqueado_ate timestamptz,
  primeiro_gargalo_feito boolean not null default false,
  vivo boolean not null default true,
  morto_em timestamptz,
  causa_morte text,
  legado_de uuid references public.personagens(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  aprovado_em timestamptz,
  excluido_em timestamptz
);
create index on public.personagens (dono);
create index on public.personagens (status) where excluido_em is null;

-- ───────────────────────── Leitura do Destino ─────────────────────────
create table public.leituras (
  id bigint generated always as identity primary key,
  personagem uuid not null references public.personagens(id) on delete restrict,
  dono uuid not null references public.perfis(id) on delete restrict,
  tipo text not null check (tipo in ('corpo','raiz','linhagem')),
  raridade text not null,
  resultado text not null,
  detalhes jsonb not null default '{}'::jsonb,
  rolagem int not null,
  garantida boolean not null default false,
  precisa_escolha boolean not null default false,
  criado_em timestamptz not null default now()
);
create index on public.leituras (personagem);
create index on public.leituras (dono);

create table public.escolhas_leitura (
  leitura bigint primary key references public.leituras(id),
  manteve_novo boolean not null,
  decidido_em timestamptz not null default now()
);

create table public.leituras_concedidas (
  id bigint generated always as identity primary key,
  personagem uuid not null references public.personagens(id) on delete cascade,
  quantidade int not null,
  motivo text not null,
  concedido_por uuid references public.perfis(id),
  criado_em timestamptz not null default now()
);
create index on public.leituras_concedidas (personagem);

-- ───────────────────────── Rolagens oficiais ─────────────────────────
create table public.rolagens (
  id bigint generated always as identity primary key,
  personagem uuid not null references public.personagens(id) on delete restrict,
  dono uuid not null references public.perfis(id) on delete restrict,
  tipo text not null check (tipo in ('gargalo','desvio')),
  dados int[] not null,
  modificadores jsonb not null default '{}'::jsonb,
  total int not null,
  resultado text not null,
  criado_em timestamptz not null default now()
);
create index on public.rolagens (personagem);
create index on public.rolagens (dono);

-- ───────────────────────── Envios (treinos e missões) ─────────────────────────
create table public.envios (
  id bigint generated always as identity primary key,
  personagem uuid not null references public.personagens(id) on delete cascade,
  dono uuid not null references public.perfis(id) on delete cascade,
  tipo text not null check (tipo in ('treino','missao_facil','missao_media','missao_dificil','pedido_avanco')),
  titulo text not null check (char_length(titulo) between 2 and 120),
  foco text,
  texto text not null check (char_length(texto) <= 60000),
  linhas int not null,
  status text not null default 'pendente' check (status in ('pendente','aprovado','recusado')),
  pe_concedido int,
  taeis_concedidos int,
  nota_admin text,
  revisado_por uuid references public.perfis(id),
  revisado_em timestamptz,
  criado_em timestamptz not null default now()
);
create index on public.envios (personagem);
create index on public.envios (dono);
create index on public.envios (status);

-- ───────────────────────── Mural, conquistas, diário, listas, eventos ─────────────────────────
create table public.mural (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('aviso','promocao','lendario','mitico','morte','conquista','regra')),
  titulo text not null,
  corpo text,
  personagem uuid references public.personagens(id) on delete set null,
  criado_por uuid references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index on public.mural (criado_em desc);

create table public.conquistas (
  personagem uuid not null references public.personagens(id) on delete cascade,
  chave text not null,
  obtida_em timestamptz not null default now(),
  primary key (personagem, chave)
);

create table public.diario (
  id bigint generated always as identity primary key,
  personagem uuid not null references public.personagens(id) on delete cascade,
  tipo text not null,
  texto text not null,
  criado_em timestamptz not null default now()
);
create index on public.diario (personagem, criado_em desc);

create table public.listas (
  id bigint generated always as identity primary key,
  lista text not null check (lista in ('dragoes','procurados')),
  posicao int not null check (posicao between 1 and 50),
  nome text not null,
  personagem uuid references public.personagens(id) on delete set null,
  detalhe text,
  atualizado_em timestamptz not null default now(),
  unique (lista, posicao)
);

create table public.eventos (
  id bigint generated always as identity primary key,
  titulo text not null,
  descricao text,
  inicio timestamptz not null,
  tipo text not null default 'evento',
  criado_em timestamptz not null default now()
);

create table public.admin_log (
  id bigint generated always as identity primary key,
  admin uuid,
  acao text not null,
  tabela text not null,
  alvo text,
  antes jsonb,
  depois jsonb,
  motivo text,
  criado_em timestamptz not null default now()
);
create index on public.admin_log (criado_em desc);

-- ───────────────────────── Funções auxiliares ─────────────────────────
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.papel = 'admin' and not p.banido from public.perfis p where p.id = (select auth.uid())), false);
$$;

create or replace function public.esta_banido()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.banido from public.perfis p where p.id = (select auth.uid())), false);
$$;

-- Novo usuário → perfil (vira admin se o e-mail estiver em admin_emails)
create or replace function public.ao_criar_usuario()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_nome text := left(coalesce(nullif(btrim(new.raw_user_meta_data->>'nome_exibicao'),''), nullif(btrim(new.raw_user_meta_data->>'full_name'),''), split_part(new.email,'@',1)), 40);
begin
  if char_length(v_nome) < 2 then v_nome := 'Andarilho'; end if;
  insert into public.perfis (id, nome_exibicao, papel)
  values (new.id, v_nome,
    case when exists (select 1 from public.admin_emails a where lower(a.email) = lower(new.email)) then 'admin' else 'player' end);
  return new;
end $$;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.ao_criar_usuario();

-- Guarda: o dono só altera nome, alcunha e ficha, e apenas em rascunho/recusada.
create or replace function public.guarda_personagem()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    if old.status not in ('rascunho','recusada') then
      raise exception 'Ficha bloqueada: só a administração altera fichas enviadas ou aprovadas.';
    end if;
    if (to_jsonb(new) - array['nome','alcunha','ficha','atualizado_em'])
       is distinct from (to_jsonb(old) - array['nome','alcunha','ficha','atualizado_em']) then
      raise exception 'Valores de jogo só mudam pelo servidor ou pela administração.';
    end if;
  end if;
  new.atualizado_em := now();
  return new;
end $$;
create trigger guarda_personagem before update on public.personagens
  for each row execute function public.guarda_personagem();

-- Guarda de perfis: o jogador só muda o próprio nome de exibição.
create or replace function public.guarda_perfil()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    if (to_jsonb(new) - 'nome_exibicao') is distinct from (to_jsonb(old) - 'nome_exibicao') then
      raise exception 'Só o nome de exibição pode ser alterado.';
    end if;
  end if;
  return new;
end $$;
create trigger guarda_perfil before update on public.perfis
  for each row execute function public.guarda_perfil();

-- Registros imutáveis: ninguém apaga nem refaz leituras e rolagens.
create or replace function public.bloquear_alteracao()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'Registro imutável: % não pode ser alterado nem apagado.', tg_table_name;
end $$;
create trigger leituras_imutaveis before update or delete on public.leituras
  for each row execute function public.bloquear_alteracao();
create trigger rolagens_imutaveis before update or delete on public.rolagens
  for each row execute function public.bloquear_alteracao();
create trigger escolhas_imutaveis before update or delete on public.escolhas_leitura
  for each row execute function public.bloquear_alteracao();
create trigger admin_log_imutavel before update or delete on public.admin_log
  for each row execute function public.bloquear_alteracao();

-- Log de tudo o que um admin altera.
create or replace function public.registrar_admin()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and public.is_admin() then
    insert into public.admin_log (admin, acao, tabela, alvo, antes, depois, motivo)
    values ((select auth.uid()), tg_op, tg_table_name,
      coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id',
               (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'personagem'),
      case when tg_op = 'INSERT' then null else to_jsonb(old) end,
      case when tg_op = 'DELETE' then null else to_jsonb(new) end,
      nullif(current_setting('app.motivo', true), ''));
  end if;
  return coalesce(new, old);
end $$;
create trigger log_personagens after insert or update or delete on public.personagens for each row execute function public.registrar_admin();
create trigger log_perfis after update or delete on public.perfis for each row execute function public.registrar_admin();
create trigger log_envios after update or delete on public.envios for each row execute function public.registrar_admin();
create trigger log_mural after insert or update or delete on public.mural for each row execute function public.registrar_admin();
create trigger log_listas after insert or update or delete on public.listas for each row execute function public.registrar_admin();
create trigger log_eventos after insert or update or delete on public.eventos for each row execute function public.registrar_admin();
create trigger log_conquistas after insert or delete on public.conquistas for each row execute function public.registrar_admin();
create trigger log_concedidas after insert on public.leituras_concedidas for each row execute function public.registrar_admin();

-- ───────────────────────── RLS ─────────────────────────
alter table public.reinos enable row level security;
alter table public.perfis enable row level security;
alter table public.admin_emails enable row level security;
alter table public.personagens enable row level security;
alter table public.leituras enable row level security;
alter table public.escolhas_leitura enable row level security;
alter table public.leituras_concedidas enable row level security;
alter table public.rolagens enable row level security;
alter table public.envios enable row level security;
alter table public.mural enable row level security;
alter table public.conquistas enable row level security;
alter table public.diario enable row level security;
alter table public.listas enable row level security;
alter table public.eventos enable row level security;
alter table public.admin_log enable row level security;

-- Personagem visível publicamente quando aprovado (perfil público).
create or replace function public.personagem_visivel(p uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.personagens c where c.id = p and (
    (c.status = 'aprovada' and c.excluido_em is null) or c.dono = (select auth.uid()) or public.is_admin()));
$$;

create policy "reinos: leitura pública" on public.reinos for select to anon, authenticated using (true);

create policy "perfis: cada um vê o seu, admin vê todos" on public.perfis for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "perfis: atualizar o próprio" on public.perfis for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

create policy "personagens: aprovados são públicos" on public.personagens for select to anon, authenticated
  using ((status = 'aprovada' and excluido_em is null) or dono = (select auth.uid()) or (select public.is_admin()));
create policy "personagens: dono edita rascunho, admin edita tudo" on public.personagens for update to authenticated
  using ((dono = (select auth.uid()) and excluido_em is null and not (select public.esta_banido())) or (select public.is_admin()))
  with check ((dono = (select auth.uid()) and excluido_em is null) or (select public.is_admin()));

create policy "leituras: dono e admin" on public.leituras for select to authenticated
  using (dono = (select auth.uid()) or (select public.is_admin()));
create policy "escolhas: dono e admin" on public.escolhas_leitura for select to authenticated
  using (exists (select 1 from public.leituras l where l.id = leitura and (l.dono = (select auth.uid()) or (select public.is_admin()))));
create policy "concedidas: dono e admin" on public.leituras_concedidas for select to authenticated
  using ((select public.is_admin()) or exists (select 1 from public.personagens c where c.id = personagem and c.dono = (select auth.uid())));

create policy "rolagens: públicas" on public.rolagens for select to anon, authenticated using (true);

create policy "envios: dono e admin" on public.envios for select to authenticated
  using (dono = (select auth.uid()) or (select public.is_admin()));

create policy "mural: público" on public.mural for select to anon, authenticated using (true);
create policy "mural: admin escreve" on public.mural for insert to authenticated with check ((select public.is_admin()));
create policy "mural: admin edita" on public.mural for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "mural: admin apaga" on public.mural for delete to authenticated using ((select public.is_admin()));

create policy "conquistas: públicas se o personagem é visível" on public.conquistas for select to anon, authenticated
  using ((select public.personagem_visivel(personagem)));
create policy "diario: público se o personagem é visível" on public.diario for select to anon, authenticated
  using ((select public.personagem_visivel(personagem)));

create policy "listas: públicas" on public.listas for select to anon, authenticated using (true);
create policy "listas: admin escreve" on public.listas for insert to authenticated with check ((select public.is_admin()));
create policy "listas: admin edita" on public.listas for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "listas: admin apaga" on public.listas for delete to authenticated using ((select public.is_admin()));

create policy "eventos: públicos" on public.eventos for select to anon, authenticated using (true);
create policy "eventos: admin escreve" on public.eventos for insert to authenticated with check ((select public.is_admin()));
create policy "eventos: admin edita" on public.eventos for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "eventos: admin apaga" on public.eventos for delete to authenticated using ((select public.is_admin()));

create policy "admin_log: só admin" on public.admin_log for select to authenticated using ((select public.is_admin()));
-- admin_emails: sem políticas (somente o servidor lê).

-- Grants explícitos (o projeto não expõe tabelas novas automaticamente).
grant usage on schema public to anon, authenticated;
grant select on public.reinos, public.personagens, public.rolagens, public.mural, public.conquistas, public.diario, public.listas, public.eventos to anon;
grant select on all tables in schema public to authenticated;
revoke select on public.admin_emails from authenticated;
grant update (nome, alcunha, ficha) on public.personagens to authenticated;
grant update (nome_exibicao) on public.perfis to authenticated;
grant insert, update, delete on public.mural, public.listas, public.eventos to authenticated;
grant update on public.personagens, public.perfis to authenticated; -- RLS + gatilhos de guarda limitam o que muda
