// Converte imagens para WebP otimizado com sharp.
// Origens: assets-originais/ (imagens de terceiros) e arte-propria/ (suas artes).
// Saída: public/assets/img/<nome>.webp (até 1920 px) e <nome>-m.webp (900 px, celular).
// Uso: npm run imagens
import sharp from 'sharp';
import { readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, parse } from 'node:path';

const saida = 'public/assets/img';
await mkdir(saida, { recursive: true });
const pastas = ['assets-originais', 'arte-propria'].filter((p) => existsSync(p));
let total = 0;
for (const pasta of pastas) {
  for (const arq of await readdir(pasta)) {
    if (!/\.(jpe?g|png|webp|tiff?|avif)$/i.test(arq)) continue;
    const nome = parse(arq).name;
    const entrada = join(pasta, arq);
    const meta = await sharp(entrada).metadata();
    if ((meta.height ?? 0) < 300) { console.log('pulada (pequena demais):', arq); continue; }
    await sharp(entrada).rotate().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 72, effort: 5 }).toFile(join(saida, `${nome}.webp`));
    await sharp(entrada).rotate().resize({ width: 900, height: 1400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 66, effort: 5 }).toFile(join(saida, `${nome}-m.webp`));
    total++;
    console.log('ok', nome);
  }
}
console.log(`${total} imagens otimizadas em ${saida}`);
