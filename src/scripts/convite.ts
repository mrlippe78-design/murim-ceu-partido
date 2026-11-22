// Página de convite: cinzas caindo (canvas leve) e revelação do trailer ao rolar.
const reduzir = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function cinzas() {
  const canvas = document.querySelector<HTMLCanvasElement>('.cinzas');
  if (!canvas || reduzir()) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0, h = 0;
  const redimensionar = () => {
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  redimensionar();
  window.addEventListener('resize', redimensionar, { passive: true });
  const n = w < 700 ? 28 : 55;
  const p = Array.from({ length: n }, () => novo(true));
  function novo(inicio = false) {
    const brasa = Math.random() < 0.22;
    return {
      x: Math.random() * w, y: inicio ? Math.random() * h : -10,
      r: brasa ? 1 + Math.random() * 1.6 : 0.6 + Math.random() * 2.2,
      vy: 0.25 + Math.random() * 0.6, vx: -0.2 + Math.random() * 0.5,
      fase: Math.random() * Math.PI * 2, brasa, a: 0.25 + Math.random() * 0.5,
    };
  }
  let rodando = true;
  let ultimo = performance.now();
  const passo = (t: number) => {
    if (!rodando) return;
    const dt = Math.min(48, t - ultimo) / 16.7;
    ultimo = t;
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < p.length; i++) {
      const q = p[i];
      q.fase += 0.02 * dt;
      q.y += q.vy * dt;
      q.x += (q.vx + Math.sin(q.fase) * 0.35) * dt;
      if (q.y > h + 10 || q.x < -20 || q.x > w + 20) p[i] = novo();
      ctx.globalAlpha = q.a * (q.brasa ? 0.6 + 0.4 * Math.sin(q.fase * 3) : 1);
      ctx.fillStyle = q.brasa ? '#ff5a3a' : '#cbbfae';
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(passo);
  };
  // só anima quando o hero está visível e a aba está aberta
  const obs = new IntersectionObserver(([e]) => {
    const deve = e.isIntersecting && !document.hidden;
    if (deve && !rodando) { rodando = true; ultimo = performance.now(); requestAnimationFrame(passo); }
    if (!deve) rodando = false;
  });
  obs.observe(canvas);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) rodando = false;
    else if (!rodando) { rodando = true; ultimo = performance.now(); requestAnimationFrame(passo); }
  });
  requestAnimationFrame(passo);
}

function revelar() {
  const quadros = document.querySelectorAll('.quadro');
  if (reduzir() || !('IntersectionObserver' in window)) { quadros.forEach((q) => q.classList.add('visivel')); return; }
  const obs = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { e.target.classList.add('visivel'); obs.unobserve(e.target); }
  }, { rootMargin: '0px 0px -12% 0px' });
  quadros.forEach((q) => obs.observe(q));
}

export function iniciarConvite() {
  revelar();
  // cinzas depois do primeiro desenho, para não competir com o carregamento
  if ('requestIdleCallback' in window) (window as Window).requestIdleCallback(cinzas, { timeout: 1500 });
  else setTimeout(cinzas, 600);
}
