// ==UserScript==
// @name         alerta-fechar-atendimento
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Alerta ao fechar atendimento com motivo "Dúvidas/Informações" no INT6.
// @author
// @match        *://integrator6.gegnet.com.br/*
// @match        *//integrator6.alt.com.br/*
// @updateURL    https://raw.githubusercontent.com/joaoaguiar264/Automacoes-ALT/refs/heads/main/alerta-fechar-atendimento.js
// @downloadURL  https://raw.githubusercontent.com/joaoaguiar264/Automacoes-ALT/refs/heads/main/alerta-fechar-atendimento.js
// @icon         none
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let ultimoMotivoDescricao = null;

    setInterval(() => {
        const campo = document.querySelector('input[formcontrolname="descri_mvis"]');
        if (campo && campo.value) {
            ultimoMotivoDescricao = campo.value.trim().toLowerCase();
        }
    }, 1000);

    document.addEventListener('click', function(e) {
        const link = e.target.closest('a.ui-menuitem-link');
        if (link && link.querySelector('span.ui-menuitem-text')?.innerText.trim() === 'Fechar Atendimento') {
            if (ultimoMotivoDescricao && (ultimoMotivoDescricao.includes('dúvidas') || ultimoMotivoDescricao.includes('informações'))) {
                alert('Atenção: motivo Dúvidas/Informações. Confirme antes de fechar!');
            }
        }
    }, true);
})();
