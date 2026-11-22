// Motor de combate para o simulador da administração. Aplica as regras da biblioteca:
// iniciativa, ciclo de vantagens, choque, contra-ataque, estados, reino, Qi, Ferimento Interno e selamento.
// Para a simulação em massa há uma "variação narrativa" opcional (±%), que representa
// escolhas e descrições que as regras não capturam; com variação 0 a luta é determinística.
import type { Atributo, Tecnica } from '../../supabase/functions/_shared/regras';
import { ATRIBUTOS, NOME_ATRIBUTO, indiceReino } from '../../supabase/functions/_shared/regras';

export interface TecnicaCombate { nome: string; principal: Atributo; bonus: number; custoQi: number; recarga: number; defensiva: boolean; grau: string; bonusPrecisao: number }
export interface Combatente {
  nome: string; reino: string; atributos: Record<Atributo, number>; vida: number; qi: number; arma: number;
  tecnicas: TecnicaCombate[];
}
interface Estado extends Combatente { vidaMax: number; qiMax: number; vidaAtual: number; qiAtual: number; espera: Record<string, number>; seladoAte: number; ferimentoInterno: boolean }

const CICLO: Record<Atributo, Atributo> = { forca: 'resistencia', resistencia: 'precisao', precisao: 'agilidade', agilidade: 'vigor', vigor: 'forca' };

export function deTecnica(t: Tecnica): TecnicaCombate {
  const ent = ATRIBUTOS.map((k) => [k, Number(t.distribuicao?.[k] ?? 0)] as const).sort((a, b) => b[1] - a[1]);
  return {
    nome: t.nome || 'Técnica', principal: ent[0][0], bonus: ent[0][1], custoQi: t.custoQi, recarga: t.recarga, defensiva: !!t.defensiva, grau: t.grau,
    bonusPrecisao: ent[0][0] === 'precisao' ? ent[0][1] : Number(t.distribuicao?.precisao ?? 0),
  };
}

function multEstado(e: Estado) {
  const p = e.vidaAtual / e.vidaMax;
  if (p >= 0.75) return { m: 1, nome: 'Ileso' };
  if (p >= 0.5) return { m: 0.9, nome: 'Ferido' };
  if (p >= 0.25) return { m: 0.75, nome: 'Grave' };
  return { m: 0.6, nome: 'Crítico' };
}

function multReino(a: Estado, b: Estado) {
  const d = indiceReino(a.reino) - indiceReino(b.reino);
  return d > 0 ? 1 + 0.2 * d : 1;
}

function vence(a: Atributo, d: Atributo) { return CICLO[a] === d; }

export interface Resultado { vencedor: string | null; turnos: number; log: string[]; final: { nome: string; vida: number; vidaMax: number; qi: number }[] }

