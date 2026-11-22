import { describe, expect, it } from 'vitest';
import { sortear, simular, validarConfig, sortearCorpo, rngCripto, elementosPermitidos } from '../supabase/functions/_shared/destino';
import {
  avaliarTecnica, validarFicha, progresso, modificadoresGargalo, interpretarGargalo, piorDesvio,
  pontosTalento, derivados, valoresIniciais, contarLinhas, estagioPorPe, type Ficha,
} from '../supabase/functions/_shared/regras';

/** RNG determinístico para testes. */
function seq(valores: number[]) {
  let i = 0;
  return (n: number) => valores[i++ % valores.length] % n;
}

const fichaValida = (): Ficha => ({
  linhagem: 'humano_planicies', origem: 'discipulo', faccao: 'alianca', seita: 'montanha_celeste', idade: 19,
  talentos: { vantagens: ['coracao_calmo'], desvantagens: ['arrogante'] },
  atributos: { forca: 1000, agilidade: 1200, resistencia: 900, precisao: 1100, vigor: 800 },
  arteInterna: { nome: 'Sutra da Nuvem Parada', natureza: 'yang', passiva: '+10% de recuperação de Qi em meditação.' },
  tecnicas: [
    { nome: 'Corte da Primeira Chuva', grau: 'basica', tipo: 'externa', distribuicao: { forca: 200, precisao: 100 }, custoQi: 80, recarga: 1 },
    { nome: 'Passo do Bambu Torto', grau: 'basica', tipo: 'externa', distribuicao: { agilidade: 300 }, custoQi: 60, recarga: 1 },
    { nome: 'Guarda da Pedra Fria', grau: 'basica', tipo: 'externa', distribuicao: { resistencia: 360 }, custoQi: 70, recarga: 1, defensiva: true },
  ],
  arma: { nome: 'Espada de ferro', tipo: 'comum' },
  historia: 'Filho de lenhador.\n'.repeat(10),
});

describe('configuração do destino', () => {
  it('pesos somam 10.000 e toda raridade tem corpos', () => {
    expect(validarConfig()).toEqual([]);
  });
});

describe('sorteio de corpo', () => {
  it('fronteiras de peso: 0 → comum, 8955 → raro, 9955 → lendário, 9995 → mítico', () => {
    const base = { fios: 0, miticosOcupados: [], faccao: null };
    expect(sortearCorpo(base, seq([0, 0])).raridade).toBe('comum');
    expect(sortearCorpo(base, seq([8954, 0])).raridade).toBe('comum');
    expect(sortearCorpo(base, seq([8955, 0])).raridade).toBe('raro');
    expect(sortearCorpo(base, seq([9755, 0])).raridade).toBe('epico');
    expect(sortearCorpo(base, seq([9955, 0])).raridade).toBe('lendario');
    expect(sortearCorpo(base, seq([9995, 0])).raridade).toBe('mitico');
  });

  it('abaixo de Épico gera 1 Fio; com 40 Fios garante Épico+ e zera', () => {
    const r1 = sortearCorpo({ fios: 3, miticosOcupados: [], faccao: null }, seq([10, 0]));
    expect(r1.fiosDepois).toBe(4);
    const r2 = sortearCorpo({ fios: 40, miticosOcupados: [], faccao: null }, seq([0, 0]));
    expect(r2.garantida).toBe(true);
    expect(['epico', 'lendario', 'mitico']).toContain(r2.raridade);
    expect(r2.fiosDepois).toBe(0);
  });

  it('Mítico ocupado vai para outro Mítico livre; todos ocupados viram Lendário', () => {
    const todos = ['corpo_celestial', 'ossos_dourados', 'yin_absoluto', 'yang_primordial', 'vazio_caos'];
    const um = sortearCorpo({ fios: 0, miticosOcupados: ['corpo_celestial'], faccao: null }, seq([9999, 0]));
    expect(um.raridade).toBe('mitico');
    expect(um.resultado).not.toBe('corpo_celestial');
    const nenhum = sortearCorpo({ fios: 0, miticosOcupados: todos, faccao: null }, seq([9999, 0]));
    expect(nenhum.raridade).toBe('lendario');
  });

  it('Lendário e Mítico começam selados', () => {
    expect(sortearCorpo({ fios: 0, miticosOcupados: [], faccao: null }, seq([9960, 0])).detalhes.selado).toBe(true);
  });
});

