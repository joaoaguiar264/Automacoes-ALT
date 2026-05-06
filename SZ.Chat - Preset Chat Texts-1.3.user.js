// ==UserScript==
// @name         SZ.Chat - Preset Chat Texts
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Draggable UI with preset texts, collapsible upward
// @match        https://clusterscpr.sz.chat/*
// @updateURL    https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/SZ.Chat%20-%20Preset%20Chat%20Texts-1.3.user.js
// @downloadURL  https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/SZ.Chat%20-%20Preset%20Chat%20Texts-1.3.user.js
// @icon         https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/icon.png
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let protocoloAtual = null;

    function extrairProtocolo() {
        const mensagens = document.querySelectorAll('#list_mensagens > ul > li');

        if (!mensagens.length) {
            console.log("Sem mensagens ainda...");
            return;
        }

        let novoProtocolo = null;

        mensagens.forEach(msg => {
            const texto = msg.innerText || msg.textContent;

            const match = texto.match(/protocolo.*?(\d{5,})/i);

            if (match) {
                novoProtocolo = match[1];
            }
        });

        if (novoProtocolo && novoProtocolo !== protocoloAtual) {
            protocoloAtual = novoProtocolo;
            console.log("🔥 Protocolo encontrado:", protocoloAtual);
        }
    }

    // roda a cada 2 segundos (simples e confiável pra SPA)
    setInterval(extrairProtocolo, 2000);

    window.addEventListener('load', () => {

        const box = document.createElement('div');
        box.style.position = 'fixed';
        box.style.bottom = '200px';
        box.style.right = '10px';
        box.style.width = '240px';
        box.style.background = '#1e1e1e';
        box.style.color = '#fff';
        box.style.padding = '10px';
        box.style.border = '1px solid #444';
        box.style.borderColor = "cyan";
        box.style.borderRadius = '8px';
        box.style.zIndex = '9999';
        box.style.fontFamily = 'Arial, sans-serif';

        const savedPosition = localStorage.getItem('szchat_box_position');
        if (savedPosition) {
            const { left, top } = JSON.parse(savedPosition);

            box.style.left = left;
            box.style.top = top;
            box.style.right = 'auto';
            box.style.bottom = 'auto';
        }

        // Header
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.cursor = 'move';

        const title = document.createElement('strong');
        title.textContent = 'Facilitador de Vidas';
        title.style.color = "cyan";
        title.style.fontSize = '14px';

        const toggleBtn = document.createElement('span');
        toggleBtn.textContent = '↑';
        toggleBtn.style.color = "cyan";
        toggleBtn.style.padding = '2px 6px';
        toggleBtn.style.borderRadius = '4px';
        toggleBtn.style.background = '#2a2a2a';

        header.appendChild(title);
        header.appendChild(toggleBtn);

        box.appendChild(header);

        const divider = document.createElement('hr');
        divider.style.border = '0';
        divider.style.borderTop = '1px solid #444';

        // Content container (will be positioned above)
        const content = document.createElement('div');
        content.style.position = 'absolute';
        content.style.bottom = '100%'; // THIS makes it expand upward
        content.style.left = '0';
        content.style.width = '100%';
        content.style.background = '#1e1e1e';
        content.style.border = '1px solid #444';
        content.style.borderRadius = '8px';
        content.style.padding = '10px';
        content.style.display = 'none'; // start collapsed
        content.style.boxSizing = 'border-box';
        content.style.maxHeight = '420px';   // limit height
        content.style.overflowY = 'auto';    // enable vertical scroll
        content.style.overflowX = 'hidden';  // prevent sideways scroll

        const presets = [
            {
                title: "Bem Vindo",
                text: () => `Olá *{{NAME}}*, seja bem-vindo(a)! 😃

Sou *{{AGENT}}* do Suporte Técnico.

O protocolo do seu atendimento é *${protocoloAtual || '-----'}*.

Já comecei seu atendimento, vou fazer algumas verificações na sua conexão, só um momento.`
            },
            { title: "Lentidão 1 - Aparelhos", text: "Está lento em todos os aparelhos? Celular, tv, computador, etc" },
            { title: "Lentidão 2 - Cômodos", text: "Certo, sobre o local, sente lentidão em todos os cômodos?" },
            { title: "Lentidão 3 - Site/App", text: "E essa lentidão seria em algum app ou site específico? ou no geral mesmo?" },
            { title: "Foto aparelhos", text: "Poderia enviar uma foto dos aparelhos da internet? Enquanto isso eu fazer alguns ajustes no sistema." },
            { title: "Pode testar", text: "Obrigado por aguardar, poderia testar a conexão agora, por favor, fiz alguns ajustes na rede, se for na tv, precisa reiniciar a tv antes." },
            { title: "Testar na 5G", text: "Vão aparecer duas redes, normal e 5G, pode conectar e testar na 5G, por favor, pois nela chega mais velocidade que a normal." },
            { title: "Deu certo", text: "Perfeito! Consigo lhe ajudar em algo mais no momento? ou tudo certo agora?" },
            {
                title: "Logistica",
                text: () => `Prezado(a) {{NAME}},

Será necessário o envio de um técnico até o local para resolver a situação.
Vou transferi-lo(a) agora para o nosso setor de Agendamentos.

📝 *Protocolo*: ${protocoloAtual || '-----'}

Os agendamentos são realizados exclusivamente em horário comercial:

🕒 *Segunda a sexta-feira*: 08h00 às 11h30 | 13h30 às 18h00
🕒 *Sábado*: 08h00 às 12h00

Por gentileza, aguarde. Em breve, você será atendido dentro do horário informado.`
            },
            {
                title: "Finalizar",
                text: () => `Foi um prazer te atender! 😊

Protocolo do atendimento: *${protocoloAtual || '-----'}*

Nosso compromisso é oferecer um atendimento ágil, claro e atencioso, sempre com foco na melhor experiência para você.

📲 Em breve, você receberá uma pesquisa rápida pelo WhatsApp sobre o atendimento de hoje. Sua opinião é muito importante para continuarmos evoluindo e oferecendo um serviço cada vez melhor.

Se conseguimos te ajudar como esperava, ficaremos muito felizes em receber sua avaliação positiva!

📞 Lembre-se: nosso *suporte* está disponível *24 horas* por dia, todos os dias da semana, sempre pronto para te ajudar no que for preciso.

Agradecemos o contato!`
            }
        ];

        presets.forEach(p => {
            const btn = document.createElement('div');
            btn.style.padding = '8px';
            btn.style.margin = '6px 0';
            btn.style.background = '#2a2a2a';
            btn.style.borderRadius = '6px';
            btn.style.cursor = 'pointer';
            btn.style.transition = '0.2s';
            const preview = typeof p.text === 'function' ? p.text() : p.text;

            btn.innerHTML = `
    <div style="font-weight:bold; color:#4fc3f7;">
        ${p.title}
    </div>
    <div style="font-size:12px; color:#ccc;">
        ${preview.substring(0, 40)}...
    </div>
`;

            btn.addEventListener('mouseenter', () => {
                btn.style.background = '#3a3a3a';
            });

            btn.addEventListener('mouseleave', () => {
                btn.style.background = '#2a2a2a';
            });

            btn.addEventListener('click', () => {
                const chatBox = document.querySelector('#twemoji-textarea');
                if (chatBox) {
                    const textoFinal = typeof p.text === 'function' ? p.text() : p.text;
                    chatBox.innerHTML = textoFinal;

                    // simula digitação
                    chatBox.dispatchEvent(new Event('input', { bubbles: true }));

                    chatBox.focus();
                }
            });

            content.appendChild(btn);
        });

        box.appendChild(content);
        document.body.appendChild(box);

        let hideTimeout;

        box.addEventListener('mouseenter', () => {
            clearTimeout(hideTimeout);
            content.style.display = 'block';
            toggleBtn.textContent = '🍆';
        });

        box.addEventListener('mouseleave', () => {
            hideTimeout = setTimeout(() => {
                content.style.display = 'none';
                toggleBtn.textContent = '↑';
            }, 200); // 200ms de grace period
        });

        // Também adiciona nos próprios listeners do content
        content.addEventListener('mouseenter', () => {
            clearTimeout(hideTimeout);
        });

        content.addEventListener('mouseleave', () => {
            hideTimeout = setTimeout(() => {
                content.style.display = 'none';
                toggleBtn.textContent = '↑';
            }, 200);
        });

        // Dragging (only header drags)
        let isDragging = false;
        let offsetX, offsetY;

        header.addEventListener('mousedown', (e) => {
            isDragging = true;

            // Convert bottom/right to top/left BEFORE dragging
            const rect = box.getBoundingClientRect();

            box.style.left = rect.left + 'px';
            box.style.top = rect.top + 'px';
            box.style.right = 'auto';
            box.style.bottom = 'auto';

            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const maxX = window.innerWidth - box.offsetWidth;
                const maxY = window.innerHeight - box.offsetHeight;

                box.style.left = Math.min(Math.max(0, e.clientX - offsetX), maxX) + 'px';
                box.style.top = Math.min(Math.max(0, e.clientY - offsetY), maxY) + 'px';
            }
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                localStorage.setItem('szchat_box_position', JSON.stringify({
                    left: box.style.left,
                    top: box.style.top
                }));
            }
            isDragging = false;
        });

    });

})();
