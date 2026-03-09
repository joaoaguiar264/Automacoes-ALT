// ==UserScript==
// @name         ToolsVGL -> SZ.chat - Notificação Sua vez
// @version      1.0
// @match        *://toolsvgl.gegnet.com.br/fila
// @match        *://clusterscpr.sz.chat/*
// @updateURL    https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/ToolsVGL%20--%20SZ.chat%20-%20Notifica%C3%A7%C3%A3o%20Sua%20vez-1.0.user.js
// @downloadURL  https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/ToolsVGL%20--%20SZ.chat%20-%20Notifica%C3%A7%C3%A3o%20Sua%20vez-1.0.user.js
// @icon         https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/icon.png
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// ==/UserScript==

(function () {
    "use strict";

    ////////////////////////////////////////////////////
    // PARTE 1 — MONITORAR FILA TOOLS
    ////////////////////////////////////////////////////

    if (location.href.includes("fila")) {

        let disparado = false;

        function pegarMeuNome() {
            return document.querySelector(".fw-semibold")?.innerText.trim();
        }

        function verificarFila() {

            const meuNome = pegarMeuNome();
            if (!meuNome) return;

            const linhas = document.querySelectorAll("#fila tbody tr");

            for (const linha of linhas) {

                const usuario = linha.children[1]?.innerText.trim();
                const posicao = linha.children[2]?.innerText.trim();

                if (usuario === meuNome) {

                    if (posicao === "1" && !disparado) {

                        disparado = true;

                        console.log("🚨 SUA VEZ NA FILA");

                        new Audio('https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/sua-vez.mp3').play();

                        GM_setValue("minha_vez", Date.now());

                        notificar("🚨 É sua vez na fila!");
                    }

                    // SE PERDER POSIÇÃO 1
                    if (posicao !== "1" && disparado){

                        disparado = false;

                        console.log("⛔ Não é mais sua vez");

                        GM_setValue("minha_vez", false);

                    }

                    return;
                }
            }
        }

        function notificar(texto) {

            if (Notification.permission === "granted") {
                new Notification(texto);
            } else {
                Notification.requestPermission();
            }

        }

        setInterval(verificarFila, 2000);

    }

    ////////////////////////////////////////////////////
    // PARTE 2 — SZ CHAT
    ////////////////////////////////////////////////////

    if (location.href.includes("sz.chat")) {

        let modoAtivo = false;

        GM_addValueChangeListener("minha_vez", (n,o,v,remote)=>{

            if(!remote) return;

            modoAtivo = v;

            if (modoAtivo) {
                iniciarMonitor();
            } else {
                console.log("🛑 Monitor desativado (não é mais sua vez)");
            }

        });

        ////////////////////////////////////////////////////
        // MONITOR DO SZ CHAT
        ////////////////////////////////////////////////////

        function waitForBadgeEmEspera() {

            return new Promise(resolve => {

                const interval = setInterval(() => {

                    const headers = document.querySelectorAll('.list-header');

                    for (let header of headers) {

                        const texto = header.innerText;

                        if (texto.includes('Em espera')) {

                            const badge = header.querySelector('.badge.text-ellipsis');

                            if (badge) {

                                const numero = parseInt(badge.textContent.trim());

                                if (!isNaN(numero)) {

                                    clearInterval(interval);
                                    resolve(badge);
                                    return;
                                }
                            }
                        }

                    }

                }, 300);

            });

        }

        async function iniciarMonitor() {

            console.log("🟢 Modo atendimento ATIVO");

            const badge = await waitForBadgeEmEspera();

            function getNumero() {
                return parseInt(badge.textContent.trim()) || 0;
            }

            let valorAtual = getNumero();

            console.log("📊 contatos em espera:", valorAtual);

            if (valorAtual > 0) {

                console.log("🚀 Já existem contatos aguardando");

                tocarGongo();

                return;
            }

            const observer = new MutationObserver(() => {

                if (!modoAtivo) return;

                const novoValor = getNumero();

                if (novoValor > valorAtual) {

                    console.log("🚀 NOVO CONTATO!");

                    tocarGongo();
                }

                valorAtual = novoValor;

            });

            observer.observe(badge.parentElement,{
                childList:true,
                subtree:true,
                characterData:true
            });

        }

        function tocarGongo(){

            new Audio("https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/gongo.mp3").play();

            console.log("🥁 GONGO TOCOU - desativando monitor");

            modoAtivo = false;

            GM_setValue("minha_vez", false);

        }

    }

})();
