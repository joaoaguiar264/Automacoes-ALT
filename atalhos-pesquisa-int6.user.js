// ==UserScript==
// @name         Integrator - atalhos-pesquisa-int6
// @version      1.0
// @description  Adiciona botões de atalho para seleção rápida de Nome | Código | CPF | CNPJ na pesquisa de clientes
// @author       Luiz Toledo
// @match        https://integrator6.gegnet.com.br/*
// @match        https://integrator6.alt.com.br/*
// @grant        none
// @updateURL    https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/atalhos-pesquisa-int6.user.js
// @downloadURL  https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/atalhos-pesquisa-int6.user.js
// @icon         none

// ==/UserScript==

(function() {
    'use strict';

    console.log('[AtalhosPesquisa] script iniciado');

    const campos = [
        { label: 'Nome',            value: 'nome_cli'     },
        { label: 'Código',          value: 'codcli'       },
        { label: 'CPF',             value: 'cpf'          },
        { label: 'CNPJ',            value: 'cnpj'         },
        { label: 'E-mail',  value: 'cl.e_mail'    },
        { label: 'PPPoe',  value: 'l.login'    }
    ];

    function inserirBotoes() {
        const titulo = Array.from(document.querySelectorAll('.panel-title'))
                             .find(el => el.textContent.includes('Pesquisar Cliente'));
        if (!titulo) return;

        const form = document.querySelector('form.form-horizontal');
        if (!form) return;
        if (document.getElementById('search-shortcuts')) return;
        console.log('[AtalhosPesquisa] inserindo botões acima da barra de pesquisa');

        const wrapper = document.createElement('div');
        wrapper.id = 'search-shortcuts';
        wrapper.style.display = 'flex';
        wrapper.style.flexWrap = 'wrap';
        wrapper.style.gap = '6px';
        wrapper.style.marginBottom = '8px';
        wrapper.style.alignItems = 'center';

        campos.forEach(({ label, value }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = label;
            btn.className = 'btn btn-primary';
            btn.style.padding = '4px 8px';
            btn.addEventListener('click', () => {
                const selectCampo = document.querySelector('select[formcontrolname="campo"], select#campo');
                if (selectCampo) {
                    selectCampo.value = value;
                    selectCampo.dispatchEvent(new Event('change', { bubbles: true }));
                }
                const inputValor = document.querySelector('input[formcontrolname="valor"], input#valor');
                if (inputValor) inputValor.focus();
            });
            wrapper.appendChild(btn);
        });

        form.insertBefore(wrapper, form.firstChild);
    }

    const observer = new MutationObserver(inserirBotoes);
    observer.observe(document.body, { childList: true, subtree: true });
})();
