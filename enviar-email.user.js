// ==UserScript==
// @name         Integrator - enviar-email
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Botão “Enviar E-mail” no menu de atendimento: abre o modal, seleciona modelo, marca leitura obrigatória e só clica em “Finalizar” depois que o botão estiver ativo.
// @author       Luiz Toledo
// @match        *://integrator6.gegnet.com.br/*
// @match        *://integrator6.alt.com.br/*
// @grant        none
// @icon         none
// @updateURL    https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/enviar-email.user.js
// @downloadURL  https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/enviar-email.user.js
// ==/UserScript==

(function() {
    'use strict';

    function criarBotaoEmail() {
        const btn = document.createElement('button');
        btn.id = 'btn-enviar-email-menubar';
        btn.innerText = 'Enviar E-mail - SUP';
        Object.assign(btn.style, {
            margin: '0 5px',
            padding: '6px 10px',
            background: '#0057a3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
        });

        btn.addEventListener('click', async () => {
            const esperar = ms => new Promise(r => setTimeout(r, ms));


            const menuEnviar = [...document.querySelectorAll('a.ui-menuitem-link')]
                .find(a => a.querySelector('span.ui-menuitem-text')?.innerText.trim() === 'Enviar E-mail');
            if (!menuEnviar) return;
            menuEnviar.click();
            await esperar(300);


            const select = document.querySelector('select.feedBackErro');
            if (!select) return;
            const option = [...select.options]
                .find(o => o.text.includes('Como foi nosso atendimento técnico'));
            if (!option) return;
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            await esperar(300);


            const timeout = Date.now() + 10000;
            let btnFinalizar = null;
            while (Date.now() < timeout) {

                btnFinalizar = document.querySelector(
                    'div.ui-dialog button.btn-success.ng-star-inserted'
                );
                if (btnFinalizar && !btnFinalizar.disabled) {
                    btnFinalizar.click();
                    return;
                }
                await esperar(200);
            }
            console.warn('Botão Finalizar não ficou ativo em 10s');
        });

        return btn;
    }

    function inserirBotaoNoMenu() {

        if (!document.querySelector('input[formcontrolname="descri_mvis"]')) return;
        if (document.querySelector('#btn-enviar-email-menubar')) return;
        const container = document.querySelector('div.ui-menubar-custom');
        if (!container) return;
        container.appendChild(criarBotaoEmail());
    }

    new MutationObserver(inserirBotaoNoMenu)
        .observe(document.body, { childList: true, subtree: true });
})();