describe('raiz e linhagem', () => {
  it('Sangue só para Culto ou heterodoxos', () => {
    expect(elementosPermitidos('alianca')).not.toContain('sangue');
    expect(elementosPermitidos('culto')).toContain('sangue');
  });
  it('raiz dupla tem dois elementos diferentes', () => {
    const r = sortear('raiz', { fios: 0, miticosOcupados: [], faccao: 'alianca' }, seq([8500, 0, 0]));
    expect(r.raridade).toBe('dupla');
    const el = r.detalhes.elementos as string[];
    expect(el).toHaveLength(2);
    expect(el[0]).not.toBe(el[1]);
  });
});

describe('simulação estatística (RNG criptográfico)', () => {
  it('100.000 leituras de corpo ficam perto das porcentagens', () => {
    const res = simular('corpo', 100_000, rngCripto);
    for (const r of res) {
      // tolerância de ~5 desvios-padrão
      const sd = Math.sqrt((r.esperado * (1 - r.esperado)) / 100_000);
      expect(Math.abs(r.obtido - r.esperado)).toBeLessThan(5 * sd + 1e-9);
    }
  });
});

describe('técnicas', () => {
  it('Básica: 300 de bônus, Qi 60–100, recarga 1', () => {
    expect(avaliarTecnica({ nome: 'X', grau: 'basica', tipo: 'externa', distribuicao: { forca: 300 }, custoQi: 80, recarga: 1 }).ok).toBe(true);
    const estourou = avaliarTecnica({ nome: 'X', grau: 'basica', tipo: 'externa', distribuicao: { forca: 301 }, custoQi: 80, recarga: 1 });
    expect(estourou.ok).toBe(false);
    expect(estourou.erros.join()).toMatch(/orçamento/);
  });
  it('defensiva ganha +20% e demoníaca +30%', () => {
    expect(avaliarTecnica({ nome: 'X', grau: 'basica', tipo: 'externa', distribuicao: { resistencia: 360 }, custoQi: 80, recarga: 1, defensiva: true }).ok).toBe(true);
    expect(avaliarTecnica({ nome: 'X', grau: 'intermediaria', tipo: 'demoniaca', distribuicao: { forca: 910 }, custoQi: 150, recarga: 2 }).ok).toBe(true);
  });
  it('Qi fora da faixa e recarga baixa são recusados', () => {
    const a = avaliarTecnica({ nome: 'X', grau: 'avancada', tipo: 'externa', distribuicao: { forca: 1000 }, custoQi: 100, recarga: 1 });
    expect(a.erros.length).toBe(2);
  });
  it('gera texto no formato do WhatsApp', () => {
    const a = avaliarTecnica({ nome: 'Lâmina', grau: 'basica', tipo: 'externa', distribuicao: { forca: 300 }, custoQi: 60, recarga: 1 });
    expect(a.texto).toContain('*【Lâmina】*');
    expect(a.texto).toContain('+300 Força');
  });
});

