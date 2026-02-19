// ==UserScript==
// @name         Integrator - painel-regionais
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Barra arrastável, Cidades Exatas e Correção de Seleção
// @author       Gemini
// @match        https://integrator6.alt.com.br/*
// @updateURL    https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/painel-regionais.user.js
// @downloadURL  https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/painel-regionais.user.js
// @icon         none
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. CONFIGURAÇÃO (NOMES EXATOS) ---
    const LOGISTICAS = [
        { nome: "CCO", cor: "#d1ecf1", cidades: ["CHAPECÓ"] },
        { nome: "JBA", cor: "#ffeeba", cidades: ["JOAÇABA", "HERVAL D'OESTE", "CATANDUVAS", "LAGES", "LUZERNA"] },
        { nome: "MFA", cor: "#c3e6cb", cidades: ["MAFRA", "RIO NEGRO", "RIO NEGRINHO", "SÃO BENTO DO SUL"] },
        { nome: "CTA", cor: "#f5c6cb", cidades: ["CURITIBA", "PINHAIS", "SÃO JOSÉ DOS PINHAIS", "PIRAQUARA", "ITAPERUÇU", "RIO BRANCO DO SUL"] },
        { nome: "PYE", cor: "#e2e3e5", cidades: ["PIÊN", "MANDIRITUBA", "AGUDOS DO SUL", "CAMPO ALEGRE", "QUITANDINHA"] }
    ];

    let timeoutValidacao = null;

    // --- 2. INJEÇÃO DE ESTILOS CSS (A MÁGICA DA SELEÇÃO) ---
    // Aqui criamos regras que pintam a linha, MAS param de pintar se ela for selecionada (.info, .selected, etc)
    const styleSheet = document.createElement("style");
    let cssRules = `
        /* Estilo base para os textos ficarem legíveis */
        tr[class*='tm-log-'] td { font-weight: 600 !important; color: #333 !important; }
    `;

    LOGISTICAS.forEach(log => {
        // A regra :not(.info):not(.selected) garante que se o sistema selecionar a linha, nossa cor sai
        cssRules += `
            tr.tm-log-${log.nome}:not(.info):not(.selected):not(.ui-state-highlight) td {
                background-color: ${log.cor} !important;
            }
            /* Opcional: borda colorida mesmo quando selecionado para saber de onde é */
            tr.tm-log-${log.nome}.info td, tr.tm-log-${log.nome}.selected td {
                border-left: 5px solid ${log.cor} !important;
            }
        `;
    });
    styleSheet.innerText = cssRules;
    document.head.appendChild(styleSheet);


    // --- 3. FUNÇÃO DE ARRASTAR ---
    function tornarArrastavel(elemento) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        elemento.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
            elemento.style.cursor = 'grabbing';
            elemento.style.transition = 'none';
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            elemento.style.top = (elemento.offsetTop - pos2) + "px";
            elemento.style.left = (elemento.offsetLeft - pos1) + "px";
            elemento.style.right = 'auto';
            elemento.style.bottom = 'auto';
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
            elemento.style.cursor = 'grab';
            elemento.style.opacity = '1';
        }
    }

    // --- 4. ATUALIZAR PAINEL ---
    function atualizarPainel(contagem, total) {
        let painel = document.getElementById('painel-logistica-alt');

        if (!painel) {
            painel = document.createElement('div');
            painel.id = 'painel-logistica-alt';

            Object.assign(painel.style, {
                position: 'fixed',
                top: '6px',
                right: '350px',
                backgroundColor: '#2d3436',
                color: '#dfe6e9',
                padding: '5px 15px',
                borderRadius: '20px',
                fontFamily: 'Segoe UI, sans-serif',
                fontSize: '12px',
                zIndex: '999999',
                boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '15px',
                cursor: 'grab',
                opacity: '0.8',
                transition: 'opacity 0.3s',
                whiteSpace: 'nowrap',
                border: '1px solid #444'
            });

            painel.onmouseenter = () => { painel.style.opacity = '1'; };
            painel.onmouseleave = () => { painel.style.opacity = '0.8'; };

            document.body.appendChild(painel);
            tornarArrastavel(painel);
        }

        let html = `<div style="display:flex; align-items:center; border-right:1px solid #555; padding-right:10px;">
                      <span style="font-weight:bold; color:#00b894;">TOTAL: ${total}</span>
                    </div>`;

        let itensLogistica = "";
        LOGISTICAS.forEach(log => {
            if (contagem[log.nome] > 0) {
                itensLogistica += `<div style="display:flex; align-items:center;">
                                     <span style="width:8px; height:8px; background-color:${log.cor}; border-radius:50%; margin-right:5px; box-shadow:0 0 2px #fff;"></span>
                                     <span style="font-weight:600; color:${log.cor}; filter:brightness(1.1);">${log.nome}: ${contagem[log.nome]}</span>
                                   </div>`;
            }
        });

        if (total === 0) {
            html += `<span style="font-style:italic; opacity:0.6;">Sem atendimentos</span>`;
        } else {
            html += `<div style="display:flex; gap:12px;">${itensLogistica}</div>`;
        }

        if (painel.innerHTML !== html) painel.innerHTML = html;
    }

    // --- 5. PROCESSAR TABELA (COM CLASSES CSS) ---
    function processarTabela() {
        const linhas = document.querySelectorAll('tbody tr');
        let totalGeral = 0;
        let contagem = {};
        LOGISTICAS.forEach(l => contagem[l.nome] = 0);

        if (linhas.length === 0) {
            atualizarPainel(contagem, 0);
            return;
        }

        let indiceCidade = -1;
        const headers = document.querySelectorAll('th');
        headers.forEach((th, i) => {
            if (th.innerText && th.innerText.toUpperCase().includes('CIDADE')) indiceCidade = i;
        });
        if (indiceCidade === -1) indiceCidade = 4;

        linhas.forEach(linha => {
            const celulas = linha.querySelectorAll('td');
            if (celulas.length > indiceCidade) {
                // 1. Limpa espaços e coloca em maiúsculo
                const textoCidade = celulas[indiceCidade].innerText.trim().toUpperCase();

                let logEncontrada = null;
                for (let i = 0; i < LOGISTICAS.length; i++) {
                    const log = LOGISTICAS[i];
                    // 2. CORREÇÃO: Comparação EXATA (===) em vez de 'includes'
                    // Isso impede que "Curitibanos" ative "Curitiba"
                    if (log.cidades.some(c => textoCidade === c)) {
                        logEncontrada = log;
                        break;
                    }
                }

                if (logEncontrada) {
                    // 3. MUDANÇA: Em vez de pintar com .style, adicionamos uma CLASSE
                    // Se a linha já tiver a classe, não fazemos nada (performance)
                    if (!linha.classList.contains(`tm-log-${logEncontrada.nome}`)) {
                        // Remove classes antigas de outras logísticas (caso mude)
                        LOGISTICAS.forEach(l => linha.classList.remove(`tm-log-${l.nome}`));

                        // Adiciona a classe da logística certa
                        linha.classList.add(`tm-log-${logEncontrada.nome}`);
                    }
                    contagem[logEncontrada.nome]++;
                    totalGeral++;
                }
            }
        });
        atualizarPainel(contagem, totalGeral);
    }

    // --- 6. OBSERVADOR ---
    const observer = new MutationObserver((mutations) => {
        if (timeoutValidacao) clearTimeout(timeoutValidacao);
        timeoutValidacao = setTimeout(() => {
            if (document.querySelector('tbody')) processarTabela();
        }, 300);
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: false });
    setTimeout(processarTabela, 1500);

})();
