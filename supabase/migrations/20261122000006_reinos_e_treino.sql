-- Novos reinos (Vida e Morte agora por PE; Natural; Harmonia Celeste; Imortal Marcial só por evento)
-- e treino com mínimo de 20 linhas.
update public.reinos set pe_inicial = 185000, pe_intermediario = 220000, pe_superior = 260000,
  pa_por_estagio = 1000, qi_ao_entrar = 20000, teto_atributo = 11000, pe_treino = 700, pe_missao_narrada = 1800
where chave = 'vida_morte';
insert into public.reinos values
  ('natural', 8, 'Reino Natural', 310000, 365000, 430000, 1200, 28000, 14000, 800, 2100),
  ('harmonia', 9, 'Harmonia Celeste', 510000, 600000, 700000, 1500, 40000, 18000, 900, 2500),
  ('imortal', 10, 'Imortal Marcial', null, null, null, 0, 60000, null, null, null)
on conflict (chave) do nothing;

-- enviar_texto: treino passa de 80 para 20 linhas
do $$
declare def text;
begin
  def := pg_get_functiondef('public.enviar_texto(uuid, text, text, text, text)'::regprocedure);
  def := replace(def, 'when ''treino'' then 80', 'when ''treino'' then 20');
  execute def;
end $$;
