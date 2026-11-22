// Gera os ícones do PWA a partir de um SVG desenhado para o site.
import sharp from 'sharp';
const selo = (pad) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0c0a09"/>
  <g transform="translate(256 256) rotate(-4) translate(-256 -256)">
    <rect x="${pad}" y="${pad}" width="${512 - pad * 2}" height="${512 - pad * 2}" rx="18" fill="#a8121a"/>
    <rect x="${pad + 18}" y="${pad + 18}" width="${512 - pad * 2 - 36}" height="${512 - pad * 2 - 36}" rx="10" fill="none" stroke="#f9e9d8" stroke-opacity=".35" stroke-width="6"/>
  </g>
  <path d="M${pad + 70} ${512 - pad - 90} L${512 - pad - 70} ${pad + 90}" stroke="#f9e9d8" stroke-width="30" stroke-linecap="square"/>
  <path d="M${pad + 95} ${pad + 140} H${512 - pad - 110} M${pad + 120} ${512 - pad - 130} H${512 - pad - 90}" stroke="#f9e9d8" stroke-width="22"/>
</svg>`);
await sharp(selo(40)).resize(192).png().toFile('public/icones/icone-192.png');
await sharp(selo(40)).resize(512).png().toFile('public/icones/icone-512.png');
await sharp(selo(96)).resize(512).png().toFile('public/icones/icone-maskable-512.png');
console.log('ícones gerados');
