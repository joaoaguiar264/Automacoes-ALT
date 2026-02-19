// ==UserScript==
// @name         Integrator - notificar-novo-atendimento
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Monitora contador no Main e Atendimentos, notifica em aumentos. Atualiza atendimentos a cada 10s simulando botão.
// @author       ALT
// @match        https://integrator6.gegnet.com.br/*
// @grant        GM_notification
// @run-at       document-idle
// @updateURL    https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/notificar-novo-atendimento.user.js
// @downloadURL  https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/notificar-novo-atendimento.user.js
// @icon         https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/icon.png
// ==/UserScript==

(function() {
    'use strict';
    console.log('[Notificador] Script unificado injetado com simulação de botão de atualização!');


    let mainWelcomeSeen = false;
    let lastMainValue = null;
    const MAIN_SELECTOR = '.ui-g-12.conteudo-box > strong';


    let lastAtValue = null;
    let refreshIntervalStarted = false;
    const AT_SELECTOR = 'div[tooltipposition="top"].ng-star-inserted > i.ei.ei-cliente';
    const PENDENTE_SELECTOR = 'span.fa.fa-fw.fa-flag.PENDENTE';

    function notify(title, text) {
        GM_notification({
            title,
            text,
            timeout: 5000,
            onclick: () => window.focus()
        });
    }

    function getMaxMain() {
        const els = document.querySelectorAll(MAIN_SELECTOR);
        const nums = Array.from(els)
                          .map(el => parseInt(el.textContent.trim(), 10))
                          .filter(n => !isNaN(n));
        return nums.length ? Math.max(...nums) : null;
    }

    function getAtCount() {
        return document.querySelectorAll(AT_SELECTOR).length;
    }

    function getPendentes() {
        return document.querySelectorAll(PENDENTE_SELECTOR).length;
    }

    setInterval(() => {
        const hash = window.location.hash || '';


        if (hash === '#/app' || hash === '#/app/' || hash === '') {
            if (!mainWelcomeSeen) {
                const welcome = Array.from(document.querySelectorAll('strong'))
                                     .some(el => el.textContent.includes('Bem-Vindo ao Integrator'));
                if (welcome) {
                    mainWelcomeSeen = true;
                    console.log('[Notificador] MAIN: Welcome detectado.');
                } else return;
            }

            const current = getMaxMain();
            if (current === null) return;

            if (lastMainValue === null) {
                lastMainValue = current;
                console.log(`[Notificador] MAIN: inicializado em ${lastMainValue}`);
                return;
            }

            if (current < lastMainValue) {
                lastMainValue = current;
                console.log(`[Notificador] MAIN: reset para ${current}`);
                return;
            }

            if (current > lastMainValue) {
                console.log(`[Notificador] MAIN: incremento ${lastMainValue}→${current}`);
                lastMainValue = current;
                notify('Novo Atendimento', 'NOVO ATENDIMENTO ABERTO!');
            }
            return;
        }


        if (hash.startsWith('#/app/atendimentos')) {

            if (!refreshIntervalStarted) {
                refreshIntervalStarted = true;
                setInterval(() => {
                    const btn = document.querySelector('button.btn.btn-default > i.glyphicon.glyphicon-refresh')?.parentElement;
                    if (btn) {
                        btn.click();
                        console.log('[Notificador] AT: botão de atualização clicado.');
                    }
                }, 25000); // Atualizado de 10000 para 25000
            }

            const currentAt = getAtCount();
            console.log(`[Notificador] AT: contagem de atendimentos = ${currentAt}`);

            if (lastAtValue === null) {
                lastAtValue = currentAt;
                console.log(`[Notificador] AT: inicializado em ${lastAtValue}`);
                return;
            }

            if (currentAt < lastAtValue) {
                lastAtValue = currentAt;
                console.log(`[Notificador] AT: reset para ${currentAt}`);
                return;
            }

            if (currentAt > lastAtValue) {
                console.log(`[Notificador] AT: incremento ${lastAtValue}→${currentAt}`);
                lastAtValue = currentAt;
                const pendentes = getPendentes();
                const message = `Atualização automática ativada\nAtendimentos pendentes: ${pendentes}`;
                notify('ATUALIZAÇÃO DE ATENDIMENTOS', message);
            }
            return;
        }

    }, 500);
})();
