const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["_astro/cartao.Dxj5bktH.js","_astro/global.CV8tprj-.js","_astro/app.D0Q0hGTF.js","_astro/regras.Bor_20To.js"])))=>i.map(i=>d[i]);
import{a as e,c as t,d as n,f as r,g as i,h as a,l as o,o as s,p as c,r as l,t as u,u as d}from"./app.D0Q0hGTF.js";import{E as f,a as p,b as m,c as h,g,n as _,r as v,s as y,t as b,u as x,w as S}from"./regras.Bor_20To.js";import{t as C}from"./textos.DXzAbp-v.js";import{i as w,r as T,t as E}from"./global.CV8tprj-.js";var D=[[62,92],[38,118],[100,128],[112,150],[100,104],[30,146],[128,250],[92,250],[138,92],[162,118],[170,146],[108,300],[100,60],[100,178],[100,210],[100,160],[84,196],[116,196],[90,330],[112,330]];function O(e){let t=[..._.meridianos.principais,..._.meridianos.extraordinarios],n=D.map(([n,r],i)=>{let a=i+1,o=a>12;return`<circle class="ponto ${o?`extra`:``} ${e.includes(a)?`aberto`:``}" cx="${n}" cy="${r}" r="${o?5:6}"><title>${t[i]}${e.includes(a)?` (aberto)`:` (fechado)`}</title></circle>`}).join(``),r=e.filter(e=>e<=12).length,i=e.filter(e=>e>12).length;return`<svg viewBox="0 0 200 360" role="img" aria-label="Meridianos: ${r} de 12 principais e ${i} de 8 extraordinários abertos">
    <path class="canal" d="M100 30 a18 22 0 1 0 0.1 0 M100 74 V220 M100 90 L44 150 L28 200 M100 90 L156 150 L172 200 M100 220 L86 340 M100 220 L114 340 M70 90 H130" />
    ${n}
  </svg>
  <p class="ajuda" style="text-align:center">${r}/12 principais · ${i}/8 extraordinários</p>`}var k={primeiro_passo:`Primeiro Passo`,primeiro_avanco:`Gargalo Rompido`,primeira_vitoria:`Primeiro Sangue`,sobrevivente:`Sobrevivente`,corpo_epico:`Tocado pelo Céu`,dragao:`Nome na Lista`,procurado:`Cabeça a Prêmio`,lenda:`Lenda Viva`};function A(e,t){let i=m(e.pe,e.reino,e.estagio),a=_.reinos.find(t=>t.chave===e.reino),o=a.pe?a.pe[[`inicial`,`intermediario`,`superior`].indexOf(e.estagio)]:0,c=i.proximo&&Number.isFinite(i.proximo.pe)?Math.min(100,(e.pe-o)/Math.max(1,i.proximo.pe-o)*100):100,l=g(e.fama);return`<dl class="numeros">
    <div><dt>PE</dt><dd>${r(e.pe)}<small>${i.proximo?`faltam ${r(i.falta)} para ${s(n.reino(i.proximo.reino))} ${s(n.estagio(i.proximo.estagio))}${i.precisaGargalo?` (gargalo)`:``}`:`topo`}</small></dd><div class="progresso-pe"><span style="width:${c}%"></span></div></div>
    <div><dt>PA livre</dt><dd>${r(e.pa)}<small>teto ${r(a.teto??0)} por atributo</small></dd></div>
    <div><dt>Vida</dt><dd>${r(t.vida)}</dd></div>
    <div><dt>Qi</dt><dd>${r(e.qi_max)}<small>${Math.floor(e.qi_max/100)} anos de energia</small></dd></div>
    <div><dt>Taéis</dt><dd>${r(e.taeis)}</dd></div>
    <div><dt>Corrupção</dt><dd>${e.corrupcao}<small>${e.corrupcao>=75?`voz dupla`:e.corrupcao>=50?`veias escuras`:e.corrupcao>=25?`olhos avermelhados`:`sem marcas`}</small></dd><div class="corrup"><span style="left:${e.corrupcao}%"></span></div></div>
    <div><dt>Fama</dt><dd>${r(e.fama)}<small>${s(l.nivel)}</small></dd></div>
    <div><dt>Infâmia</dt><dd>${r(e.infamia)}<small>${e.infamia>=1500?`cabeça a prêmio`:``}</small></dd></div>
    <div><dt>Contribuição</dt><dd>${r(e.contribuicao)}</dd></div>
    <div><dt>Região</dt><dd style="font-size:1rem">${s(e.regiao??`—`)}</dd></div>
    <div><dt>Leituras</dt><dd>${e.leituras}<small>${e.fios}/40 Fios</small></dd></div>
    <div><dt>Fichas</dt><dd style="font-size:1rem">${s(n.status(e.status))}</dd></div>
  </dl>`}function j(t,i,a){let o=t.ficha??{},c=y(o,t.corpo,t.linhagem_rara,t.reino,t.qi_max),u=n.raridadeCorpo(t.corpo),d=x(t.faccao??o.faccao),p=(o.tecnicas??[]).map(e=>`<li><pre class="texto-pronto" style="max-height:none;margin:0">${s(S(e))}</pre></li>`).join(``);return`
  <header class="perfil-cabeca">
    <span class="fantasma-ideograma" aria-hidden="true">${s(d?.ideograma??`人`)}</span>
    <p class="rotulo">${s(n.faccao(t.faccao??o.faccao))} · ${s(n.seita(t.seita??o.seita))}</p>
    <h1>${s(t.nome)}</h1>
    ${t.alcunha?`<p class="alcunha">“${s(t.alcunha)}”</p>`:``}
    <div class="linha-flex">
      <span class="rotulo ouro">${s(n.reino(t.reino))} · ${s(n.estagio(t.estagio))}</span>
      <span class="corpo-destaque r-${u}"><span class="raridade">${s(l[u])}${c.selado?` · selado`:``}</span><strong>${s(n.corpo(t.corpo))}</strong></span>
    </div>
    ${t.vivo?``:`<p class="memorial">${s(t.causa_morte??`Tombou no Jianghu.`)}${t.morto_em?` — ${new Date(t.morto_em).toLocaleDateString(`pt-BR`)}`:``}</p>`}
    <div class="linha-flex">
      <button class="btn fantasma pequeno" id="copiar-link">Copiar link do perfil</button>
      <button class="btn fantasma pequeno" id="copiar-ficha">Copiar ficha para o WhatsApp</button>
      <button class="btn pequeno" id="gerar-cartao">Gerar cartão</button>
    </div>
  </header>
  ${A(t,c)}
  <div class="perfil-grade">
    <div>
      ${i?`<section class="bloco acoes-dono" id="acoes"></section>`:``}
      <section class="bloco"><h2>Atributos</h2>
        <table class="tabela-mini"><tbody>${b.map(e=>`<tr><th>${v[e]}</th><td class="num">${r(c.atributos[e])}</td><td class="num sutil">base ${r(Number(o.atributos?.[e]??0))}</td></tr>`).join(``)}</tbody></table>
      </section>
      <section class="bloco"><h2>Artes</h2>
        <p><strong>${s(o.arteInterna?.nome??`—`)}</strong> <span class="mudo">(${s(_.elementos[o.arteInterna?.natureza??``]??`—`)})</span><br>${s(o.arteInterna?.passiva??``)}</p>
        <ul class="lista-simples">${p}</ul>
        <p style="margin-top:1rem"><strong>Arma:</strong> ${s(o.arma?.nome??`—`)}</p>
      </section>
      <section class="bloco"><h2>Diário</h2>
        <ol class="diario">${a.diario.map(t=>`<li><time>${e(t.criado_em)}</time>${s(t.texto)}</li>`).join(``)||`<li>Nada registrado ainda.</li>`}</ol>
      </section>
    </div>
    <div>
      <section class="bloco meridianos"><h2>Meridianos</h2>${O(t.meridianos??[])}</section>
      <section class="bloco"><h2>Origem e sangue</h2>
        <ul class="lista-simples">
          <li><strong>Linhagem:</strong> ${s(n.linhagem(t.linhagem??o.linhagem))}${t.linhagem_rara?` + ${s(n.linhagem(t.linhagem_rara))}`:``}</li>
          <li><strong>Origem:</strong> ${s(n.origem(t.origem??o.origem))}</li>
          <li><strong>Raiz de Qi:</strong> ${s(n.raiz(t.raiz))}</li>
          <li><strong>Talentos:</strong> ${(o.talentos?.vantagens??[]).map(e=>s(f(e)?.nome)).join(`, `)||`—`}</li>
          <li><strong>Desvantagens:</strong> ${(o.talentos?.desvantagens??[]).map(e=>s(h(e)?.nome)).join(`, `)||`—`}</li>
          <li><strong>Idade:</strong> ${s(o.idade??`—`)}</li>
        </ul>
      </section>
      <section class="bloco"><h2>Ferimentos</h2><ul class="lista-simples">${(t.ferimentos??[]).map(e=>`<li>${s(e.texto??e.tipo)}${e.ate?` <span class="sutil">até ${new Date(e.ate).toLocaleDateString(`pt-BR`)}</span>`:``}</li>`).join(``)||`<li class="mudo">Ileso.</li>`}</ul></section>
      <section class="bloco"><h2>Inventário</h2><ul class="lista-simples">${(t.inventario??[]).map(e=>`<li>${s(typeof e==`string`?e:`${e.nome}${e.qtd>1?` ×${e.qtd}`:``}`)}</li>`).join(``)||`<li class="mudo">Vazio.</li>`}</ul></section>
      <section class="bloco"><h2>Afinidades</h2><ul class="lista-simples">${Object.entries(t.afinidades??{}).map(([e,t])=>`<li>${s(e)}: <strong>${s(t)}</strong>/100</li>`).join(``)||`<li class="mudo">Nenhum mestre por perto.</li>`}</ul></section>
      <section class="bloco"><h2>Conquistas</h2>${a.conquistas.map(e=>`<span class="conquista">✦ ${s(k[e.chave]??e.chave)}</span>`).join(``)||`<p class="mudo">Nenhuma ainda.</p>`}</section>
      ${o.aparencia||o.historia?`<section class="bloco"><h2>Quem é</h2>${o.aparencia?`<p>${s(o.aparencia)}</p>`:``}${o.personalidade?`<p>${s(o.personalidade)}</p>`:``}${o.historia?`<p class="mudo">${s(o.historia).replace(/\n/g,`<br>`)}</p>`:``}</section>`:``}
    </div>
  </div>`}function M(t,n){let i=_.reinos.find(e=>e.chave===t.reino),a=t.estagio===`superior`;return`<h2>Ações</h2>
    <div class="linha-flex">
      <a class="btn fantasma pequeno" href="${o(`/conta/leitura/?id=${t.id}`)}">Leitura do Destino (${t.leituras})</a>
      ${t.gargalo_liberado?`<button class="btn pequeno" id="rolar-gargalo">Rolar o gargalo (3d6 oficial)</button>`:``}
    </div>
    <div id="resultado-gargalo"></div>
    ${t.pa>0?`<details class="painel"><summary><strong>Distribuir ${t.pa} PA</strong> (teto ${r(i.teto??0)})</summary>
      <form id="form-pa" class="grade-campos cinco" style="margin-top:1rem">${b.map(e=>`<div class="campo"><label for="pa-${e}">${v[e]}</label><input type="number" id="pa-${e}" data-attr="${e}" min="0" step="10" value="0" /></div>`).join(``)}
      <button class="btn pequeno" type="submit">Aplicar</button></form></details>`:``}
    <details class="painel" ${t.vivo?`open`:``}><summary><strong>Enviar treino ou missão</strong></summary>
      <form id="form-envio" style="margin-top:1rem">
        <div class="grade-campos">
          <div class="campo"><label for="env-tipo">Tipo</label><select id="env-tipo">
            <option value="treino">Treino (20+ linhas)</option><option value="missao_facil">Missão fácil (40+)</option>
            <option value="missao_media">Missão média (60+)</option><option value="missao_dificil">Missão difícil (80+)</option>
            ${a?`<option value="pedido_avanco">Pedido de avanço (40+)</option>`:``}</select></div>
          <div class="campo"><label for="env-titulo">Título</label><input id="env-titulo" required minlength="2" maxlength="120" /></div>
          <div class="campo"><label for="env-foco">Foco do treino</label><input id="env-foco" maxlength="120" placeholder="Ex.: Guarda da Nuvem Parada" /></div>
        </div>
        <div class="campo"><label for="env-texto">Texto (cole aqui)</label><textarea id="env-texto" rows="12" required></textarea>
          <p class="contagem-linhas" id="contagem" aria-live="polite">0 linhas</p></div>
        <button class="btn" type="submit">Enviar para a fila</button>
      </form>
    </details>
    <details class="painel"><summary><strong>Meus envios (${n.length})</strong></summary>
      <div class="tabela-rolagem"><table class="tabela-mini"><thead><tr><th>Data</th><th>Tipo</th><th>Título</th><th>Linhas</th><th>Status</th><th>PE</th></tr></thead><tbody>
      ${n.map(t=>`<tr><td>${e(t.criado_em)}</td><td>${s(t.tipo.replace(`_`,` `))}</td><td>${s(t.titulo)}${t.nota_admin?`<br><small class="mudo">${s(t.nota_admin)}</small>`:``}</td><td class="num">${t.linhas}</td><td>${s(t.status)}</td><td class="num">${t.pe_concedido??`—`}</td></tr>`).join(``)||`<tr><td colspan="6" class="mudo">Nenhum envio.</td></tr>`}
      </tbody></table></div>
    </details>`}function N(e){let n={treino:20,missao_facil:40,missao_media:60,missao_dificil:80,pedido_avanco:40},r=u(`#env-tipo`),a=u(`#env-texto`),o=()=>{if(!r||!a)return;let e=p(a.value),t=n[r.value],i=u(`#contagem`);i.textContent=`${e} linhas de ${t} necessárias`,i.className=`contagem-linhas ${e>=t?`ok`:`erro`}`,u(`#env-foco`).closest(`.campo`).toggleAttribute(`hidden`,r.value!==`treino`)};r?.addEventListener(`change`,o),a?.addEventListener(`input`,o),o(),document.querySelector(`#form-envio`)?.addEventListener(`submit`,async t=>{t.preventDefault();let{error:n}=await i.rpc(`enviar_texto`,{p_personagem:e.id,p_tipo:r.value,p_titulo:u(`#env-titulo`).value,p_foco:u(`#env-foco`).value,p_texto:a.value});if(n)return T(d(n),!0);T(`Enviado! Está na fila de aprovação.`),setTimeout(()=>location.reload(),900)}),document.querySelector(`#form-pa`)?.addEventListener(`submit`,async t=>{t.preventDefault();let n={};document.querySelectorAll(`#form-pa input[data-attr]`).forEach(e=>{Number(e.value)>0&&(n[e.dataset.attr]=Number(e.value))});let{error:r}=await i.rpc(`distribuir_pa`,{p_id:e.id,p_atributos:n});if(r)return T(d(r),!0);T(`PA distribuído.`),setTimeout(()=>location.reload(),800)}),document.querySelector(`#rolar-gargalo`)?.addEventListener(`click`,async n=>{if(confirm(`Fazer a rolagem oficial do gargalo agora? Ela fica registrada e não pode ser refeita.`)){n.target.disabled=!0;try{let n=await t(`gargalo`,{personagem:e.id}),r=n.resultado===`avanco`?`AVANÇOU!`:n.resultado===`falha`?`Falhou sem dano. Tente de novo em 1 semana.`:`DESVIO DE QI: ${n.desvio?.nome} — ${n.desvio?.texto}`;u(`#resultado-gargalo`).innerHTML=`<div class="painel"><p class="rotulo">3d6 oficial</p><p style="font:400 2rem var(--f-display);margin:.3rem 0">${n.dados.join(` + `)} ${n.modificadores.total>=0?`+`:`−`} ${Math.abs(n.modificadores.total)} = ${n.total}</p>
        <p><strong>${s(r)}</strong></p><ul>${n.modificadores.lista.map(e=>`<li>${s(e.motivo)}: ${e.valor>0?`+`:``}${e.valor}</li>`).join(``)}</ul>
        ${n.desvio?`<p class="mudo">1d6 de Desvio: ${n.desvio.dados.join(`, `)}</p>`:``}<button class="btn pequeno" onclick="location.reload()">Atualizar ficha</button></div>`}catch(e){T(e.message,!0),n.target.disabled=!1}}})}async function P(){let e=c(`id`),t=u(`#perfil`),{data:r}=await i.from(`personagens`).select(`*`).eq(`id`,e).maybeSingle();if(!r){t.innerHTML=`<h1>Personagem não encontrado</h1><p>Ele pode ainda não ter sido aprovado, ou o link está errado.</p>`;return}let l=(await a())?.user.id===r.dono,[{data:d},{data:f},p]=await Promise.all([i.from(`diario`).select(`*`).eq(`personagem`,r.id).order(`criado_em`,{ascending:!1}).limit(60),i.from(`conquistas`).select(`*`).eq(`personagem`,r.id),l?i.from(`envios`).select(`id, tipo, titulo, linhas, status, pe_concedido, nota_admin, criado_em`).eq(`personagem`,r.id).order(`criado_em`,{ascending:!1}):Promise.resolve({data:[]})]);document.title=`${r.nome} · Murim: Céu Partido`,t.classList.toggle(`morto`,!r.vivo),t.innerHTML=j(r,l,{diario:d??[],conquistas:f??[],envios:p.data??[]}),l&&r.status===`aprovada`&&r.vivo?(u(`#acoes`).innerHTML=M(r,p.data??[]),N(r)):l&&(u(`#acoes`).innerHTML=`<p class="nota">Ficha ${s(n.status(r.status).toLowerCase())}. <a href="${o(`/conta/ficha/?id=${r.id}`)}">Abrir no criador</a></p>`),u(`#copiar-link`).onclick=()=>E(location.href,`Link copiado.`),u(`#copiar-ficha`).onclick=()=>E(C(r)),u(`#gerar-cartao`).onclick=async()=>(await w(async()=>{let{baixarCartao:e}=await import(`./cartao.Dxj5bktH.js`);return{baixarCartao:e}},__vite__mapDeps([0,1,2,3]))).baixarCartao(r)}P();