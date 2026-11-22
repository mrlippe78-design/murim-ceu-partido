// RLS e funções do servidor, testados direto na API com uma conta de jogador comum.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const URL = 'https://pzlfgbygekasqhzlfnko.supabase.co';
const CHAVE = 'sb_publishable_AsUkaYJOqAilZVU-Agrggw_CBDcBl_7';
test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'roda uma vez'));

test('jogador comum não burla as regras', async () => {
  const sb = createClient(URL, CHAVE, { auth: { persistSession: false } });
  const sufixo = Date.now().toString(36);
  const { data: cad, error: e0 } = await sb.auth.signUp({ email: `seguranca.${sufixo}@teste.murim.dev`, password: `Seg-${sufixo}-123!`, options: { data: { nome_exibicao: 'Teste Segurança' } } });
  expect(e0).toBeNull();
  const uid = cad.user!.id;

  // sem quiz, não cria personagem
  const semQuiz = await sb.rpc('criar_personagem', { p_nome: 'Trapaceiro' });
  expect(semQuiz.error?.message).toMatch(/tutorial/);
  await sb.rpc('aprovar_quiz', { p_respostas: { q1: 'b', q2: 'c', q3: 'a', q4: 'c', q5: 'b', q6: 'a' } });
  const { data: id } = await sb.rpc('criar_personagem', { p_nome: 'Trapaceiro' });

  // não muda PE, taéis, corpo nem status por fora
  for (const campo of [{ pe: 99999 }, { taeis: 100000 }, { corpo: 'corpo_celestial' }, { status: 'aprovada' }, { leituras: 50 }]) {
    const r = await sb.from('personagens').update(campo).eq('id', id);
    expect(r.error, JSON.stringify(campo)).not.toBeNull();
  }
  // não vira admin
  const papel = await sb.from('perfis').update({ papel: 'admin' }).eq('id', uid);
  expect(papel.error).not.toBeNull();
  // não grava Leitura nem rolagem direto, e não chama as funções exclusivas do servidor
  expect((await sb.from('leituras').insert({ personagem: id, dono: uid, tipo: 'corpo', raridade: 'mitico', resultado: 'corpo_celestial', rolagem: 1 })).error).not.toBeNull();
  expect((await sb.from('rolagens').insert({ personagem: id, dono: uid, tipo: 'gargalo', dados: [6, 6, 6], total: 18, resultado: 'avanco' })).error).not.toBeNull();
  expect((await sb.rpc('aplicar_leitura', { p_personagem: id, p_tipo: 'corpo', p_raridade: 'mitico', p_resultado: 'corpo_celestial', p_nome: 'x', p_detalhes: {}, p_rolagem: 1, p_garantida: false, p_fios_antes: 0, p_fios_depois: 0, p_concessao: null })).error).not.toBeNull();
  expect((await sb.rpc('ajustar_personagem', { p_id: id, p_mudancas: { pe: 5000 }, p_motivo: 'trapaça' })).error?.message).toMatch(/administradores/);
  // não lê o histórico de admin nem a lista de e-mails de admin
  expect((await sb.from('admin_log').select('*')).data ?? []).toHaveLength(0);
  expect((await sb.from('admin_emails').select('*')).error).not.toBeNull();
  // não envia treino com personagem não aprovado
  expect((await sb.rpc('enviar_texto', { p_personagem: id, p_tipo: 'treino', p_titulo: 'x', p_foco: 'x', p_texto: 'a\n'.repeat(90) })).error?.message).toMatch(/aprovados/);
  // a Leitura via servidor funciona uma vez; a segunda é recusada
  const ok = await sb.functions.invoke('jogo', { body: { acao: 'leitura', personagem: id, tipo: 'raiz' } });
  expect(ok.error).toBeNull();
  const nao = await sb.functions.invoke('jogo', { body: { acao: 'leitura', personagem: id, tipo: 'raiz' } });
  expect(nao.error).not.toBeNull();
  // a Leitura registrada não pode ser apagada nem alterada
  const { data: lei } = await sb.from('leituras').select('id').eq('personagem', id);
  expect(lei).toHaveLength(1);
  await sb.from('leituras').delete().eq('id', lei![0].id);
  expect((await sb.from('leituras').select('id').eq('personagem', id)).data).toHaveLength(1);
  // simulação de 100 mil é só para admin
  expect((await sb.functions.invoke('jogo', { body: { acao: 'simular', n: 100000 } })).error).not.toBeNull();
});
