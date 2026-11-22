// Som ambiente e efeitos sintetizados com Web Audio (nenhum arquivo de terceiros).
// Ambiente: vento filtrado + um zumbido grave que respira. Efeitos: gongo, selo, trovão.
let ctx: AudioContext | null = null;
let ambiente: { parar: () => void } | null = null;

function contexto() {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function ruido(c: AudioContext, segundos: number) {
  const buf = c.createBuffer(1, c.sampleRate * segundos, c.sampleRate);
  const d = buf.getChannelData(0);
  let ultimo = 0;
  for (let i = 0; i < d.length; i++) { // ruído marrom: mais grave, parece vento
    const branco = Math.random() * 2 - 1;
    ultimo = (ultimo + 0.02 * branco) / 1.02;
    d[i] = ultimo * 3.5;
  }
  return buf;
}

export function ligarAmbiente() {
  if (ambiente) return;
  const c = contexto();
  const mestre = c.createGain();
  mestre.gain.value = 0;
  mestre.gain.linearRampToValueAtTime(0.16, c.currentTime + 3);
  mestre.connect(c.destination);

  const vento = c.createBufferSource();
  vento.buffer = ruido(c, 6);
  vento.loop = true;
  const filtro = c.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.frequency.value = 420;
  filtro.Q.value = 0.8;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGanho = c.createGain();
  lfoGanho.gain.value = 260;
  lfo.connect(lfoGanho).connect(filtro.frequency);
  vento.connect(filtro).connect(mestre);

  const drone = c.createOscillator();
  drone.type = 'sine';
  drone.frequency.value = 55;
  const droneG = c.createGain();
  droneG.gain.value = 0.35;
  drone.connect(droneG).connect(mestre);
  const quinta = c.createOscillator();
  quinta.type = 'triangle';
  quinta.frequency.value = 82.4;
  const quintaG = c.createGain();
  quintaG.gain.value = 0.08;
  quinta.connect(quintaG).connect(mestre);

  vento.start(); lfo.start(); drone.start(); quinta.start();
  ambiente = {
    parar: () => {
      mestre.gain.linearRampToValueAtTime(0, c.currentTime + 1);
      setTimeout(() => { vento.stop(); lfo.stop(); drone.stop(); quinta.stop(); mestre.disconnect(); }, 1100);
    },
  };
}

export function desligarAmbiente() {
  ambiente?.parar();
  ambiente = null;
}

/** Efeitos da Leitura do Destino. Só tocam se o som estiver ligado. */
export function efeito(tipo: 'gongo' | 'selo' | 'trovao') {
  if (localStorage.getItem('som') !== '1') return;
  const c = contexto();
  const t = c.currentTime;
  const g = c.createGain();
  g.connect(c.destination);
  if (tipo === 'gongo') {
    for (const [f, a] of [[110, 0.5], [164, 0.25], [221, 0.15], [297, 0.08]] as const) {
      const o = c.createOscillator();
      o.frequency.value = f;
      const og = c.createGain();
      og.gain.setValueAtTime(a, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 4);
      o.connect(og).connect(g);
      o.start(t); o.stop(t + 4);
    }
    g.gain.value = 0.5;
  } else if (tipo === 'selo') {
    const s = c.createBufferSource();
    s.buffer = ruido(c, 0.3);
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 600;
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    s.connect(f).connect(g);
    s.start(t);
  } else {
    const s = c.createBufferSource();
    s.buffer = ruido(c, 3);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2500, t);
    f.frequency.exponentialRampToValueAtTime(80, t + 2.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.2, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 3);
    s.connect(f).connect(g);
    s.start(t);
  }
}
