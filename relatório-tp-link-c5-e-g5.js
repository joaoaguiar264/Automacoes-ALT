// ==UserScript==
// @name         relatório-tp-link-c5-e-g5
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Coleta modelo, dispositivos, DNS, largura de canal, UPnP e uptime do Archer/EX automaticamente.
// @author       
// @match        *://*/*
// @updateURL    https://raw.githubusercontent.com/joaoaguiar264/Automacoes-ALT/main/relatório-tp-link-c5-e-g5.js
// @downloadURL  https://raw.githubusercontent.com/joaoaguiar264/Automacoes-ALT/main/relatório-tp-link-c5-e-g5.js
// @icon         none
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const $ = (sel, root=document) => root.querySelector(sel);
    const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

    const extractCount = text => {
        const m = text.match(/\((\d+)\)/) || text.match(/^(\d+)$/);
        return m ? parseInt(m[1], 10) : 0;
    };

    function getFieldValueOrText(el) {
        if (!el) return '';
        if (el.tagName === 'SELECT') {
            const opt = el.selectedOptions && el.selectedOptions[0];
            if (opt && opt.textContent) return opt.textContent.trim();
            if (el.value) return String(el.value).trim();
            return '';
        }
        if ('value' in el && el.value != null) return String(el.value).trim();
        return (el.textContent || '').trim();
    }

    async function waitFor(sel, timeout=6000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const el = $(sel);
            if (el) return el;
            await sleep(120);
        }
        return null;
    }

    function looksOn(el) {
        if (!el) return null;
        const t = (el.textContent || '').toLowerCase();
        const cls = el.className || '';
        if (typeof el.checked === 'boolean') return el.checked;
        if (/(on|selected|enable|enabled|ligado|habilitado)/i.test(t)) return true;
        if (/(off|disabled|desabilitado|desligado)/i.test(t)) return false;
        if (/tp-switch-on|switch-on|is-on|active|selected/.test(cls)) return true;
        if (/tp-switch-off|switch-off|inactive/.test(cls)) return false;
        const aria = el.getAttribute && (el.getAttribute('aria-checked') || el.getAttribute('aria-selected'));
        if (aria != null) return aria === 'true';
        return null;
    }

    async function getUPnPStatus() {
        const candidates = [
            '#upnp_on', '#upnp_off', '#upnp_enable', '#upnp-switch',
            'input[id*="upnp"]', 'input[name*="upnp"]', '[class*="upnp"]',
            '[data-setting*="upnp"]'
        ];
        for (const c of candidates) {
            const els = $$(c);
            for (const el of els) {
                const v = looksOn(el);
                if (v === true) return 'Habilitado';
                if (v === false) return 'Desabilitado';
            }
        }
        const upnpNodes = $$('*').filter(n => /upnp/i.test(n.textContent || ''));
        for (const n of upnpNodes) {
            const near = [n, n.parentElement, n.nextElementSibling].filter(Boolean);
            for (const x of near) {
                const v = looksOn(x);
                if (v === true) return 'Habilitado';
                if (v === false) return 'Desabilitado';
                const chk = $('input[type="checkbox"]', x);
                if (chk) return chk.checked ? 'Habilitado' : 'Desabilitado';
            }
        }
        return 'N/A';
    }

    function extractUptimeFromText(s) {
        const m = s.match(/(?:up\s*time|uptime|run\s*time|runtime|tempo\s*de\s*atividade|tempo\s*de\s*funcionamento)\s*[:\-]?\s*([^\n\r]+)/i);
        return m && m[1] ? m[1].trim() : null;
    }

    async function getUptime() {
        const idCandidates = ['#UpTime','#sys_uptime','#systemUpTime','#uptime','.UpTime','.uptime','#runtime','.runtime'];
        for (const c of idCandidates) {
            const el = $(c);
            const val = getFieldValueOrText(el);
            if (val && /(\d+\s*(day|hora|hour|min|seg|sec)|\d{1,2}:\d{2}:\d{2})/i.test(val)) return val;
        }
        const labels = $$('*').filter(n => /(up\s*time|uptime|run\s*time|runtime|tempo\s*de\s*atividade|tempo\s*de\s*funcionamento)/i.test(n.textContent || ''));
        for (const lab of labels) {
            const next = lab.nextElementSibling || lab.parentElement;
            const chain = [lab, next, next && next.nextElementSibling].filter(Boolean);
            for (const node of chain) {
                const txt = (node.textContent || '').trim();
                const got = extractUptimeFromText(txt) || (/\d{1,2}:\d{2}:\d{2}/.test(txt) ? txt : null);
                if (got) return got;
            }
        }
        const global = document.body ? document.body.innerText || '' : '';
        const fromGlobal = extractUptimeFromText(global);
        return fromGlobal || 'N/A';
    }

    async function readWidthWithRetries(selector, tries=6, delay=180) {
        for (let i = 0; i < tries; i++) {
            const el = $(selector);
            const val = getFieldValueOrText(el);
            if (el && val) return val;
            await sleep(delay);
        }
        return 'N/A';
    }

    async function buildReport() {

        let modelo;
        const modelNameEl = $('#modelName');
        if (modelNameEl) {
            modelo = modelNameEl.textContent.trim();
        } else {
            const botHver = $('#bot_hver');
            if (botHver) {
                modelo = botHver.textContent.trim();
            } else {
                return;
            }
        }

        await sleep(1000);

        const wifiCount = extractCount($('#map_num_wireless')?.textContent || '');
        const wireCount = extractCount($('#map_num_wire')?.textContent || '');
        const dnsRaw = getFieldValueOrText($('#internetDns')) || '';
        const ipv4s = dnsRaw.match(/\b\d+\.\d+\.\d+\.\d+\b/g) || [];
        const dns1 = ipv4s[0] || 'N/A';
        const dns2 = ipv4s[1] || 'N/A';

        const ssid2g = getFieldValueOrText($('#routerWirelessSsid_2g')) || '';
        const ssid5g = getFieldValueOrText($('#routerWirelessSsid_5g')) || '';
        const canal2 = getFieldValueOrText($('#routerWirelessChannel_2g')) || getFieldValueOrText($('#channel_2g')) || 'N/A';
        const canal5 = getFieldValueOrText($('#routerWirelessChannel_5g')) || getFieldValueOrText($('#channel_5g')) || 'N/A';

        let largura2 = 'N/A', largura5 = 'N/A';

        const advanced = $('#advanced');
        if (advanced) { advanced.click(); await sleep(700); }
        const tab24 = $('#showWireless_2g');
        if (tab24) {
            tab24.scrollIntoView({ block: 'center', inline: 'center' });
            tab24.click();
            tab24.dispatchEvent(new Event('click', { bubbles: true }));
            await sleep(650);
            await waitFor('#channelWidth_2g', 5000);
            largura2 = await readWidthWithRetries('#channelWidth_2g', 8, 200);
        } else {

            const width2El = await waitFor('#channelWidth_2g', 5000);
            if (width2El) largura2 = await readWidthWithRetries('#channelWidth_2g');
        }

        const tab5 = $('#showWireless_5g');
        if (tab5) {
            tab5.scrollIntoView({ block: 'center', inline: 'center' });
            tab5.click();
            tab5.dispatchEvent(new Event('click', { bubbles: true }));
            await sleep(650);
            await waitFor('#channelWidth_5g', 5000);
            largura5 = await readWidthWithRetries('#channelWidth_5g', 8, 200);
        } else {
            const width5El = $('#channelWidth_5g');
            if (width5El) largura5 = getFieldValueOrText(width5El) || 'N/A';
        }


        let prior5g = 'N/A';
        if (ssid2g && ssid5g) {
            const has5 = /(5g|5ghz)/i.test(ssid5g);
            prior5g = (ssid2g === ssid5g && !has5) ? 'Habilitado' : 'Desabilitado';
        }

        const ipv6 = 'Habilitado';


        let upnp = await getUPnPStatus();
        if (upnp === 'N/A') {
            const upnpLink = $$('a,button').find(a => /upnp/i.test(a.getAttribute('url') || '') || /upnp/i.test(a.textContent || ''));
            if (upnpLink) { upnpLink.click(); await sleep(900); upnp = await getUPnPStatus(); }
        }


        let uptime = await getUptime();
        if (uptime === 'N/A') {
            const timeLink = $$('a,button').find(a => /(time|status|system)/i.test(a.getAttribute('url') || '') || /(time|status|system)/i.test(a.textContent || ''));
            if (timeLink) { timeLink.click(); await sleep(1200); uptime = await getUptime(); }
        }

        const report = `
[DADOS DO ROTEADOR]
Modelo: ${modelo}
Equipamentos Wireless: ${wifiCount}
Equipamentos Cabeados: ${wireCount}
Priorizar 5G: ${prior5g}
IPV6: ${ipv6}
UPnP: ${upnp}
DNS Primário: ${dns1}
DNS Secundário: ${dns2}
Rede 2.4GHz Canal: ${canal2} | Largura: ${largura2}
Rede 5GHz Canal: ${canal5} | Largura: ${largura5}
Uptime: ${uptime}
        `.trim();

        GM_setClipboard(report);
        alert('Relatório TP-LINK copiado para a área de transferência!');
    }
    
    document.addEventListener('keydown', e => {
        if (e.key === 'Insert') {
            e.preventDefault();
            buildReport();
        }
    });


    window.addEventListener('load', () => {
        setTimeout(buildReport, 1500);
    });
})();
