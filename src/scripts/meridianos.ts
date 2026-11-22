// Diagrama do corpo com 12 meridianos principais (vermelho) e 8 extraordinários (ouro).
import { DADOS } from '../../supabase/functions/_shared/regras';

const PONTOS: [number, number][] = [
  // principais 1..12 (braços, tronco e pernas)
  [62, 92], [38, 118], [100, 128], [112, 150], [100, 104], [30, 146], [128, 250], [92, 250], [138, 92], [162, 118], [170, 146], [108, 300],
  // extraordinários 13..20 (linha central e calcanhares)
  [100, 60], [100, 178], [100, 210], [100, 160], [84, 196], [116, 196], [90, 330], [112, 330],
];

export function svgMeridianos(abertos: number[]): string {
  const nomes = [...DADOS.meridianos.principais, ...DADOS.meridianos.extraordinarios];
  const pontos = PONTOS.map(([x, y], i) => {
    const n = i + 1;
    const extra = n > 12;
    return `<circle class="ponto ${extra ? 'extra' : ''} ${abertos.includes(n) ? 'aberto' : ''}" cx="${x}" cy="${y}" r="${extra ? 5 : 6}"><title>${nomes[i]}${abertos.includes(n) ? ' (aberto)' : ' (fechado)'}</title></circle>`;
  }).join('');
  const abertosP = abertos.filter((n) => n <= 12).length;
  const abertosE = abertos.filter((n) => n > 12).length;
  return `<svg viewBox="0 0 200 360" role="img" aria-label="Meridianos: ${abertosP} de 12 principais e ${abertosE} de 8 extraordinários abertos">
    <path class="canal" d="M100 30 a18 22 0 1 0 0.1 0 M100 74 V220 M100 90 L44 150 L28 200 M100 90 L156 150 L172 200 M100 220 L86 340 M100 220 L114 340 M70 90 H130" />
    ${pontos}
  </svg>
  <p class="ajuda" style="text-align:center">${abertosP}/12 principais · ${abertosE}/8 extraordinários</p>`;
}
