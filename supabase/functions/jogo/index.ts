// Edge Function `jogo` — tudo que exige sorte ou autoridade passa por aqui.
// Ações: leitura | gargalo | enviar_ficha | aprovar_ficha | simular
// A aleatoriedade usa crypto.getRandomValues (amostragem por rejeição, sem viés).
import { createClient } from 'npm:@supabase/supabase-js@2.119.2';
import { sortear, simular, validarConfig, rngCripto, type TipoLeitura } from '../_shared/destino.ts';
import {
  validarFicha, valoresIniciais, modificadoresGargalo, interpretarGargalo, piorDesvio, corpo as corpoInfo, type Ficha,
} from '../_shared/regras.ts';
import dados from '../_shared/dados.json' with { type: 'json' };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
class Erro extends Error { constructor(msg: string, public status = 400) { super(msg); } }

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MITICOS = dados.corpos.filter((c) => c.raridade === 'mitico').map((c) => c.chave);

async function usuario(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Erro('Entre na sua conta.', 401);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Erro('Sessão inválida. Entre de novo.', 401);
  const { data: perfil } = await admin.from('perfis').select('*').eq('id', data.user.id).single();
  if (!perfil) throw new Erro('Perfil não encontrado.', 403);
  if (perfil.banido) throw new Erro('Conta suspensa.', 403);
  return { id: data.user.id as string, admin: perfil.papel === 'admin' };
}

async function meuPersonagem(uid: string, id: string) {
  const { data: c } = await admin.from('personagens').select('*').eq('id', id).single();
  if (!c || c.dono !== uid || c.excluido_em) throw new Erro('Personagem não encontrado.', 404);
  if (!c.vivo) throw new Erro('Este personagem está morto.');
  return c;
}

async function miticosOcupados(): Promise<string[]> {
  const { data: vivos } = await admin.from('personagens').select('corpo').in('corpo', MITICOS).eq('vivo', true).is('excluido_em', null);
  const { data: pend } = await admin.from('leituras').select('id, resultado, personagem, escolhas_leitura(leitura)')
    .in('resultado', MITICOS).eq('precisa_escolha', true);
  const ocupados = new Set<string>((vivos ?? []).map((v) => v.corpo));
  for (const p of pend ?? []) if (!(p as { escolhas_leitura: unknown[] }).escolhas_leitura?.length) ocupados.add(p.resultado);
  return [...ocupados];
}

// ───────── Leitura do Destino ─────────
async function leitura(uid: string, body: { personagem: string; tipo: TipoLeitura }) {
  if (!['corpo', 'raiz', 'linhagem'].includes(body.tipo)) throw new Erro('Escolha Corpo Marcial, Raiz de Qi ou Linhagem rara.');
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const c = await meuPersonagem(uid, body.personagem);
    let concessao: string | null = null;
    if (c.leituras === 0) {
      if (c.leitura_liberada_em && new Date(c.leitura_liberada_em) <= new Date()) concessao = 'liberada';
      else if (!c.sorte_usada && c.ficha?.talentos?.vantagens?.includes('sorte_do_ceu')) concessao = 'sorte';
      else if (c.leitura_liberada_em) throw new Erro(`Sua Leitura de criação só é liberada em ${new Date(c.leitura_liberada_em).toLocaleDateString('pt-BR')} (regra anti-reroll).`);
      else throw new Erro('Este personagem não tem Leituras do Destino disponíveis.');
    }
    const faccao = c.faccao ?? c.ficha?.faccao ?? null;
    const r = sortear(body.tipo, { fios: c.fios, miticosOcupados: await miticosOcupados(), faccao }, rngCripto);
    const { data, error } = await admin.rpc('aplicar_leitura', {
      p_personagem: c.id, p_tipo: r.tipo, p_raridade: r.raridade, p_resultado: r.resultado, p_nome: r.nome,
      p_detalhes: r.detalhes, p_rolagem: r.rolagem, p_garantida: r.garantida, p_fios_antes: c.fios, p_fios_depois: r.fiosDepois,
      p_concessao: concessao,
    });
    if (error) {
      if (/conflito|mitico_ocupado/.test(error.message)) continue; // estado mudou: sorteia de novo com dados frescos
      if (/sem_leituras/.test(error.message)) throw new Erro('Este personagem não tem Leituras do Destino disponíveis.');
      throw new Erro('Não foi possível registrar a Leitura.');
    }
    const info = r.tipo === 'corpo' ? corpoInfo(r.resultado) : null;
    return { ...r, ...data, info, fiosParaGarantia: 40 };
  }
  throw new Erro('O destino está turbulento (muitas leituras ao mesmo tempo). Tente de novo.', 409);
}

