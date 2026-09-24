// ==UserScript==
// @name         Zendesk - ALT Copilot
// @namespace    alt.copilot
// @version      1.5
// @description  Sistema de presets/mensagens prontas para atendimento ALT
// @author       João Aguiar
// @match        https://brasiltecparsupport.zendesk.com/agent/*
// @updateURL    https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/Zendesk%20-%20ALT%20Copilot.user.js
// @downloadURL  https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/Zendesk%20-%20ALT%20Copilot.user.js
// @icon         https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/icon.png
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  CONFIG                                                          ║
    // ╚══════════════════════════════════════════════════════════════════╝
    const CONFIG = {
        STORAGE_KEY: 'alt_copilot_state_v2',

        SELECTORS: {
            selectedTicketTab:
            'a[data-test-id="header-tab"][data-entity-type="TICKET_ENTITY_TYPE"][data-entity-is-selected="true"]',

            selectedTicketTitle:
            '[data-test-id="header-tab-title"]',

            chatInput: [
                '[data-test-id="omnicomposer-plain-text-ckeditor"][contenteditable="true"]',
                '[data-test-id="ticket-rich-text-editor"] [contenteditable="true"][role="textbox"]',
                '.zendesk-editor--rich-text-container [contenteditable="true"][role="textbox"]',
            ],

            messageItems:
            '[data-test-id="omni-log-container"] [data-test-id="omni-log-comment-item"]',

            messageBubble:
            '[data-test-id="omni-log-item-message"]',

            messageContent:
            '[data-test-id="omni-log-message-content"]',

            messageSender:
            '[data-test-id="omni-log-item-sender"]',

            messageTimestamp:
            'time[data-test-id^="timestamp-"]',
        },
    };

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  PRESETS                                                         ║
    // ║  Cada preset tem:                                                ║
    // ║    - id: identificador único                                     ║
    // ║    - label: texto curto exibido no botão                         ║
    // ║    - text: mensagem que será inserida no chat                    ║
    // ║    - keywords: palavras que ativam a sugestão automática         ║
    // ║    - priority: peso para ordenação (maior = mais relevante)      ║
    // ║                                                                  ║
    // ║  Categorias: 'lentidao', 'semconexao', 'sky', 'senha', 'geral'   ║
    // ║  ('geral' não vira aba, mas aparece em sugeridas)                ║
    // ╚══════════════════════════════════════════════════════════════════╝
    const CATEGORIES = [
        { id: 'lentidao',   label: '📉 Lentidão' },
        { id: 'semconexao', label: '🚫 Sem conexão' },
        { id: 'sky',        label: '📺 Sky+' },
        { id: 'senha',      label: '🔑 Troca de senha' },
    ];

    const PRESETS = [
        // ─── GERAIS ───────────────────────────────────────────────────────
        {
            id: 'welcome',
            category: 'geral',
            label: '👋 Bem-vindo',
            text: `Olá *{{NAME}}*, seja bem-vindo(a)! 😃

O protocolo do seu atendimento é *{{PROTOCOL}}*.

Já comecei seu atendimento, vou fazer algumas verificações na sua conexão, só um momento.`,
            clientKeywords: ['Já sou cliente 😉'],
            agentKeywords: ['Atendimento iniciado por', 'certo', 'problema'],
            priority: 10,
        },
        {
            id: 'mais-algo',
            category: 'geral',
            label: '❓ Ajudo em mais algo?',
            text: `Perfeito 😄 Consigo te ajudar em mais alguma coisa?`,
            clientKeywords: ['esta melhor', 'voltou', 'funcionou', 'resolveu', 'normal', 'agora foi', 'consegui', 'perfeito', 'deu certo', 'deu boa', 'melhorou', 'agora sim', 'normalizou', 'agora esta bom', 'agora esta otimo', 'retornou', 'está funcionando', 'esta funcionando', 'obrigada', 'obrigado'],
            agentKeywords: ['deu certo?'],
            priority: 9,
        },
        {
            id: 'um-momento',
            category: 'geral',
            label: '🕚 Só mais um momento?',
            text: `Só mais um momento, estou realizando alguns testes e ajustes na sua rede. Assim que terminar lhe dou um retorno.`,
            clientKeywords: ['demora', 'cade', 'ainda', 'nada ainda', 'nada?', 'retorno'],
            agentKeywords: [],
            priority: 7,
        },
        {
            id: 'inatividade',
            category: 'geral',
            label: '🕚🏁 Finalizar inatividade',
            text: `{{NAME}} No momento, notei que você não pode falar comigo. 🥺\n\nVou encerrar esse atendimento, caso precise, é só chamar novamente!\n\nProtocolo do atendimento: *{{PROTOCOL}}*\n\nAgradecemos o seu contato! Tenha um ótimo dia 😃\n\nOBS: Pedimos a gentileza de não responder esta mensagem, pois seu atendimento está sendo finalizado e qualquer nova mensagem ou emoji iniciará um novo atendimento.  Mas lembramos que estamos aqui para qualquer nova necessidade.😉`,
            clientKeywords: [],
            agentKeywords: ['podemos continuar?', 'continuidade'],
            priority: 7,
        },
        {
            id: 'vou-testar',
            category: 'geral',
            label: '🕚 Fico no aguardo',
            text: `Certo, fico no aguardo!`,
            clientKeywords: ['vou testar', 'testando'],
            agentKeywords: [],
            priority: 9,
        },
        {
            id: 'finalizar',
            category: 'geral',
            label: '🏁 Finalizar atendimento',
            text: `Foi um prazer te atender! 😊\n\nProtocolo do atendimento: *{{PROTOCOL}}*\n\nNosso compromisso é oferecer um atendimento ágil, claro e atencioso, sempre com foco na melhor experiência para você.\n\n📲 Em breve, você receberá uma pesquisa rápida pelo WhatsApp sobre o atendimento de hoje. Sua opinião é muito importante para continuarmos evoluindo e oferecendo um serviço cada vez melhor.\n\nSe conseguimos te ajudar como esperava, ficaremos muito felizes em receber sua avaliação positiva!\n\n📞 Lembre-se: nosso *suporte* está disponível *24 horas* por dia, todos os dias da semana,\nsempre pronto para te ajudar no que for preciso.\n\nAgradecemos o contato!`,
            clientKeywords: ['era so isso', 'era isso', 'so isso', 'obrigado', 'valeu', 'nao precisa mais', 'tudo certo', 'nada mais', 'entro em contato novamente'],
            agentKeywords: ['Perfeito 😄 Consigo te ajudar em mais alguma coisa?', 'ajudo em algo mais?', 'consigo ajudar em algo mais?', 'tenha uma ótima semana', 'algo mais?', 'tudo certo agora', 'de nada', 'qualquer coisa', 'ficamos a disposição'],
            priority: 10,
        },

        // ─── LENTIDÃO ─────────────────────────────────────────────────────
        {
            id: 'lent-pergunta-aparelhos',
            category: 'lentidao',
            label: '1️⃣ Quais aparelhos?',
            text: `A dificuldade acontece em quais aparelhos? Celular, televisão ou computador?`,
            clientKeywords: ['lento', 'lenta', 'lentidao', 'lentidão', 'devagar', 'travando', 'travado', 'demorando', 'ruim', 'instavel', 'oscilando', 'fraca', 'travado', 'travada', 'sinal fraco'],
            agentKeywords: [],
            priority: 9,
        },
        {
            id: 'lent-pergunta-comodos',
            category: 'lentidao',
            label: '2️⃣ Quais cômodos?',
            text: `Em todos os cômodos da casa ou em algum específico?`,
            clientKeywords: [],
            agentKeywords: ['A dificuldade acontece em quais aparelhos? Celular, televisão ou computador?'],
            priority: 8,
        },
        {
            id: 'lent-pergunta-apps',
            category: 'lentidao',
            label: '3️⃣ Quais apps/sites?',
            text: `E essa dificuldade/lentidão seria em algum app ou site específico? ou no geral mesmo?`,
            clientKeywords: [],
            agentKeywords: ['Em todos os cômodos da casa ou em algum específico'],
            priority: 7,
        },
        {
            id: 'lent-teste',
            category: 'lentidao',
            label: '📡 Pode testar',
            text: `Obrigado, por aguardar! Pode verificar se melhorou? Caso esteja utilizando uma televisão, é necessário reiniciá-la.`,
            clientKeywords: [],
            agentKeywords: ['E essa dificuldade/lentidão seria em algum app ou site específico? ou no geral mesmo?', 'vou verificar', 'um momento', 'um segundo'],
            priority: 6,
        },
        {
            id: 'lent-dica-5g',
            category: 'lentidao',
            label: '📶 Explicar 5G',
            text: `Dica: Utilize a rede 5G na região próxima ao roteador e a rede 2,4G para regiões mais distantes ou com obstáculos no caminho.\nOBS: A rede 5G pode não funcionar em dispositivos mais antigos.`,
            clientKeywords: ['wifi ruim', 'internet ruim'],
            agentKeywords: ['Obrigado, por aguardar! Pode verificar se melhorou? Caso esteja utilizando uma televisão, é necessário reiniciá-la.'],
            priority: 6,
        },
        {
            id: 'lent-reiniciar-roteador',
            category: 'lentidao',
            label: '📡 Reiniciar Roteador',
            text: `Reinicie o roteador mais uma vez, por favor.`,
            clientKeywords: [],
            agentKeywords: ['pode testar a conexao agora'],
            priority: 5,
        },
        {
            id: 'lent-btv',
            category: 'lentidao',
            label: '⚠️ BTV/TV Box é instável',
            text: `Esses aparelhos BTV costumam apresentar bastante instabilidade de conexão por conta própria. Vamos observar se estabiliza, mas eles podem ser meio imprevisíveis.`,
            clientKeywords: ['btv', 'tv box', 'tvbox', 'aparelho de tv'],
            agentKeywords: [],
            priority: 3,
        },
        {
            id: 'lent-teste-velocidade',
            category: 'lentidao',
            label: '⚡ Pedir teste de velocidade',
            text: `Consegue fazer um teste de velocidade pelo site https://fast.com/pt/ e me enviar um print, por favor?`,
            clientKeywords: ['internet lenta'],
            agentKeywords: ['pode testar a conexao agora'],
            priority: 4,
        },

        // ─── SEM CONEXÃO ──────────────────────────────────────────────────
        {
            id: 'sem-foto-aparelhos',
            category: 'semconexao',
            label: '📸 Pedir foto dos aparelhos',
            text: `Pode enviar uma foto dos equipamentos de internet, como roteador e ONU, por favor? Enquanto isso, vou realizar alguns ajustes na sua rede.`,
            clientKeywords: ['sem internet', 'sem sinal', 'sem conexao', 'caiu', 'nao funciona', 'nao tem internet', 'sem acesso', 'estou sem internet', 'nao retornou', 'sem rede', 'site específico', 'rompimento', 'luz vermelha'],
            agentKeywords: [],
            priority: 9,
        },
        {
            id: 'sem-tirar-tomada',
            category: 'semconexao',
            label: '🔌 Pedir pra tirar da tomada',
            text: `Pode retirar da tomada os equipamentos de internet, como roteador e ONU, por favor? Pode deixar desligados por enquanto, já vou avisar quando puder ligar novamente.`,
            clientKeywords: ['continua vermelho'],
            agentKeywords: ['enviar uma foto dos aparelhos'],
            priority: 8,
        },
        {
            id: 'sem-ligar-novamente',
            category: 'semconexao',
            label: '🔌 Pode ligar de volta',
            text: `Agora pode ligar os equipamentos novamente, por favor.`,
            clientKeywords: ['retirei', 'tirei', 'desliguei'],
            agentKeywords: ['Pode retirar os dois aparelhos da tomada'],
            priority: 7,
        },
        {
            id: 'visita-explicacao',
            category: 'semconexao',
            label: '⚠️ Informar caso de visita',
            text: `Realizei alguns ajustes, porém realmente a conexão não retornou. Para esse caso, será necessária uma visita técnica no local. Vou verificar a disponibilidade da agenda`,
            clientKeywords: ['nao voltou', 'continua sem internet', 'luz vermelha', 'los'],
            agentKeywords: ['Agora pode ligar os aparelhos novamente', 'Poderia enviar uma foto dos aparelhos da internet, por favor? Enquanto isso vou realizar alguns ajustes aqui no sistema.', 'sem conexao'],
            priority: 6,
        },
        {
            id: 'disponibilidade-visita',
            category: 'semconexao',
            label: '✅/❌ Disponibilidade',
            text: `Teriam disponibilidade para Amanhã no periodo da manhã?`,
            clientKeywords: [],
            agentKeywords: ['Realizei alguns ajustes, porém realmente a conexão não retornou. Para esse caso, será necessária uma visita técnica no local. Vou verificar a disponibilidade da agenda'],
            priority: 6,
        },
        {
            id: 'visita-agendada',
            category: 'semconexao',
            label: '📅 Visita agendada',
            text: `Prezado(a) {{NAME}},\n\nSerá necessário o envio de um técnico até o local para resolver a situação.\n\nVou transferi-lo(a) agora para o nosso setor de Agendamentos.\n\n📝 *Protocolo*: {{PROTOCOL}}\n\nOs agendamentos são realizados exclusivamente em horário comercial:\n🕒 *Segunda a sexta-feira*: 08h00 às 11h30 | 13h30 às 18h00\n🕒 *Sábado*: 08h00 às 12h00\n\nPor gentileza, aguarde. Em breve, você será atendido dentro do horário informado.`,
            clientKeywords: [],
            agentKeywords: ['Realizei alguns ajustes, porém realmente a conexão não retornou. Para esse caso, será necessária uma visita técnica no local.', 'encaminhar', 'visita'],
            priority: 5,
        },

        // ─── SKY+ ─────────────────────────────────────────────────────────
        {
            id: 'sky-passo-a-passo',
            category: 'sky',
            label: '📱 Passo a passo Sky+',
            text: `https://drive.google.com/file/d/1gO3nTAp_tAKkgsphCJh-8zdYjg9XBlne/view?usp=sharing\n\n📱 Passo a passo para acesso ao Sky+\n\n 1. Acesse a loja de aplicativos do seu celular (Play Store ou App Store) e baixe o aplicativo Sky+.\n\n 2. Abra o aplicativo e conceda todas as permissões solicitadas, necessárias para o funcionamento completo dos recursos.\n\n 3. Na tela inicial, clique em “Operadoras”, pesquise por ALT - GGNET e selecione a opção correspondente.\n\n 4. Ao acessar a tela de login, insira o e-mail e a senha recebidos e clique em “Entrar”.\n\n 5. Em seguida, crie seu perfil. Pronto! Seu acesso ao Sky+ estará liberado.\n\n ✅ Pronto! Seu acesso ao conteúdo está liberado.`,
            clientKeywords: ['sky', 'sky+', 'skymais', 'sky mais'],
            agentKeywords: [],
            priority: 9,
        },
        {
            id: 'prime-passo-a-passo',
            category: 'sky',
            label: '📱 Passo a passo Prime Video',
            text: `🎬 Ativação do Prime Vídeo (caso incluso no plano)\n\n 1. No aplicativo da Sky+ instalado no celular, clique no ícone de perfil (canto superior direito).\n\n 2. Acesse a opção “Meus produtos”.\n\n 3. Localize “Amazon Prime” e clique em “Ativar conta”.\n\n 4. Selecione a opção "Criar Conta" e preencha os dados solicitados utilizando o mesmo e-mail cadastrado no Sky+ e clique em “Verificar e-mail”.\n\n 5. Insira o código recebido no seu e-mail e selecione “Criar sua conta da Amazon”.\n\n 6. Clique em “Criar chave de acesso” para configurar biometria ou reconhecimento facial (opcional).\n\n 7. Clique em “Continuar”.\n\n 8. Informe seu CPF e salve as alterações.\n\n 9. Após a ativação, selecione a opção “Acessar agora no app” para baixar ou abrir o aplicativo.\n\n 10. Faça login utilizando os dados cadastrados ou utilize biometria/reconhecimento facial.\n\n ✅ Pronto! Seu acesso ao conteúdo está liberado.`,
            clientKeywords: ['prime video', 'amazon prime'],
            agentKeywords: ['sky+'],
            priority: 9,
        },

        // ─── TROCA DE SENHA ───────────────────────────────────────────────
        {
            id: 'senha-pedir-nova',
            category: 'senha',
            label: '🔑 Pedir a nova senha',
            text: `Crie sua nova senha
Ela deve ter no mínimo 8 caracteres e incluir:
* Pelo menos uma letra maiúscula;
* Pelo menos uma letra minúscula;
* Pelo menos um número;
* Pelo menos um caractere especial (!, @, #, $).`,
            clientKeywords: ['trocar senha', 'mudar senha', 'troca de senha'],
            agentKeywords: [],
            priority: 8,
        },
        {
            id: 'nome-pedir-novo',
            category: 'senha',
            label: '📺 Pedir o novo nome',
            text: `Por gentileza, me informa qual nome novo que você gostaria.`,
            clientKeywords: ['trocar nome do wifi', 'trocar nome', 'troca de nome'],
            agentKeywords: [],
            priority: 8,
        },
        {
            id: 'senha-feita',
            category: 'senha',
            label: '✅ Senha alterada',
            text: `Senha alterada com sucesso. Pode reconectar os aparelhos com a nova senha, por favor.`,
            clientKeywords: [],
            agentKeywords: ['me informa qual senha nova'],
            priority: 7,
        },
        {
            id: 'nome-feito',
            category: 'senha',
            label: '✅ Nome alterado',
            text: `Nome alterado com sucesso. Pode reconectar os aparelhos com o novo nome, por favor.`,
            clientKeywords: [],
            agentKeywords: ['me informa qual nome novo'],
            priority: 7,
        },
    ];

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  STORAGE                                                         ║
    // ╚══════════════════════════════════════════════════════════════════╝
    const Storage = {
        load() {
            try {
                const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
                return raw ? JSON.parse(raw) : {};
            } catch {
                return {};
            }
        },
        save(state) {
            try {
                localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state));
            } catch (e) {
                console.warn('[ALTCopilot] Falha ao salvar estado:', e);
            }
        },
        patch(partial) {
            const current = this.load();
            this.save({ ...current, ...partial });
        },
        markPresetUsed(contactKey, presetId) {
            const state = this.load();
            const used = state.usedPresets || {};

            if (!used[contactKey]) used[contactKey] = [];
            if (!used[contactKey].includes(presetId)) {
                used[contactKey].push(presetId);
            }

            this.save({ ...state, usedPresets: used });
        },

        getUsedPresets(contactKey) {
            const state = this.load();
            return state.usedPresets?.[contactKey] || [];
        },
    };

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  CHAT READER                                                     ║
    // ╚══════════════════════════════════════════════════════════════════╝
    const ChatReader = {
        _selectedTab() {
            return document.querySelector(
                CONFIG.SELECTORS.selectedTicketTab
            );
        },

        getCurrentContact() {
            const tab = this._selectedTab();

            if (!tab) {
                return null;
            }

            let ticketId =
                tab.getAttribute('data-entity-id') || '';

            if (!ticketId) {
                const href =
                      tab.getAttribute('href') || '';

                ticketId =
                    href.match(/\/tickets\/(\d+)/i)?.[1] || '';
            }

            if (!ticketId) {
                return null;
            }

            const titleEl =
                  tab.querySelector(
                      CONFIG.SELECTORS.selectedTicketTitle
                  );

            const name =
                  titleEl?.getAttribute('title')?.trim() ||
                  titleEl?.textContent?.trim() ||
                  `Ticket #${ticketId}`;

            return {
                name,
                number: '',
                ticketId,
                displayName: `${name} - #${ticketId}`,
                key: `ticket_${ticketId}`,
                title: name,
            };
        },

        getActiveTicketRoot() {
            const contact =
                  this.getCurrentContact();

            if (!contact?.ticketId) {
                return null;
            }

            const ticketId =
                  contact.ticketId;

            /*
         * PRIMEIRA OPÇÃO:
         *
         * layout do MESMO ticket selecionado
         * e obrigatoriamente ativo.
         */
            const activeLayout =
                  document.querySelector(
                      `[data-test-id="ticket-${ticketId}-standard-layout"][data-is-active="true"]`
                  );

            if (activeLayout) {
                return activeLayout;
            }

            /*
         * Fallback.
         */
            const conversation =
                  document.querySelector(
                      `.conversation-polaris[data-ticket-id="${ticketId}"]`
                  );

            if (conversation) {
                const layout =
                      conversation.closest(
                          '[data-test-id^="ticket-"][data-is-active="true"]'
                      );

                if (layout) {
                    return layout;
                }
            }

            return null;
        },

        getMessages() {
            const root =
                  this.getActiveTicketRoot();

            if (!root) {
                return [];
            }

            /*
         * MUITO IMPORTANTE:
         *
         * agora lê SOMENTE mensagens
         * do ticket atualmente selecionado.
         */
            const items =
                  root.querySelectorAll(
                      '[data-test-id="omni-log-comment-item"]'
                  );

            const messages = [];

            items.forEach((article) => {
                const bubble =
                      article.querySelector(
                          CONFIG.SELECTORS.messageBubble
                      );

                if (!bubble) {
                    return;
                }

                const type =
                      bubble.getAttribute('type') || '';

                let role = null;

                if (type === 'end-user') {
                    role = 'client';
                }
                else if (type === 'agent') {
                    role = 'agent';
                }
                else if (type === 'bot') {
                    role = 'bot';
                }
                else {
                    return;
                }

                const contentEl =
                      bubble.querySelector(
                          CONFIG.SELECTORS.messageContent
                      );

                if (!contentEl) {
                    return;
                }

                const text =
                      (
                          contentEl.innerText ||
                          contentEl.textContent ||
                          ''
                      ).trim();

                if (!text) {
                    return;
                }

                const senderEl =
                      article.querySelector(
                          CONFIG.SELECTORS.messageSender
                      );

                const timestampEl =
                      article.querySelector(
                          CONFIG.SELECTORS.messageTimestamp
                      );

                messages.push({
                    role,

                    author:
                    senderEl
                    ?.textContent
                    ?.trim() || '',

                    text,

                    time:
                    timestampEl
                    ?.textContent
                    ?.trim() || '',

                    type,
                });
            });

            return messages;
        },
    };

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  CHAT WRITER                                                     ║
    // ╚══════════════════════════════════════════════════════════════════╝
    const ChatWriter = {
        findInput() {
            /*
         * Não procura mais na página inteira.
         *
         * Primeiro descobre qual ticket está ativo.
         */
            const root =
                  ChatReader.getActiveTicketRoot();

            if (!root) {
                console.error(
                    '[ALTCopilot] Layout do ticket ativo não encontrado.'
                );

                return null;
            }

            /*
         * E SOMENTE dentro dele procura
         * o CKEditor.
         */
            for (
                const selector
                of CONFIG.SELECTORS.chatInput
            ) {
                const candidates =
                      root.querySelectorAll(
                          selector
                      );

                for (const el of candidates) {
                    if (
                        this._isUsable(el)
                    ) {
                        return el;
                    }
                }
            }

            return null;
        },

        _isUsable(el) {
            if (!el) {
                return false;
            }

            const rect =
                  el.getBoundingClientRect();

            const style =
                  window.getComputedStyle(el);

            if (
                style.display === 'none' ||
                style.visibility === 'hidden'
            ) {
                return false;
            }

            /*
         * Confere novamente se esse editor
         * pertence ao ticket ativo.
         */
            const layout =
                  el.closest(
                      '[data-test-id^="ticket-"][data-is-active]'
                  );

            if (
                layout &&
                layout.getAttribute(
                    'data-is-active'
                ) !== 'true'
            ) {
                return false;
            }

            return (
                rect.width > 0 &&
                rect.height > 0 &&
                el.getAttribute(
                    'contenteditable'
                ) === 'true'
            );
        },

        _escapeHtml(text) {
            return String(text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        },

        _textToHtml(text) {
            return String(text)
                .replace(/\r\n?/g, '\n')
                .split('\n')
                .map((line) => {
                /*
                 * Mantém linhas vazias
                 * entre parágrafos.
                 */
                if (!line) {
                    return '<p><br></p>';
                }

                return (
                    `<p>${this._escapeHtml(line)}</p>`
                );
            })
                .join('');
        },

        insertText(text) {
            const input =
                  this.findInput();

            if (!input) {
                console.error(
                    '[ALTCopilot] Campo do ticket ativo não encontrado.'
                );

                return false;
            }

            /*
         * Agora é a instância do CKEditor
         * DO TICKET ATUAL.
         */
            const editor =
                  input.ckeditorInstance;

            if (!editor) {
                console.error(
                    '[ALTCopilot] Instância do CKEditor não encontrada.',
                    input
                );

                return false;
            }

            try {
                const html =
                      this._textToHtml(
                          text
                      );

                /*
             * Substitui TODO o rascunho atual.
             *
             * Não existe:
             *
             * Selection
             * Range
             * Ctrl+A
             * ClipboardEvent
             * execCommand
             * fallback
             *
             * Portanto não tem mais motivo
             * para piscar seleção na tela.
             */
                editor.setData(
                    html
                );

                /*
             * Cursor no final.
             */
                if (
                    editor.model &&
                    editor.model.document
                ) {
                    editor.model.change(
                        (writer) => {
                            const modelRoot =
                                  editor.model.document
                            .getRoot();

                            if (modelRoot) {
                                writer.setSelection(
                                    modelRoot,
                                    'end'
                                );
                            }
                        }
                    );
                }

                /*
             * Foco novamente no editor.
             */
                if (
                    editor.editing &&
                    editor.editing.view
                ) {
                    editor.editing.view.focus();
                }

                /*
             * Confirma que o CKEditor
             * realmente recebeu os dados.
             */
                const result =
                      editor.getData?.() || '';

                const plainResult =
                      result
                .replace(
                    /<[^>]*>/g,
                    ''
                )
                .replace(
                    /&nbsp;/g,
                    ' '
                )
                .trim();

                if (
                    String(text).trim() &&
                    !plainResult
                ) {
                    console.error(
                        '[ALTCopilot] CKEditor não confirmou a inserção.'
                    );

                    return false;
                }

                console.log(
                    '[ALTCopilot] Preset inserido no ticket:',
                    ChatReader
                    .getCurrentContact()
                    ?.ticketId
                );

                return true;

            } catch (error) {
                console.error(
                    '[ALTCopilot] Erro ao preencher CKEditor:',
                    error
                );

                return false;
            }
        },
    };
    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  PRESET ENGINE                                                   ║
    // ║  Lógica de scoring + substituição de variáveis                   ║
    // ╚══════════════════════════════════════════════════════════════════╝
    const PresetEngine = {
        // Normaliza texto: remove acentos, lowercase, trim
        _normalize(text) {
            return text
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^\w\s]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        },

        // Extrai protocolo do histórico
        extractProtocol(messages) {
            const text = messages.map((m) => m.text).join('\n');
            const m1 = text.match(/protocolo[^\d]{0,30}(\d{7,10})/i);
            if (m1) return m1[1];
            const m2 = text.match(/\b(\d{7,10})\b/);
            return m2 ? m2[1] : null;
        },

        // Substitui {{PROTOCOL}} pelo protocolo extraído
        // ({{NAME}} fica literal — o sistema do chat substitui)
        fillVariables(text, messages) {
            const protocol = this.extractProtocol(messages);
            const contact = ChatReader.getCurrentContact();

            if (contact?.name) {
                text = text.replace(/\{\{NAME\}\}/g, contact.name);
            }
            if (protocol) {
                text = text.replace(/\{\{PROTOCOL\}\}/g, protocol);
            }
            return text;
        },

        /**
         * Calcula score de relevância de cada preset com base nas
         * últimas mensagens do CLIENTE.
         *
         * Algoritmo:
         * - Pega últimas 5 mensagens do cliente
         * - Mensagem mais recente = peso maior (recencyWeight)
         * - Cada keyword encontrada soma: priority * recencyWeight
         * - Bonus extra se a keyword bate na ÚLTIMA mensagem
         *
         * Retorna presets com score > 0, ordenados desc.
         */
        getSuggested(messages, limit = 6) {
            const clientMsgs = messages
            .filter((m) => m.role === 'client')
            .slice(-5);

            const agentMsgs = messages
            .filter((m) => m.role === 'agent')
            .slice(-5);

            /*
     * Estado desse ticket.
     *
     * Se ainda não usamos NENHUM preset,
     * o Bem-vindo será forçado na primeira posição.
     */
            const contactKey =
                  Observer._getContactKey();

            const used =
                  Storage.getUsedPresets(
                      contactKey
                  );

            const welcome =
                  PRESETS.find(
                      (p) => p.id === 'welcome'
                  );

            const scored =
                  PRESETS.map((preset) => {
                      let score = 0;
                      let matched = false;

                      /*
             * Bem-vindo não participa mais
             * do score normal.
             *
             * Ele será controlado manualmente
             * mais abaixo.
             */
                      if (preset.id === 'welcome') {
                          return {
                              preset,
                              score: 0,
                              matched: false
                          };
                      }

                      // CLIENTE
                      clientMsgs.forEach(
                          (msg, idx) => {
                              const recency =
                                    (idx + 1) /
                                    clientMsgs.length;

                              const isLast =
                                    idx ===
                                    clientMsgs.length - 1;

                              const normMsg =
                                    this._normalize(
                                        msg.text
                                    );

                              (
                                  preset.clientKeywords ||
                                  []
                              ).forEach((kw) => {
                                  const normKw =
                                        this._normalize(
                                            kw
                                        );

                                  const regex =
                                        new RegExp(
                                            `\\b${normKw}\\b`,
                                            'i'
                                        );

                                  if (
                                      regex.test(
                                          normMsg
                                      )
                                  ) {
                                      matched = true;

                                      score +=
                                          preset.priority *
                                          recency *
                                          (
                                          isLast
                                          ? 2
                                          : 1
                                      );
                                  }
                              });
                          }
                      );

                      // ATENDENTE
                      agentMsgs.forEach(
                          (msg, idx) => {
                              const recency =
                                    (idx + 1) /
                                    agentMsgs.length;

                              const isLast =
                                    idx ===
                                    agentMsgs.length - 1;

                              const normMsg =
                                    this._normalize(
                                        msg.text
                                    );

                              (
                                  preset.agentKeywords ||
                                  []
                              ).forEach((kw) => {
                                  const normKw =
                                        this._normalize(
                                            kw
                                        );

                                  if (
                                      normMsg.includes(
                                          normKw
                                      )
                                  ) {
                                      matched = true;

                                      score +=
                                          (
                                          preset.priority *
                                          0.8
                                      ) *
                                          recency *
                                          (
                                          isLast
                                          ? 2
                                          : 1
                                      );
                                  }
                              });
                          }
                      );

                      return {
                          preset,
                          score,
                          matched
                      };
                  });

            /*
     * Sugestões normais.
     */
            let results =
                scored
            .filter(
                (s) =>
                s.matched &&
                !used.includes(
                    s.preset.id
                )
            )
            .sort(
                (a, b) =>
                b.score -
                a.score
            )
            .map(
                (s) =>
                s.preset
            );

            /*
     * Se não teve nenhuma sugestão por keyword,
     * mantém os presets gerais.
     */
            if (!results.length) {
                results =
                    PRESETS.filter(
                    (p) =>
                    [
                        'um-momento',
                        'mais-algo'
                    ].includes(p.id) &&
                    !used.includes(p.id)
                );
            }

            /*
     * BEM-VINDO:
     *
     * Só aparece enquanto NENHUM preset
     * foi utilizado nesse ticket.
     */
            if (
                used.length === 0 &&
                welcome
            ) {
                /*
         * Segurança contra duplicação.
         */
                results =
                    results.filter(
                    (p) =>
                    p.id !== 'welcome'
                );

                results.unshift(
                    welcome
                );
            } else {
                /*
         * Depois que qualquer preset foi usado,
         * o Bem-vindo não aparece mais.
         */
                results =
                    results.filter(
                    (p) =>
                    p.id !== 'welcome'
                );
            }

            return results.slice(
                0,
                limit
            );
        },

        getByCategory(categoryId) {
            return PRESETS
                .filter((p) => p.category === categoryId)
                .sort((a, b) => b.priority - a.priority);
        },
    };

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  STYLES                                                          ║
    // ╚══════════════════════════════════════════════════════════════════╝
    const Styles = {
        inject() {
            if (document.getElementById('alt-copilot-styles')) return;
            const css = `
        #alt-copilot-fab {
          position: fixed;
          right: 10px;
          bottom: 130px;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: #1181b7;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(0,0,0,.18);
          z-index: 999998;
          transition: transform .15s ease, box-shadow .15s ease;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        }
        #alt-copilot-fab:hover {
          transform: scale(1.06);
          box-shadow: 0 6px 18px rgba(0,0,0,.24);
        }
        #alt-copilot-fab svg { width: 24px; height: 24px; }

        #alt-copilot-panel {
          right: 20px; bottom: 80px;
          position: fixed;
          width: 480px;
          height: 450px;
          background: #ffffff;
          border: 1px solid #e3e8ed;
          border-radius: 12px;
          box-shadow: 0 12px 40px rgba(0,0,0,.18);
          z-index: 999999;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
          color: #2c3e50;
          overflow: hidden;
        }
        #alt-copilot-panel.hidden { display: none; }

        .altc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: #0c3455;
          color: #fff;
          user-select: none;
        }
        .altc-header-title {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: .3px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .altc-header-title .dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #4ade80;
        }
        .altc-header-actions { display: flex; gap: 4px; }
        .altc-icon-btn {
          width: 24px; height: 24px;
          border: none;
          background: transparent;
          color: #fff;
          cursor: pointer;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: .8;
          transition: transform .25s ease, opacity .12s ease, background .12s ease;
        }
        .altc-icon-btn:hover { opacity: 1; background: rgba(255,255,255,.12); }

        .altc-context {
          padding: 8px 14px;
          background: #f7f9fb;
          border-bottom: 1px solid #e3e8ed;
          font-size: 11px;
          color: #607080;
        }
        .altc-context strong { color: #2c3e50; font-weight: 600; }

        .altc-tabs {
          display: flex;
          gap: 2px;
          padding: 6px 6px 0 6px;
          border-bottom: 1px solid #e3e8ed;
          background: #fafbfc;
          overflow-x: auto;
          flex-shrink: 0;
        }
        .altc-tab {
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 500;
          color: #607080;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          white-space: nowrap;
          font-family: inherit;
          transition: all .12s ease;
        }
        .altc-tab:hover {
          color: #1181b7;
        }
        .altc-tab.active {
          color: #1181b7;
          border-bottom-color: #1181b7;
          font-weight: 600;
        }

        .altc-body {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .altc-preset {
          background: #f7f9fb;
          border: 1px solid #e3e8ed;
          border-radius: 8px;
          padding: 8px 10px;
          cursor: pointer;
          transition: all .12s ease;
          color: #2c3e50;
          text-align: left;
          font-family: inherit;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .altc-preset:hover {
          border-color: #1181b7;
          background: #eaf3f9;
        }
        .altc-preset:active { transform: scale(.98); }
        .altc-preset-label {
          font-size: 12px;
          font-weight: 600;
          color: #1181b7;
        }
        .altc-preset-text {
          font-size: 11px;
          line-height: 1.4;
          color: #607080;
          white-space: pre-wrap;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .altc-empty {
          padding: 24px 12px;
          text-align: center;
          color: #97a4b3;
          font-size: 12px;
          line-height: 1.5;
        }
      `;
            const style = document.createElement('style');
            style.id = 'alt-copilot-styles';
            style.textContent = css;
            document.head.appendChild(style);
        },
    };

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  UI                                                              ║
    // ╚══════════════════════════════════════════════════════════════════╝
    const UI = {
        fab: null,
        panel: null,
        body: null,
        contextEl: null,
        tabsEl: null,
        activeTab: 'sugeridas',

        build() {
            Styles.inject();

            this.fab = document.createElement('div');
            this.fab.id = 'alt-copilot-fab';
            this.fab.title = 'ALT Copilot';
            this.fab.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      `;
            this.fab.addEventListener('mouseenter', () => this.toggle(true));

            this.fab.addEventListener('mouseleave', () => this.toggle(false));
            document.body.appendChild(this.fab);

            this.panel = document.createElement('div');
            this.panel.id = 'alt-copilot-panel';
            this.panel.classList.add('hidden');

            this.panel.addEventListener('mouseenter', () => this.toggle(true));

            this.panel.addEventListener('mouseleave', () => this.toggle(false));
            document.body.appendChild(this.panel);

            const tabsHTML = [
                `<button class="altc-tab active" data-tab="sugeridas">⭐ Sugeridas</button>`,
                ...CATEGORIES.map((c) => `<button class="altc-tab" data-tab="${c.id}">${c.label}</button>`),
            ].join('');

            this.panel.innerHTML = `
        <div class="altc-header">
          <div class="altc-header-title">
            <span class="dot"></span>
            <span>ALT Copilot</span>
          </div>
          <div class="altc-header-actions">
            <button class="altc-icon-btn" data-action="refresh" title="Atualizar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
            <button class="altc-icon-btn" data-action="close" title="Fechar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="altc-context">
          Cliente: <strong data-ref="contact">—</strong>
        </div>
        <div class="altc-tabs" data-ref="tabs">${tabsHTML}</div>
        <div class="altc-body" data-ref="body">
          <div class="altc-empty">Selecione um atendimento para ver sugestões.</div>
        </div>
      `;
            document.body.appendChild(this.panel);

            this.body = this.panel.querySelector('[data-ref="body"]');
            this.contextEl = this.panel.querySelector('[data-ref="contact"]');
            this.tabsEl = this.panel.querySelector('[data-ref="tabs"]');

            this.panel.querySelector('[data-action="close"]').addEventListener('click', () => this.toggle(false));
            this.panel.querySelector('[data-action="refresh"]').addEventListener('click', () => {
                const contactKey = Observer._getContactKey();

                const state = Storage.load();

                if (state.usedPresets?.[contactKey]) {
                    delete state.usedPresets[contactKey];
                    Storage.save(state);
                }

                Observer.lastMessageSignature = '';

                UI.refreshContext();
                App.render();

                const btn = this.panel.querySelector('[data-action="refresh"]');

                btn.style.transform = 'rotate(180deg)';

                setTimeout(() => {
                    btn.style.transform = '';
                }, 250);
            });

            // Eventos das abas
            this.tabsEl.querySelectorAll('.altc-tab').forEach((tab) => {
                tab.addEventListener('click', () => {
                    this.setActiveTab(tab.dataset.tab);
                });
            });

            const state = Storage.load();

            if (state.panelOpen) this.toggle(true);
        },

        toggle(force) {
            const open = force !== undefined ? force : this.panel.classList.contains('hidden');
            this.panel.classList.toggle('hidden', !open);
            Storage.patch({ panelOpen: open });
            if (open) {
                this.refreshContext();
                App.render();
            }
        },

        isOpen() {
            return !this.panel.classList.contains('hidden');
        },

        refreshContext() {
            const contact = ChatReader.getCurrentContact();
            this.contextEl.textContent = contact?.displayName || '—';
        },

        setActiveTab(tabId) {
            this.activeTab = tabId;
            this.tabsEl.querySelectorAll('.altc-tab').forEach((t) => {
                t.classList.toggle('active', t.dataset.tab === tabId);
            });
            App.render();
        },

        showEmpty(msg) {
            this.body.innerHTML = `<div class="altc-empty">${msg}</div>`;
        },

        showPresets(presets, messages) {
            this.body.innerHTML = '';

            if (!presets.length) {
                this.showEmpty('Nenhuma sugestão disponível.');
                return;
            }

            presets.forEach((preset) => {
                const filledText = PresetEngine.fillVariables(preset.text, messages);

                const btn = document.createElement('button');
                btn.className = 'altc-preset';
                btn.innerHTML = `
                    <div class="altc-preset-label"></div>
                    <div class="altc-preset-text"></div>
                `;

                btn.querySelector('.altc-preset-label').textContent = preset.label;
                btn.querySelector('.altc-preset-text').textContent = filledText;

                btn.addEventListener('click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    if (btn.dataset.inserting === '1') {
                        return;
                    }

                    btn.dataset.inserting = '1';

                    try {
                        const ok =
                              await ChatWriter.insertText(
                                  filledText,
                                  'replace'
                              );

                        if (!ok) {
                            btn.style.borderColor = '#ef4444';

                            setTimeout(() => {
                                btn.style.borderColor = '';
                            }, 800);

                            return;
                        }

                        const contactKey =
                              Observer._getContactKey();

                        Storage.markPresetUsed(
                            contactKey,
                            preset.id
                        );

                        btn.style.borderColor = '#4ade80';
                        btn.style.background = '#f0fdf4';

                        setTimeout(() => {
                            btn.style.borderColor = '';
                            btn.style.background = '';
                        }, 600);

                    } finally {
                        setTimeout(() => {
                            delete btn.dataset.inserting;
                        }, 300);
                    }
                });

                this.body.appendChild(btn);
            });
        },
    };

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  OBSERVER                                                        ║
    // ╚══════════════════════════════════════════════════════════════════╝
    const Observer = {
        debounceTimer: null,
        lastContactKey: '',
        lastMessageSignature: '',

        start() {
            this.lastContactKey = this._getContactKey();
            this.lastMessageSignature = this._messageSignature();

            const obs = new MutationObserver((records) => {
                const relevant = records.some((record) => {
                    const target =
                        record.target?.nodeType === Node.ELEMENT_NODE
                            ? record.target
                            : record.target?.parentElement;

                    return !target?.closest?.('#alt-copilot-panel, #alt-copilot-fab');
                });

                if (relevant) this.onMutation();
            });

            obs.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: [
                    'data-entity-is-selected',
                    'data-entity-id',
                    'data-is-active',
                    'data-channel',
                    'data-test-id',
                    'aria-label',
                ],
            });

            setInterval(() => this.onMutation(), 1000);

            console.log('[ALTCopilot] Observer Zendesk ativo');
        },

        _getContactKey() {
            const contact = ChatReader.getCurrentContact();
            return contact?.key || '';
        },

        _messageSignature() {
            return ChatReader.getMessages()
                .slice(-8)
                .map((m) => `${m.role}:${m.text}`)
                .join('|');
        },

        onMutation() {
            clearTimeout(this.debounceTimer);

            this.debounceTimer = setTimeout(() => {
                const currentKey = this._getContactKey();
                const contactChanged = currentKey !== this.lastContactKey;

                if (contactChanged) {
                    console.log(
                        '[ALTCopilot] Ticket mudou:',
                        this.lastContactKey,
                        '->',
                        currentKey
                    );

                    this.lastContactKey = currentKey;
                    this.lastMessageSignature = this._messageSignature();

                    UI.activeTab = 'sugeridas';

                    UI.tabsEl.querySelectorAll('.altc-tab').forEach((t) => {
                        t.classList.toggle('active', t.dataset.tab === 'sugeridas');
                    });

                    UI.refreshContext();

                    if (UI.isOpen()) {
                        App.render();
                    }

                    return;
                }

                const signature = this._messageSignature();

                if (signature !== this.lastMessageSignature) {
                    this.lastMessageSignature = signature;

                    if (
                        UI.activeTab === 'sugeridas' &&
                        UI.isOpen()
                    ) {
                        App.render();
                    }

                }
            }, 250);
        },
    };

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  APP                                                             ║
    // ╚══════════════════════════════════════════════════════════════════╝
    const App = {
        render() {
            const messages = ChatReader.getMessages();

            UI.refreshContext();

            let presets;

            if (UI.activeTab === 'sugeridas') {
                presets = PresetEngine.getSuggested(messages);
            } else {
                presets = PresetEngine.getByCategory(UI.activeTab);
            }

            UI.showPresets(presets, messages);
        },

        init() {
            console.log('[ALTCopilot] Iniciando…');

            UI.build();
            Observer.start();
        },
    };

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  BOOT                                                            ║
    // ╚══════════════════════════════════════════════════════════════════╝
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => App.init());
    } else {
        App.init();
    }

    window.ALTCopilot = {
        App,
        ChatReader,
        ChatWriter,
        UI,
        Storage,
        PresetEngine,
        PRESETS,
        CATEGORIES,
        CONFIG,

        debugZendesk() {
            const tab = ChatReader._selectedTab();
            const input = ChatWriter.findInput();
            const candidates = ChatReader._collectMessageCandidates();

            const info = {
                contact: ChatReader.getCurrentContact(),

                selectedTab: tab
                    ? {
                        ticketId: tab.getAttribute('data-entity-id'),
                        selected: tab.getAttribute('data-entity-is-selected'),
                        title:
                            tab.querySelector(
                                CONFIG.SELECTORS.selectedTicketTitle
                            )?.textContent?.trim() || '',
                    }
                    : null,

                input: input
                    ? {
                        testId: input.getAttribute('data-test-id'),
                        ariaLabel: input.getAttribute('aria-label'),
                        contenteditable: input.getAttribute('contenteditable'),
                    }
                    : null,

                messages: candidates.map((x) => ({
                    role: x.role,
                    text: x.text.slice(0, 300),
                    testId: x.el.getAttribute('data-test-id') || '',
                })),
            };

            console.log('[ALTCopilot] Debug Zendesk:', info);
            console.table(info.messages);

            return info;
        },
    };
})();
