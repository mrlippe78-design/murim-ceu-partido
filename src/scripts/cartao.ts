// Cartão do personagem: imagem vertical 1080x1350 gerada no navegador (canvas), pronta para o WhatsApp.
import { link, nomes, toast } from './app';
import { faccao as infoFaccao, corpo as infoCorpo, seita as infoSeita } from '../../supabase/functions/_shared/regras';
import imagens from '../data/imagens.json';

const COR_RARIDADE: Record<string, string> = { comum: '#948772', raro: '#4fa585', epico: '#7f9be0', lendario: '#e0ac45', mitico: '#ff5a4a' };

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = src; });
}

function quebrar(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const palavras = texto.split(' ');
  const linhas: string[] = [];
  let atual = '';
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(teste).width > largura && atual) { linhas.push(atual); atual = p; } else atual = teste;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export async function gerarCartao(c: Record<string, any>): Promise<Blob> {
  await document.fonts.ready;
  await Promise.all([document.fonts.load('400 120px "Zen Antique"'), document.fonts.load('700 40px "Alegreya Sans"'), document.fonts.load('italic 40px Alegreya')]);
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  const fac = infoFaccao(c.faccao ?? c.ficha?.faccao);
  const espaco = (imagens as Record<string, { arquivo: string }>)[`faccao-${fac?.chave}`] ?? (imagens as Record<string, { arquivo: string }>).hero;
  ctx.fillStyle = '#0c0a09';
  ctx.fillRect(0, 0, W, H);
  try {
    const img = await carregarImagem(link(espaco.arquivo));
    const esc = Math.max(W / img.width, H / img.height);
    ctx.globalAlpha = 0.55;
    ctx.filter = 'grayscale(0.6) sepia(0.4) contrast(1.15)';
    ctx.drawImage(img, (W - img.width * esc) / 2, (H - img.height * esc) / 2, img.width * esc, img.height * esc);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
  } catch { /* sem imagem: fundo liso */ }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(12,10,9,.35)'); g.addColorStop(0.45, 'rgba(12,10,9,.55)'); g.addColorStop(1, 'rgba(12,10,9,.97)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // ideograma gigante
  ctx.fillStyle = 'rgba(168,18,26,.32)';
  ctx.font = '400 760px "Zen Antique"';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(fac?.ideograma ?? '武', -80, 900);

  // corte diagonal
  ctx.strokeStyle = '#d3262c'; ctx.lineWidth = 6;
  ctx.shadowColor = 'rgba(211,38,44,.8)'; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.moveTo(80, 860); ctx.lineTo(1000, 800); ctx.stroke();
  ctx.shadowBlur = 0;

  // selo da seita
  const sx = 860, sy = 80;
  ctx.save(); ctx.translate(sx + 70, sy + 70); ctx.rotate(-0.07);
  ctx.fillStyle = '#a8121a'; ctx.fillRect(-70, -70, 140, 140);
  ctx.strokeStyle = 'rgba(255,220,200,.35)'; ctx.lineWidth = 4; ctx.strokeRect(-60, -60, 120, 120);
  ctx.fillStyle = '#f9e9d8'; ctx.font = '400 96px "Zen Antique"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(fac?.ideograma ?? '武', 0, 6);
  ctx.restore();

  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#bf9a5b'; ctx.font = '700 30px "Alegreya Sans"';
  ctx.fillText('MURIM · CÉU PARTIDO', 80, 120);
  ctx.fillStyle = '#ec5b4f';
  ctx.fillText(`${nomes.faccao(c.faccao ?? c.ficha?.faccao).toUpperCase()}`, 80, 165);
  ctx.fillStyle = '#bfb19a'; ctx.font = '500 30px "Alegreya Sans"';
  ctx.fillText(infoSeita(c.seita ?? c.ficha?.seita)?.nome ?? '', 80, 205);

  // nome
  ctx.fillStyle = '#f5ead6';
  let tam = 128;
  ctx.font = `400 ${tam}px "Zen Antique"`;
  while (ctx.measureText(c.nome).width > 920 && tam > 60) { tam -= 6; ctx.font = `400 ${tam}px "Zen Antique"`; }
  ctx.fillText(c.nome, 80, 990);
  if (c.alcunha) {
    ctx.fillStyle = '#e2c58b'; ctx.font = 'italic 46px Alegreya';
    ctx.fillText(`“${c.alcunha}”`, 80, 1055);
  }
  ctx.fillStyle = '#ece2cf'; ctx.font = '700 36px "Alegreya Sans"';
  ctx.fillText(`${nomes.reino(c.reino).toUpperCase()} · ${nomes.estagio(c.estagio).toUpperCase()}`, 80, 1125);

  // corpo marcial com brilho
  const cp = infoCorpo(c.corpo);
  const cor = COR_RARIDADE[cp?.raridade ?? 'comum'];
  const especial = ['lendario', 'mitico'].includes(cp?.raridade ?? '');
  ctx.font = '400 50px "Zen Antique"';
  const larg = ctx.measureText(cp?.nome ?? '').width + 80;
  ctx.save();
  if (especial) { ctx.shadowColor = cor; ctx.shadowBlur = 40; }
  ctx.strokeStyle = cor; ctx.lineWidth = especial ? 4 : 2;
  ctx.strokeRect(80, 1165, Math.min(920, larg), 110);
  ctx.restore();
  ctx.fillStyle = cor; ctx.font = '700 24px "Alegreya Sans"';
  ctx.fillText(`CORPO ${(cp?.raridade ?? 'comum').replace('lendario', 'lendário').replace('mitico', 'mítico').replace('epico', 'épico').toUpperCase()}`, 120, 1205);
  ctx.fillStyle = especial ? '#fff3dd' : '#ece2cf'; ctx.font = '400 50px "Zen Antique"';
  for (const [i, l] of quebrar(ctx, cp?.nome ?? '', 860).slice(0, 1).entries()) ctx.fillText(l, 120, 1255 + i * 50);

  ctx.fillStyle = '#948772'; ctx.font = '500 24px "Alegreya Sans"';
  ctx.fillText(location.host + link('/'), 80, 1320);
  return new Promise((ok) => cv.toBlob((b) => ok(b!), 'image/png'));
}

export async function baixarCartao(c: Record<string, any>) {
  toast('Pintando o cartão…');
  const blob = await gerarCartao(c);
  const nome = `cartao-${String(c.nome).toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-')}.png`;
  const arq = new File([blob], nome, { type: 'image/png' });
  if (navigator.canShare?.({ files: [arq] })) {
    try { await navigator.share({ files: [arq], title: c.nome }); return; } catch { /* cai para download */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