// ───────── Gargalo (3d6) e Desvio de Qi (1d6) ─────────
async function gargalo(uid: string, body: { personagem: string }) {
  const c = await meuPersonagem(uid, body.personagem);
  if (c.status !== 'aprovada') throw new Erro('A ficha precisa estar aprovada.');
  if (!c.gargalo_liberado) throw new Erro('O gargalo ainda não está aberto: envie o pedido de avanço (40+ linhas) e aguarde a aprovação.');
  if (c.gargalo_bloqueado_ate && new Date(c.gargalo_bloqueado_ate) > new Date())
    throw new Erro(`Nova tentativa liberada em ${new Date(c.gargalo_bloqueado_ate).toLocaleDateString('pt-BR')}.`);
  const idx = dados.reinos.findIndex((r) => r.chave === c.reino);
  const prox = dados.reinos[idx + 1];
  if (!prox?.pe) throw new Erro('O próximo reino só é alcançado por evento.');
  if (c.estagio !== 'superior' || c.pe < prox.pe[0]) throw new Erro(`É preciso estar no estágio Superior e ter ${prox.pe[0]} PE.`);
  if (prox.chave === 'transcendente' && (c.meridianos ?? []).filter((m: number) => m >= 13).length < 8)
    throw new Erro('O Transcendente exige os 8 meridianos extraordinários abertos.');

  const internos = (c.ferimentos ?? []).filter((f: { tipo: string }) => f.tipo === 'interno').length;
  const mods = modificadoresGargalo({
    corpo: c.corpo, talentos: [...(c.ficha?.talentos?.vantagens ?? []), ...(c.ficha?.talentos?.desvantagens ?? [])],
    corrupcao: c.corrupcao, ferimentosInternos: internos, primeiroGargalo: !c.primeiro_gargalo_feito, mods: c.gargalo_mods ?? {},
  });
  const d = [rngCripto(6) + 1, rngCripto(6) + 1, rngCripto(6) + 1];
  const total = d[0] + d[1] + d[2] + mods.total;
  const resultado = interpretarGargalo(total);
  let desvioDados: number[] = [];
  let face = 0;
  if (resultado === 'desvio') {
    const duplo = (corpoInfo(c.corpo)?.efeito as { desvioDuplo?: boolean })?.desvioDuplo;
    desvioDados = duplo ? [rngCripto(6) + 1, rngCripto(6) + 1] : [rngCripto(6) + 1];
    face = piorDesvio(desvioDados);
  }
  const { data, error } = await admin.rpc('aplicar_gargalo', {
    p_personagem: c.id, p_dados: d, p_mods: { lista: mods.lista, total: mods.total }, p_total: total,
    p_resultado: resultado, p_desvio_dados: desvioDados, p_desvio_face: face,
  });
  if (error) throw new Erro('Não foi possível registrar a rolagem.');
  return { dados: d, modificadores: mods, total, resultado, desvio: face ? { dados: desvioDados, face, ...dados.gargalo.desvio[face - 1] } : null, ...data };
}

// ───────── Fichas ─────────
async function enviarFicha(uid: string, body: { personagem: string }) {
  const c = await meuPersonagem(uid, body.personagem);
  if (!['rascunho', 'recusada'].includes(c.status)) throw new Erro('Esta ficha já foi enviada.');
  const { data: outros } = await admin.from('personagens').select('id, faccao, ficha').eq('dono', uid).is('excluido_em', null).eq('vivo', true).neq('id', c.id);
  const outrasFaccoes = (outros ?? []).map((o) => o.faccao ?? o.ficha?.faccao).filter(Boolean);
  const v = validarFicha(c.ficha as Ficha, { corpo: c.corpo, linhagemRara: c.linhagem_rara, sorteUsada: c.sorte_usada, outrasFaccoes });
  if (v.erros.length) return { ok: false, erros: v.erros, avisos: v.avisos };
  const { data: pend } = await admin.from('leituras').select('id, escolhas_leitura(leitura)').eq('personagem', c.id).eq('precisa_escolha', true);
  if ((pend ?? []).some((p) => !(p as { escolhas_leitura: unknown[] }).escolhas_leitura?.length))
    return { ok: false, erros: ['Decida qual resultado da Leitura do Destino manter antes de enviar.'], avisos: [] };
  await admin.from('personagens').update({ status: 'aguardando', motivo_recusa: null }).eq('id', c.id);
  await admin.from('diario').insert({ personagem: c.id, tipo: 'envio', texto: 'Ficha enviada para aprovação.' });
  return { ok: true, avisos: v.avisos };
}

async function aprovarFicha(uid: string, body: { personagem: string; regiao?: string }) {
  const { data: c } = await admin.from('personagens').select('*').eq('id', body.personagem).single();
  if (!c || c.status !== 'aguardando') throw new Erro('A ficha não está aguardando aprovação.');
  const { data: outros } = await admin.from('personagens').select('id, faccao').eq('dono', c.dono).is('excluido_em', null).eq('vivo', true).neq('id', c.id).eq('status', 'aprovada');
  const v = validarFicha(c.ficha as Ficha, { corpo: c.corpo, linhagemRara: c.linhagem_rara, sorteUsada: c.sorte_usada, outrasFaccoes: (outros ?? []).map((o) => o.faccao) });
  if (v.erros.length) return { ok: false, erros: v.erros };
  const valores = { ...valoresIniciais(c.ficha as Ficha, c.corpo, c.linhagem_rara), regiao: body.regiao ?? null };
  const { error } = await admin.rpc('aprovar_ficha', { p_id: c.id, p_valores: valores, p_admin: uid });
  if (error) throw new Erro(error.message);
  return { ok: true, valores };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const u = await usuario(req);
    switch (body.acao) {
      case 'leitura': return json(await leitura(u.id, body));
      case 'gargalo': return json(await gargalo(u.id, body));
      case 'enviar_ficha': return json(await enviarFicha(u.id, body));
      case 'aprovar_ficha':
        if (!u.admin) throw new Erro('Somente administradores.', 403);
        return json(await aprovarFicha(u.id, body));
      case 'simular': {
        if (!u.admin) throw new Erro('Somente administradores.', 403);
        const n = Math.min(Math.max(Number(body.n) || 100000, 1000), 200000);
        const tipo = (['corpo', 'raiz', 'linhagem'].includes(body.tipo) ? body.tipo : 'corpo') as TipoLeitura;
        const inicio = Date.now();
        return json({ tipo, n, config: validarConfig(), resultado: simular(tipo, n, rngCripto), ms: Date.now() - inicio });
      }
      default: throw new Erro('Ação desconhecida.');
    }
  } catch (e) {
    const err = e as Erro;
    return json({ erro: err.message ?? 'Erro inesperado.' }, err.status ?? 500);
  }
});
