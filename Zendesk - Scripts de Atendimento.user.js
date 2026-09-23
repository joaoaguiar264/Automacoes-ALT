// ==UserScript==
// @name         Zendesk - Scripts de Atendimento
// @namespace    http://tampermonkey.net/
// @version      2.1.1
// @description  Scripts de atendimento por ticket no Zendesk
// @match        https://brasiltecparsupport.zendesk.com/agent/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-idle
// @updateURL    https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/Zendesk%20-%20Scripts%20de%20Atendimento.user.js
// @downloadURL  https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/Zendesk%20-%20Scripts%20de%20Atendimento.user.js
// @icon         https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/icon.png
// ==/UserScript==
(function () {
    'use strict';
    const STORAGE_PREFIX = 'zendesk_form_ticket_';
    const POS_KEY = 'zendesk_popup_pos_v2';
    const VIS_KEY = 'zendesk_popup_visible_v2';
    const SIZE_KEY = 'zendesk_popup_size_v2';
    // 🎯 Meus tickets Abertos
    const OPEN_VIEW_ID = '41940549244820';
    let currentTicketKey = null;
    let currentTicketMeta = null;
    let currentScriptId = null;
    let saveTimer = null;
    let checkTimer = null;
    let suppressSave = false;
    const clean = v => String(v ?? '')
        .replace(/\s+/g, ' ')
        .trim();
    const valOrNA = v => clean(v) || 'Não informado.';
    const extractPhone = value => {
        const m = String(value || '')
            .match(/\+?[\d\s\-()]{8,}/);
        if (!m)
            return null;
        const digits = m[0].replace(/\D/g, '');
        return digits.length >= 8
            ? digits
            : null;
    };
    // ============================================================
    // ZENDESK
    // ============================================================
    const getOpenTicketCount = () => {
        const el = document.querySelector(`a[data-test-id="views_views-list_item-view-${OPEN_VIEW_ID}"] ` +
            `[data-test-id="views_views-list_item_count"]`);
        if (!el)
            return null;
        const n = parseInt(clean(el.textContent).replace(/\D/g, ''), 10);
        return Number.isFinite(n)
            ? n
            : null;
    };
    /*
        Esse é o ponto principal da detecção.
        Pode haver vários tickets ABERTOS no topo do Zendesk, mas somente
        o que possui:
        data-entity-is-selected="true"
        está realmente selecionado na tela.
    */
    const getSelectedTab = () => {
        return document.querySelector('a[data-test-id="header-tab"]' +
            '[data-entity-type="TICKET_ENTITY_TYPE"]' +
            '[data-entity-is-selected="true"]');
    };
    const findPhoneInPage = () => {
        const tel = document.querySelector('a[href^="tel:"]');
        if (tel) {
            return (extractPhone(tel.getAttribute('href')) ||
                extractPhone(tel.textContent));
        }
        const selectors = [
            '[data-test-id*="phone"]',
            '[data-test-id*="telefone"]',
            'input[name*="phone" i]',
            'input[name*="telefone" i]',
            'input[aria-label*="phone" i]',
            'input[aria-label*="telefone" i]'
        ];
        for (const el of document.querySelectorAll(selectors.join(','))) {
            const p = extractPhone(el.value) ||
                extractPhone(el.getAttribute('title')) ||
                extractPhone(el.getAttribute('aria-label')) ||
                extractPhone(el.textContent);
            if (p)
                return p;
        }
        return null;
    };
    const getTicketContext = () => {
        const tab = getSelectedTab();
        if (!tab)
            return null;
        let ticketId = tab.getAttribute('data-entity-id');
        if (!ticketId) {
            const m = (tab.getAttribute('href') || '').match(/tickets\/(\d+)/i);
            ticketId =
                m?.[1] || null;
        }
        if (!ticketId)
            return null;
        const titleEl = tab.querySelector('[data-test-id="header-tab-title"]');
        const name = clean(titleEl?.getAttribute('title') ||
            titleEl?.textContent) ||
            `Ticket #${ticketId}`;
        return {
            key: `ticket_${ticketId}`,
            ticketId,
            name,
            phone: findPhoneInPage()
        };
    };
    const loadState = key => {
        return GM_getValue(STORAGE_PREFIX + key, {
            script: null,
            data: {}
        });
    };
    const saveState = (key, state) => {
        if (!key)
            return;
        GM_setValue(STORAGE_PREFIX + key, state);
    };
    // ============================================================
    // HELPERS DOS FORMULÁRIOS
    // ============================================================
    const text = (id, label, placeholder = '') => ({
        type: 'text',
        id,
        label,
        placeholder
    });
    const date = (id, label) => ({
        type: 'date',
        id,
        label
    });
    const area = (id, label, placeholder = '') => ({
        type: 'textarea',
        id,
        label,
        placeholder
    });
    const select = (id, label, options) => ({
        type: 'select',
        id,
        label,
        options
    });
    const radio = (id, label, options) => ({
        type: 'radio',
        id,
        label,
        options
    });
    const check = (id, label, children = []) => ({
        type: 'checkbox',
        id,
        label,
        children
    });
    const card = (title, fields, required = false) => ({
        title,
        fields,
        required
    });
    // ============================================================
    // SCRIPTS
    // ============================================================
    const SCRIPTS = {
        // ========================================================
        // CONEXÃO LENTA
        // ========================================================
        lentidao: {
            label: 'Conexão lenta',
            cards: [
                card('Problema relatado pelo cliente', [
                    area('problemaCliente', 'Problema relatado pelo cliente', 'Exemplo: O cliente relata que a internet apresenta lentidão há dias...'),
                    text('aparelhosAfetados', 'A dificuldade ocorre em todos os aparelhos ou apenas em algum específico?', 'Exemplo: Apenas na TV da sala e no celular do cliente.'),
                    text('comodosAfetados', 'A dificuldade ocorre em todos os cômodos ou apenas em alguma área?', 'Exemplo: Ocorre somente no quarto dos fundos.'),
                    text('sitesAplicativos', 'A lentidão ocorre em algum site ou aplicativo específico ou em todos?', 'Exemplo: Lentidão em todos os apps, principalmente Netflix.'),
                    radio('fotoInstalacao', 'O cliente enviou foto ampla do local de instalação do roteador?', [
                        {
                            value: 'naoEnviou',
                            label: 'Cliente não enviou foto'
                        },
                        {
                            value: 'enviou',
                            label: 'Cliente enviou foto do roteador',
                            children: [
                                radio('padraoFoto', '', [
                                    {
                                        value: 'dentro',
                                        label: 'Instalação dentro dos padrões'
                                    },
                                    {
                                        value: 'fora',
                                        label: 'Instalação fora do padrão',
                                        children: [
                                            text('detalheForaPadrao', 'Detalhamento', 'Exemplo: Roteador dentro do móvel.')
                                        ]
                                    }
                                ])
                            ]
                        }
                    ])
                ], true),
                card('Configurações do roteador', [
                    area('configRoteador', '', 'Cole as informações do roteador aqui...')
                ], true),
                card('Alterações realizadas no roteador', [
                    check('nenhumaAlt', 'Nenhuma alteração realizada'),
                    check('reiniciadoRoteador', 'Reiniciado roteador'),
                    check('larg2_4', 'Largura de banda 2.4 GHz alterada para', [
                        text('larg2_4_txt', '', 'Ex: 20MHz')
                    ]),
                    check('canal2_4', 'Canal 2.4 GHz alterado para', [
                        text('canal2_4_txt', '', 'Ex: 1, 6 ou 11')
                    ]),
                    check('larg5', 'Largura de banda 5 GHz alterada para', [
                        text('larg5_txt', '', 'Ex: 80MHz')
                    ]),
                    check('canal5', 'Canal 5 GHz alterado para', [
                        text('canal5_txt', '', 'Ex: 36, 40, 44...')
                    ]),
                    check('dnsLan', 'DNS LAN alterado para', [
                        select('dnsLan_txt', '', [
                            '187.85.152.10 / 187.85.152.11'
                        ])
                    ]),
                    check('dnsWan', 'DNS WAN alterado para', [
                        select('dnsWan_txt', '', [
                            '187.85.152.10 / 187.85.152.11'
                        ])
                    ]),
                    check('dnsIncorreto', 'DNS incorreto — alteração remota não permitida'),
                    check('mtu1492', 'MTU alterado para 1492'),
                    check('ipv6', 'IPv6 habilitado em', [
                        select('ipv6_txt', '', [
                            'SLAAC',
                            'DHCP',
                            'AUTO'
                        ])
                    ]),
                    check('firmware', 'Firmware atualizado'),
                    check('limpeza', 'Limpeza da lista de aparelhos offline realizada'),
                    check('outrasAcoesRoteador', 'Outras ações realizadas no roteador', [
                        area('outrasAcoesRoteador_txt', '', 'Exemplo: Unificado as redes Wi-Fi')
                    ])
                ], true),
                card('Informações da ONU', [
                    area('infoOnu', '', 'Cole os dados da ONU aqui...')
                ], true),
                card('Alterações realizadas na ONU', [
                    check('nenhumaAltOnu', 'Nenhuma alteração realizada'),
                    check('firmwareOnu', 'Atualizado Firmware'),
                    check('outrasAcoesOnu', 'Outras ações realizadas na ONU', [
                        area('outrasAcoesOnu_txt', '', 'Exemplo: Reiniciado equipamento e refeito provisionamento.')
                    ])
                ], true),
                card('Outras ações realizadas com o cliente', [
                    radio('outrasAcoesClienteTipo', '', [
                        {
                            value: 'nenhuma',
                            label: 'Nenhuma alteração realizada'
                        },
                        {
                            value: 'realizado',
                            label: 'Realizado as seguintes ações',
                            children: [
                                area('outrasAcoes', '', 'Exemplo: Orientado o cliente a retirar o roteador de dentro do móvel...')
                            ]
                        }
                    ])
                ], true),
                card('Histórico de atendimento', [
                    text('historicoAtendimento', '', 'Exemplo: Cliente possui 2 atendimentos nos últimos 3 meses')
                ], true),
                card('Considerações finais', [
                    radio('consideracoesFinais', '', [
                        {
                            value: 'Conexão normalizada após procedimentos.',
                            label: 'Conexão normalizada após procedimentos.'
                        },
                        {
                            value: 'Cliente parou de interagir no Zendesk, atendimento finalizado por inatividade.',
                            label: 'Cliente parou de interagir no Zendesk, atendimento finalizado por inatividade.'
                        },
                        {
                            value: 'Atendimento transferido para outro atendente (devido a intervalo / término de expediente).',
                            label: 'Atendimento transferido (intervalo / término de expediente).'
                        },
                        {
                            value: 'Problema persiste, encaminhado para Logística',
                            label: 'Problema persiste, encaminhado para Logística',
                            children: [
                                area('infoLogistica', 'Informações para o setor de logística', 'Insira as informações para o setor de logística')
                            ]
                        },
                        {
                            value: 'Outros',
                            label: 'Outros (especificar)',
                            children: [
                                area('infoOutros', 'Detalhamento do "Outros"', 'Descreva o "Outros"')
                            ]
                        }
                    ])
                ], true)
            ],
            generate(v) {
                const out = [
                    `Problema relatado pelo cliente: ${valOrNA(v.problemaCliente)}`,
                    `Aparelhos que apresentam dificuldade: ${valOrNA(v.aparelhosAfetados)}`,
                    `Local da dificuldade (cômodo/ambiente): ${valOrNA(v.comodosAfetados)}`,
                    `Site/App/Acessos afetados: ${valOrNA(v.sitesAplicativos)}`,
                    ''
                ];
                if (v.fotoInstalacao ===
                    'naoEnviou') {
                    out.push('Cliente não enviou foto do local onde o roteador está instalado, para melhor análise da dificuldade.', '');
                }
                if (v.fotoInstalacao ===
                    'enviou') {
                    let s = 'Cliente enviou foto do roteador';
                    if (v.padraoFoto ===
                        'dentro') {
                        s +=
                            ' - Instalação está dentro dos padrões.';
                    }
                    if (v.padraoFoto ===
                        'fora') {
                        s +=
                            ` - Instalação fora do padrão: ${valOrNA(v.detalheForaPadrao)}`;
                    }
                    out.push(s, '');
                }
                out.push('----------- TESTES REALIZADOS PELO CSA ONU / ROTEADOR -----------', '[CONFIGURAÇÕES DO ROTEADOR]', valOrNA(v.configRoteador), '', '[INFORMAÇÕES DA ONU]', valOrNA(v.infoOnu), '');
                const a = [];
                if (v.nenhumaAlt)
                    a.push('Nenhuma alteração realizada');
                if (v.reiniciadoRoteador)
                    a.push('Reiniciado roteador');
                if (v.larg2_4)
                    a.push(`Largura de banda 2.4 GHz alterada para: ${v.larg2_4_txt || ''}`);
                if (v.canal2_4)
                    a.push(`Canal 2.4 GHz alterado para: ${v.canal2_4_txt || ''}`);
                if (v.larg5)
                    a.push(`Largura de banda 5 GHz alterada para: ${v.larg5_txt || ''}`);
                if (v.canal5)
                    a.push(`Canal 5 GHz alterado para: ${v.canal5_txt || ''}`);
                if (v.dnsLan)
                    a.push(`DNS LAN alterado para: ${v.dnsLan_txt || ''}`);
                if (v.dnsWan)
                    a.push(`DNS WAN alterado para: ${v.dnsWan_txt || ''}`);
                if (v.dnsIncorreto)
                    a.push('DNS incorreto — alteração remota não permitida');
                if (v.mtu1492)
                    a.push('MTU alterado para 1492');
                if (v.ipv6)
                    a.push(`IPv6 habilitado em: ${v.ipv6_txt || ''}`);
                if (v.firmware)
                    a.push('Firmware atualizado');
                if (v.limpeza)
                    a.push('Limpeza da lista de aparelhos offline realizada');
                if (v.outrasAcoesRoteador &&
                    v.outrasAcoesRoteador_txt) {
                    a.push(v.outrasAcoesRoteador_txt);
                }
                const onu = [];
                if (!v.nenhumaAltOnu) {
                    if (v.firmwareOnu)
                        onu.push('Atualizado Firmware');
                    if (v.outrasAcoesOnu &&
                        v.outrasAcoesOnu_txt) {
                        onu.push(v.outrasAcoesOnu_txt);
                    }
                }
                const cli = v.outrasAcoesClienteTipo ===
                    'realizado' &&
                    v.outrasAcoes;
                if (a.length ||
                    onu.length ||
                    cli) {
                    out.push('[ALTERAÇÕES REALIZADAS]');
                    if (a.length)
                        out.push(`ROTEADOR: ${a.join(', ')}`);
                    if (onu.length)
                        out.push(`ONU: ${onu.join(', ')}`);
                    if (cli)
                        out.push(`Outras ações realizadas: ${v.outrasAcoes}`);
                    out.push('');
                }
                out.push('----------- HISTÓRICO DE ATENDIMENTO -----------', valOrNA(v.historicoAtendimento), '');
                out.push(`Considerações finais - ${v.consideracoesFinais ===
                    'Outros'
                    ? valOrNA(v.infoOutros)
                    : valOrNA(v.consideracoesFinais)}`);
                if (v.consideracoesFinais ===
                    'Problema persiste, encaminhado para Logística' &&
                    clean(v.infoLogistica)) {
                    out.push('', '---------- Dados para Logística inserir na O.S ----------', clean(v.infoLogistica));
                }
                return out.join('\n');
            }
        },
        // ========================================================
        // SEM CONEXÃO - ONU UP
        // ========================================================
        sem_conexao_onu_up: {
            label: 'Sem conexão - ONU UP',
            cards: [
                card('📡 Login desconectado', [
                    area('problemaCliente', 'Problema relatado pelo cliente', 'Descreva o problema relatado pelo cliente.')
                ], true),
                card('🔧 Configurações da ONU', [
                    area('configOnu', '', 'Cole os dados da ONU aqui...')
                ], true),
                card('Detalhes da desconexão', [
                    text('planoDesconectado', 'Plano desconectado desde', 'Ex: 09/09 às 14h'),
                    radio('equipReiniciados', 'Equipamentos reiniciados', [
                        {
                            value: 'Sim',
                            label: 'Sim'
                        },
                        {
                            value: 'Não',
                            label: 'Não'
                        }
                    ]),
                    radio('caboWanValidado', 'Validado cabo de rede na porta WAN do roteador', [
                        {
                            value: 'Sim',
                            label: 'Sim'
                        },
                        {
                            value: 'Não',
                            label: 'Não'
                        }
                    ]),
                    radio('wifiVisivel', 'Aparece o nome da rede Wi-Fi para o cliente', [
                        {
                            value: 'Sim',
                            label: 'Sim'
                        },
                        {
                            value: 'Não',
                            label: 'Não'
                        }
                    ]),
                    radio('radiusLog', 'Aparece tentativa de autenticação no log do radius', [
                        {
                            value: 'Não',
                            label: 'Não'
                        },
                        {
                            value: 'Sim',
                            label: 'Sim',
                            children: [
                                text('msgRadiusLog', 'Mensagem apresentada no log', 'Insira aqui a mensagem que apresenta')
                            ]
                        }
                    ]),
                    area('infoAdicionais', 'Informações adicionais', 'Detalhes adicionais do atendimento.')
                ], true),
                card('Histórico de atendimento', [
                    text('historicoAtendimento', '', 'Exemplo: Cliente possui 2 atendimentos nos últimos 3 meses')
                ], true),
                card('📌 Conclusão', [
                    radio('conclusao', '', [
                        {
                            value: 'Conexão normalizada',
                            label: 'Conexão normalizada'
                        },
                        {
                            value: 'Problema persiste, encaminhado para Logística',
                            label: 'Problema persiste, encaminhado para Logística',
                            children: [
                                area('infoLogistica', 'Informações para o setor de Logística inserir na O.S.', 'Insira as informações para a Logística')
                            ]
                        },
                        {
                            value: 'Problema persiste, visita técnica agendada',
                            label: 'Problema persiste, visita técnica agendada'
                        }
                    ])
                ], true)
            ],
            generate(v) {
                const out = [
                    `Problema relatado pelo cliente: ${valOrNA(v.problemaCliente)}`,
                    '',
                    '----------- TESTES REALIZADOS PELO CSA ONU / ROTEADOR -----------',
                    '[CONFIGURAÇÕES DA ONU]',
                    valOrNA(v.configOnu),
                    '',
                    `Plano desconectado desde: ${valOrNA(v.planoDesconectado)}`,
                    `Equipamentos reiniciados: ${valOrNA(v.equipReiniciados)}`,
                    `Validado cabo de rede na porta WAN do roteador: ${valOrNA(v.caboWanValidado)}`,
                    `Aparece o nome da rede Wi-Fi para o cliente: ${valOrNA(v.wifiVisivel)}`,
                    `Aparece tentativa de autenticação no log do radius: ${valOrNA(v.radiusLog)}`
                ];
                if (v.radiusLog ===
                    'Sim' &&
                    clean(v.msgRadiusLog)) {
                    out.push(`Mensagem apresentada no radius: ${clean(v.msgRadiusLog)}`);
                }
                if (clean(v.infoAdicionais)) {
                    out.push(`Informações adicionais: ${clean(v.infoAdicionais)}`);
                }
                out.push('', '----------- HISTÓRICO DE ATENDIMENTO -----------', valOrNA(v.historicoAtendimento), '');
                if (v.conclusao) {
                    out.push(`Conclusão: ${v.conclusao}`);
                }
                if (v.conclusao ===
                    'Problema persiste, encaminhado para Logística' &&
                    clean(v.infoLogistica)) {
                    out.push('', '----------- LOGÍSTICA / O.S -----------', '', clean(v.infoLogistica));
                }
                return out.join('\n');
            }
        },
        // ========================================================
        // SEM CONEXÃO - ONU DOWN
        // ========================================================
        sem_conexao_onu_down: {
            label: 'Sem conexão - ONU DOWN',
            cards: [
                card('📡 Sem acesso - ONU DOWN', [
                    area('problemaCliente', 'Problema relatado pelo cliente', 'Descreva o problema relatado pelo cliente.')
                ], true),
                card('Dados ONU', [
                    area('dadosOnu', '', 'Insira os dados da ONU')
                ], true),
                card('Testes realizados', [
                    select('alarmeOnu', 'Verificado ONU DOWN com alarme de Link', [
                        'LOS',
                        'Sem Energia',
                        'Down',
                        'Outro'
                    ]),
                    text('planoDesconectado', 'Plano desconectado desde', 'Ex: 10/09 14h30'),
                    text('sinalOnu', 'Último sinal da ONU', 'Ex: -25.4 dBm'),
                    radio('clientesCaixa', 'Demais clientes da caixa estão', [
                        {
                            value: 'Up',
                            label: 'Up'
                        },
                        {
                            value: 'Down',
                            label: 'Down'
                        }
                    ]),
                    radio('energiaLocal', 'Validado energia no local', [
                        {
                            value: 'Sim',
                            label: 'Sim'
                        },
                        {
                            value: 'Não',
                            label: 'Não'
                        }
                    ]),
                    radio('equipReiniciados', 'Equipamentos reiniciados', [
                        {
                            value: 'Sim',
                            label: 'Sim'
                        },
                        {
                            value: 'Não',
                            label: 'Não'
                        }
                    ]),
                    area('infoAdicionais', 'Informações adicionais', 'Detalhes adicionais do atendimento.')
                ], true),
                card('Histórico de atendimento', [
                    text('historicoAtendimento', '', 'Exemplo: Cliente possui 2 atendimentos nos últimos 3 meses')
                ], true),
                card('📌 Conclusão', [
                    radio('conclusao', '', [
                        {
                            value: 'Conexão normalizada',
                            label: 'Conexão normalizada'
                        },
                        {
                            value: 'Problema persiste, encaminhado para Logística',
                            label: 'Problema persiste, encaminhado para Logística',
                            children: [
                                area('infoLogistica', 'Informações para o setor de Logística inserir na O.S.', 'Será preenchido automaticamente ao gerar, mas você pode editar.')
                            ]
                        }
                    ])
                ], true)
            ],
            generate(v) {
                const out = [
                    '',
                    `Problema relatado pelo cliente: ${valOrNA(v.problemaCliente)}`,
                    '',
                    '----------- DADOS ONU -----------',
                    '',
                    valOrNA(v.dadosOnu),
                    '',
                    '----------- TESTES REALIZADOS PELO CSA ONU / ROTEADOR -----------',
                    '',
                    `Verificado ONU DOWN com alarme de Link: ${valOrNA(v.alarmeOnu)}`
                ];
                if (clean(v.planoDesconectado)) {
                    out.push(`Plano desconectado desde: ${clean(v.planoDesconectado)}`);
                }
                if (clean(v.sinalOnu)) {
                    out.push(`Último sinal da ONU: ${clean(v.sinalOnu)}`);
                }
                out.push(`Demais clientes da caixa estão: ${valOrNA(v.clientesCaixa)}`, `Validado energia no local: ${valOrNA(v.energiaLocal)}`, `Equipamentos reiniciados: ${valOrNA(v.equipReiniciados)}`);
                if (clean(v.infoAdicionais)) {
                    out.push('', `Informações adicionais: ${clean(v.infoAdicionais)}`);
                }
                if (clean(v.historicoAtendimento)) {
                    out.push('', '----------- HISTÓRICO DE ATENDIMENTO -----------', '', `Histórico de atendimento: ${clean(v.historicoAtendimento)}`);
                }
                if (v.conclusao) {
                    out.push('', `Conclusão: ${v.conclusao}`);
                }
                if (v.conclusao ===
                    'Problema persiste, encaminhado para Logística') {
                    const log = clean(v.infoLogistica) ||
                        (`Verificado ONU DOWN com alarme de link: ${valOrNA(v.alarmeOnu)}` +
                            '\nEncaminhar técnico no local.');
                    out.push('', '----------- LOGÍSTICA / O.S -----------', '', log);
                }
                return out.join('\n');
            }
        },
        // ========================================================
        // CONECTADO SEM INTERNET
        // ========================================================
        conectado_sem_internet: {
            label: 'Conectado sem Internet',
            cards: [
                card('📶 Login conectado - mas não navega', [
                    area('problemaCliente', 'Problema relatado pelo cliente', 'Exemplo: Cliente informa que todos os aparelhos estão conectados ao Wi-Fi, mas aparece a mensagem sem acesso à internet.')
                ], true),
                card('🔧 Configurações do roteador', [
                    area('configRoteador', '', 'Cole as informações do roteador aqui. Caso não haja acesso ou seja Mikrotik, registre aqui.')
                ], true),
                card('Ações / Alterações realizadas no roteador', [
                    check('nenhumaAlt', 'Nenhuma alteração realizada'),
                    check('reiniciadoRoteador', 'Reiniciado roteador'),
                    check('larg2_4', 'Largura de banda 2.4 GHz alterada para', [
                        text('larg2_4_txt', '', 'Ex: 20MHz')
                    ]),
                    check('canal2_4', 'Canal 2.4 GHz alterado para', [
                        text('canal2_4_txt', '', 'Ex: 1, 6 ou 11')
                    ]),
                    check('larg5', 'Largura de banda 5 GHz alterada para', [
                        text('larg5_txt', '', 'Ex: 80MHz')
                    ]),
                    check('canal5', 'Canal 5 GHz alterado para', [
                        text('canal5_txt', '', 'Ex: 36, 40, 44...')
                    ]),
                    check('dnsLan', 'DNS LAN alterado para', [
                        select('dnsLan_txt', '', [
                            '177.131.112.10 / 177.131.112.11',
                            '187.85.152.10 / 187.85.152.11'
                        ])
                    ]),
                    check('dnsWan', 'DNS WAN alterado para', [
                        select('dnsWan_txt', '', [
                            '177.131.112.10 / 177.131.112.11',
                            '187.85.152.10 / 187.85.152.11'
                        ])
                    ]),
                    check('dnsIncorreto', 'DNS incorreto — alteração remota não permitida'),
                    check('mtu1492', 'MTU alterado para 1492'),
                    check('ipv6', 'IPv6 habilitado em', [
                        select('ipv6_txt', '', [
                            'SLAAC',
                            'DHCP',
                            'AUTO'
                        ])
                    ]),
                    check('firmware', 'Firmware atualizado'),
                    check('limpeza', 'Limpeza da lista de aparelhos offline realizada'),
                    check('outrasAcoesRoteador', 'Outras ações realizadas no roteador', [
                        area('outrasAcoesRoteador_txt', '', 'Exemplo: Campo Gateway padrão estava em branco, configurado o mesmo')
                    ])
                ], true),
                card('💡 Informações da ONU', [
                    area('infoOnu', '', 'Cole os dados da ONU aqui...')
                ], true),
                card('Outras ações realizadas', [
                    area('outrasAcoes', '', 'Descreva outras ações ou verificações realizadas durante o atendimento.')
                ]),
                card('Histórico de atendimento', [
                    text('historicoAtendimento', '', 'Exemplo: Cliente possui 2 atendimentos nos últimos 3 meses')
                ], true),
                card('📌 Conclusão', [
                    radio('conclusao', '', [
                        {
                            value: 'Conexão normalizada',
                            label: 'Conexão normalizada'
                        },
                        {
                            value: 'Não foi possível validar, cliente parou de interagir no Zendesk',
                            label: 'Não foi possível validar, cliente parou de interagir no Zendesk'
                        },
                        {
                            value: 'Cliente optou por continuar testando a conexão e, caso perceba novas dificuldades, retornará o contato',
                            label: 'Cliente optou por continuar testando a conexão'
                        },
                        {
                            value: 'Problema persiste, encaminhado para Logística',
                            label: 'Problema persiste, encaminhado para Logística',
                            children: [
                                area('infoLogistica', 'Informações para o setor de Logística inserir na O.S.', 'Insira as informações para o setor de logística')
                            ]
                        },
                        {
                            value: 'Outros',
                            label: 'Outros (especificar)',
                            children: [
                                area('infoOutros', 'Detalhamento do "Outros"', 'Descreva o "Outros"')
                            ]
                        }
                    ])
                ], true)
            ],
            generate(v) {
                const out = [
                    'LOGIN CONECTADO - MAS NÃO NAVEGA',
                    '',
                    `Problema relatado pelo cliente: ${valOrNA(v.problemaCliente)}`,
                    '',
                    '----------- TESTES REALIZADOS PELO CSA ONU / ROTEADOR -----------',
                    '',
                    '[CONFIGURAÇÕES DO ROTEADOR]',
                    valOrNA(v.configRoteador),
                    ''
                ];
                const a = [];
                if (v.nenhumaAlt)
                    a.push('Nenhuma alteração realizada');
                if (v.reiniciadoRoteador)
                    a.push('Reiniciado roteador');
                if (v.larg2_4)
                    a.push(`Largura de banda 2.4 GHz alterada para: ${v.larg2_4_txt || ''}`);
                if (v.canal2_4)
                    a.push(`Canal 2.4 GHz alterado para: ${v.canal2_4_txt || ''}`);
                if (v.larg5)
                    a.push(`Largura de banda 5 GHz alterada para: ${v.larg5_txt || ''}`);
                if (v.canal5)
                    a.push(`Canal 5 GHz alterado para: ${v.canal5_txt || ''}`);
                if (v.dnsLan)
                    a.push(`DNS LAN alterado para: ${v.dnsLan_txt || ''}`);
                if (v.dnsWan)
                    a.push(`DNS WAN alterado para: ${v.dnsWan_txt || ''}`);
                if (v.dnsIncorreto)
                    a.push('DNS incorreto — alteração remota não permitida');
                if (v.mtu1492)
                    a.push('MTU alterado para 1492');
                if (v.ipv6)
                    a.push(`IPv6 habilitado em: ${v.ipv6_txt || ''}`);
                if (v.firmware)
                    a.push('Firmware atualizado');
                if (v.limpeza)
                    a.push('Limpeza da lista de aparelhos offline realizada');
                if (v.outrasAcoesRoteador &&
                    v.outrasAcoesRoteador_txt) {
                    a.push(v.outrasAcoesRoteador_txt);
                }
                if (a.length)
                    out.push(`Ações / Alterações realizadas no roteador: ${a.join(', ')}`, '');
                out.push('[INFORMAÇÕES DA ONU]', valOrNA(v.infoOnu), '');
                if (clean(v.outrasAcoes)) {
                    out.push(`Outras ações realizadas: ${clean(v.outrasAcoes)}`, '');
                }
                out.push('----------- HISTÓRICO DE ATENDIMENTO -----------', valOrNA(v.historicoAtendimento), '');
                if (v.conclusao) {
                    out.push(`Conclusão: ${v.conclusao}`);
                }
                if (v.conclusao ===
                    'Problema persiste, encaminhado para Logística' &&
                    clean(v.infoLogistica)) {
                    out.push('', '----------- LOGÍSTICA / O.S -----------', clean(v.infoLogistica));
                }
                if (v.conclusao ===
                    'Outros' &&
                    clean(v.infoOutros)) {
                    out.push(clean(v.infoOutros));
                }
                return out.join('\n');
            }
        },
        // ========================================================
        // TROCA DE SENHA / SSID
        // ========================================================
        troca_senha: {
            label: 'Troca de Senha / SSID',
            cards: [
                card('Dados do solicitante', [
                    text('nomeSolicitante', 'Nome de quem entrou em contato', 'Digite o nome do solicitante')
                ], true),
                card('Cliente entrou em contato solicitando', [
                    check('alterarSenha', 'Alteração da senha do Wi-Fi', [
                        text('senhaAntiga', 'Senha antiga', 'Digite a senha antiga'),
                        text('senhaNova', 'Senha nova', 'Digite a nova senha')
                    ]),
                    check('alterarSSID', 'Alteração do nome da rede (SSID)', [
                        text('nomeAtualSSID', 'Nome atual', 'Digite o nome atual da rede'),
                        text('novoNomeSSID', 'Novo nome', 'Digite o novo nome da rede')
                    ])
                ], true),
                card('Dados do roteador / ONU para documentação', [
                    area('dadosRoteador', 'Dados de roteador', 'Cole as informações do roteador aqui. Caso não haja acesso ou seja Mikrotik, registre aqui.'),
                    area('dadosONU', 'Dados de ONU', 'Cole os dados da ONU aqui.')
                ], true)
            ],
            generate(v) {
                const out = [
                    `Nome do solicitante: ${valOrNA(v.nomeSolicitante)}`,
                    '',
                    'Cliente entrou em contato referente a:'
                ];
                if (v.alterarSenha) {
                    out.push('Alteração da senha do Wi-Fi:', `- Senha antiga: ${valOrNA(v.senhaAntiga)}`, `- Senha nova: ${valOrNA(v.senhaNova)}`, '');
                }
                if (v.alterarSSID) {
                    out.push('Alteração do nome da rede (SSID):', `- Nome atual: ${valOrNA(v.nomeAtualSSID)}`, `- Novo nome: ${valOrNA(v.novoNomeSSID)}`, '');
                }
                if (!v.alterarSenha &&
                    !v.alterarSSID) {
                    out.push('Nenhuma solicitação específica foi selecionada.', '');
                }
                out.push('----------- DADOS DO ROTEADOR / ONU PARA DOCUMENTAÇÃO -----------', 'Dados de roteador:', valOrNA(v.dadosRoteador), '', 'Dados de ONU:', valOrNA(v.dadosONU));
                return out.join('\n');
            }
        },
        // ========================================================
        // OUTRAS DEMANDAS
        // ========================================================
        outras_demandas: {
            label: 'Outras Demandas',
            cards: [
                card('Dados do contato', [
                    text('nomeSolicitante', 'Nome de quem entrou em contato', 'Ex.: Maria Souza'),
                    text('contatoSolicitante', 'Telefone que cliente entrou em contato', '(DDD) 9xxxx-xxxx')
                ], true),
                card('Demanda para o setor', [
                    radio('setor', '', [
                        {
                            value: 'Suporte Técnico',
                            label: 'Suporte Técnico',
                            children: [
                                area('solicitacaoSuporte', 'Descreva a solicitação do cliente', 'Descreva com detalhes...'),
                                area('dadosRoteador', 'Dados do Roteador', 'Cole as informações do roteador aqui.'),
                                area('dadosONU', 'Dados da ONU', 'Cole os dados da ONU aqui.'),
                                radio('logistica', 'Necessário encaminhar para Logística?', [
                                    {
                                        value: 'Não',
                                        label: 'Não'
                                    },
                                    {
                                        value: 'Sim',
                                        label: 'Sim',
                                        children: [
                                            area('infoLogistica', 'Informações para o setor de Logística inserir na O.S.', 'Insira as informações para o setor de logística')
                                        ]
                                    }
                                ])
                            ]
                        },
                        {
                            value: 'Comercial / SAC / Retenção',
                            label: 'Comercial / SAC / Retenção',
                            children: [
                                area('solicitacaoComercial', 'Descreva a solicitação do cliente', 'Descreva com detalhes...')
                            ]
                        }
                    ])
                ], true)
            ],
            generate(v) {
                const out = [
                    'SOLICITAÇÃO DO CLIENTE',
                    '',
                    `Nome do solicitante: ${valOrNA(v.nomeSolicitante)}`,
                    `Contato: ${valOrNA(v.contatoSolicitante)}`,
                    ''
                ];
                if (v.setor ===
                    'Suporte Técnico') {
                    out.push(`Descrição da solicitação: ${valOrNA(v.solicitacaoSuporte)}`, '', '----------- DADOS DO ROTEADOR / ONU PARA DOCUMENTAÇÃO -----------', valOrNA(v.dadosRoteador), '', 'Dados da ONU:', valOrNA(v.dadosONU), '');
                    if (v.logistica ===
                        'Sim' &&
                        clean(v.infoLogistica)) {
                        out.push('---------- Dados para Logística inserir na O.S ----------', clean(v.infoLogistica));
                    }
                }
                else if (v.setor ===
                    'Comercial / SAC / Retenção') {
                    out.push(`Descrição da solicitação: ${valOrNA(v.solicitacaoComercial)}`, '');
                }
                else {
                    out.push('Setor não selecionado.');
                }
                return out.join('\n');
            }
        },
        // ========================================================
        // GMAIL - MONITORAMENTO
        // ========================================================
        gmail_monitoramento: {
            label: 'Gmail - Monitoramento',
            cards: [
                card('Reportar evento', [
                    text('idEvento', 'ID do evento:', 'Insira ID do evento'),
                    check('naoPossuiId', 'Não possui'),
                    text('nomeCliente', 'Nome do Cliente:'),
                    text('pontoAcesso', 'Ponto de Acesso:'),
                    text('horarioQueda', 'Horário da queda:', 'Ex: 14h30'),
                    radio('energia', 'Validado a energia:', [
                        {
                            value: 'Sim',
                            label: 'Sim'
                        },
                        {
                            value: 'Não',
                            label: 'Não',
                            children: [
                                text('motivoEnergia', 'Motivo:', 'Descreva o motivo...')
                            ]
                        }
                    ]),
                    radio('eCondominio', 'O ponto de acesso é condomínio?', [
                        {
                            value: 'Sim',
                            label: 'Sim',
                            children: [
                                text('telefone', 'Telefone:', '(DDD) 9xxxx-xxxx')
                            ]
                        },
                        {
                            value: 'Não',
                            label: 'Não'
                        }
                    ])
                ])
            ],
            generate(v) {
                const n = x => clean(x) ||
                    'Não informado';
                const out = [
                    `ID do evento: ${v.naoPossuiId
                        ? 'Não possui'
                        : n(v.idEvento)}`,
                    `Nome do Cliente: ${n(v.nomeCliente)}`,
                    `Ponto de Acesso: ${n(v.pontoAcesso)}`,
                    `Horário da queda: ${n(v.horarioQueda)}`,
                    `Validado a energia: ${n(v.energia)}`
                ];
                if (v.energia ===
                    'Não') {
                    out.push(`Motivo: ${n(v.motivoEnergia)}`);
                }
                if (v.eCondominio ===
                    'Sim') {
                    out.push(`Telefone: ${n(v.telefone)}`);
                }
                return out.join('\n');
            }
        },
        // ========================================================
        // WHATSAPP - ACIONAMENTO
        // ========================================================
        whatsapp_acionamento: {
            label: 'Whatsapp - Acionamento',
            cards: [
                card('Dados da execução', [
                    date('dataServico', 'Data da execução do serviço'),
                    text('tecnico', 'Nome do Técnico', 'Marcar @técnico no grupo WhatsApp'),
                    radio('restricao', 'Restrição de horário', [
                        {
                            value: 'Não',
                            label: 'Não'
                        },
                        {
                            value: 'Sim',
                            label: 'Sim',
                            children: [
                                text('restricaoTexto', 'Especifique', 'Ex: Realizar antes das 14h / Realizar após as 15h')
                            ]
                        }
                    ])
                ], true),
                card('Protocolos', [
                    text('protocoloAtendimento', 'Protocolo de atendimento', 'Digite o protocolo'),
                    text('osMultifoco', 'Protocolo O.S Multifoco', 'Digite o protocolo da O.S')
                ], true),
                card('Localização do atendimento', [
                    text('contato', 'Contato', 'Telefone / WhatsApp do cliente'),
                    text('cidade', 'Cidade e Bairro', 'Cidade e bairro do atendimento')
                ], true),
                card('Prévia', [
                    area('previa', 'Resumo do problema identificado', 'Ex.: ONU em LOS, Roteador resetado, Sinal alto, cabo limitando velocidade, etc.')
                ], true)
            ],
            generate(v) {
                let data = 'Não informado.';
                if (clean(v.dataServico)) {
                    const p = v.dataServico.split('-');
                    data =
                        p.length === 3
                            ? `${p[2]}/${p[1]}/${p[0]}`
                            : v.dataServico;
                }
                let r = 'Não informado.';
                if (v.restricao ===
                    'Não') {
                    r =
                        'Não';
                }
                if (v.restricao ===
                    'Sim') {
                    r =
                        `Sim${clean(v.restricaoTexto)
                            ? ' – ' +
                                clean(v.restricaoTexto)
                            : ''}`;
                }
                return [
                    `Data da execução do serviço: ${data}`,
                    `Nome do Técnico: ${valOrNA(v.tecnico)}`,
                    `Restrição de horário: ${r}`,
                    `Protocolo de atendimento: ${valOrNA(v.protocoloAtendimento)}`,
                    `Protocolo O.S Multifoco: ${valOrNA(v.osMultifoco)}`,
                    `Contato: ${valOrNA(v.contato)}`,
                    `Cidade: ${valOrNA(v.cidade)}`,
                    `Prévia: ${valOrNA(v.previa)}`
                ].join('\n');
            }
        }
    };
    // ============================================================
    // RENDER DOS CAMPOS
    // ============================================================
    const esc = s => {
        return String(s ?? '')
            .replace(/[&<>"']/g, c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[c]);
    };
    function renderField(f) {
        const label = f.label
            ? `<div class="szc-label">${esc(f.label)}</div>`
            : '';
        if (f.type ===
            'text' ||
            f.type ===
                'date') {
            return `
                <div class="szc-field">
                    ${label}
                    <input
                        class="szc-input"
                        data-id="${f.id}"
                        type="${f.type}"
                        placeholder="${esc(f.placeholder || '')}"
                    >
                </div>
            `;
        }
        if (f.type ===
            'textarea') {
            return `
                <div class="szc-field">
                    ${label}
                    <textarea
                        class="szc-textarea"
                        data-id="${f.id}"
                        placeholder="${esc(f.placeholder || '')}"
                    ></textarea>
                </div>
            `;
        }
        if (f.type ===
            'select') {
            return `
                <div class="szc-field">
                    ${label}
                    <select
                        class="szc-select"
                        data-id="${f.id}"
                    >
                        <option value="">
                            Selecione
                        </option>
                        ${f.options
                .map(o => `
                                        <option value="${esc(o)}">
                                            ${esc(o)}
                                        </option>
                                    `)
                .join('')}
                    </select>
                </div>
            `;
        }
        if (f.type ===
            'checkbox') {
            const child = f.children?.length
                ? `
                        <div class="szc-subbox">
                            ${f.children
                    .map(renderField)
                    .join('')}
                        </div>
                    `
                : '';
            return `
                <div
                    class="szc-check-item"
                    data-cond-type="checkbox"
                    data-cond-id="${f.id}"
                >
                    <label class="szc-check-header">
                        <input
                            type="checkbox"
                            data-id="${f.id}"
                        >
                        <span>
                            ${esc(f.label)}
                        </span>
                    </label>
                    ${child}
                </div>
            `;
        }
        if (f.type ===
            'radio') {
            return `
                <div class="szc-field">
                    ${label}
                    <div class="szc-check-list">
                        ${f.options
                .map(o => {
                const child = o.children?.length
                    ? `
                                                    <div class="szc-subbox">
                                                        ${o.children
                        .map(renderField)
                        .join('')}
                                                    </div>
                                                `
                    : '';
                return `
                                            <div
                                                class="szc-check-item"
                                                data-cond-type="radio"
                                                data-cond-id="${f.id}"
                                                data-cond-value="${esc(o.value)}"
                                            >
                                                <label class="szc-check-header">
                                                    <input
                                                        type="radio"
                                                        name="${f.id}"
                                                        data-id="${f.id}"
                                                        value="${esc(o.value)}"
                                                    >
                                                    <span>
                                                        ${esc(o.label)}
                                                    </span>
                                                </label>
                                                ${child}
                                            </div>
                                        `;
            })
                .join('')}
                    </div>
                </div>
            `;
        }
        return '';
    }
    function renderScript(id) {
        const s = SCRIPTS[id];
        return s.cards
            .map(c => `
                    <div
                        class="szc-card${c.required
            ? ' szc-required'
            : ''}"
                    >
                        <h3>
                            ${esc(c.title)}
                            ${c.required
            ? '<span class="szc-badge">obrigatório</span>'
            : ''}
                        </h3>
                        ${c.fields
            .map(renderField)
            .join('')}
                    </div>
                `)
            .join('');
    }
    // ============================================================
    // CSS
    // ============================================================
    const style = document.createElement('style');
    style.textContent = `
        #szchat-popup {
            position: fixed;
            z-index: 999999;
            background: #ffffff;
            border: 1px solid #c7c7c7;
            border-radius: 10px;
            box-shadow:
                0 6px 24px rgba(0, 0, 0, 0.2);
            font-family:
                "Segoe UI",
                system-ui,
                Arial,
                sans-serif;
            font-size: 13px;
            color: #0f172a;
            display: flex;
            flex-direction: column;
            min-width: 400px;
            min-height: 620px;
            overflow: hidden;
            resize: both;
        }
        #szchat-header {
            background: #1181b7;
            color: #ffffff;
            padding: 8px 12px;
            cursor: move;
            display: flex;
            align-items: center;
            justify-content: space-between;
            user-select: none;
            flex-shrink: 0;
        }
        #szchat-header .title {
            font-weight: 700;
        }
        #szchat-header .subtitle {
            font-size: 11px;
            opacity: 0.9;
            margin-left: 8px;
            max-width: 240px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        #szchat-header button {
            background: transparent;
            border: 0;
            color: #ffffff;
            cursor: pointer;
            font-size: 14px;
            padding: 2px 8px;
            border-radius: 4px;
        }
        #szchat-header button:hover {
            background:
                rgba(
                    255,
                    255,
                    255,
                    0.2
                );
        }
        #szchat-toolbar {
            padding: 8px 12px;
            background: #f6f7fb;
            border-bottom:
                1px solid #e7eaf0;
            display: flex;
            gap: 8px;
            align-items: center;
            flex-shrink: 0;
        }
        #szchat-toolbar select {
            flex: 1;
            padding: 6px 8px;
            border:
                1px solid #dbe1ea;
            border-radius: 8px;
            font-size: 12px;
            background: #ffffff;
        }
        #szchat-body {
            flex: 1;
            overflow-y: auto;
            padding: 10px 12px;
            background: #fafbfd;
            display: flex;
            flex-direction: column;
        }
        .szc-card {
            background: #ffffff;
            border:
                1px solid #e7eaf0;
            border-radius: 10px;
            padding: 10px 12px;
            margin-bottom: 10px;
        }
        .szc-card h3 {
            margin:
                0 0 8px;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .szc-badge {
            font-size: 10px;
            background: #eef2ff;
            border:
                1px solid #e0e7ff;
            padding:
                2px 6px;
            border-radius: 999px;
        }
        .szc-field {
            margin-bottom: 8px;
        }
        .szc-label {
            font-size: 11px;
            color: #475569;
            margin-bottom: 4px;
            font-weight: 600;
        }
        .szc-input,
        .szc-select,
        .szc-textarea {
            width: 100%;
            box-sizing: border-box;
            border:
                1px solid #dbe1ea;
            background: #ffffff;
            border-radius: 8px;
            padding:
                7px 9px;
            font-size: 12px;
            outline: none;
            font-family: inherit;
        }
        .szc-textarea {
            min-height: 60px;
            resize: vertical;
        }
        .szc-input:focus,
        .szc-select:focus,
        .szc-textarea:focus {
            border-color:
                rgba(
                    37,
                    99,
                    235,
                    0.7
                );
            box-shadow:
                0 0 0 3px
                rgba(
                    37,
                    99,
                    235,
                    0.12
                );
        }
        .szc-check-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .szc-check-item {
            border:
                1px solid #e5e7eb;
            background: #fbfcff;
            border-radius: 8px;
            overflow: hidden;
        }
        .szc-check-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding:
                8px 10px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
        }
        .szc-check-header input {
            width: 14px;
            height: 14px;
            accent-color: #2563eb;
        }
        .szc-subbox {
            display: none;
            padding:
                8px 10px
                10px 30px;
            border-top:
                1px solid #e5e7eb;
            background: #ffffff;
        }
        .szc-check-item.szc-active
        > .szc-subbox {
            display: block;
        }
        .szc-card.szc-error {
            border-color: #ef4444;
            background: #fef2f2;
        }
        .szc-card.szc-error h3 {
            color: #b91c1c;
        }
        #szchat-footer {
            border-top:
                1px solid #e7eaf0;
            padding: 10px 12px;
            margin:
                10px -12px -10px;
            background: #f6f7fb;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .szc-row {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .szc-status {
            font-size: 11px;
            color: #475569;
            font-style: italic;
        }
        .szc-context {
            margin-left: auto;
            font-family: monospace;
            font-size: 11px;
            color: #666666;
        }
        #szchat-footer button {
            padding:
                6px 10px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
        }
        .szc-primary {
            background: #2563eb;
            color: #ffffff;
            border:
                1px solid #2563eb;
        }
        .szc-ghost {
            background: #ffffff;
            color: #0f172a;
            border:
                1px solid #dbe1ea;
        }
        #szchat-output {
            width: 100%;
            min-height: 100px;
            box-sizing: border-box;
            font-family:
                ui-monospace,
                Menlo,
                Consolas,
                monospace;
            font-size: 11.5px;
            background: #1e293b;
            color: #e2e8f0;
            border:
                1px solid #334155;
            border-radius: 8px;
            padding: 8px;
            resize: vertical;
        }
        #szchat-toggle {
            position: fixed;
            z-index: 999998;
            bottom: 60px;
            right: 10px;
            background: #1181b7;
            color: #ffffff;
            border: 0;
            border-radius: 50%;
            width: 52px;
            height: 52px;
            cursor: pointer;
            box-shadow:
                0 3px 10px
                rgba(
                    0,
                    0,
                    0,
                    0.25
                );
            font-size: 20px;
        }
        .szc-empty {
            color: #999999;
            font-style: italic;
            padding: 24px;
            text-align: center;
        }
        #szchat-error {
            background: #fef2f2;
            border:
                1px solid #fecaca;
            color: #7f1d1d;
            font-size: 12px;
            font-weight: 700;
            padding:
                8px 10px;
            border-radius: 8px;
            margin-bottom: 10px;
        }
    `;
    document.head.appendChild(style);
    // ============================================================
    // BOTÃO FLUTUANTE
    // ============================================================
    const toggle = document.createElement('button');
    toggle.id =
        'szchat-toggle';
    toggle.textContent =
        '📝';
    toggle.title =
        'Mostrar/ocultar atendimento';
    document.body.appendChild(toggle);
    // ============================================================
    // POPUP
    // ============================================================
    const popup = document.createElement('div');
    popup.id =
        'szchat-popup';
    popup.innerHTML = `
        <div id="szchat-header">
            <div>
                <span class="title">
                    Atendimento
                </span>
                <span
                    class="subtitle"
                    id="szchat-subtitle"
                >
                    — nenhum ticket selecionado
                </span>
            </div>
            <button id="szchat-hide">
                ✕
            </button>
        </div>
        <div id="szchat-toolbar">
            <select
                id="szchat-script"
                disabled
            >
                <option value="">
                    Selecione um script...
                </option>
                ${Object.entries(SCRIPTS)
        .map(([id, s]) => `<option value="${id}">${esc(s.label)}</option>`)
        .join('')}
            </select>
        </div>
        <div id="szchat-body">
            <div id="szchat-form">
                <div class="szc-empty">
                    Selecione um ticket aberto para começar.
                </div>
            </div>
            <div
                id="szchat-footer"
                style="display:none"
            >
                <div class="szc-row">
                    <button
                        class="szc-primary"
                        id="szchat-generate"
                    >
                        ⚡ Gerar Script
                    </button>
                    <button
                        class="szc-ghost"
                        id="szchat-copy"
                    >
                        📎 Copiar
                    </button>
                </div>
                <textarea
                    id="szchat-output"
                    placeholder="Clique em Gerar Script para montar o texto..."
                ></textarea>
                <div class="szc-row">
                    <span
                        class="szc-status"
                        id="szchat-status"
                    ></span>
                    <span
                        class="szc-context"
                        id="szchat-context"
                    ></span>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(popup);
    const header = popup.querySelector('#szchat-header');
    const subtitle = popup.querySelector('#szchat-subtitle');
    const scriptSelect = popup.querySelector('#szchat-script');
    const body = popup.querySelector('#szchat-body');
    const form = popup.querySelector('#szchat-form');
    const footer = popup.querySelector('#szchat-footer');
    const output = popup.querySelector('#szchat-output');
    const status = popup.querySelector('#szchat-status');
    const context = popup.querySelector('#szchat-context');
    // ============================================================
    // POSIÇÃO / TAMANHO / VISIBILIDADE
    // ============================================================
    const pos = GM_getValue(POS_KEY, {
        top: 80,
        left: Math.max(20, innerWidth -
            440)
    });
    const size = GM_getValue(SIZE_KEY, {
        width: 400,
        height: 620
    });
    popup.style.cssText +=
        `;top:${pos.top}px;` +
            `left:${pos.left}px;` +
            `width:${size.width}px;` +
            `height:${size.height}px;` +
            `display:${GM_getValue(VIS_KEY, false)
                ? 'flex'
                : 'none'}`;
    new ResizeObserver(() => {
        const width = popup.offsetWidth;
        const height = popup.offsetHeight;
        if (width > 0 && height > 0) {
            GM_setValue(SIZE_KEY, {
                width,
                height
            });
        }
    }).observe(popup);
    // ============================================================
    // ARRASTAR
    // ============================================================
    let dragging = false;
    let dx = 0;
    let dy = 0;
    header.addEventListener('mousedown', e => {
        if (e.target.closest('button')) {
            return;
        }
        dragging =
            true;
        const r = popup.getBoundingClientRect();
        dx =
            e.clientX -
                r.left;
        dy =
            e.clientY -
                r.top;
        e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
        if (!dragging)
            return;
        popup.style.left =
            Math.max(0, Math.min(innerWidth - 80, e.clientX - dx)) +
                'px';
        popup.style.top =
            Math.max(0, Math.min(innerHeight - 40, e.clientY - dy)) +
                'px';
    });
    document.addEventListener('mouseup', () => {
        if (!dragging)
            return;
        dragging =
            false;
        GM_setValue(POS_KEY, {
            top: parseInt(popup.style.top),
            left: parseInt(popup.style.left)
        });
    });
    // ============================================================
    // MOSTRAR / ESCONDER
    // ============================================================
    const setVisible = v => {
        popup.style.display =
            v
                ? 'flex'
                : 'none';
        GM_setValue(VIS_KEY, v);
    };
    toggle.onclick =
        () => {
            setVisible(popup.style.display ===
                'none');
        };
    popup.querySelector('#szchat-hide').onclick =
        () => setVisible(false);
    // ============================================================
    // VALORES DO FORMULÁRIO
    // ============================================================
    function values() {
        const v = {};
        form.querySelectorAll('[data-id]').forEach(el => {
            const id = el.dataset.id;
            if (el.type ===
                'checkbox') {
                v[id] =
                    el.checked;
            }
            else if (el.type ===
                'radio') {
                if (el.checked) {
                    v[id] =
                        el.value;
                }
                else if (!(id in v)) {
                    v[id] =
                        '';
                }
            }
            else {
                v[id] =
                    el.value;
            }
        });
        return v;
    }
    function setValues(v) {
        suppressSave =
            true;
        form.querySelectorAll('[data-id]').forEach(el => {
            const id = el.dataset.id;
            if (!(id in v)) {
                return;
            }
            if (el.type ===
                'checkbox') {
                el.checked =
                    !!v[id];
            }
            else if (el.type ===
                'radio') {
                el.checked =
                    el.value ===
                        v[id];
            }
            else {
                el.value =
                    v[id] || '';
            }
        });
        updateConditions();
        suppressSave =
            false;
    }
    // ============================================================
    // CAMPOS CONDICIONAIS
    // ============================================================
    function updateConditions() {
        const v = values();
        form.querySelectorAll('.szc-check-item[data-cond-id]').forEach(item => {
            const id = item.dataset.condId;
            const active = item.dataset.condType ===
                'checkbox'
                ? !!v[id]
                : v[id] ===
                    item.dataset.condValue;
            item.classList.toggle('szc-active', active);
        });
        /*
            Gmail:
            se marcar "Não possui",
            desabilita ID do evento.
        */
        const idInput = form.querySelector('[data-id="idEvento"]');
        if (idInput) {
            idInput.disabled =
                !!v.naoPossuiId;
        }
    }
    // ============================================================
    // SALVAR
    // ============================================================
    function saveCurrent() {
        if (suppressSave ||
            !currentTicketKey ||
            !currentScriptId) {
            return;
        }
        const state = loadState(currentTicketKey);
        state.script =
            currentScriptId;
        state.data ||=
            {};
        state.data[currentScriptId] = {
            fields: values(),
            output: output.value
        };
        saveState(currentTicketKey, state);
        status.textContent =
            'Salvo ✓';
        clearTimeout(saveTimer);
        saveTimer =
            setTimeout(() => {
                if (status.textContent ===
                    'Salvo ✓') {
                    status.textContent =
                        '';
                }
            }, 1000);
    }
    function debounceSave() {
        if (suppressSave) {
            return;
        }
        status.textContent =
            'Digitando…';
        clearTimeout(saveTimer);
        saveTimer =
            setTimeout(saveCurrent, 350);
    }
    form.addEventListener('input', () => {
        updateConditions();
        debounceSave();
    });
    form.addEventListener('change', () => {
        updateConditions();
        debounceSave();
    });
    output.addEventListener('input', debounceSave);
    // ============================================================
    // CARREGAR SCRIPT
    // ============================================================
    function loadScript(id) {
        currentScriptId =
            id;
        if (!id ||
            !SCRIPTS[id]) {
            form.innerHTML =
                '<div class="szc-empty">Selecione um script acima.</div>';
            footer.style.display =
                'none';
            return;
        }
        form.innerHTML =
            renderScript(id);
        footer.style.display =
            'flex';
        const state = loadState(currentTicketKey);
        const saved = state.data?.[id] ||
            {};
        setValues(saved.fields ||
            {});
        output.value =
            saved.output ||
                '';
        state.script =
            id;
        saveState(currentTicketKey, state);
        body.scrollTop =
            0;
    }
    scriptSelect.onchange =
        () => {
            if (currentScriptId) {
                clearTimeout(saveTimer);
                saveCurrent();
            }
            loadScript(scriptSelect.value);
        };
    // ============================================================
    // VALIDAÇÃO
    // ============================================================
    function validate() {
        form.querySelector('#szchat-error')?.remove();
        form.querySelectorAll('.szc-error').forEach(x => x.classList.remove('szc-error'));
        const errors = [];
        form.querySelectorAll('.szc-card.szc-required').forEach(c => {
            let ok = false;
            c.querySelectorAll('[data-id]').forEach(el => {
                const sub = el.closest('.szc-subbox');
                if (sub &&
                    !sub.parentElement
                        .classList
                        .contains('szc-active')) {
                    return;
                }
                if (el.type ===
                    'checkbox' ||
                    el.type ===
                        'radio') {
                    if (el.checked) {
                        ok =
                            true;
                    }
                }
                else if (clean(el.value)) {
                    ok =
                        true;
                }
            });
            if (!ok) {
                c.classList.add('szc-error');
                errors.push(clean(c.querySelector('h3')
                    ?.childNodes[0]
                    ?.textContent) ||
                    'Campo obrigatório');
            }
        });
        if (!errors.length) {
            return true;
        }
        const b = document.createElement('div');
        b.id =
            'szchat-error';
        b.textContent =
            '⚠️ Preencha: ' +
                errors.join(' • ');
        form.prepend(b);
        form.querySelector('.szc-error')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
        return false;
    }
    // ============================================================
    // GERAR
    // ============================================================
    popup.querySelector('#szchat-generate').onclick =
        () => {
            if (!currentScriptId ||
                !validate()) {
                return;
            }
            try {
                output.value =
                    SCRIPTS[currentScriptId].generate(values());
                saveCurrent();
                status.textContent =
                    'Gerado ✓';
                setTimeout(() => {
                    if (status.textContent ===
                        'Gerado ✓') {
                        status.textContent =
                            '';
                    }
                }, 1200);
            }
            catch (e) {
                console.error(e);
                status.textContent =
                    'Erro ao gerar';
            }
        };
    // ============================================================
    // COPIAR
    // ============================================================
    popup.querySelector('#szchat-copy').onclick =
        async () => {
            if (!clean(output.value)) {
                status.textContent =
                    'Nada para copiar';
                return;
            }
            try {
                await navigator
                    .clipboard
                    .writeText(output.value);
                status.textContent =
                    'Copiado ✓';
            }
            catch {
                output.select();
                document.execCommand('copy');
                status.textContent =
                    'Copiado ✓';
            }
        };
    // ============================================================
    // LABELS DO TICKET
    // ============================================================
    function updateLabels(meta) {
        if (!meta) {
            subtitle.textContent =
                '— nenhum ticket selecionado';
            const n = getOpenTicketCount();
            context.textContent =
                n === null
                    ? ''
                    : `Meus tickets abertos: ${n}`;
            return;
        }
        subtitle.textContent =
            '— ' +
                meta.name;
        context.textContent =
            `#${meta.ticketId}` +
                (meta.phone
                    ? ' • ' +
                        meta.phone
                    : '');
    }
    // ============================================================
    // TROCAR TICKET
    // ============================================================
    function switchTicket(meta) {
        const key = meta?.key ||
            null;
        /*
            Continua no mesmo ticket.
            Pode acontecer do telefone aparecer depois
            que o ticket terminou de carregar.
            Nesse caso atualizamos somente os dados visuais,
            sem recarregar o formulário.
        */
        if (key ===
            currentTicketKey) {
            currentTicketMeta =
                meta;
            updateLabels(meta);
            return;
        }
        /*
            Antes de mudar de cliente,
            salva o formulário anterior.
        */
        if (currentTicketKey &&
            currentScriptId) {
            saveCurrent();
        }
        currentTicketKey =
            key;
        currentTicketMeta =
            meta;
        currentScriptId =
            null;
        if (!key) {
            scriptSelect.disabled =
                true;
            scriptSelect.value =
                '';
            form.innerHTML =
                '<div class="szc-empty">Selecione um ticket aberto para começar.</div>';
            footer.style.display =
                'none';
            updateLabels(null);
            return;
        }
        scriptSelect.disabled =
            false;
        updateLabels(meta);
        const state = loadState(key);
        const last = state.script;
        /*
            Se aquele ticket já tinha um script aberto,
            carrega automaticamente.
        */
        if (last &&
            SCRIPTS[last]) {
            scriptSelect.value =
                last;
            loadScript(last);
        }
        else {
            scriptSelect.value =
                '';
            form.innerHTML =
                '<div class="szc-empty">Selecione um script acima.</div>';
            footer.style.display =
                'none';
        }
    }
    const checkActive = () => {
        switchTicket(getTicketContext());
    };
    const scheduleCheck = () => {
        clearTimeout(checkTimer);
        checkTimer =
            setTimeout(checkActive, 100);
    };
    // ============================================================
    // SALVA ANTES DE SAIR
    // ============================================================
    window.addEventListener('beforeunload', saveCurrent);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            saveCurrent();
        }
        else {
            scheduleCheck();
        }
    });
    // ============================================================
    // OBSERVA TROCA DE TICKET NO ZENDESK
    // ============================================================
    /*
        O Zendesk é SPA.
        Quando você clica em outra aba de atendimento,
        o React normalmente só muda:
        data-entity-is-selected="true"
        de um elemento para outro.
        Por isso observamos especificamente esse atributo.
    */
    new MutationObserver(scheduleCheck).observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: [
            'data-entity-is-selected',
            'data-entity-id',
            'data-entity-type',
            'aria-current',
            'href'
        ]
    });
    /*
        Fallback.
        Mesmo se algum update do Zendesk não gerar
        uma Mutation capturada pelo observer,
        a cada 1 segundo confirmamos qual aba está selecionada.
    */
    setInterval(checkActive, 1000);
    // primeira leitura
    checkActive();
    // ============================================================
    // DEBUG
    // ============================================================
    /*
        Abra o console e execute:
        __zendeskAtendimentoDebug()
        para ver o ticket que o script está detectando.
    */
    window.__zendeskAtendimentoDebug =
        () => {
            const tab = getSelectedTab();
            const info = {
                selectedTab: tab
                    ? {
                        ticketId: tab.getAttribute('data-entity-id'),
                        selected: tab.getAttribute('data-entity-is-selected'),
                        title: clean(tab.querySelector('[data-test-id="header-tab-title"]')?.textContent)
                    }
                    : null,
                context: getTicketContext(),
                openCount: getOpenTicketCount(),
                url: location.href
            };
            console.log('Zendesk Atendimento Debug:', info);
            return info;
        };
})();