describe('ficha', () => {
  it('ficha válida passa', () => {
    const v = validarFicha(fichaValida(), { corpo: 'corpo_mortal' });
    expect(v.erros).toEqual([]);
  });
  it('soma, mínimo e máximo dos atributos', () => {
    const f = fichaValida();
    f.atributos = { forca: 1700, agilidade: 1200, resistencia: 400, precisao: 900, vigor: 800 };
    const e = validarFicha(f, { corpo: 'corpo_mortal' }).erros.join(' | ');
    expect(e).toMatch(/Força no máximo 1600/);
    expect(e).toMatch(/Resistência no mínimo 500/);
  });
  it('Médico errante limita Força e Resistência a 1.200', () => {
    const f = fichaValida();
    f.origem = 'medico';
    f.atributos = { forca: 1300, agilidade: 1200, resistencia: 900, precisao: 900, vigor: 700 };
    expect(validarFicha(f, { corpo: 'corpo_mortal' }).erros.join()).toMatch(/Força no máximo 1200/);
  });
  it('exige 1 desvantagem e respeita pontos de talento', () => {
    const f = fichaValida();
    f.talentos = { vantagens: ['prodigio_marcial'], desvantagens: [] };
    const e = validarFicha(f, { corpo: 'corpo_mortal' }).erros.join();
    expect(e).toMatch(/1 desvantagem/);
    expect(e).toMatch(/custam 3 pontos, mas você tem 2/);
  });
  it('desvantagens dão no máximo 6 pontos', () => {
    const f = fichaValida();
    f.talentos = { vantagens: [], desvantagens: ['cacado', 'maldicao_sangue', 'corpo_fragil'] };
    expect(pontosTalento(f, 'raro_qualquer').ganhos).toBe(6);
  });
  it('perder o Corpo Mortal tira o ponto extra de talento', () => {
    const f = fichaValida();
    f.talentos = { vantagens: ['coracao_calmo', 'riqueza'], desvantagens: ['arrogante'] };
    expect(validarFicha(f, { corpo: 'corpo_mortal' }).erros).toEqual([]);
    expect(validarFicha(f, { corpo: 'ossos_firmes' }).erros.join()).toMatch(/custam 3 pontos, mas você tem 2/);
  });
  it('dois personagens não podem ser da mesma facção', () => {
    expect(validarFicha(fichaValida(), { corpo: 'corpo_mortal', outrasFaccoes: ['alianca'] }).erros.join()).toMatch(/facções diferentes/);
  });
  it('Sorte do Céu usada não pode ser removida', () => {
    expect(validarFicha(fichaValida(), { corpo: 'corpo_mortal', sorteUsada: true }).erros.join()).toMatch(/Sorte do Céu/);
  });
  it('Vida = Resistência + Vigor; corpo Lendário selado a 50%', () => {
    const f = fichaValida();
    expect(derivados(f, 'corpo_mortal').vida).toBe(1700);
    const d = derivados(f, 'meridianos_jade');
    expect(d.selado).toBe(true);
    expect(d.qiMax).toBe(1100);
    expect(derivados(f, 'meridianos_jade', null, 'primeira').qiMax).toBe(4200);
  });
  it('valores iniciais por origem e seita', () => {
    const f = fichaValida();
    f.origem = 'herdeiro'; f.faccao = 'clas_nobres'; f.seita = 'baek';
    f.talentos = { vantagens: ['riqueza'], desvantagens: ['arrogante'] };
    expect(valoresIniciais(f, 'corpo_mortal').taeis).toBe(600);
    const g = fichaValida();
    g.origem = 'culto'; g.faccao = 'culto'; g.seita = 'guarda_carmesim';
    expect(valoresIniciais(g, 'corpo_mortal').corrupcao).toBe(10);
  });
});

describe('progresso e gargalo', () => {
  it('estágio por PE e falta para o próximo', () => {
    expect(estagioPorPe('terceira', 999)).toBe('inicial');
    expect(estagioPorPe('terceira', 1000)).toBe('intermediario');
    const p = progresso(2600, 'terceira');
    expect(p.estagio).toBe('superior');
    expect(p.proximo).toMatchObject({ reino: 'segunda', pe: 5000 });
    expect(p.falta).toBe(2400);
    expect(p.precisaGargalo).toBe(true);
    expect(p.semanas).toBe(3); // 950 PE/semana de referência
  });
  it('modificadores: mestre +1, Corrupção −1 a cada 25, Ferimento Interno −1', () => {
    const m = modificadoresGargalo({ corpo: 'corpo_mortal', talentos: ['coracao_calmo'], corrupcao: 52, ferimentosInternos: 1, primeiroGargalo: true, mods: { mestre: true } });
    expect(m.total).toBe(1 + 1 - 2 - 1);
  });
  it('tabela: 12+ avança, 8–11 falha, 7− desvio', () => {
    expect(interpretarGargalo(12)).toBe('avanco');
    expect(interpretarGargalo(11)).toBe('falha');
    expect(interpretarGargalo(8)).toBe('falha');
    expect(interpretarGargalo(7)).toBe('desvio');
  });
  it('Dantian Duplo fica com o pior desvio', () => {
    expect(piorDesvio([6, 3])).toBe(3);
    expect(piorDesvio([2, 1])).toBe(1);
  });
  it('novos reinos: Profundo → Vida e Morte → Natural → Harmonia Celeste por PE; Imortal só por evento', () => {
    expect(progresso(155000, 'profundo').proximo).toMatchObject({ reino: 'vida_morte', pe: 185000 });
    expect(progresso(260000, 'vida_morte').proximo).toMatchObject({ reino: 'natural', pe: 310000 });
    expect(progresso(430000, 'natural').proximo).toMatchObject({ reino: 'harmonia', pe: 510000 });
    const topo = progresso(700000, 'harmonia');
    expect(topo.proximo?.reino).toBe('imortal');
    expect(topo.semanas).toBeNull();
  });
  it('conta linhas não vazias', () => {
    expect(contarLinhas('a\n\n b \r\n\n c')).toBe(3);
  });
});
