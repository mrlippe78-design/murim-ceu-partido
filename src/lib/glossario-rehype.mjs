// Plugin rehype: marca a primeira ocorrência de cada termo do glossário em cada página
// com <span class="termo" data-termo="..."> para mostrar a explicação ao tocar.
// Não mexe em títulos, links, código nem em tabelas de dados.
import { readFileSync } from 'node:fs';

const glossario = JSON.parse(readFileSync(new URL('../data/glossario.json', import.meta.url), 'utf8'));
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const formas = glossario.flatMap((g) => g.formas.map((f) => ({ forma: f, termo: g.termo })))
  .sort((a, b) => b.forma.length - a.forma.length);
const re = new RegExp(`(?<![\\p{L}])(${formas.map((f) => escapar(f.forma)).join('|')})(?![\\p{L}])`, 'u');
const IGNORAR = new Set(['h1', 'h2', 'h3', 'h4', 'a', 'code', 'pre', 'span', 'strong', 'th']);

export function glossarioRehype() {
  return (arvore) => {
    const usados = new Set();
    const visitar = (no, dentroIgnorado) => {
      if (!no.children) return;
      const novos = [];
      for (const filho of no.children) {
        if (filho.type === 'element') {
          visitar(filho, dentroIgnorado || IGNORAR.has(filho.tagName));
          novos.push(filho);
          continue;
        }
        if (filho.type !== 'text' || dentroIgnorado) { novos.push(filho); continue; }
        let texto = filho.value;
        let m;
        while (texto && (m = texto.match(re))) {
          const termo = formas.find((f) => f.forma === m[1]).termo;
          if (usados.has(termo)) {
            // já marcado nesta página: segue procurando depois deste ponto
            const corte = m.index + m[1].length;
            novos.push({ type: 'text', value: texto.slice(0, corte) });
            texto = texto.slice(corte);
            continue;
          }
          usados.add(termo);
          if (m.index > 0) novos.push({ type: 'text', value: texto.slice(0, m.index) });
          novos.push({
            type: 'element', tagName: 'span',
            properties: { className: ['termo'], dataTermo: termo, tabIndex: 0, role: 'button', ariaLabel: `${m[1]}: ver explicação` },
            children: [{ type: 'text', value: m[1] }],
          });
          texto = texto.slice(m.index + m[1].length);
        }
        if (texto) novos.push({ type: 'text', value: texto });
      }
      no.children = novos;
    };
    visitar(arvore, false);
  };
}
