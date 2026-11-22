// Gera as imagens de prévia de link (Open Graph, 1200x630) com o Chromium do Playwright.
// Saída: public/og/padrao.jpg, public/og/personagem.jpg e uma por página da biblioteca.
// Uso: npm run og   (rode de novo depois de criar páginas novas ou trocar a imagem do hero)
import { chromium } from '@playwright/test';
import { readFileSync, readdirSync, mkdirSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const raiz = resolve('.');
mkdirSync('public/og', { recursive: true });
const fonte = (p) => pathToFileURL(join(raiz, 'node_modules/@fontsource', p)).href;
const fundo = pathToFileURL(join(raiz, 'public/assets/img/hero.webp')).href;
const css = `
@font-face { font-family: 'Zen Antique'; src: url('${fonte('zen-antique/files/zen-antique-latin-400-normal.woff2')}'); }
@font-face { font-family: 'Zen Antique CJK'; src: url('${fonte('zen-antique/files/zen-antique-japanese-400-normal.woff2')}'); }
@font-face { font-family: 'Alegreya'; font-style: italic; src: url('${fonte('alegreya/files/alegreya-latin-400-italic.woff2')}'); }
@font-face { font-family: 'Alegreya Sans'; font-weight: 700; src: url('${fonte('alegreya-sans/files/alegreya-sans-latin-700-normal.woff2')}'); }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #0c0a09; color: #ece2cf; position: relative; overflow: hidden; font-family: 'Alegreya Sans'; }
.arte { position: absolute; inset: 0 0 0 46%; background: url('${fundo}') center 25% / cover; filter: grayscale(.5) sepia(.4) brightness(.6) contrast(1.2); }
.veu { position: absolute; inset: 0; background: linear-gradient(90deg, #0c0a09 40%, rgba(12,10,9,.4) 75%, rgba(12,10,9,.2)), radial-gradient(60% 80% at 80% 0%, rgba(168,18,26,.4), transparent 70%); }
.ideo { position: absolute; left: -40px; bottom: -120px; font: 560px/1 'Zen Antique CJK', serif; color: #a8121a; opacity: .22; }
.selo { position: absolute; right: 60px; top: 56px; width: 92px; height: 92px; background: #a8121a; transform: rotate(-5deg); display: grid; place-items: center; font: 60px 'Zen Antique CJK'; color: #f9e9d8; box-shadow: inset 0 0 0 4px #7a0a10; }
.txt { position: absolute; left: 72px; top: 70px; width: 760px; }
.rot { font-weight: 700; font-size: 22px; letter-spacing: .3em; text-transform: uppercase; color: #bf9a5b; }
h1 { font: 400 92px/1 'Zen Antique', serif; margin: 26px 0 18px; color: #f5ead6; }
h1.menor { font-size: 70px; }
.golpe { width: 520px; height: 4px; background: linear-gradient(90deg, #d3262c, transparent); transform: rotate(-2deg); margin: 6px 0 26px; box-shadow: 0 0 14px rgba(211,38,44,.8); }
p { font: italic 34px/1.3 'Alegreya', serif; color: #d9ccb6; }
.rodape { position: absolute; left: 72px; bottom: 50px; font-weight: 700; font-size: 22px; letter-spacing: .2em; color: #ec5b4f; text-transform: uppercase; }
`;
const pagina = ({ rotulo, titulo, frase, ideograma }) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="arte"></div><div class="veu"></div><div class="ideo">${ideograma}</div><div class="selo">裂</div>
<div class="txt"><div class="rot">${rotulo}</div><h1 class="${titulo.length > 22 ? 'menor' : ''}">${titulo}</h1><div class="golpe"></div><p>${frase}</p></div>
<div class="rodape">Murim · Céu Partido</div></body></html>`;

function md(dir) {
  return readdirSync(dir).flatMap((f) => {
    const c = join(dir, f);
    return statSync(c).isDirectory() ? md(c) : f.endsWith('.md') ? [c] : [];
  });
}
const campo = (s, k) => { const m = s.match(new RegExp(`^${k}: (.*)$`, 'm')); return m ? m[1].replace(/^"|"$/g, '').replace(/\\"/g, '"') : ''; };
const NOMES = { comece: 'Comece aqui', mundo: 'O Mundo', faccoes: 'Facções e Seitas', personagem: 'Personagem', cultivo: 'Cultivo', artes: 'Artes Marciais', combate: 'Combate', evolucao: 'Evolução', sistemas: 'Sistemas' };

const alvos = [
  { arq: 'padrao', rotulo: 'RPG de murim pelo WhatsApp', titulo: 'Murim: Céu Partido', frase: 'O céu se partiu há trinta e um anos. Ninguém o costurou.', ideograma: '武' },
  { arq: 'personagem', rotulo: 'Ficha de personagem', titulo: 'Um nome no Jianghu', frase: 'Corpo, raiz, seita e destino, registrados para sempre.', ideograma: '人' },
];
for (const f of md('src/content/biblioteca')) {
  const s = readFileSync(f, 'utf8');
  const id = relative('src/content/biblioteca', f).replace(/\\/g, '/').replace(/\.md$/, '');
  alvos.push({ arq: id.replace(/\//g, '--'), rotulo: `Biblioteca · ${NOMES[campo(s, 'secao')] ?? ''}`, titulo: campo(s, 'titulo'), frase: campo(s, 'resumo'), ideograma: campo(s, 'ideograma') || '道' });
}

const nav = await chromium.launch();
const p = await nav.newPage({ viewport: { width: 1200, height: 630 } });
const tmp = join(raiz, 'scripts', '.og-tmp.html');
for (const a of alvos) {
  // a página precisa vir de um arquivo local para carregar fontes e a pintura de fundo
  writeFileSync(tmp, pagina(a));
  await p.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `public/og/${a.arq}.jpg`, type: 'jpeg', quality: 80 });
}
await nav.close();
rmSync(tmp, { force: true });
console.log(`${alvos.length} prévias geradas em public/og/`);
