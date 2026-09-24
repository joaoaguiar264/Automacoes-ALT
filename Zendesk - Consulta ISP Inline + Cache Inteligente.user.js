// ==UserScript==
// @name         Zendesk - Consulta ISP Inline + Cache Inteligente
// @namespace    http://tampermonkey.net/
// @version      8.0
// @description  Auto-load com cache em memória, integração completa Zendesk + Amigo + AutoISP e busca ao vivo de clientes na caixa (splitter)
// @match        https://*.zendesk.com/agent/*
// @match        https://plataforma.sejaamigo.com.br/*
// @match        https://autoisp.brasiltecpar.com.br/subscribers*
// @match        https://autoisp.gegnet.com.br/subscribers*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      n8n.gegnet.com.br
// @connect      plataforma.sejaamigo.com.br
// @updateURL    https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/Zendesk%20-%20Consulta%20ISP%20Inline%20+%20Cache%20Inteligente.user.js
// @downloadURL    https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/Zendesk%20-%20Consulta%20ISP%20Inline%20+%20Cache%20Inteligente.user.js
// @connect      api.macvendors.com
// ==/UserScript==

(function () {
    'use strict';

    // ==========================================
    // PARTE 1: LÓGICA NO ZENDESK (Integração n8n Inline + Cache)
    // ==========================================
    if (window.location.hostname.includes('zendesk.com')) {
        const URL_WEBHOOK_N8N = 'http://n8n.gegnet.com.br/webhook/consulta-amigo';

        // Objeto global para salvar o cache das consultas
        const cacheConsultasISP = {};
        // Cache dos clientes já buscados por caixa (splitter)
        const cacheSplitterClientes = {};

        // Requisição autenticada direta à Amigo (usa a sessão logada no navegador)
        function gmFetchAmigo(url, method = "GET", data = null, headers = {}) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method,
                    url,
                    data,
                    headers,
                    withCredentials: true,
                    onload: (res) => {
                        if ((res.finalUrl && res.finalUrl.includes('/login')) || (res.responseText && res.responseText.includes('page-signin-modal'))) {
                            reject('LOGIN_REQUIRED');
                        } else {
                            resolve(res.responseText);
                        }
                    },
                    onerror: () => reject('NETWORK_ERROR')
                });
            });
        }

        // Lógica de busca de caixa (splitter): consulta em tempo real quem está
        // conectado na mesma caixa, direto na plataforma Amigo (mesma origem
        // usada no script "Integração Múltipla - Zendesk, Amigo & AutoISP").
        function buscarClientesSplitter(box, splitterId, theme) {
            if (cacheSplitterClientes[splitterId]) {
                renderizarTabelaSplitter(box, cacheSplitterClientes[splitterId]);
                return;
            }

            box.innerHTML = '<div style="text-align:center; padding:8px; opacity:0.8;">⏳ Verificando clientes da caixa...</div>';

            const payload = `filters[splitter]=${encodeURIComponent(splitterId)}&pagination[pageNumber]=1&pagination[pageSize]=50`;

            gmFetchAmigo('https://plataforma.sejaamigo.com.br/pt/network-documentation/connection/json', 'POST', payload, {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "X-Requested-With": "XMLHttpRequest"
            }).then(res => {
                try {
                    const json = JSON.parse(res);
                    const lista = json.data || json.items || json.rows || (Array.isArray(json) ? json : []);

                    const clientes = lista.map(item => {
                        if (Array.isArray(item)) {
                            const limpa = (str) => str ? String(str).replace(/<[^>]+>/g, '').trim() : "-";
                            return { nome: limpa(item[3]) || "-", etiqueta: limpa(item[5]) || "-", status: limpa(item[7]) || "-" };
                        }
                        return {
                            nome: item.personName || item.nome || item.name || item.customerName || item.cliente || "-",
                            etiqueta: item.serviceTag || item.etiqueta || item.tag || "-",
                            status: item.status || (item.enabled !== undefined ? (item.enabled ? "Normal" : "Bloqueado") : item.connectionStatus || item.ativo || "-")
                        };
                    });

                    cacheSplitterClientes[splitterId] = clientes;
                    renderizarTabelaSplitter(box, clientes);
                } catch (err) {
                    box.innerHTML = '<div style="text-align:center; padding:8px; color:#dc3545;">❌ Não foi possível ler os clientes da caixa.</div>';
                }
            }).catch((err) => {
                const msg = err === 'LOGIN_REQUIRED'
                    ? '❌ Faça login na Amigo (em outra aba) para consultar a caixa.'
                    : '❌ Erro ao consultar a Amigo.';
                box.innerHTML = `<div style="text-align:center; padding:8px; color:#dc3545;">${msg}</div>`;
            });
        }

        function renderizarTabelaSplitter(box, clientes) {
            if (!clientes || clientes.length === 0) {
                box.innerHTML = '<div style="text-align:center; padding:8px; opacity:0.7;">Nenhum cliente retornado para esta caixa.</div>';
                return;
            }
            let html = '<table><tr><th>Nome</th><th>Etiqueta</th><th>Status</th></tr>';
            clientes.forEach(c => {
                const s = (c.status || '-').toString();
                const cor = (s.toLowerCase() === 'normal' || s.toLowerCase().includes('ativo') || s.toLowerCase().includes('online')) ? '#15803d' : '#b91c1c';
                html += `<tr>
                    <td style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px;" title="${c.nome}">${c.nome}</td>
                    <td style="font-family:monospace;">${c.etiqueta}</td>
                    <td style="color:${cor}; font-weight:bold;">${s}</td>
                </tr>`;
            });
            html += '</table>';
            box.innerHTML = html;
        }

        const style = document.createElement('style');
        style.innerHTML = `
            .isp-panel { margin-top: 8px; font-family: -apple-system, sans-serif; font-size: 12px; background: rgba(0,0,0,0.15); border: 1px solid rgba(128,128,128,0.3); border-radius: 6px; padding: 8px; color: inherit; }
            .isp-row { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; }
            .isp-btn { background: #1f73b7; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-weight: 600; flex: 1; }
            .isp-btn:hover { background: #145287; }
            .isp-btn-config { background: transparent; border: 1px solid rgba(128,128,128,0.5); border-radius: 4px; padding: 4px 6px; cursor: pointer; color: inherit; }
            .isp-input { width: 100%; box-sizing: border-box; padding: 6px; border: 1px solid rgba(128,128,128,0.5); border-radius: 4px; margin-bottom: 6px; background: rgba(255,255,255,0.05); color: inherit; }
            .isp-config-box { display: none; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; margin-bottom: 8px; border: 1px dashed rgba(128,128,128,0.4); }
            .isp-result-box { display: none; margin-top: 8px; }
            .isp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 8px 0; }
            .isp-label { font-size: 10px; opacity: 0.7; font-weight: bold; display: block; text-transform: uppercase; }
            .isp-val { font-family: monospace; font-weight: bold; font-size: 11px; }
            .isp-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; }
            .isp-online { background: #15803d; color: white; }
            .isp-offline { background: #b91c1c; color: white; }
            .isp-link { color: #5ab0ff; text-decoration: none; font-size: 11px; font-weight: bold; }
            #isp-splitter-list { display:none; margin-top:6px; max-height:180px; overflow-y:auto; font-size:10px; border:1px solid rgba(128,128,128,0.3); border-radius:4px; padding:4px; background:rgba(0,0,0,0.2); }
            #isp-splitter-list table { width:100%; text-align:left; border-collapse:collapse; }
            #isp-splitter-list th { padding:4px 2px; border-bottom:1px solid rgba(128,128,128,0.5); opacity:0.8; text-transform:uppercase; }
            #isp-splitter-list td { padding:4px 2px; border-bottom:1px solid rgba(128,128,128,0.1); }
        `;
        document.head.appendChild(style);

        function renderizarDados(panel, data) {
            panel.querySelector('#isp-status').innerText = data.isOnline ? '🟢 ONLINE' : '🔴 OFFLINE';
            panel.querySelector('#isp-status').className = 'isp-badge ' + (data.isOnline ? 'isp-online' : 'isp-offline');
            panel.querySelector('#isp-ip').innerText = data.ip || '-';
            panel.querySelector('#isp-uptime').innerText = data.uptime || '-';
            panel.querySelector('#isp-splitter').innerText = data.splitter || '-';
            panel.querySelector('#isp-limite').innerText = data.limite || '-';
            panel.querySelector('#isp-mac').innerText = data.mac ? `${data.mac} (${data.fabricanteMac})` : '-';
            panel.querySelector('#isp-link-amigo').href = data.linkAmigo || '#';
            panel.querySelector('#isp-link-onu').href = data.linkAutoISP || '#';

            const btnSplitter = panel.querySelector('#btn-isp-ver-splitter');
            const listSplitter = panel.querySelector('#isp-splitter-list');

            if (data.splitterId) {
                // Caminho novo: busca em tempo real (igual à lógica do script Integração Múltipla)
                btnSplitter.style.display = 'block';
                listSplitter.style.display = 'none';
                listSplitter.innerHTML = '';

                btnSplitter.onclick = (e) => {
                    e.preventDefault();
                    if (listSplitter.style.display === 'block') {
                        listSplitter.style.display = 'none';
                        return;
                    }
                    listSplitter.style.display = 'block';
                    buscarClientesSplitter(listSplitter, data.splitterId);
                };
            } else if (data.clientesSplitter && data.clientesSplitter.length > 0) {
                // Compatibilidade: n8n já mandou a lista pronta (sem splitterId)
                btnSplitter.style.display = 'block';
                let html = '<table><tr><th>Nome</th><th>Etiqueta</th><th>Status</th></tr>';
                data.clientesSplitter.forEach(c => {
                    const cor = (c.status.toLowerCase() === 'normal' || c.status.toLowerCase().includes('ativo') || c.status.toLowerCase().includes('online')) ? '#15803d' : '#b91c1c';
                    html += `<tr>
                        <td style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px;" title="${c.nome}">${c.nome}</td>
                        <td style="font-family:monospace;">${c.etiqueta}</td>
                        <td style="color:${cor}; font-weight:bold;">${c.status}</td>
                    </tr>`;
                });
                html += '</table>';
                listSplitter.innerHTML = html;
                listSplitter.style.display = 'none';

                btnSplitter.onclick = (e) => {
                    e.preventDefault();
                    listSplitter.style.display = listSplitter.style.display === 'none' ? 'block' : 'none';
                };
            } else {
                btnSplitter.style.display = 'none';
                listSplitter.innerHTML = '';
            }

            panel.dataset.resumoTexto = data.resumoTexto || '';
            panel.querySelector('#isp-resultado').style.display = 'block';
            panel.querySelector('#isp-loading').style.display = 'none';
        }

        function executarConsulta(panel, etiqueta, forcarAtualizacao = false) {
            const au = GM_getValue('amigo_user', ''), ap = GM_getValue('amigo_pass', '');
            const iu = GM_getValue('autoisp_user', ''), ip = GM_getValue('autoisp_pass', '');

            if (!au || !iu) {
                if (forcarAtualizacao) alert('Clique na engrenagem ⚙️ e salve suas senhas primeiro.');
                panel.querySelector('#isp-loading').style.display = 'none';
                return;
            }

            // 1. Verifica Cache
            if (!forcarAtualizacao && cacheConsultasISP[etiqueta]) {
                renderizarDados(panel, cacheConsultasISP[etiqueta]);
                return;
            }

            // 2. Busca Nova
            const loadingText = panel.querySelector('#isp-loading');
            loadingText.style.display = 'block';
            loadingText.innerText = '⏳ Consultando n8n...';
            panel.querySelector('#isp-resultado').style.display = 'none';

            GM_xmlhttpRequest({
                method: "POST",
                url: URL_WEBHOOK_N8N,
                headers: { "Content-Type": "application/json" },
                data: JSON.stringify({ etiqueta, amigo_user: au, amigo_pass: ap, autoisp_user: iu, autoisp_pass: ip }),
                onload: (res) => {
                    if (res.status === 200) {
                        try {
                            const data = JSON.parse(res.responseText);
                            cacheConsultasISP[etiqueta] = data; // Salva no cache
                            renderizarDados(panel, data);
                        } catch(err) {
                            loadingText.innerText = '❌ Erro ao ler resposta do n8n (JSON Inválido).';
                        }
                    } else {
                        loadingText.innerText = '❌ Falha de comunicação (Status: ' + res.status + ')';
                    }
                },
                onerror: (err) => {
                    console.error("Erro no GM_xmlhttpRequest:", err);
                    loadingText.innerText = '❌ Erro de Rede. O n8n bloqueou a conexão ou está offline.';
                },
                ontimeout: () => {
                    loadingText.innerText = '❌ Tempo de resposta esgotado (Timeout).';
                }
            });
        }

        function injetarInterface() {
            const labels = Array.from(document.querySelectorAll('label'));
            const etiquetas = labels.filter(l => l.textContent.includes('Etiqueta do cliente'));

            etiquetas.forEach(labelEtiqueta => {
                const wrapper = labelEtiqueta.parentElement;
                if (!wrapper || wrapper.querySelector('.isp-panel')) return;

                const inputEtiqueta = wrapper.querySelector('input');
                if (!inputEtiqueta) return;

                const panel = document.createElement('div');
                panel.className = 'isp-panel';
                panel.innerHTML = `
                    <div class="isp-row">
                        <button id="btn-isp-consultar" class="isp-btn">🔄 Atualizar</button>
                        <button id="btn-isp-config" class="isp-btn-config" title="Configurar Senhas">⚙️</button>
                    </div>
                    <div id="isp-loading" style="display:none; text-align:center; font-size:11px; opacity:0.8; margin-bottom:8px;">⏳ Consultando...</div>
                    <div id="isp-config" class="isp-config-box">
                        <span class="isp-label">Amigo - Email e Senha</span>
                        <input type="text" id="cfg-a-user" class="isp-input" placeholder="Email Amigo">
                        <input type="password" id="cfg-a-pass" class="isp-input" placeholder="Senha Amigo">
                        <span class="isp-label">AutoISP - Email e Senha</span>
                        <input type="text" id="cfg-i-user" class="isp-input" placeholder="Email AutoISP">
                        <input type="password" id="cfg-i-pass" class="isp-input" placeholder="Senha AutoISP">
                        <button id="btn-isp-salvar" class="isp-btn" style="width:100%; background:#2f3941;">💾 Salvar Senhas</button>
                    </div>
                    <div id="isp-resultado" class="isp-result-box">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span id="isp-status" class="isp-badge">ONLINE</span>
                            <a id="isp-link-amigo" href="#" target="_blank" class="isp-link">Amigo ↗</a>
                            <a id="isp-link-onu" href="#" target="_blank" class="isp-link">ONU ↗</a>
                        </div>
                        <div class="isp-grid">
                            <div><span class="isp-label">IP ATUAL</span><span id="isp-ip" class="isp-val">-</span></div>
                            <div><span class="isp-label">UPTIME</span><span id="isp-uptime" class="isp-val">-</span></div>
                            <div><span class="isp-label">SPLITTER</span><span id="isp-splitter" class="isp-val">-</span></div>
                            <div><span class="isp-label">LIMITE</span><span id="isp-limite" class="isp-val">-</span></div>
                        </div>
                        <div style="margin-bottom:6px;"><span class="isp-label">MAC</span><span id="isp-mac" class="isp-val">-</span></div>
                        <button id="btn-isp-colar" class="isp-btn" style="width:100%; margin-bottom:6px; background:transparent; border:1px solid rgba(128,128,128,0.5);">📋 Colar Resumo</button>
                        <button id="btn-isp-ver-splitter" class="isp-btn" style="display:none; width:100%; background:#475569;">📦 Ver Clientes no Splitter</button>
                        <div id="isp-splitter-list"></div>
                    </div>
                `;

                inputEtiqueta.insertAdjacentElement('afterend', panel);

                // Carrega senhas locais
                panel.querySelector('#cfg-a-user').value = GM_getValue('amigo_user', '');
                panel.querySelector('#cfg-a-pass').value = GM_getValue('amigo_pass', '');
                panel.querySelector('#cfg-i-user').value = GM_getValue('autoisp_user', '');
                panel.querySelector('#cfg-i-pass').value = GM_getValue('autoisp_pass', '');

                // Eventos
                panel.querySelector('#btn-isp-config').onclick = (e) => {
                    e.preventDefault();
                    const box = panel.querySelector('#isp-config');
                    box.style.display = box.style.display === 'none' || !box.style.display ? 'block' : 'none';
                };

                panel.querySelector('#btn-isp-salvar').onclick = (e) => {
                    e.preventDefault();
                    GM_setValue('amigo_user', panel.querySelector('#cfg-a-user').value.trim());
                    GM_setValue('amigo_pass', panel.querySelector('#cfg-a-pass').value.trim());
                    GM_setValue('autoisp_user', panel.querySelector('#cfg-i-user').value.trim());
                    GM_setValue('autoisp_pass', panel.querySelector('#cfg-i-pass').value.trim());
                    panel.querySelector('#isp-config').style.display = 'none';
                };

                // Botão de Forçar Atualização
                panel.querySelector('#btn-isp-consultar').onclick = (e) => {
                    e.preventDefault();
                    const etiqueta = inputEtiqueta.value.trim();
                    if (!etiqueta) return alert('O campo Etiqueta está vazio no Zendesk!');
                    executarConsulta(panel, etiqueta, true); // True = força busca nova
                };

                // Colar resumo
                panel.querySelector('#btn-isp-colar').onclick = (e) => {
                    e.preventDefault();
                    const resumoAtual = panel.dataset.resumoTexto;
                    if (!resumoAtual) return;
                    const editor = document.querySelector('.ck-editor__editable') || document.querySelector('textarea[name="comment.body"]');
                    if (editor) {
                        if (editor.classList.contains('ck-editor__editable')) {
                            resumoAtual.split('\n').forEach(linha => {
                                const p = document.createElement('p'); p.innerText = linha; editor.appendChild(p);
                            });
                        } else { editor.value += '\n' + resumoAtual; }
                        editor.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                };

                // ===== AUTO-LOAD AQUI =====
                const etiquetaValue = inputEtiqueta.value.trim();
                if (etiquetaValue) {
                    executarConsulta(panel, etiquetaValue, false); // False = checa o cache primeiro
                }
            });
        }

        // Monitora o Zendesk para injetar quando carregar
        const observer = new MutationObserver(() => { injetarInterface(); });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ==========================================
    // PARTE 2: LÓGICA NA PLATAFORMA AMIGO E AUTOISP (Intacta)
    // ==========================================
    const URL_AMIGO = 'plataforma.sejaamigo.com.br';
    const URL_AUTOISP = 'autoisp.brasiltecpar.com.br';
    const URL_AUTOISP_ALT = 'autoisp.gegnet.com.br';

    if (window.location.hostname.includes(URL_AMIGO)) {
        function inserirBotaoAmigo() {
            const tabela = document.querySelector('table');
            if (!tabela) return;
            const cabecalhos = Array.from(tabela.querySelectorAll('thead th'));
            const linhasTabela = tabela.querySelectorAll('tbody tr');
            if (linhasTabela.length === 0 || cabecalhos.length === 0) return;

            let indiceEtiqueta = cabecalhos.findIndex(th => th.textContent.trim().toLowerCase() === 'etiqueta');
            if (indiceEtiqueta === -1) indiceEtiqueta = cabecalhos.findIndex(th => th.textContent.trim().toLowerCase() === 'usuário ipoe');
            if (indiceEtiqueta === -1) return;

            linhasTabela.forEach(linha => {
                if (linha.querySelector('.btn-autoisp')) return;
                const celulas = linha.querySelectorAll('td');
                if (celulas.length <= indiceEtiqueta) return;
                const termoBusca = celulas[indiceEtiqueta].textContent.trim();
                if (!termoBusca) return;

                const btn = document.createElement('a');
                btn.className = 'btn-autoisp btn btn-sm btn-success';
                btn.style.marginLeft = '8px';
                btn.style.cursor = 'pointer';
                btn.innerHTML = 'AutoISP <i class="fa fa-external-link"></i>';

                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    GM_setValue('etiquetaAutoISP', termoBusca);
                    window.open('https://autoisp.gegnet.com.br/subscribers', '_blank');
                });

                const ultimaCelula = celulas[celulas.length - 1];
                if (ultimaCelula) {
                    ultimaCelula.style.display = 'flex';
                    ultimaCelula.style.alignItems = 'center';
                    ultimaCelula.appendChild(btn);
                }
            });
        }
        const observerAmigo = new MutationObserver(() => { setTimeout(inserirBotaoAmigo, 150); });
        observerAmigo.observe(document.body, { childList: true, subtree: true });
    }

    if (window.location.hostname.includes(URL_AUTOISP) || window.location.hostname.includes(URL_AUTOISP_ALT)) {
        const etiquetaSalva = GM_getValue('etiquetaAutoISP', '');

        if (etiquetaSalva) {
            function estaProcessando() {
                const elementos = document.querySelectorAll('*');
                for (let el of elementos) {
                    if (el.textContent === 'Processando...' || el.textContent === 'Processing...') {
                        const estilo = window.getComputedStyle(el);
                        if (estilo.display !== 'none' && estilo.visibility !== 'hidden' && estilo.opacity !== '0') return true;
                    }
                }
                return false;
            }

            const tentarPreencher = setInterval(() => {
                const xpathInput = '//*[@id="subscriber_index_table"]/thead/tr[1]/th[1]/input';
                const inputCampo = document.evaluate(xpathInput, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

                if (inputCampo) {
                    if (estaProcessando()) return;
                    clearInterval(tentarPreencher);

                    inputCampo.value = etiquetaSalva;
                    inputCampo.dispatchEvent(new Event('input', { bubbles: true }));
                    inputCampo.dispatchEvent(new Event('change', { bubbles: true }));
                    inputCampo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));

                    GM_setValue('etiquetaAutoISP', '');
                }
            }, 100);

            setTimeout(() => { clearInterval(tentarPreencher); GM_setValue('etiquetaAutoISP', ''); }, 15000);
        }
    }
})();
