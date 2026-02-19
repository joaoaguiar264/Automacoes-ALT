// ==UserScript==
// @name         Roteadores - relatorio-ont-huawei
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Ao entrar na ONT, gera relatório após 5s pegando cada informação da ONT sem alterar a página
// @author       none
// @match        https://*/index.asp
// @grant        GM_setClipboard
// @run-at       document-idle
// @icon         none
// @updateURL    https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/relatorio-ont-huawei.user.js
// @downloadURL  https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/relatorio-ont-huawei.user.js

// ==/UserScript==

(function() {
  'use strict';

  const tasks = [
    {
      path: '/html/amp/wlanbasic/simplewificfg.asp',
      extract: doc => {
        const ssid = doc.getElementById('txt_5g_wifiname')?.value || '';
        return { prior5g: ssid.toLowerCase().includes('5g') ? 'Desabilitado' : 'Habilitado' };
      }
    },
    {
      path: '/html/ssmp/deviceinfo/deviceinfo.asp',
      extract: doc => ({
        modelo:   doc.getElementById('td1_2')?.textContent.trim()  || 'N/A',
        firmware: doc.getElementById('td5_2')?.textContent.trim()  || 'N/A',
        uptime:   doc.getElementById('td14_2')?.textContent.trim() || 'N/A'
      })
    },
    {
      path: '/html/amp/wlanadv/WlanAdvance.asp?2G',
      extract: doc => ({
        largura24: doc.getElementById('X_HW_HT20')?.options[doc.getElementById('X_HW_HT20').selectedIndex]?.text.trim() || 'N/A',
        canal24:   doc.getElementById('Channel')?.options[doc.getElementById('Channel').selectedIndex]?.text.trim()   || 'N/A'
      })
    },
    {
      path: '/html/amp/wlanadv/WlanAdvance.asp?5G',
      extract: doc => ({
        largura5: doc.getElementById('X_HW_HT20')?.options[doc.getElementById('X_HW_HT20').selectedIndex]?.text.trim() || 'N/A',
        canal5:   doc.getElementById('Channel')?.options[doc.getElementById('Channel').selectedIndex]?.text.trim()   || 'N/A'
      })
    },
    {
      path: '/html/bbsp/dhcpservercfg/dhcp2.asp',
      extract: doc => ({
        dns1: doc.getElementById('dnsMainPri')?.value.trim() || 'N/A',
        dns2: doc.getElementById('dnsMainSec')?.value.trim() || 'N/A'
      })
    },
    {
      path: '/html/bbsp/upnp/upnp.asp',
      extract: doc => ({
        upnp: doc.getElementById('Enable')?.checked ? 'Habilitado' : 'Desabilitado'
      })
    }
  ];

  function loadIframe(path) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = location.protocol + '//' + location.host + path;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        const doc = iframe.contentDocument;
        document.body.removeChild(iframe);
        resolve(doc);
      };
      iframe.onerror = () => {
        document.body.removeChild(iframe);
        reject(new Error('Falha ao carregar ' + path));
      };
    });
  }

  function extractCount(text) {
    const m = text.match(/\((\d+)\)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  async function aguardarDispositivos(ms = 2000) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function gerarRelatorio() {
    await aguardarDispositivos(2500);

    const mainIframe = document.querySelector('iframe[src*="mainpage.asp"]');
    let wifiCount = 0, wireCount = 0;
    if (mainIframe) {
      const mainDoc = mainIframe.contentDocument;
      wifiCount = extractCount(mainDoc.getElementById('wifinumspan')?.textContent.trim() || '');
      wireCount = extractCount(mainDoc.getElementById('linenumspan')?.textContent.trim() || '');
    }
    const totalDev = wifiCount + wireCount;

    const acc = {
      modelo: 'N/A', firmware: 'N/A', uptime: 'N/A',
      largura24: 'N/A', canal24: 'N/A',
      largura5: 'N/A', canal5: 'N/A',
      dns1: 'N/A', dns2: 'N/A',
      prior5g: 'Desabilitado', upnp: 'Desabilitado',
      ipv6: 'Habilitado'
    };

    try {
      const docs = await Promise.all(tasks.map(task => loadIframe(task.path)));
      docs.forEach((doc, i) => {
        Object.assign(acc, tasks[i].extract(doc));
      });

      const report = `[CONFIGURAÇÕES DO ROTEADOR]
Modelo: ${acc.modelo}
Firmware: ${acc.firmware}
Dispositivos Wi-Fi conectados: ${wifiCount}
Dispositivos cabeados conectados: ${wireCount}
Total de dispositivos: ${totalDev}
DNS WAN: ${acc.dns1}, ${acc.dns2}
DNS LAN: ${acc.dns1}, ${acc.dns2}
Priorizar 5G: ${acc.prior5g}
IPv6: ${acc.ipv6}
UPnP: ${acc.upnp}
Rede 2.4GHz com canal ${acc.canal24} e largura em ${acc.largura24}
Rede 5GHz com canal ${acc.canal5} e largura em ${acc.largura5}
Uptime: ${acc.uptime}`.trim();

      GM_setClipboard(report);
      alert('Relatório copiado para a área de transferência!');
    } catch (err) {
      console.error(err);
      alert('Erro durante a coleta: ' + err.message);
    }
  }

  window.addEventListener('load', gerarRelatorio);
})();
