import { describe, expect, it } from 'vitest';
import { lutar, simularMassa, type Combatente } from '../src/lib/combate';

const seoAh = (): Combatente => ({
  nome: 'Seo-ah', reino: 'terceira', vida: 1600, qi: 1000, arma: 100,
  atributos: { forca: 900, agilidade: 1300, resistencia: 900, precisao: 1200, vigor: 700 },
  tecnicas: [
    { nome: 'Corte da Primeira Chuva', principal: 'precisao', bonus: 300, bonusPrecisao: 300, custoQi: 80, recarga: 1, defensiva: false, grau: 'basica' },
    { nome: 'Guarda da Nuvem Parada', principal: 'agilidade', bonus: 360, bonusPrecisao: 0, custoQi: 70, recarga: 1, defensiva: true, grau: 'basica' },
  ],
});
const galPi = (): Combatente => ({
  nome: 'Gal-pi', reino: 'terceira', vida: 1800, qi: 1000, arma: 0,
  atributos: { forca: 1500, agilidade: 800, resistencia: 1000, precisao: 900, vigor: 800 },
  tecnicas: [{ nome: 'Mordida do Lobo Faminto', principal: 'forca', bonus: 300, bonusPrecisao: 0, custoQi: 90, recarga: 1, defensiva: false, grau: 'basica' }],
});

describe('combate', () => {
  it('a mais ágil age primeiro e o primeiro golpe respeita o ciclo (1.600 contra 1.150)', () => {
    const r = lutar(seoAh(), galPi());
    expect(r.log[0]).toMatch(/Seo-ah/);
    expect(r.log[1]).toMatch(/1600 contra bloqueio de Gal-pi: 1150 \(ciclo a favor da defesa\)\. Dano 450/);
  });
  it('a luta termina com vencedor e respeita o limite de turnos', () => {
    const r = lutar(seoAh(), galPi());
    expect(r.turnos).toBeLessThanOrEqual(30);
    expect(r.vencedor).not.toBeUndefined();
  });
  it('um reino de diferença dá vantagem clara', () => {
    const forte = { ...galPi(), nome: 'Veterano', reino: 'segunda' };
    const m = simularMassa(seoAh(), forte, 300, 0.1);
    expect(m.vitoriasB).toBeGreaterThan(m.vitoriasA);
  });
  it('lutas espelhadas ficam equilibradas na simulação em massa', () => {
    const b = { ...seoAh(), nome: 'Gêmea' };
    const m = simularMassa(seoAh(), b, 1000, 0.1);
    expect(m.vitoriasA + m.vitoriasB + m.empates).toBe(1000);
    // quem age primeiro tem alguma vantagem, mas não absoluta
    expect(m.vitoriasB).toBeGreaterThan(100);
  });
});
