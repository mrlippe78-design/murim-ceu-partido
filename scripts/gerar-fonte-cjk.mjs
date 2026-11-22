// Gera uma versão mínima da Zen Antique só com os ideogramas usados no site.
// Isso troca ~120 arquivos de fonte (e um CSS enorme) por um único arquivo de poucos KB.
// Rode de novo (npm run fonte) se acrescentar ideogramas novos em qualquer texto.
import subsetFont from 'subset-font';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const pastas = ['src', 'supabase/functions/_shared', 'public/manifest.webmanifest'];
const arquivos = (p) => statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => arquivos(join(p, f))) : [p];
const texto = pastas.flatMap(arquivos).filter((f) => /\.(astro|md|json|ts|mjs|webmanifest)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('');
const cjk = [...new Set(texto.match(/[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/gu) ?? [])].join('');
const origem = readFileSync('node_modules/@fontsource/zen-antique/files/zen-antique-japanese-400-normal.woff2');
const saida = await subsetFont(origem, cjk, { targetFormat: 'woff2' });
writeFileSync('public/fontes/zen-antique-cjk.woff2', saida);
console.log(`${cjk.length} ideogramas · ${(saida.length / 1024).toFixed(1)} KB`);
