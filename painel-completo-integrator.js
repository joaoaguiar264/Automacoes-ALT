// ==UserScript==
// @name         painel-completo-integrator
// @namespace    http://tampermonkey.net/
// @version      10.0
// @description  Painel de Status + Macros (Só aparece dentro do Atendimento)
// @author       
// @match        *://integrator6.alt.com.br/*
// @updateURL    https://raw.githubusercontent.com/joaoaguiar264/Automacoes-ALT/refs/heads/main/painel-completo-integrator.js
// @downloadURL  https://raw.githubusercontent.com/joaoaguiar264/Automacoes-ALT/refs/heads/main/painel-completo-integrator.js
// @icon         none
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- Minhas Configurações ---
    const BOTOES_STATUS = [
        {label: "Em Analise", cor: "#ffc107", texto: "#000000"},
        {label: "Pendente", cor: "#8e44ad", texto: "#ffffff"},
        {label: "Aguardando Informações", cor: "#7f8c8d", texto: "#ffffff"},
        {label: "Em Resolução", cor: "#2980b9", texto: "#ffffff"},
        {label: "Aguardando Encerramento", cor: "#27ae60", texto: "#ffffff"}
    ];

    const BOTOES_ACAO = [
        {
            tipo: "COMENTARIO",
            label: "➕ Coment: Em tratativa",
            cor: "#2c3e50",
            texto: "#ffffff",
            tipoDropdown: "Comentário Padrão",
            mensagem: "Em atendimento via chat."
        }
    ];

    // --- Estilos CSS ---
    const ESTILO_CSS = `
        #painel-botoes-status {
            padding: 10px 0; margin: 10px 0 15px 0; display: flex; gap: 5px;
            flex-wrap: wrap; align-items: center; border-bottom: 1px dashed #ccc;
        }
        .titulo-painel { font-size: 11px; font-weight: bold; color: #777; margin: 0 5px 0 10px; text-transform: uppercase; }
        .btn-status-rapido {
            border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;
            font-size: 12px; font-weight: bold; box-shadow: 0 2px 3px rgba(0,0,0,0.1); transition: all 0.2s;
        }
        .btn-status-rapido:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-status-rapido.processando { cursor: wait; opacity: 0.7; transform: none; }
        .separador { width: 1px; height: 20px; background: #ccc; margin: 0 10px; }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.innerText = ESTILO_CSS;
    document.head.appendChild(styleSheet);

    setInterval(verificarEInjetarBotoes, 1000);

    // --- Lógica de Injeção ---
    function verificarEInjetarBotoes() {
        if (document.getElementById('painel-botoes-status')) return;

        // Trava de Segurança: Só injeto o painel se encontrar abas de atendimento
        // Isso evita bugs na tela de pesquisa
        const abas = document.querySelectorAll('.ui-tabview-title, li[role="presentation"] a');
        let ehTelaAtendimento = false;

        for (let aba of abas) {
            const texto = aba.textContent.trim();
            if (texto === 'Dados' || texto === 'Histórico' || texto === 'Conexão') {
                ehTelaAtendimento = true;
                break;
            }
        }

        if (!ehTelaAtendimento) return;

        // Insiro o painel logo acima do label "Protocolo"
        const labelProtocolo = encontrarLabelPorTexto('Protocolo');
        if (labelProtocolo) {
            let containerAlvo = labelProtocolo.closest('.ui-grid-row') || labelProtocolo.closest('.row') || labelProtocolo.parentElement.parentElement;
            
            if (containerAlvo && containerAlvo.parentElement.classList.contains('ui-panel-content')) {
                 containerAlvo = containerAlvo.parentElement;
            }
            if (containerAlvo) criarPainel(containerAlvo);
        }
    }

    function criarPainel(localInsercao) {
        if(document.getElementById('painel-botoes-status')) return;
        
        const divContainer = document.createElement('div');
        divContainer.id = 'painel-botoes-status';

        divContainer.appendChild(criarTitulo('Status:'));
        BOTOES_STATUS.forEach(conf => {
            const btn = criarBotaoBase(conf);
            btn.onclick = (e) => { e.preventDefault(); executingStatus(conf.label, btn); };
            divContainer.appendChild(btn);
        });

        const sep = document.createElement('div'); sep.className = 'separador'; divContainer.appendChild(sep);

        divContainer.appendChild(criarTitulo('Ações:'));
        BOTOES_ACAO.forEach(conf => {
            const btn = criarBotaoBase(conf);
            btn.onclick = (e) => { e.preventDefault(); executingMacro(btn, conf); };
            divContainer.appendChild(btn);
        });

        localInsercao.insertBefore(divContainer, localInsercao.firstChild);
    }

    function criarTitulo(t) { const s=document.createElement('span'); s.className='titulo-painel'; s.innerText=t; return s; }
    function criarBotaoBase(c) { const b=document.createElement('button'); b.innerText=c.label; b.className='btn-status-rapido'; b.style.backgroundColor=c.cor; b.style.color=c.texto; return b; }

    // --- Macro de Comentário ---
    async function executingMacro(botao, config) {
        const txtOrig = botao.innerText;
        const corOrig = botao.style.backgroundColor;

        botao.innerText = "⏳ ...";
        botao.classList.add('processando');

        try {
            const btnAdd = encontrarElementoPorTexto('span, button', 'Adicionar');
            if(!btnAdd) throw new Error("Botão Adicionar sumiu");
            btnAdd.click();
            await esperar(200);

            const btnComent = encontrarElementoPorTexto('span.ui-menuitem-text', 'Comentário');
            if(!btnComent) throw new Error("Opção Comentário sumiu");
            btnComent.click();

            botao.innerText = "⏳ Janela...";
            await esperar(800);

            // O Pulo do Gato: Busco direto o <select> no HTML e forço o valor
            // Ignoro o componente visual do PrimeNG que é difícil de clicar
            if (config.tipo === "COMENTARIO") {
                const selects = document.querySelectorAll('select.form-control');
                let selectAlvo = null;
                
                for (let sel of selects) {
                    for (let op of sel.options) {
                        if (op.text.trim() === config.tipoDropdown) {
                            selectAlvo = sel;
                            sel.value = op.value;
                            break;
                        }
                    }
                    if (selectAlvo) break;
                }

                if (selectAlvo) {
                    selectAlvo.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    throw new Error("Não achei o campo de Tipo (Select).");
                }
            }
            await esperar(300);

            const textarea = document.querySelector('textarea.form-control') || document.querySelector('.ui-dialog textarea');
            if(textarea) {
                textarea.value = config.mensagem;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
            }

            botao.innerText = "⏳ Salvando...";
            await esperar(500);

            const btnsSalvar = document.querySelectorAll('button');
            let clicou = false;
            
            for (let btn of btnsSalvar) {
                if ((btn.textContent.includes('SALVAR') || btn.textContent.includes('Salvar')) && !btn.disabled) {
                    if(btn.offsetParent !== null) {
                        btn.click();
                        clicou = true;
                        break;
                    }
                }
            }

            if(clicou) {
                botao.innerText = "✅ Feito!";
                botao.style.backgroundColor = "#27ae60";
            } else {
                throw new Error("Botão Salvar bloqueado.");
            }

        } catch (e) {
            console.error(e);
            botao.innerText = "❌ Erro";
            botao.style.backgroundColor = "#c0392b";
            alert("Erro: " + e.message);
        }

        setTimeout(() => {
            botao.innerText = txtOrig;
            botao.classList.remove('processando');
            botao.style.backgroundColor = corOrig;
        }, 2000);
    }

    // --- Mudança de Status ---
    function executingStatus(alvo, btn) {
        const txt = btn.innerText; btn.innerText = "⏳";
        
        // Simulo a navegação do mouse: Mudar -> Status -> Opção
        const btnMudar = encontrarElementoPorTexto('span, button, a', 'Mudar');
        if(btnMudar) {
            btnMudar.click();
            setTimeout(() => {
                const btnStatus = encontrarElementoPorTexto('span, a', 'Status');
                if(btnStatus) {
                    btnStatus.parentElement.dispatchEvent(new MouseEvent("mouseenter", {bubbles: true}));
                    setTimeout(() => {
                        const item = encontrarElementoPorTexto('span.ui-menuitem-text', alvo);
                        if(item) item.click();
                        resetBtn(btn, txt);
                    }, 200);
                } else resetBtn(btn, txt);
            }, 150);
        } else resetBtn(btn, txt);
    }

    // --- Helpers ---
    function resetBtn(b, t) { setTimeout(() => b.innerText = t, 500); }
    function esperar(ms) { return new Promise(r => setTimeout(r, ms)); }
    
    function encontrarElementoPorTexto(sel, txt) { 
        for (let el of document.querySelectorAll(sel)) 
            if (el.textContent.trim() === txt) return el; 
        return null; 
    }
    
    function encontrarLabelPorTexto(txt) { 
        for (let l of document.querySelectorAll('label')) 
            if (l.textContent.includes(txt)) return l; 
        return null; 
    }

})();


