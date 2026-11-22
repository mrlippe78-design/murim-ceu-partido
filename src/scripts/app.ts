// Cliente do site: sessão, chamadas ao servidor e utilitários de interface.
import { createClient, FunctionsHttpError, type Session } from '@supabase/supabase-js';
import { DADOS, reino as infoReino, seita as infoSeita, faccao as infoFaccao, corpo as infoCorpo, linhagem as infoLinhagem, origem as infoOrigem } from '../../supabase/functions/_shared/regras';
export { toast, copiar } from './global';

export const supabase = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.PUBLIC_SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const BASE = (document.body.dataset.base ?? '/').replace(/\/?$/, '/');
export const link = (p: string) => BASE + p.replace(/^\//, '');

export interface Perfil { id: string; nome_exibicao: string; papel: 'player' | 'admin'; banido: boolean; quiz_aprovado: boolean; ultima_exclusao_em: string | null }

export async function sessao(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function perfilAtual(): Promise<Perfil | null> {
  const s = await sessao();
  if (!s) return null;
  const { data } = await supabase.from('perfis').select('*').eq('id', s.user.id).single();
  return data as Perfil | null;
}

/** Redireciona para /conta/ se não houver sessão. */
export async function exigirLogin(): Promise<Perfil> {
  const p = await perfilAtual();
  if (!p) {
    location.href = link(`/conta/?voltar=${encodeURIComponent(location.pathname + location.search)}`);
    throw new Error('sem sessão');
  }
  return p;
}

/** Chama a Edge Function `jogo` e devolve o JSON ou lança Error com a mensagem do servidor. */
export async function jogo<T = Record<string, unknown>>(acao: string, corpo: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('jogo', { body: { acao, ...corpo } });
  if (error) {
    let msg = 'Falha ao falar com o servidor.';
    if (error instanceof FunctionsHttpError) {
      try { msg = (await error.context.json()).erro ?? msg; } catch { /* mantém */ }
    }
    throw new Error(msg);
  }
  return data as T;
}

/** Converte erro do Postgres/RPC numa frase legível. */
export function mensagemErro(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  return m.replace(/^.*?ERROR:\s*/, '').replace(/\(SQLSTATE.*$/, '');
}

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const num = (n: number | null | undefined) => (n ?? 0).toLocaleString('pt-BR');
export const data = (d: string) => new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
export const $ = <T extends HTMLElement = HTMLElement>(sel: string, raiz: ParentNode = document) => raiz.querySelector<T>(sel)!;
export const $$ = <T extends HTMLElement = HTMLElement>(sel: string, raiz: ParentNode = document) => [...raiz.querySelectorAll<T>(sel)];

export const nomes = {
  reino: (k: string) => infoReino(k)?.nome ?? k,
  estagio: (k: string) => DADOS.estagios.find((e) => e.chave === k)?.nome ?? k,
  seita: (k?: string | null) => infoSeita(k)?.nome ?? '—',
  faccao: (k?: string | null) => infoFaccao(k)?.nome ?? '—',
  corpo: (k: string) => infoCorpo(k)?.nome ?? k,
  raridadeCorpo: (k: string) => infoCorpo(k)?.raridade ?? 'comum',
  linhagem: (k?: string | null) => infoLinhagem(k)?.nome ?? '—',
  origem: (k?: string | null) => infoOrigem(k)?.nome ?? '—',
  raiz: (r: { tipo: string; elementos: string[] }) => {
    const base = (DADOS.raizes as Record<string, { nome: string }>)[r?.tipo ?? 'comum']?.nome ?? 'Raiz Comum';
    const el = (r?.elementos ?? []).map((e) => (DADOS.elementos as Record<string, string>)[e]).join(' e ');
    return el ? `${base} (${el})` : base;
  },
  status: (s: string) => ({ rascunho: 'Rascunho', aguardando: 'Aguardando aprovação', aprovada: 'Aprovada', recusada: 'Recusada' }[s] ?? s),
};

export const ROTULO_RARIDADE: Record<string, string> = { comum: 'Comum', raro: 'Raro', epico: 'Épico', lendario: 'Lendário', mitico: 'Mítico', dupla: 'Dupla', pura: 'Pura', variante: 'Variante', rara: 'Rara' };

/** Debounce simples para o salvamento automático. */
export function adiar<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout>;
  return (...a: A) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function param(nome: string) {
  return new URLSearchParams(location.search).get(nome);
}
