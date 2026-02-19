// ==UserScript==
// @name         Coletar Dados ONU
// @namespace    http://tampermonkey.net/
// @version      4.0
// @author       Ayano/Hiyori
// @description  Coleta dados das tabelas corretas da ONU com botão customizado + estados avançados de RX
// @match        https://autoisp.gegnet.com.br/contracted_services/*
// @match        https://autoisp.gegnet.com.br/gpon_clients/*
// @match        https://autoisp.acessoline.net.br/contracted_services/*
// @match        https://autoisp.acessoline.net.br/gpon_clients/*
// @grant        GM_setClipboard
// @icon         https://preview.redd.it/vector-remake-of-outer-wilds-ventures-logo-v0-mu1zldbvn7od1.png?width=1080&crop=smart&auto=webp&s=1be922bc3413d1f3d9c6ba703a63ada9acbabfdf

// ==/UserScript==

(function() {
    'use strict';

    // 🔎 Acha exclusivamente a tabela T2 (a que contém <th>OLT</th>)
    function getTableT2() {
        const tables = document.querySelectorAll("table");
        for (const table of tables) {
            const thOLT = [...table.querySelectorAll("th")].find(x => x.textContent.trim() === "OLT");
            if (thOLT) return table;
        }
        return null;
    }

    // 🔎 Acha exclusivamente a tabela T1 (a que contém "Atenuação Rx ONU")
    function getTableT1() {
        const tables = document.querySelectorAll("table");
        for (const table of tables) {
            const th = [...table.querySelectorAll("th")].find(x => x.textContent.includes("Atenuação Rx ONU"));
            if (th) return table;
        }
        return null;
    }

    // 🔧 Função pegar valores da T2
    function getByThFromT2(label) {
        const table = getTableT2();
        if (!table) return "";
        const ths = table.querySelectorAll("th");
        for (const th of ths) {
            if (th.textContent.trim() === label) {
                const td = th.parentElement.querySelector("td");
                return td ? td.innerText.trim() : "";
            }
        }
        return "";
    }

    // 🔧 Nome da OLT (vem do <a>)
    function getOLTName() {
        const table = getTableT2();
        if (!table) return "";
        const thOLT = [...table.querySelectorAll("th")].find(x => x.textContent.trim() === "OLT");
        if (!thOLT) return "";
        const link = thOLT.parentElement.querySelector("td a");
        return link ? link.textContent.trim() : "";
    }

    // 🔧 Valores da T1
    function getByThFromT1(label) {
        const table = getTableT1();
        if (!table) return "";
        const ths = table.querySelectorAll("th");
        for (const th of ths) {
            if (th.textContent.trim() === label) {
                const td = th.parentElement.querySelector("td");
                return td ? td.innerText.trim() : "";
            }
        }
        return "";
    }

    // -----------------------------------
    // 🔥 DETECÇÃO REAL DOS 4 ESTADOS RX
    // -----------------------------------
    function getStatusONU() {

        if (document.querySelector(".status-small.status-loss-signal")) {
            return "LOS";
        }

        if (document.querySelector(".status-small.status-rx-critical")) {
            return "Atenuação Grave";
        }

        if (document.querySelector(".status-small.status-rx-warning")) {
            return "Levemente Atenuado";
        }

        if (document.querySelector(".status-small.status-rx-ok")) {
            return "UP";
        }

        return "Desconhecido";
    }

    // 🔥 Captura correta do valor Rx ONU para todos os estados
    function getRxONU() {

        let div =
            document.querySelector(".status-small.status-loss-signal") ||
            document.querySelector(".status-small.status-rx-critical") ||
            document.querySelector(".status-small.status-rx-warning") ||
            document.querySelector(".status-small.status-rx-ok");

        if (!div) return "";

        // LOS não tem sinal
        if (div.classList.contains("status-loss-signal")) {
            return "LOS";
        }

        return div.textContent.trim();
    }

    // -------------------------------
    // 🔧 Coleta final formatada
    // -------------------------------
    function coletarDados() {

        // T2
        const descricao = getByThFromT2("Descrição na OLT");
        const olt = getOLTName();
        const pon = getByThFromT2("PON Link");
        const onuId = getByThFromT2("ONU ID");
        const servicePort = getByThFromT2("Service Port");
        const vlan = getByThFromT2("VLAN (do perfil)");

        // T1
        const modelo = getByThFromT1("Modelo de ONU");
        const firmware = getByThFromT1("Firmware da ONU");
        const uptime = getByThFromT1("Uptime da ONU");

        const attONU = getRxONU();
        const attOLT = getByThFromT1("Atenuação Rx OLT");
        const statusONU = getStatusONU();

        return `[LOCALIZAÇÃO]
ONU está localizada em ${descricao}
Cliente sobe em OLT: ${olt} - ${pon} - ONU ID: ${onuId}.
Modelo da ONU: ${modelo}
Firmware da ONU: ${firmware}
Service Port: ${servicePort}
VLAN (do perfil): ${vlan}
Uptime: ${uptime}
Status da ONU: ${statusONU}
Atenuação Rx ONU: ${attONU}
Atenuação Rx OLT: ${attOLT}`;
    }

    // ---------------------------------------------
    // Botão na barra de ações
    // ---------------------------------------------
    function addButton() {
        const container = document.querySelector(".general-buttons-wrapper.card-body");
        if (!container) return;

        if (document.querySelector("#btn-copiar-onu")) return;

        const btn = document.createElement("button");
        btn.id = "btn-copiar-onu";
        btn.className = "button-from-general btn btn-primary";
        btn.innerHTML = `<i class="bi bi-clipboard-check icon-with-text"></i> Copiar Dados ONU`;

        btn.addEventListener("click", () => {
            GM_setClipboard(coletarDados());
            alert("Dados da ONU copiados!");
        });

        container.appendChild(btn);
    }

    // Observa alterações para inserir o botão
    const obs = new MutationObserver(() => addButton());
    obs.observe(document.body, { childList: true, subtree: true });

})();