export function lutar(A: Combatente, B: Combatente, opcoes: { variacao?: number; maxTurnos?: number; rng?: () => number; log?: boolean } = {}): Resultado {
  const variacao = opcoes.variacao ?? 0, maxT = opcoes.maxTurnos ?? 30, rng = opcoes.rng ?? Math.random, logar = opcoes.log ?? true;
  const ini = (c: Combatente): Estado => ({ ...c, vidaMax: c.vida, qiMax: c.qi, vidaAtual: c.vida, qiAtual: c.qi, espera: {}, seladoAte: -1, ferimentoInterno: false });
  const a = ini(A), b = ini(B);
  const log: string[] = [];
  const L = (s: string) => { if (logar) log.push(s); };
  const ruido = () => (variacao ? 1 + (rng() * 2 - 1) * variacao : 1);
  const ordem = a.atributos.agilidade > b.atributos.agilidade || (a.atributos.agilidade === b.atributos.agilidade && a.atributos.precisao >= b.atributos.precisao) ? [a, b] : [b, a];
  L(`Iniciativa: ${ordem[0].nome} (Agilidade ${ordem[0].atributos.agilidade}) age primeiro.`);

  const usarQi = (e: Estado, custo: number) => {
    e.qiAtual -= custo;
    if (e.qiAtual <= 0 && !e.ferimentoInterno) { e.qiAtual = 0; e.ferimentoInterno = true; e.qiMax = Math.round(e.qiMax * 0.75); L(`  ${e.nome} esgota o Qi: Ferimento Interno (−25% de Qi máximo).`); }
  };
  const disponivel = (e: Estado, t: TecnicaCombate, turno: number) => {
    if (e.seladoAte >= turno) return false;
    if ((e.espera[t.nome] ?? -99) > turno) return false;
    if (e.qiAtual < t.custoQi) return false;
    const est = multEstado(e).nome;
    if ((est === 'Grave' || est === 'Crítico') && ['suprema', 'lendaria'].includes(t.grau)) return false;
    return true;
  };

  // melhor defesa possível de d contra um ataque com atributo `attr` e valor `valor`
  function melhorDefesa(d: Estado, attr: Atributo, baseAtq: number, turno: number, podeReagir: boolean) {
    const ops: { nome: string; attr: Atributo; valor: number; tec?: TecnicaCombate }[] = [
      { nome: 'bloqueio', attr: 'resistencia', valor: d.atributos.resistencia },
      { nome: 'esquiva', attr: 'agilidade', valor: d.atributos.agilidade },
    ];
    if (podeReagir) for (const t of d.tecnicas.filter((x) => x.defensiva && disponivel(d, x, turno))) ops.push({ nome: t.nome, attr: t.principal, valor: d.atributos[t.principal] + t.bonus, tec: t });
    const ms = multEstado(d).m;
    let melhor = ops[0], melhorV = -1;
    for (const o of ops) {
      let v = o.valor * ms;
      const base = d.atributos[o.attr];
      if (Math.abs(baseAtq - base) / Math.min(baseAtq, base) <= 0.3 && vence(o.attr, attr)) v *= 1.15;
      // técnica defensiva só vale a pena se ganhar algo relevante
      const custo = o.tec ? o.tec.custoQi * 0.5 : 0;
      if (v - custo > melhorV) { melhorV = v - custo; melhor = o; }
    }
    return melhor;
  }

  let turno = 0;
  for (turno = 1; turno <= maxT; turno++) {
    for (const atk of ordem) {
      const def = atk === a ? b : a;
      if (atk.vidaAtual <= 0 || def.vidaAtual <= 0) break;
      const ea = multEstado(atk), ed = multEstado(def);
      let usouTec = false;
      // opções de ataque
      const ops: { nome: string; attr: Atributo; valor: number; tec?: TecnicaCombate }[] = ATRIBUTOS.filter((k) => k !== 'vigor').map((k) => ({ nome: `ataque básico (${NOME_ATRIBUTO[k]})`, attr: k, valor: atk.atributos[k] + atk.arma }));
      for (const t of atk.tecnicas.filter((x) => !x.defensiva && disponivel(atk, x, turno))) ops.push({ nome: t.nome, attr: t.principal, valor: atk.atributos[t.principal] + t.bonus + atk.arma, tec: t });
      const mr = multReino(atk, def), mrd = multReino(def, atk);
      const podeReagir = ed.nome !== 'Crítico';

      // selamento: se dá para selar o Qi de quem depende de técnicas, sela
      const precisaoSelo = (atk.atributos.precisao + Math.max(0, ...atk.tecnicas.filter((t) => !t.defensiva && disponivel(atk, t, turno)).map((t) => t.bonusPrecisao)) + 0) * ea.m;
      // (a IA só tenta selar quando já está perdendo a troca de golpes, como no exemplo da biblioteca)
      if (ea.nome !== 'Ileso' && def.seladoAte < turno && def.tecnicas.some((t) => !t.defensiva) && precisaoSelo >= def.atributos.resistencia * ed.m * 1.2 * mrd / mr && def.vidaAtual / def.vidaMax > 0.5) {
        const t = atk.tecnicas.filter((x) => !x.defensiva && disponivel(atk, x, turno)).sort((x, y) => y.bonusPrecisao - x.bonusPrecisao)[0];
        if (t) { usarQi(atk, t.custoQi); atk.espera[t.nome] = turno + t.recarga; usouTec = true; }
        def.seladoAte = turno + 1;
        L(`T${turno} · ${atk.nome} acerta um ponto vital${t ? ` com ${t.nome}` : ''}: Qi de ${def.nome} selado por 2 turnos.`);
      } else {
        // escolhe o ataque com maior dano esperado contra a melhor defesa
        let escolha = ops[0], melhorDano = -Infinity;
        for (const o of ops) {
          let v = o.valor * ea.m * mr;
          const d = melhorDefesa(def, o.attr, atk.atributos[o.attr], turno, podeReagir);
          let dv = d.valor * ed.m * mrd;
          const dif = Math.abs(atk.atributos[o.attr] - def.atributos[d.attr]) / Math.min(atk.atributos[o.attr], def.atributos[d.attr]);
          if (dif <= 0.3) { if (vence(o.attr, d.attr)) v *= 1.15; else if (vence(d.attr, o.attr)) dv *= 1.15; }
          const dano = v > dv * 1.1 ? v - dv : Math.abs(v - dv) <= dv * 0.1 ? 50 : -100;
          const nota = dano - (o.tec ? o.tec.custoQi * 0.3 : 0) + (variacao ? rng() * 40 : 0);
          if (nota > melhorDano) { melhorDano = nota; escolha = o; }
        }
        let vAtq = escolha.valor * ea.m * mr * ruido();
        if (escolha.tec) { usarQi(atk, escolha.tec.custoQi); atk.espera[escolha.tec.nome] = turno + escolha.tec.recarga; usouTec = true; }
        const dEsc = melhorDefesa(def, escolha.attr, atk.atributos[escolha.attr], turno, podeReagir);
        let vDef = dEsc.valor * ed.m * mrd * ruido();
        let usouTecDef = false;
        if (dEsc.tec) { usarQi(def, dEsc.tec.custoQi); def.espera[dEsc.tec.nome] = turno + dEsc.tec.recarga; usouTecDef = true; }
        // o limite de 30% compara os atributos puros, sem bônus de técnica e arma
        const dif = Math.abs(atk.atributos[escolha.attr] - def.atributos[dEsc.attr]) / Math.min(atk.atributos[escolha.attr], def.atributos[dEsc.attr]);
        let ciclo = '';
        if (dif <= 0.3) {
          if (vence(escolha.attr, dEsc.attr)) { vAtq *= 1.15; ciclo = ' (ciclo a favor do ataque)'; }
          else if (vence(dEsc.attr, escolha.attr)) { vDef *= 1.15; ciclo = ' (ciclo a favor da defesa)'; }
        }
        vAtq = Math.round(vAtq); vDef = Math.round(vDef);
        let txt = `T${turno} · ${atk.nome} usa ${escolha.nome}: ${vAtq} contra ${dEsc.nome} de ${def.nome}: ${vDef}${ciclo}. `;
        if (vAtq > vDef * 1.1) {
          const dano = vAtq - vDef;
          def.vidaAtual -= dano;
          txt += `Dano ${dano}.`;
          if (escolha.tec && dano >= 500 && !def.ferimentoInterno) { def.ferimentoInterno = true; def.qiMax = Math.round(def.qiMax * 0.75); def.qiAtual = Math.min(def.qiAtual, def.qiMax); txt += ' Ferimento Interno!'; }
        } else if (Math.abs(vAtq - vDef) <= Math.max(vAtq, vDef) * 0.1) {
          atk.vidaAtual -= 100; def.vidaAtual -= 100; txt += 'Choque: −100 para os dois.';
        } else if (vDef >= vAtq * 1.3 && podeReagir) {
          const contra = Math.round((Math.max(def.atributos.precisao, def.atributos.forca) + def.arma) * multEstado(def).m * mrd);
          const res = Math.round(atk.atributos.resistencia * multEstado(atk).m * mr);
          const dano = Math.max(0, contra - res);
          atk.vidaAtual -= dano;
          txt += `Defesa esmagadora: contra-ataque de ${contra} contra ${res}, dano ${dano}.`;
        } else txt += 'Bloqueado.';
        L(txt);
        if (!usouTecDef && def.vidaAtual > 0) { /* a reação não impede a recuperação do defensor no turno dele */ }
      }
      if (!usouTec) atk.qiAtual = Math.min(atk.qiMax, atk.qiAtual + Math.round(atk.qiMax * 0.1));
      for (const e of [atk, def]) if (e.vidaAtual <= 0) { e.vidaAtual = 0; L(`  ${e.nome} cai.`); }
      if (def.vidaAtual > 0) L(`  ${def.nome}: ${def.vidaAtual}/${def.vidaMax} (${multEstado(def).nome}) · ${atk.nome}: ${atk.vidaAtual}/${atk.vidaMax} (${multEstado(atk).nome})`);
    }
    if (a.vidaAtual <= 0 || b.vidaAtual <= 0) break;
  }
  const vencedor = a.vidaAtual <= 0 && b.vidaAtual <= 0 ? null : a.vidaAtual <= 0 ? b.nome : b.vidaAtual <= 0 ? a.nome
    : a.vidaAtual / a.vidaMax === b.vidaAtual / b.vidaMax ? null : a.vidaAtual / a.vidaMax > b.vidaAtual / b.vidaMax ? a.nome : b.nome;
  if (turno > maxT) L(`Limite de ${maxT} turnos: decide a Vida restante em %.`);
  return { vencedor, turnos: Math.min(turno, maxT), log, final: [a, b].map((e) => ({ nome: e.nome, vida: e.vidaAtual, vidaMax: e.vidaMax, qi: e.qiAtual })) };
}

export function simularMassa(A: Combatente, B: Combatente, n = 1000, variacao = 0.1) {
  let va = 0, vb = 0, emp = 0, turnos = 0;
  for (let i = 0; i < n; i++) {
    const r = lutar(A, B, { variacao, log: false });
    if (r.vencedor === A.nome) va++; else if (r.vencedor === B.nome) vb++; else emp++;
    turnos += r.turnos;
  }
  return { n, vitoriasA: va, vitoriasB: vb, empates: emp, turnosMedios: turnos / n };
}
