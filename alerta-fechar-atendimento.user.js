// ==UserScript==
// @name         Integrator - alerta-fechar-atendimento
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Alerta ao fechar atendimento com motivo "Dúvidas/Informações" no INT6.
// @author       Joao Aguiar
// @match        *://integrator6.gegnet.com.br/*
// @match        *//integrator6.alt.com.br/*
// @updateURL    https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/alerta-fechar-atendimento.user.js
// @downloadURL  https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/alerta-fechar-atendimento.user.js
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
