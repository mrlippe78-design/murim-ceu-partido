import imagens from '../data/imagens.json';

/** Prefixa um caminho interno com o `base` do site (GitHub Pages serve em /murim-ceu-partido/). */
export function url(caminho: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (/^(https?:)?\/\//.test(caminho) || caminho.startsWith('#') || caminho.startsWith('mailto:')) return caminho;
  return base + (caminho.startsWith('/') ? caminho : '/' + caminho);
}

type Espaco = { arquivo: string; alt: string };
/** Lê um espaço de imagem de src/data/imagens.json. Devolve versão celular (-m) quando existir. */
export function imagem(espaco: string): Espaco & { src: string; srcMovel: string } {
  const e = (imagens as unknown as Record<string, Espaco>)[espaco] ?? (imagens as unknown as Record<string, Espaco>).hero;
  const src = url(e.arquivo);
  const srcMovel = /\.webp$/.test(e.arquivo) ? url(e.arquivo.replace(/\.webp$/, '-m.webp')) : src;
  return { ...e, src, srcMovel };
}
