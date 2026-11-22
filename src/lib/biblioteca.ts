import { getCollection, type CollectionEntry } from 'astro:content';
import { secoes } from '../data/navegacao';

export type Pagina = CollectionEntry<'biblioteca'>;

/** Todas as páginas na ordem de leitura: seção (ordem do menu) e depois `ordem`. */
export async function paginasOrdenadas(): Promise<Pagina[]> {
  const todas = await getCollection('biblioteca');
  const idx = (s: string) => secoes.findIndex((x) => x.chave === s);
  return todas.sort((a, b) => idx(a.data.secao) - idx(b.data.secao) || a.data.ordem - b.data.ordem || a.data.titulo.localeCompare(b.data.titulo));
}

export async function arvore() {
  const ps = await paginasOrdenadas();
  return secoes.map((s) => ({ ...s, paginas: ps.filter((p) => p.data.secao === s.chave) }));
}

export const hrefPagina = (p: Pagina) => `/biblioteca/${p.id}/`;
