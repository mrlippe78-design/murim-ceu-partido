// Ladrilho de "grão de papel" (160x160) usado no fundo do site. Gerado uma vez; leve e sem filtros em tempo real.
import sharp from 'sharp';
const L = 160, px = Buffer.alloc(L * L * 4);
let s = 31; // semente fixa: o arquivo não muda a cada execução
const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
for (let i = 0; i < L * L; i++) {
  const v = 200 + Math.round(rnd() * 55);
  px.set([v, v - 8, v - 20, Math.round(rnd() * 255)], i * 4);
}
await sharp(px, { raw: { width: L, height: L, channels: 4 } }).blur(0.4).png({ compressionLevel: 9, palette: true }).toFile('public/textura-papel.png');
console.log('textura gerada');
