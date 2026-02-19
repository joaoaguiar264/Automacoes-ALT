// ==UserScript==
// @name         MyISP - atalho-pausas
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Insere botões de pausa com timer e notificações periódicas via GM_notification.
// @author       Luiz Toledo
// @match        http://qm.coger.net.br:8080/queuemetrics/*
// @grant        GM_notification
// @updateURL    https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/atalho-pausas.user.js
// @downloadURL  https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/atalho-pausas.user.js
// @icon         https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/icon.png
// ==/UserScript==

(function(){
  'use strict';


  const style = document.createElement('style');
  style.textContent = `
    .GMTE43CCJG { display: none !important; }
    .GMTE43CCKG { width: 360px !important; padding: 8px !important; }
    .GMTE43CCKG table { width: 100% !important; margin: 0 !important; }
    .GMTE43CCKG td { padding: 4px !important; }
    #custom-types { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; margin-bottom: 8px; }
    #custom-controls { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    #custom-controls select.GMTE43CCNG { flex: 1; max-width: 120px; }
    #pause-timer { font-size: 1.0em; color: #919191; border-radius: 3px; min-width: 60px; text-align: center; }
  `;
  document.head.appendChild(style);


  const pausas = { "Almoço": "16", "Café/Água": "27", "Aux NOC": "19", "Acesso Remoto": "17", "Banheiro": "13", "SZ CHAT": "20" };

  const triggerTexts = ["Café/Água", "NOC", "Banheiro"];

  const notificacoes = [600000, 1200000, 1800000, 3600000];
  let timerInterval, pauseStart;
  const alerts = new Set();

  function formatTime(ms) {
    const total = Math.floor(ms/1000);
    const h = Math.floor(total/3600).toString().padStart(2, '0');
    const m = Math.floor((total%3600)/60).toString().padStart(2, '0');
    const s = (total%60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function startTimer() {
    clearInterval(timerInterval);
    pauseStart = Date.now();
    alerts.clear();
    const display = document.getElementById('pause-timer');
    if (display) display.textContent = '00:00:00';
    timerInterval = setInterval(() => {
      const elapsed = Date.now() - pauseStart;
      if (display) display.textContent = formatTime(elapsed);
      const sel = document.querySelector('select.GMTE43CCNG');
      const motivo = sel?.selectedOptions[0].text || '';
      if (triggerTexts.some(sub => motivo.includes(sub))) {
        notificacoes.forEach(ms => {
          if (elapsed >= ms && !alerts.has(ms)) {
            alerts.add(ms);
            GM_notification({
              title: '🔔 Alerta Pausa',
              text: `Pausa "${motivo}" há ${formatTime(ms)}`,
              timeout: 5000
            });
          }
        });
      }
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    const d = document.getElementById('pause-timer'); if (d) d.textContent = '00:00:00';
  }

  async function aplicarPausa(val, nome) {
    const sel = document.querySelector('select.GMTE43CCNG'); if (!sel) return;
    sel.value = val; sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    document.querySelector('button.GMTE43CCIG')?.click();
    startTimer();
  }

  function encerrarPausa() {
    document.querySelectorAll('button.GMTE43CCIG').forEach(b => {
      if (/fim da pausa/i.test(b.innerText)) b.click();
    });
    stopTimer();
  }

  function inserirCustom() {
    const sel = document.querySelector('select.GMTE43CCNG'); if (!sel || document.querySelector('#custom-types')) return;
    const parent = sel.parentNode;

    const types = document.createElement('div'); types.id = 'custom-types';
    Object.entries(pausas).forEach(([nome, val]) => {
      const b = document.createElement('button'); b.innerText = nome;
      Object.assign(b.style, { padding: '4px 8px', fontSize: '0.85em', background: '#00796b', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' });
      b.addEventListener('click', () => aplicarPausa(val, nome));
      types.appendChild(b);
    });
    parent.insertBefore(types, sel);

    const ctr = document.createElement('div'); ctr.id = 'custom-controls'; ctr.appendChild(sel);

    const bf = document.createElement('button'); bf.innerText = 'Fim da Pausa';
    Object.assign(bf.style, { padding: '4px 8px', fontSize: '0.8em', background: '#C62828', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' });
    bf.addEventListener('click', encerrarPausa); ctr.appendChild(bf);

    const bp = document.createElement('button'); bp.innerText = 'Pausa';
    Object.assign(bp.style, { padding: '4px 8px', fontSize: '0.8em', background: '#FFA000', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' });
    bp.addEventListener('click', () => {
      const sel2 = document.querySelector('select.GMTE43CCNG');
      const val = sel2.value;
      const nome = sel2.selectedOptions[0].text;
      aplicarPausa(val, nome);
    }); ctr.appendChild(bp);

    const td = document.createElement('span'); td.id = 'pause-timer'; td.textContent = '00:00:00'; ctr.appendChild(td);
    parent.insertBefore(ctr, types.nextSibling);
  }

  new MutationObserver(inserirCustom).observe(document.body, { childList: true, subtree: true });
})();
