// Leitura do Destino — lógica pura (sem I/O). Usada pela Edge Function `jogo`,
// pela simulação de 100.000 rolagens e pelos testes (Vitest).
import config from './destino-config.json' with { type: 'json' };
import dados from './dados.json' with { type: 'json' };

export type TipoLeitura = 'corpo' | 'raiz' | 'linhagem';
/** Retorna um inteiro uniforme em [0, n). Deve ser criptográfico em produção. */
export type Rng = (n: number) => number;

export interface EstadoLeitura {
  fios: number;
  /** chaves de corpos Míticos já em posse de alguém vivo (ou pendentes de escolha) */
  miticosOcupados: string[];
  faccao: string | null;
}

export interface ResultadoLeitura {
  tipo: TipoLeitura;
  raridade: string;
  resultado: string;
  nome: string;
  detalhes: Record<string, unknown>;
  rolagem: number;
  garantida: boolean;
  fiosDepois: number;
}

export const CONFIG = config;

/** RNG criptográfico sem viés (amostragem por rejeição sobre Uint32). */
export function rngCripto(n: number): number {
  if (!Number.isInteger(n) || n <= 0) throw new Error('n inválido');
  const limite = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limite) return buf[0] % n;
  }
}

function escolherPorPeso<T extends { peso: number }>(itens: T[], valor: number): T {
  let acc = 0;
  for (const it of itens) {
    acc += it.peso;
    if (valor < acc) return it;
  }
  return itens[itens.length - 1];
}

export function validarConfig(): string[] {
  const erros: string[] = [];
  const soma = (xs: { peso: number }[]) => xs.reduce((a, b) => a + b.peso, 0);
  if (soma(config.corpo.raridades) !== config.corpo.escala) erros.push('corpo: pesos não somam a escala');
  if (soma(config.raiz.tipos) !== config.raiz.escala) erros.push('raiz: pesos não somam a escala');
  if (soma(config.linhagem.resultados) !== config.linhagem.escala) erros.push('linhagem: pesos não somam a escala');
  for (const r of config.corpo.raridades) {
    if (!dados.corpos.some((c) => c.raridade === r.chave)) erros.push(`sem corpos na raridade ${r.chave}`);
  }
  return erros;
}

const ORDEM_RARIDADE = ['comum', 'raro', 'epico', 'lendario', 'mitico'];
export const raridadeIndice = (r: string) => ORDEM_RARIDADE.indexOf(r);

export function sortearCorpo(estado: EstadoLeitura, rng: Rng): ResultadoLeitura {
  const garantida = estado.fios >= config.fiosParaGarantia;
  let tabela = config.corpo.raridades;
  if (garantida) tabela = tabela.filter((r) => raridadeIndice(r.chave) >= raridadeIndice('epico'));
  const total = tabela.reduce((a, b) => a + b.peso, 0);
  const rolagem = rng(total);
  let raridade = escolherPorPeso(tabela, rolagem).chave;

  let candidatos = dados.corpos.filter((c) => c.raridade === raridade);
  if (raridade === 'mitico') {
    candidatos = candidatos.filter((c) => !estado.miticosOcupados.includes(c.chave));
    if (candidatos.length === 0) {
      raridade = 'lendario';
      candidatos = dados.corpos.filter((c) => c.raridade === 'lendario');
    }
  }
  const corpo = candidatos[rng(candidatos.length)];
  let fiosDepois = estado.fios;
  if (garantida) fiosDepois = 0;
  else if (raridadeIndice(raridade) < raridadeIndice('epico')) fiosDepois = estado.fios + 1;
  return {
    tipo: 'corpo', raridade, resultado: corpo.chave, nome: corpo.nome,
    detalhes: { selado: raridadeIndice(raridade) >= raridadeIndice('lendario') },
    rolagem, garantida, fiosDepois,
  };
}

export function elementosPermitidos(faccao: string | null): string[] {
  const podeSangue = faccao !== null && config.raiz.sangueSoPara.includes(faccao);
  return config.raiz.elementos.filter((e) => e !== 'sangue' || podeSangue);
}

export function sortearRaiz(estado: EstadoLeitura, rng: Rng): ResultadoLeitura {
  const rolagem = rng(config.raiz.escala);
  const tipo = escolherPorPeso(config.raiz.tipos, rolagem);
  const permitidos = elementosPermitidos(estado.faccao);
  let elementos: string[] = [];
  if (tipo.chave === 'dupla') {
    const a = permitidos[rng(permitidos.length)];
    const resto = permitidos.filter((e) => e !== a);
    elementos = [a, resto[rng(resto.length)]];
  } else if (tipo.chave === 'pura') {
    elementos = [permitidos[rng(permitidos.length)]];
  } else if (tipo.chave === 'variante') {
    const podeSangue = permitidos.includes('sangue');
    const vars = config.raiz.variantes.filter((v) => v !== 'sangue' || podeSangue);
    elementos = [vars[rng(vars.length)]];
  }
  const nomesEl = elementos.map((e) => (dados.elementos as Record<string, string>)[e]).join(' e ');
  return {
    tipo: 'raiz', raridade: tipo.chave, resultado: tipo.chave,
    nome: tipo.chave === 'comum' ? tipo.nome : `${tipo.nome} (${nomesEl})`,
    detalhes: { elementos }, rolagem, garantida: false, fiosDepois: estado.fios,
  };
}

export function sortearLinhagem(estado: EstadoLeitura, rng: Rng): ResultadoLeitura {
  const rolagem = rng(config.linhagem.escala);
  const r = escolherPorPeso(config.linhagem.resultados, rolagem);
  return {
    tipo: 'linhagem', raridade: r.chave === 'nenhuma' ? 'comum' : 'rara', resultado: r.chave, nome: r.nome,
    detalhes: {}, rolagem, garantida: false, fiosDepois: estado.fios,
  };
}

export function sortear(tipo: TipoLeitura, estado: EstadoLeitura, rng: Rng = rngCripto): ResultadoLeitura {
  if (tipo === 'corpo') return sortearCorpo(estado, rng);
  if (tipo === 'raiz') return sortearRaiz(estado, rng);
  if (tipo === 'linhagem') return sortearLinhagem(estado, rng);
  throw new Error('tipo de leitura inválido');
}

/** Simula N leituras independentes (sem Fio acumulado, sem Míticos ocupados): mede a tabela pura. */
export function simular(tipo: TipoLeitura, n: number, rng: Rng = rngCripto, faccao: string | null = 'culto') {
  const contagem: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const r = sortear(tipo, { fios: 0, miticosOcupados: [], faccao }, rng);
    contagem[r.raridade] = (contagem[r.raridade] ?? 0) + 1;
  }
  const esperado: Record<string, number> = {};
  if (tipo === 'corpo') for (const r of config.corpo.raridades) esperado[r.chave] = r.peso / config.corpo.escala;
  if (tipo === 'raiz') for (const r of config.raiz.tipos) esperado[r.chave] = r.peso / config.raiz.escala;
  if (tipo === 'linhagem') {
    esperado.comum = config.linhagem.resultados[0].peso / config.linhagem.escala;
    esperado.rara = 1 - esperado.comum;
  }
  return Object.keys(esperado).map((k) => ({
    chave: k,
    esperado: esperado[k],
    obtido: (contagem[k] ?? 0) / n,
    quantidade: contagem[k] ?? 0,
  }));
}
