// ==UserScript==
// @name         atalho-autoisp
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Insere um botão “AutoISP” acima do Dashboard, com o mesmo estilo nativo do menu lateral do Integrator 6 (GGNET e ALT)
// @author       Luiz Toledo
// @match        https://integrator6.gegnet.com.br/*
// @match        https://integrator6.alt.com.br/*
// @updateURL    https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/atalho-autoisp.user.js
// @downloadURL  https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/atalho-autoisp.user.js
// @icon         none
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const BTN_ID = 'autoisp-menu-item';

    function criarMenuItemAutoISP(url) {
        const li = document.createElement('li');
        li.id = BTN_ID;
        li.className = 'deactivated ng-star-inserted';
        li.setAttribute('role', 'presentation');
        li.setAttribute('data-container', 'body');
        li.setAttribute('data-toggle', 'tooltip');
        li.setAttribute('data-placement', 'right');
        li.setAttribute('title', 'Acessar AutoISP');

        const a = document.createElement('a');
        a.className = 'dropdown';
        a.href = url;
        a.target = '_blank';

        const div = document.createElement('div');
        div.className = 'link ng-star-inserted';

        const span = document.createElement('span');
        span.className = 'fa fa-external-link';

        const texto = document.createTextNode(' AutoISP');

        div.appendChild(span);
        div.appendChild(texto);
        a.appendChild(div);
        li.appendChild(a);

        return li;
    }

    function inserirAcimaDashboard() {

        if (document.getElementById(BTN_ID)) return;


        let dashboardLi = document.getElementById('dashboard-cliente');
        if (!dashboardLi) {
            const divs = Array.from(document.querySelectorAll('div.link.ng-star-inserted'));
            const dashDiv = divs.find(d => d.textContent.trim().startsWith('Dashboard'));
            dashboardLi = dashDiv ? dashDiv.closest('li') : null;
        }
        if (!dashboardLi) return;


        const hash = window.location.hash;
        const match = hash.match(/\/cliente\/(\d+)/);
        if (!match) return;
        const clienteId = match[1];


        const host = window.location.host;
        const domain = host.includes('alt')
            ? 'https://autoisp.gegnet.com.br'
            : 'https://autoisp.gegnet.com.br';

        const url = `${domain}/subscribers/${clienteId}`;


        const novoItem = criarMenuItemAutoISP(url);
        dashboardLi.parentNode.insertBefore(novoItem, dashboardLi);
    }


    const observer = new MutationObserver(inserirAcimaDashboard);
    observer.observe(document.body, { childList: true, subtree: true });


    window.addEventListener('load', inserirAcimaDashboard);
    window.addEventListener('hashchange', inserirAcimaDashboard);
    setInterval(inserirAcimaDashboard, 1000);
})();
