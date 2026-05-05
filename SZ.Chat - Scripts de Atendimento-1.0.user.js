// ==UserScript==
// @name         SZ.Chat - Scripts de Atendimento
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Popup arrastável com formulários de atendimento (Lentidão, etc), salvos por número de telefone
// @match        https://clusterscpr.sz.chat/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @run-at       document-idle
// @icon         https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/icon.png
// @updateURL    https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/SZ.Chat%20-%20Scripts%20de%20Atendimento-1.0.user.js
// @downloadURL  https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/SZ.Chat%20-%20Scripts%20de%20Atendimento-1.0.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ============ STORAGE KEYS ============
    const STORAGE_PREFIX = 'szchat_form_';   // szchat_form_<phone> -> { script: id, data: { id: { fields..., output } } }
    const POS_KEY = 'szchat_popup_pos_v1';
    const VIS_KEY = 'szchat_popup_visible_v1';
    const SIZE_KEY = 'szchat_popup_size_v1';

    let currentPhone = null;
    let currentScriptId = null;
    let saveTimer = null;
    let suppressSave = false; // true while we're programmatically loading values

    // ============ HELPERS ============
    const extractPhone = (title) => {
        if (!title) return null;
        const match = title.match(/\+?[\d\s\-()]{8,}/);
        if (!match) return null;
        return match[0].replace(/\D/g, '');
    };

    const loadPhoneState = (phone) => {
        if (!phone) return { script: null, data: {} };
        return GM_getValue(STORAGE_PREFIX + phone, { script: null, data: {} });
    };

    const savePhoneState = (phone, state) => {
        if (!phone) return;
        GM_setValue(STORAGE_PREFIX + phone, state);
    };

    // ============ SCRIPT DEFINITIONS ============
    // Each script defines: id, label, fields (form HTML), generate(values) => string
    // To add new scripts later, add entries to SCRIPTS object.

    const SCRIPTS = {
        lentidao: {
            label: 'Conexão lenta',
            render: () => `
                <div class="szc-card">
                    <h3>Problema relatado pelo cliente <span class="szc-badge">obrigatório</span></h3>

                    <div class="szc-stack">
                        <div class="szc-field">
                            <div class="szc-label">Problema relatado pelo cliente</div>
                            <textarea class="szc-textarea" data-id="problemaCliente" placeholder="Exemplo: O cliente relata que a internet apresenta lentidão há dias..."></textarea>
                        </div>

                        <div class="szc-field">
                            <div class="szc-label">A dificuldade ocorre em todos os aparelhos ou apenas em algum específico?</div>
                            <input class="szc-input" data-id="aparelhosAfetados" type="text" placeholder="Exemplo: Apenas na TV da sala e no celular do cliente.">
                        </div>

                        <div class="szc-field">
                            <div class="szc-label">A dificuldade ocorre em todos os cômodos ou apenas em alguma área?</div>
                            <input class="szc-input" data-id="comodosAfetados" type="text" placeholder="Exemplo: Ocorre somente no quarto dos fundos.">
                        </div>

                        <div class="szc-field">
                            <div class="szc-label">A lentidão ocorre em algum site ou aplicativo específico ou em todos?</div>
                            <input class="szc-input" data-id="sitesAplicativos" type="text" placeholder="Exemplo: Lentidão em todos os apps, principalmente Netflix.">
                        </div>

                        <div class="szc-field">
                            <div class="szc-label">O cliente enviou foto ampla do local de instalação do roteador?</div>
                            <div class="szc-check-list">
                                <div class="szc-check-item">
                                    <label class="szc-check-header">
                                        <input type="radio" name="fotoInstalacao" data-id="fotoInstalacao" value="naoEnviou">
                                        <span>Cliente não enviou foto</span>
                                    </label>
                                </div>
                                <div class="szc-check-item" data-show-when="fotoInstalacao=enviou">
                                    <label class="szc-check-header">
                                        <input type="radio" name="fotoInstalacao" data-id="fotoInstalacao" value="enviou">
                                        <span>Cliente enviou foto do roteador</span>
                                    </label>
                                    <div class="szc-subbox">
                                        <div class="szc-check-list">
                                            <div class="szc-check-item">
                                                <label class="szc-check-header">
                                                    <input type="radio" name="padraoFoto" data-id="padraoFoto" value="dentro">
                                                    <span>Instalação dentro dos padrões</span>
                                                </label>
                                            </div>
                                            <div class="szc-check-item" data-show-when="padraoFoto=fora">
                                                <label class="szc-check-header">
                                                    <input type="radio" name="padraoFoto" data-id="padraoFoto" value="fora">
                                                    <span>Instalação fora do padrão</span>
                                                </label>
                                                <div class="szc-subbox">
                                                    <div class="szc-field">
                                                        <div class="szc-label">Detalhamento</div>
                                                        <input class="szc-input" data-id="detalheForaPadrao" type="text" placeholder="Exemplo: Roteador dentro do móvel.">
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="szc-card">
                    <h3>Configurações do roteador <span class="szc-badge">obrigatório</span></h3>
                    <textarea class="szc-textarea" data-id="configRoteador" placeholder="Cole as informações do roteador aqui..."></textarea>
                </div>

                <div class="szc-card">
                    <h3>Alterações realizadas no roteador <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-check-list">
                        <div class="szc-check-item">
                            <label class="szc-check-header"><input type="checkbox" data-id="nenhumaAlt"><span>Nenhuma alteração realizada</span></label>
                        </div>
                        <div class="szc-check-item">
                            <label class="szc-check-header"><input type="checkbox" data-id="reiniciadoRoteador"><span>Reiniciado roteador</span></label>
                        </div>
                        <div class="szc-check-item" data-show-when="larg2_4=true">
                            <label class="szc-check-header"><input type="checkbox" data-id="larg2_4"><span>Largura de banda 2.4 GHz alterada para</span></label>
                            <div class="szc-subbox">
                                <input class="szc-input" data-id="larg2_4_txt" type="text" placeholder="Ex: 20MHz">
                            </div>
                        </div>
                        <div class="szc-check-item" data-show-when="canal2_4=true">
                            <label class="szc-check-header"><input type="checkbox" data-id="canal2_4"><span>Canal 2.4 GHz alterado para</span></label>
                            <div class="szc-subbox">
                                <input class="szc-input" data-id="canal2_4_txt" type="text" placeholder="Ex: 1, 6 ou 11">
                            </div>
                        </div>
                        <div class="szc-check-item" data-show-when="larg5=true">
                            <label class="szc-check-header"><input type="checkbox" data-id="larg5"><span>Largura de banda 5 GHz alterada para</span></label>
                            <div class="szc-subbox">
                                <input class="szc-input" data-id="larg5_txt" type="text" placeholder="Ex: 80MHz">
                            </div>
                        </div>
                        <div class="szc-check-item" data-show-when="canal5=true">
                            <label class="szc-check-header"><input type="checkbox" data-id="canal5"><span>Canal 5 GHz alterado para</span></label>
                            <div class="szc-subbox">
                                <input class="szc-input" data-id="canal5_txt" type="text" placeholder="Ex: 36, 40, 44...">
                            </div>
                        </div>
                        <div class="szc-check-item" data-show-when="dnsLan=true">
                            <label class="szc-check-header"><input type="checkbox" data-id="dnsLan"><span>DNS LAN alterado para</span></label>
                            <div class="szc-subbox">
                                <select class="szc-select" data-id="dnsLan_txt">
                                    <option value="">Selecione</option>
                                    <option value="187.85.152.10 / 187.85.152.11">187.85.152.10 / 187.85.152.11</option>
                                </select>
                            </div>
                        </div>
                        <div class="szc-check-item" data-show-when="dnsWan=true">
                            <label class="szc-check-header"><input type="checkbox" data-id="dnsWan"><span>DNS WAN alterado para</span></label>
                            <div class="szc-subbox">
                                <select class="szc-select" data-id="dnsWan_txt">
                                    <option value="">Selecione</option>
                                    <option value="187.85.152.10 / 187.85.152.11">187.85.152.10 / 187.85.152.11</option>
                                </select>
                            </div>
                        </div>
                        <div class="szc-check-item">
                            <label class="szc-check-header"><input type="checkbox" data-id="dnsIncorreto"><span>DNS incorreto — alteração remota não permitida</span></label>
                        </div>
                        <div class="szc-check-item">
                            <label class="szc-check-header"><input type="checkbox" data-id="mtu1492"><span>MTU alterado para 1492</span></label>
                        </div>
                        <div class="szc-check-item" data-show-when="ipv6=true">
                            <label class="szc-check-header"><input type="checkbox" data-id="ipv6"><span>IPv6 habilitado em</span></label>
                            <div class="szc-subbox">
                                <select class="szc-select" data-id="ipv6_txt">
                                    <option value="">Selecione</option>
                                    <option value="SLAAC">SLAAC</option>
                                    <option value="DHCP">DHCP</option>
                                    <option value="AUTO">AUTO</option>
                                </select>
                            </div>
                        </div>
                        <div class="szc-check-item">
                            <label class="szc-check-header"><input type="checkbox" data-id="firmware"><span>Firmware atualizado</span></label>
                        </div>
                        <div class="szc-check-item">
                            <label class="szc-check-header"><input type="checkbox" data-id="limpeza"><span>Limpeza da lista de aparelhos offline realizada</span></label>
                        </div>
                        <div class="szc-check-item" data-show-when="outrasAcoesRoteador=true">
                            <label class="szc-check-header"><input type="checkbox" data-id="outrasAcoesRoteador"><span>Outras ações realizadas no roteador</span></label>
                            <div class="szc-subbox">
                                <textarea class="szc-textarea" data-id="outrasAcoesRoteador_txt" placeholder="Exemplo: Unificado as redes Wi-Fi"></textarea>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="szc-card">
                    <h3>Informações da ONU <span class="szc-badge">obrigatório</span></h3>
                    <textarea class="szc-textarea" data-id="infoOnu" placeholder="Cole os dados da ONU aqui..."></textarea>
                </div>

                <div class="szc-card">
                    <h3>Alterações realizadas na ONU <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-check-list">
                        <div class="szc-check-item">
                            <label class="szc-check-header"><input type="checkbox" data-id="nenhumaAltOnu"><span>Nenhuma alteração realizada</span></label>
                        </div>
                        <div class="szc-check-item">
                            <label class="szc-check-header"><input type="checkbox" data-id="firmwareOnu"><span>Atualizado Firmware</span></label>
                        </div>
                        <div class="szc-check-item" data-show-when="outrasAcoesOnu=true">
                            <label class="szc-check-header"><input type="checkbox" data-id="outrasAcoesOnu"><span>Outras ações realizadas na ONU</span></label>
                            <div class="szc-subbox">
                                <textarea class="szc-textarea" data-id="outrasAcoesOnu_txt" placeholder="Exemplo: Reiniciado equipamento e refeito provisionamento."></textarea>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="szc-card">
                    <h3>Outras ações realizadas com o cliente <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-check-list">
                        <div class="szc-check-item">
                            <label class="szc-check-header"><input type="radio" name="outrasAcoesClienteTipo" data-id="outrasAcoesClienteTipo" value="nenhuma"><span>Nenhuma alteração realizada</span></label>
                        </div>
                        <div class="szc-check-item" data-show-when="outrasAcoesClienteTipo=realizado">
                            <label class="szc-check-header"><input type="radio" name="outrasAcoesClienteTipo" data-id="outrasAcoesClienteTipo" value="realizado"><span>Realizado as seguintes ações</span></label>
                            <div class="szc-subbox">
                                <textarea class="szc-textarea" data-id="outrasAcoes" placeholder="Exemplo: Orientado o cliente a retirar o roteador de dentro do móvel..."></textarea>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="szc-card">
                    <h3>Histórico de atendimento <span class="szc-badge">obrigatório</span></h3>
                    <input class="szc-input" data-id="historicoAtendimento" type="text" placeholder="Exemplo: Cliente possui 2 atendimentos nos últimos 3 meses">
                </div>

                <div class="szc-card">
                    <h3>Considerações finais <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-check-list">
                        <div class="szc-check-item">
                            <label class="szc-check-header"><input type="radio" name="consideracoesFinais" data-id="consideracoesFinais" value="Conexão normalizada após procedimentos."><span>Conexão normalizada após procedimentos.</span></label>
                        </div>
                        <div class="szc-check-item">
                            <label class="szc-check-header"><input type="radio" name="consideracoesFinais" data-id="consideracoesFinais" value="Cliente parou de interagir no SZ.Chat, atendimento finalizado por inatividade."><span>Cliente parou de interagir no SZ.Chat, atendimento finalizado por inatividade.</span></label>
                        </div>
                        <div class="szc-check-item">
                            <label class="szc-check-header"><input type="radio" name="consideracoesFinais" data-id="consideracoesFinais" value="Atendimento transferido para outro atendente (devido a intervalo / término de expediente)."><span>Atendimento transferido (intervalo / término de expediente).</span></label>
                        </div>
                        <div class="szc-check-item" data-show-when="consideracoesFinais=Problema persiste, encaminhado para Logística">
                            <label class="szc-check-header"><input type="radio" name="consideracoesFinais" data-id="consideracoesFinais" value="Problema persiste, encaminhado para Logística"><span>Problema persiste, encaminhado para Logística</span></label>
                            <div class="szc-subbox">
                                <div class="szc-label">Informações para o setor de logística</div>
                                <textarea class="szc-textarea" data-id="infoLogistica" placeholder="Insira as informações para o setor de logística"></textarea>
                            </div>
                        </div>
                        <div class="szc-check-item" data-show-when="consideracoesFinais=Outros">
                            <label class="szc-check-header"><input type="radio" name="consideracoesFinais" data-id="consideracoesFinais" value="Outros"><span>Outros (especificar)</span></label>
                            <div class="szc-subbox">
                                <div class="szc-label">Detalhamento do "Outros"</div>
                                <textarea class="szc-textarea" data-id="infoOutros" placeholder="Descreva o 'Outros'"></textarea>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            generate: (v) => {
                const valOrNA = (x) => (x && x.trim()) ? x.trim() : 'Não informado.';
                const linhas = [];

                linhas.push('Problema relatado pelo cliente: ' + valOrNA(v.problemaCliente));
                linhas.push('Aparelhos que apresentam dificuldade: ' + valOrNA(v.aparelhosAfetados));
                linhas.push('Local da dificuldade (cômodo/ambiente): ' + valOrNA(v.comodosAfetados));
                linhas.push('Site/App/Acessos afetados: ' + valOrNA(v.sitesAplicativos));
                linhas.push('');

                if (v.fotoInstalacao === 'naoEnviou') {
                    linhas.push('Cliente não enviou foto do local onde o roteador está instalado, para melhor análise da dificuldade.');
                    linhas.push('');
                } else if (v.fotoInstalacao === 'enviou') {
                    let l = 'Cliente enviou foto do roteador';
                    if (v.padraoFoto === 'dentro') l += ' - Instalação está dentro dos padrões.';
                    if (v.padraoFoto === 'fora') l += ' - Instalação fora do padrão: ' + valOrNA(v.detalheForaPadrao);
                    linhas.push(l);
                    linhas.push('');
                }

                linhas.push('----------- TESTES REALIZADOS PELO CSA ONU / ROTEADOR -----------');
                linhas.push('[CONFIGURAÇÕES DO ROTEADOR]');
                linhas.push(valOrNA(v.configRoteador));
                linhas.push('');
                linhas.push('[INFORMAÇÕES DA ONU]');
                linhas.push(valOrNA(v.infoOnu));
                linhas.push('');

                const acoes = [];
                if (v.nenhumaAlt) acoes.push('Nenhuma alteração realizada');
                if (v.reiniciadoRoteador) acoes.push('Reiniciado roteador');
                if (v.larg2_4) acoes.push('Largura de banda 2.4 GHz alterada para: ' + (v.larg2_4_txt || ''));
                if (v.canal2_4) acoes.push('Canal 2.4 GHz alterado para: ' + (v.canal2_4_txt || ''));
                if (v.larg5) acoes.push('Largura de banda 5 GHz alterada para: ' + (v.larg5_txt || ''));
                if (v.canal5) acoes.push('Canal 5 GHz alterado para: ' + (v.canal5_txt || ''));
                if (v.dnsLan) acoes.push('DNS LAN alterado para: ' + (v.dnsLan_txt || ''));
                if (v.dnsWan) acoes.push('DNS WAN alterado para: ' + (v.dnsWan_txt || ''));
                if (v.dnsIncorreto) acoes.push('DNS incorreto — alteração remota não permitida');
                if (v.mtu1492) acoes.push('MTU alterado para 1492');
                if (v.ipv6) acoes.push('IPv6 habilitado em: ' + (v.ipv6_txt || ''));
                if (v.firmware) acoes.push('Firmware atualizado');
                if (v.limpeza) acoes.push('Limpeza da lista de aparelhos offline realizada');
                if (v.outrasAcoesRoteador && v.outrasAcoesRoteador_txt) acoes.push(v.outrasAcoesRoteador_txt);

                const acoesOnu = [];
                if (!v.nenhumaAltOnu) {
                    if (v.firmwareOnu) acoesOnu.push('Atualizado Firmware');
                    if (v.outrasAcoesOnu && v.outrasAcoesOnu_txt) acoesOnu.push(v.outrasAcoesOnu_txt);
                }

                const mostrarOutrasCli = v.outrasAcoesClienteTipo === 'realizado' && v.outrasAcoes;
                if (acoes.length || acoesOnu.length || mostrarOutrasCli) {
                    linhas.push('[ALTERAÇÕES REALIZADAS]');
                    if (acoes.length) linhas.push('ROTEADOR: ' + acoes.join(', '));
                    if (acoesOnu.length) linhas.push('ONU: ' + acoesOnu.join(', '));
                    if (mostrarOutrasCli) linhas.push('Outras ações realizadas: ' + v.outrasAcoes);
                    linhas.push('');
                }

                linhas.push('----------- HISTÓRICO DE ATENDIMENTO -----------');
                linhas.push(valOrNA(v.historicoAtendimento));
                linhas.push('');

                if (v.consideracoesFinais === 'Outros') {
                    linhas.push('Considerações finais - ' + valOrNA(v.infoOutros));
                } else {
                    linhas.push('Considerações finais - ' + valOrNA(v.consideracoesFinais));
                }

                if (v.consideracoesFinais === 'Problema persiste, encaminhado para Logística' && v.infoLogistica) {
                    linhas.push('');
                    linhas.push('---------- Dados para Logística inserir na O.S ----------');
                    linhas.push(v.infoLogistica);
                }

                return linhas.join('\n');
            },
        },

        sem_conexao_onu_up: {
            label: 'Sem conexão - ONU UP',
            render: () => `
                <div class="szc-card">
                    <h3>📡 Login desconectado <span class="szc-badge">obrigatório</span></h3>

                    <div class="szc-stack">
                        <div class="szc-field">
                            <div class="szc-label">Problema relatado pelo cliente</div>
                            <textarea class="szc-textarea" data-id="problemaCliente" placeholder="Descreva o problema relatado pelo cliente."></textarea>
                        </div>
                    </div>
                </div>

                <div class="szc-card">
                    <h3>🔧 Configurações da ONU <span class="szc-badge">obrigatório</span></h3>
                    <textarea class="szc-textarea" data-id="configOnu" placeholder="Cole os dados da ONU aqui..."></textarea>
                </div>

                <div class="szc-card">
                    <h3>Detalhes da desconexão</h3>

                    <div class="szc-stack">
                        <div class="szc-field">
                            <div class="szc-label">Plano desconectado desde <span class="szc-badge">obrigatório</span></div>
                            <input class="szc-input" data-id="planoDesconectado" type="text" placeholder="Ex: 09/09 às 14h">
                        </div>

                        <div class="szc-field">
                            <div class="szc-label">Equipamentos reiniciados</div>
                            <div class="szc-check-list">
                                <div class="szc-check-item">
                                    <label class="szc-check-header">
                                        <input type="radio" name="equipReiniciados" data-id="equipReiniciados" value="Sim">
                                        <span>Sim</span>
                                    </label>
                                </div>
                                <div class="szc-check-item">
                                    <label class="szc-check-header">
                                        <input type="radio" name="equipReiniciados" data-id="equipReiniciados" value="Não">
                                        <span>Não</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div class="szc-field">
                            <div class="szc-label">Validado cabo de rede na porta WAN do roteador</div>
                            <div class="szc-check-list">
                                <div class="szc-check-item">
                                    <label class="szc-check-header">
                                        <input type="radio" name="caboWanValidado" data-id="caboWanValidado" value="Sim">
                                        <span>Sim</span>
                                    </label>
                                </div>
                                <div class="szc-check-item">
                                    <label class="szc-check-header">
                                        <input type="radio" name="caboWanValidado" data-id="caboWanValidado" value="Não">
                                        <span>Não</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div class="szc-field">
                            <div class="szc-label">Aparece o nome da rede Wi-Fi para o cliente</div>
                            <div class="szc-check-list">
                                <div class="szc-check-item">
                                    <label class="szc-check-header">
                                        <input type="radio" name="wifiVisivel" data-id="wifiVisivel" value="Sim">
                                        <span>Sim</span>
                                    </label>
                                </div>
                                <div class="szc-check-item">
                                    <label class="szc-check-header">
                                        <input type="radio" name="wifiVisivel" data-id="wifiVisivel" value="Não">
                                        <span>Não</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div class="szc-field">
                            <div class="szc-label">Aparece tentativa de autenticação no log do radius</div>
                            <div class="szc-check-list">
                                <div class="szc-check-item">
                                    <label class="szc-check-header">
                                        <input type="radio" name="radiusLog" data-id="radiusLog" value="Não">
                                        <span>Não</span>
                                    </label>
                                </div>
                                <div class="szc-check-item" data-show-when="radiusLog=Sim">
                                    <label class="szc-check-header">
                                        <input type="radio" name="radiusLog" data-id="radiusLog" value="Sim">
                                        <span>Sim</span>
                                    </label>
                                    <div class="szc-subbox">
                                        <div class="szc-label">Mensagem apresentada no log</div>
                                        <input class="szc-input" data-id="msgRadiusLog" type="text" placeholder="Insira aqui a mensagem que apresenta">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="szc-field">
                            <div class="szc-label">Informações adicionais</div>
                            <textarea class="szc-textarea" data-id="infoAdicionais" placeholder="Detalhes adicionais do atendimento."></textarea>
                        </div>
                    </div>
                </div>

                <div class="szc-card">
                    <h3>Histórico de atendimento <span class="szc-badge">obrigatório</span></h3>
                    <input class="szc-input" data-id="historicoAtendimento" type="text" placeholder="Exemplo: Cliente possui 2 atendimentos nos últimos 3 meses">
                </div>

                <div class="szc-card">
                    <h3>📌 Conclusão <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-check-list">
                        <div class="szc-check-item">
                            <label class="szc-check-header">
                                <input type="radio" name="conclusao" data-id="conclusao" value="Conexão normalizada">
                                <span>Conexão normalizada</span>
                            </label>
                        </div>
                        <div class="szc-check-item" data-show-when="conclusao=Problema persiste, encaminhado para Logística">
                            <label class="szc-check-header">
                                <input type="radio" name="conclusao" data-id="conclusao" value="Problema persiste, encaminhado para Logística">
                                <span>Problema persiste, encaminhado para Logística</span>
                            </label>
                            <div class="szc-subbox">
                                <div class="szc-label">Informações para o setor de Logística inserir na O.S.</div>
                                <textarea class="szc-textarea" data-id="infoLogistica" placeholder="Insira as informações para a Logística"></textarea>
                            </div>
                        </div>
                        <div class="szc-check-item">
                            <label class="szc-check-header">
                                <input type="radio" name="conclusao" data-id="conclusao" value="Problema persiste, visita técnica agendada">
                                <span>Problema persiste, visita técnica agendada</span>
                            </label>
                        </div>
                    </div>
                </div>
            `,
            generate: (v) => {
                const valOrNA = (x) => (x && x.toString().trim()) ? x.toString().trim() : 'Não informado.';
                const linhas = [];

                linhas.push('Problema relatado pelo cliente: ' + valOrNA(v.problemaCliente));
                linhas.push('');
                linhas.push('----------- TESTES REALIZADOS PELO CSA ONU / ROTEADOR -----------');
                linhas.push('[CONFIGURAÇÕES DA ONU]');
                linhas.push(valOrNA(v.configOnu));
                linhas.push('');
                linhas.push('Plano desconectado desde: ' + valOrNA(v.planoDesconectado));
                linhas.push('Equipamentos reiniciados: ' + valOrNA(v.equipReiniciados));
                linhas.push('Validado cabo de rede na porta WAN do roteador: ' + valOrNA(v.caboWanValidado));
                linhas.push('Aparece o nome da rede Wi-Fi para o cliente: ' + valOrNA(v.wifiVisivel));
                linhas.push('Aparece tentativa de autenticação no log do radius: ' + valOrNA(v.radiusLog));

                if (v.radiusLog === 'Sim' && v.msgRadiusLog && v.msgRadiusLog.trim()) {
                    linhas.push('Mensagem apresentada no radius: ' + v.msgRadiusLog.trim());
                }

                if (v.infoAdicionais && v.infoAdicionais.trim()) {
                    linhas.push('Informações adicionais: ' + v.infoAdicionais.trim());
                }

                linhas.push('');
                linhas.push('----------- HISTÓRICO DE ATENDIMENTO -----------');
                linhas.push(valOrNA(v.historicoAtendimento));
                linhas.push('');

                if (v.conclusao) {
                    linhas.push('Conclusão: ' + v.conclusao);
                }

                if (v.conclusao === 'Problema persiste, encaminhado para Logística' && v.infoLogistica && v.infoLogistica.trim()) {
                    linhas.push('');
                    linhas.push('----------- LOGÍSTICA / O.S -----------');
                    linhas.push('');
                    linhas.push(v.infoLogistica.trim());
                }

                return linhas.join('\n');
            },
        },

        sem_conexao_onu_down: {
            label: 'Sem conexão - ONU DOWN',
            render: () => `
                <div class="szc-card">
                    <h3>📡 Sem acesso - ONU DOWN <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-stack">
                        <div class="szc-field">
                            <div class="szc-label">Problema relatado pelo cliente</div>
                            <textarea class="szc-textarea" data-id="problemaCliente" placeholder="Descreva o problema relatado pelo cliente."></textarea>
                        </div>
                    </div>
                </div>

                <div class="szc-card">
                    <h3>Dados ONU <span class="szc-badge">obrigatório</span></h3>
                    <textarea class="szc-textarea" data-id="dadosOnu" placeholder="Insira os dados da ONU"></textarea>
                </div>

                <div class="szc-card">
                    <h3>Testes realizados <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-stack">
                        <div class="szc-field">
                            <div class="szc-label">Verificado ONU DOWN com alarme de Link</div>
                            <select class="szc-select" data-id="alarmeOnu">
                                <option value="">Selecione</option>
                                <option value="LOS">LOS</option>
                                <option value="Sem Energia">Sem Energia</option>
                                <option value="Down">Down</option>
                                <option value="Outro">Outro</option>
                            </select>
                        </div>

                        <div class="szc-field">
                            <div class="szc-label">Plano desconectado desde</div>
                            <input class="szc-input" data-id="planoDesconectado" type="text" placeholder="Ex: 10/09 14h30">
                        </div>

                        <div class="szc-field">
                            <div class="szc-label">Último sinal da ONU</div>
                            <input class="szc-input" data-id="sinalOnu" type="text" placeholder="Ex: -25.4 dBm">
                        </div>

                        <div class="szc-field">
                            <div class="szc-label">Demais clientes da caixa estão</div>
                            <div class="szc-check-list">
                                <div class="szc-check-item">
                                    <label class="szc-check-header">
                                        <input type="radio" name="clientesCaixa" data-id="clientesCaixa" value="Up">
                                        <span>Up</span>
                                    </label>
                                </div>
                                <div class="szc-check-item">
                                    <label class="szc-check-header">
                                        <input type="radio" name="clientesCaixa" data-id="clientesCaixa" value="Down">
                                        <span>Down</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div class="szc-field">
                            <div class="szc-label">Validado energia no local</div>
                            <div class="szc-check-list">
                                <div class="szc-check-item">
                                    <label class="szc-check-header">
                                        <input type="radio" name="energiaLocal" data-id="energiaLocal" value="Sim">
                                        <span>Sim</span>
                                    </label>
                                </div>
                                <div class="szc-check-item">
                                    <label class="szc-check-header">
                                        <input type="radio" name="energiaLocal" data-id="energiaLocal" value="Não">
                                        <span>Não</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div class="szc-field">
                            <div class="szc-label">Equipamentos reiniciados</div>
                            <div class="szc-check-list">
                                <div class="szc-check-item">
                                    <label class="szc-check-header">
                                        <input type="radio" name="equipReiniciados" data-id="equipReiniciados" value="Sim">
                                        <span>Sim</span>
                                    </label>
                                </div>
                                <div class="szc-check-item">
                                    <label class="szc-check-header">
                                        <input type="radio" name="equipReiniciados" data-id="equipReiniciados" value="Não">
                                        <span>Não</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div class="szc-field">
                            <div class="szc-label">Informações adicionais</div>
                            <textarea class="szc-textarea" data-id="infoAdicionais" placeholder="Detalhes adicionais do atendimento."></textarea>
                        </div>
                    </div>
                </div>

                <div class="szc-card">
                    <h3>Histórico de atendimento <span class="szc-badge">obrigatório</span></h3>
                    <input class="szc-input" data-id="historicoAtendimento" type="text" placeholder="Exemplo: Cliente possui 2 atendimentos nos últimos 3 meses">
                </div>

                <div class="szc-card">
                    <h3>📌 Conclusão <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-check-list">
                        <div class="szc-check-item">
                            <label class="szc-check-header">
                                <input type="radio" name="conclusao" data-id="conclusao" value="Conexão normalizada">
                                <span>Conexão normalizada</span>
                            </label>
                        </div>
                        <div class="szc-check-item" data-show-when="conclusao=Problema persiste, encaminhado para Logística">
                            <label class="szc-check-header">
                                <input type="radio" name="conclusao" data-id="conclusao" value="Problema persiste, encaminhado para Logística">
                                <span>Problema persiste, encaminhado para Logística</span>
                            </label>
                            <div class="szc-subbox">
                                <div class="szc-label">Informações para o setor de Logística inserir na O.S.</div>
                                <textarea class="szc-textarea" data-id="infoLogistica" placeholder="Será preenchido automaticamente ao gerar, mas você pode editar."></textarea>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            generate: (v) => {
                const valOrNA = (x) => (x && x.toString().trim()) ? x.toString().trim() : 'Não informado.';
                const linhas = [];

                linhas.push('');
                linhas.push('Problema relatado pelo cliente: ' + valOrNA(v.problemaCliente));
                linhas.push('');
                linhas.push('----------- DADOS ONU -----------');
                linhas.push('');
                linhas.push(valOrNA(v.dadosOnu));
                linhas.push('');
                linhas.push('----------- TESTES REALIZADOS PELO CSA ONU / ROTEADOR -----------');
                linhas.push('');
                linhas.push('Verificado ONU DOWN com alarme de Link: ' + valOrNA(v.alarmeOnu));

                if (v.planoDesconectado && v.planoDesconectado.trim()) {
                    linhas.push('Plano desconectado desde: ' + v.planoDesconectado.trim());
                }
                if (v.sinalOnu && v.sinalOnu.trim()) {
                    linhas.push('Último sinal da ONU: ' + v.sinalOnu.trim());
                }

                linhas.push('Demais clientes da caixa estão: ' + valOrNA(v.clientesCaixa));
                linhas.push('Validado energia no local: ' + valOrNA(v.energiaLocal));
                linhas.push('Equipamentos reiniciados: ' + valOrNA(v.equipReiniciados));

                if (v.infoAdicionais && v.infoAdicionais.trim()) {
                    linhas.push('');
                    linhas.push('Informações adicionais: ' + v.infoAdicionais.trim());
                }

                if (v.historicoAtendimento && v.historicoAtendimento.trim()) {
                    linhas.push('');
                    linhas.push('----------- HISTÓRICO DE ATENDIMENTO -----------');
                    linhas.push('');
                    linhas.push('Histórico de atendimento: ' + v.historicoAtendimento.trim());
                }

                if (v.conclusao) {
                    linhas.push('');
                    linhas.push('Conclusão: ' + v.conclusao);
                }

                if (v.conclusao === 'Problema persiste, encaminhado para Logística') {
                    // Auto-fill if user didn't customize it
                    let infoLog = (v.infoLogistica || '').trim();
                    if (!infoLog) {
                        infoLog = 'Verificado ONU DOWN com alarme de link: ' + valOrNA(v.alarmeOnu) + '\nEncaminhar técnico no local.';
                    }
                    linhas.push('');
                    linhas.push('----------- LOGÍSTICA / O.S -----------');
                    linhas.push('');
                    linhas.push(infoLog);
                }

                return linhas.join('\n');
            },
        },

        conectado_sem_internet: {
            label: 'Conectado sem Internet',
            render: () => `
                <div class="szc-card">
                    <h3>📶 Login conectado - mas não navega <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-stack">
                        <div class="szc-field">
                            <div class="szc-label">Problema relatado pelo cliente</div>
                            <textarea class="szc-textarea" data-id="problemaCliente" placeholder="Exemplo: Cliente informa que todos os aparelhos estão conectados ao Wi-Fi, mas aparece a mensagem sem acesso à internet."></textarea>
                        </div>
                    </div>
                </div>

                <div class="szc-card">
                    <h3>🔧 Configurações do roteador <span class="szc-badge">obrigatório</span></h3>
                    <textarea class="szc-textarea" data-id="configRoteador" placeholder="Cole as informações do roteador aqui. Caso não haja acesso ou seja Mikrotik, registre aqui."></textarea>
                </div>

                <div class="szc-card">
                    <h3>Ações / Alterações realizadas no roteador <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-check-list">
                        <div class="szc-check-item">
                            <label class="szc-check-header"><input type="checkbox" data-id="nenhumaAlt"><span>Nenhuma alteração realizada</span></label>
                        </div>
                        <div class="szc-check-item">
                            <label class="szc-check-header"><input type="checkbox" data-id="reiniciadoRoteador"><span>Reiniciado roteador</span></label>
                        </div>
                        <div class="szc-check-item" data-show-when="larg2_4=true">
                            <label class="szc-check-header"><input type="checkbox" data-id="larg2_4"><span>Largura de banda 2.4 GHz alterada para</span></label>
                            <div class="szc-subbox">
                                <input class="szc-input" data-id="larg2_4_txt" type="text" placeholder="Ex: 20MHz">
                            </div>
                        </div>
                        <div class="szc-check-item" data-show-when="canal2_4=true">
                            <label class="szc-check-header"><input type="checkbox" data-id="canal2_4"><span>Canal 2.4 GHz alterado para</span></label>
                            <div class="szc-subbox">
                                <input class="szc-input" data-id="canal2_4_txt" type="text" placeholder="Ex: 1, 6 ou 11">
                            </div>
                        </div>
                        <div class="szc-check-item" data-show-when="larg5=true">
                            <label class="szc-check-header"><input type="checkbox" data-id="larg5"><span>Largura de banda 5 GHz alterada para</span></label>
                            <div class="szc-subbox">
                                <input class="szc-input" data-id="larg5_txt" type="text" placeholder="Ex: 80MHz">
                            </div>
                        </div>
                        <div class="szc-check-item" data-show-when="canal5=true">
                            <label class="szc-check-header"><input type="checkbox" data-id="canal5"><span>Canal 5 GHz alterado para</span></label>
                            <div class="szc-subbox">
                                <input class="szc-input" data-id="canal5_txt" type="text" placeholder="Ex: 36, 40, 44...">
                            </div>
                        </div>
                        <div class="szc-check-item" data-show-when="dnsLan=true">
                            <label class="szc-check-header"><input type="checkbox" data-id="dnsLan"><span>DNS LAN alterado para</span></label>
                            <div class="szc-subbox">
                                <select class="szc-select" data-id="dnsLan_txt">
                                    <option value="">Selecione</option>
                                    <option value="177.131.112.10 / 177.131.112.11">177.131.112.10 / 177.131.112.11</option>
                                    <option value="187.85.152.10 / 187.85.152.11">187.85.152.10 / 187.85.152.11</option>
                                </select>
                            </div>
                        </div>
                        <div class="szc-check-item" data-show-when="dnsWan=true">
                            <label class="szc-check-header"><input type="checkbox" data-id="dnsWan"><span>DNS WAN alterado para</span></label>
                            <div class="szc-subbox">
                                <select class="szc-select" data-id="dnsWan_txt">
                                    <option value="">Selecione</option>
                                    <option value="177.131.112.10 / 177.131.112.11">177.131.112.10 / 177.131.112.11</option>
                                    <option value="187.85.152.10 / 187.85.152.11">187.85.152.10 / 187.85.152.11</option>
                                </select>
                            </div>
                        </div>
                        <div class="szc-check-item">
                            <label class="szc-check-header"><input type="checkbox" data-id="dnsIncorreto"><span>DNS incorreto — alteração remota não permitida</span></label>
                        </div>
                        <div class="szc-check-item">
                            <label class="szc-check-header"><input type="checkbox" data-id="mtu1492"><span>MTU alterado para 1492</span></label>
                        </div>
                        <div class="szc-check-item" data-show-when="ipv6=true">
                            <label class="szc-check-header"><input type="checkbox" data-id="ipv6"><span>IPv6 habilitado em</span></label>
                            <div class="szc-subbox">
                                <select class="szc-select" data-id="ipv6_txt">
                                    <option value="">Selecione</option>
                                    <option value="SLAAC">SLAAC</option>
                                    <option value="DHCP">DHCP</option>
                                    <option value="AUTO">AUTO</option>
                                </select>
                            </div>
                        </div>
                        <div class="szc-check-item">
                            <label class="szc-check-header"><input type="checkbox" data-id="firmware"><span>Firmware atualizado</span></label>
                        </div>
                        <div class="szc-check-item">
                            <label class="szc-check-header"><input type="checkbox" data-id="limpeza"><span>Limpeza da lista de aparelhos offline realizada</span></label>
                        </div>
                        <div class="szc-check-item" data-show-when="outrasAcoesRoteador=true">
                            <label class="szc-check-header"><input type="checkbox" data-id="outrasAcoesRoteador"><span>Outras ações realizadas no roteador</span></label>
                            <div class="szc-subbox">
                                <textarea class="szc-textarea" data-id="outrasAcoesRoteador_txt" placeholder="Exemplo: Campo Gateway padrão estava em branco, configurado o mesmo"></textarea>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="szc-card">
                    <h3>💡 Informações da ONU <span class="szc-badge">obrigatório</span></h3>
                    <textarea class="szc-textarea" data-id="infoOnu" placeholder="Cole os dados da ONU aqui..."></textarea>
                </div>

                <div class="szc-card">
                    <h3>Outras ações realizadas</h3>
                    <textarea class="szc-textarea" data-id="outrasAcoes" placeholder="Descreva outras ações ou verificações realizadas durante o atendimento."></textarea>
                </div>

                <div class="szc-card">
                    <h3>Histórico de atendimento <span class="szc-badge">obrigatório</span></h3>
                    <input class="szc-input" data-id="historicoAtendimento" type="text" placeholder="Exemplo: Cliente possui 2 atendimentos nos últimos 3 meses">
                </div>

                <div class="szc-card">
                    <h3>📌 Conclusão <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-check-list">
                        <div class="szc-check-item">
                            <label class="szc-check-header">
                                <input type="radio" name="conclusao" data-id="conclusao" value="Conexão normalizada">
                                <span>Conexão normalizada</span>
                            </label>
                        </div>
                        <div class="szc-check-item">
                            <label class="szc-check-header">
                                <input type="radio" name="conclusao" data-id="conclusao" value="Não foi possível validar, cliente parou de interagir no SZ">
                                <span>Não foi possível validar, cliente parou de interagir no SZ</span>
                            </label>
                        </div>
                        <div class="szc-check-item">
                            <label class="szc-check-header">
                                <input type="radio" name="conclusao" data-id="conclusao" value="Cliente optou por continuar testando a conexão e, caso perceba novas dificuldades, retornará o contato">
                                <span>Cliente optou por continuar testando a conexão</span>
                            </label>
                        </div>
                        <div class="szc-check-item" data-show-when="conclusao=Problema persiste, encaminhado para Logística">
                            <label class="szc-check-header">
                                <input type="radio" name="conclusao" data-id="conclusao" value="Problema persiste, encaminhado para Logística">
                                <span>Problema persiste, encaminhado para Logística</span>
                            </label>
                            <div class="szc-subbox">
                                <div class="szc-label">Informações para o setor de Logística inserir na O.S.</div>
                                <textarea class="szc-textarea" data-id="infoLogistica" placeholder="Insira as informações para o setor de logística"></textarea>
                            </div>
                        </div>
                        <div class="szc-check-item" data-show-when="conclusao=Outros">
                            <label class="szc-check-header">
                                <input type="radio" name="conclusao" data-id="conclusao" value="Outros">
                                <span>Outros (especificar)</span>
                            </label>
                            <div class="szc-subbox">
                                <div class="szc-label">Detalhamento do "Outros"</div>
                                <textarea class="szc-textarea" data-id="infoOutros" placeholder="Descreva o 'Outros'"></textarea>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            generate: (v) => {
                const valOrNA = (x) => (x && x.toString().trim()) ? x.toString().trim() : 'Não informado.';
                const linhas = [];

                linhas.push('LOGIN CONECTADO - MAS NÃO NAVEGA');
                linhas.push('');
                linhas.push('Problema relatado pelo cliente: ' + valOrNA(v.problemaCliente));
                linhas.push('');
                linhas.push('----------- TESTES REALIZADOS PELO CSA ONU / ROTEADOR -----------');
                linhas.push('');
                linhas.push('[CONFIGURAÇÕES DO ROTEADOR]');
                linhas.push(valOrNA(v.configRoteador));
                linhas.push('');

                const acoes = [];
                if (v.nenhumaAlt) acoes.push('Nenhuma alteração realizada');
                if (v.reiniciadoRoteador) acoes.push('Reiniciado roteador');
                if (v.larg2_4) acoes.push('Largura de banda 2.4 GHz alterada para: ' + (v.larg2_4_txt || ''));
                if (v.canal2_4) acoes.push('Canal 2.4 GHz alterado para: ' + (v.canal2_4_txt || ''));
                if (v.larg5) acoes.push('Largura de banda 5 GHz alterada para: ' + (v.larg5_txt || ''));
                if (v.canal5) acoes.push('Canal 5 GHz alterado para: ' + (v.canal5_txt || ''));
                if (v.dnsLan) acoes.push('DNS LAN alterado para: ' + (v.dnsLan_txt || ''));
                if (v.dnsWan) acoes.push('DNS WAN alterado para: ' + (v.dnsWan_txt || ''));
                if (v.dnsIncorreto) acoes.push('DNS incorreto — alteração remota não permitida');
                if (v.mtu1492) acoes.push('MTU alterado para 1492');
                if (v.ipv6) acoes.push('IPv6 habilitado em: ' + (v.ipv6_txt || ''));
                if (v.firmware) acoes.push('Firmware atualizado');
                if (v.limpeza) acoes.push('Limpeza da lista de aparelhos offline realizada');
                if (v.outrasAcoesRoteador && v.outrasAcoesRoteador_txt) acoes.push(v.outrasAcoesRoteador_txt);

                if (acoes.length > 0) {
                    linhas.push('Ações / Alterações realizadas no roteador: ' + acoes.join(', '));
                    linhas.push('');
                }

                linhas.push('[INFORMAÇÕES DA ONU]');
                linhas.push(valOrNA(v.infoOnu));
                linhas.push('');

                if (v.outrasAcoes && v.outrasAcoes.trim()) {
                    linhas.push('Outras ações realizadas: ' + v.outrasAcoes.trim());
                    linhas.push('');
                }

                linhas.push('----------- HISTÓRICO DE ATENDIMENTO -----------');
                linhas.push(valOrNA(v.historicoAtendimento));
                linhas.push('');

                if (v.conclusao) {
                    linhas.push('Conclusão: ' + v.conclusao);
                }

                if (v.conclusao === 'Problema persiste, encaminhado para Logística' && v.infoLogistica && v.infoLogistica.trim()) {
                    linhas.push('');
                    linhas.push('----------- LOGÍSTICA / O.S -----------');
                    linhas.push(v.infoLogistica.trim());
                }

                if (v.conclusao === 'Outros' && v.infoOutros && v.infoOutros.trim()) {
                    linhas.push(v.infoOutros.trim());
                }

                return linhas.join('\n');
            },
        },

        troca_senha: {
            label: 'Troca de Senha / SSID',
            render: () => `
                <div class="szc-card">
                    <h3>Dados do solicitante <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-stack">
                        <div class="szc-field">
                            <div class="szc-label">Nome de quem entrou em contato</div>
                            <input class="szc-input" data-id="nomeSolicitante" type="text" placeholder="Digite o nome do solicitante">
                        </div>
                    </div>
                </div>

                <div class="szc-card">
                    <h3>Cliente entrou em contato solicitando <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-check-list">
                        <div class="szc-check-item" data-show-when="alterarSenha=true">
                            <label class="szc-check-header">
                                <input type="checkbox" data-id="alterarSenha">
                                <span>Alteração da senha do Wi-Fi</span>
                            </label>
                            <div class="szc-subbox">
                                <div class="szc-stack">
                                    <div class="szc-field">
                                        <div class="szc-label">Senha antiga</div>
                                        <input class="szc-input" data-id="senhaAntiga" type="text" placeholder="Digite a senha antiga">
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">Senha nova</div>
                                        <input class="szc-input" data-id="senhaNova" type="text" placeholder="Digite a nova senha">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="szc-check-item" data-show-when="alterarSSID=true">
                            <label class="szc-check-header">
                                <input type="checkbox" data-id="alterarSSID">
                                <span>Alteração do nome da rede (SSID)</span>
                            </label>
                            <div class="szc-subbox">
                                <div class="szc-stack">
                                    <div class="szc-field">
                                        <div class="szc-label">Nome atual</div>
                                        <input class="szc-input" data-id="nomeAtualSSID" type="text" placeholder="Digite o nome atual da rede">
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">Novo nome</div>
                                        <input class="szc-input" data-id="novoNomeSSID" type="text" placeholder="Digite o novo nome da rede">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="szc-card">
                    <h3>Dados do roteador / ONU para documentação <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-stack">
                        <div class="szc-field">
                            <div class="szc-label">Dados de roteador</div>
                            <textarea class="szc-textarea" data-id="dadosRoteador" placeholder="Cole as informações do roteador aqui. Caso não haja acesso ou seja Mikrotik, registre aqui."></textarea>
                        </div>
                        <div class="szc-field">
                            <div class="szc-label">Dados de ONU</div>
                            <textarea class="szc-textarea" data-id="dadosONU" placeholder="Cole os dados da ONU aqui."></textarea>
                        </div>
                    </div>
                </div>
            `,
            generate: (v) => {
                const valOrNA = (x) => (x && x.toString().trim()) ? x.toString().trim() : 'Não informado.';
                const linhas = [];

                linhas.push('Nome do solicitante: ' + valOrNA(v.nomeSolicitante));
                linhas.push('');
                linhas.push('Cliente entrou em contato referente a:');

                if (v.alterarSenha) {
                    linhas.push('Alteração da senha do Wi-Fi:');
                    linhas.push('- Senha antiga: ' + valOrNA(v.senhaAntiga));
                    linhas.push('- Senha nova: ' + valOrNA(v.senhaNova));
                    linhas.push('');
                }

                if (v.alterarSSID) {
                    linhas.push('Alteração do nome da rede (SSID):');
                    linhas.push('- Nome atual: ' + valOrNA(v.nomeAtualSSID));
                    linhas.push('- Novo nome: ' + valOrNA(v.novoNomeSSID));
                    linhas.push('');
                }

                if (!v.alterarSenha && !v.alterarSSID) {
                    linhas.push('Nenhuma solicitação específica foi selecionada.');
                    linhas.push('');
                }

                linhas.push('----------- DADOS DO ROTEADOR / ONU PARA DOCUMENTAÇÃO -----------');
                linhas.push('Dados de roteador:');
                linhas.push(valOrNA(v.dadosRoteador));
                linhas.push('');
                linhas.push('Dados de ONU:');
                linhas.push(valOrNA(v.dadosONU));

                return linhas.join('\n');
            },
        },

        outras_demandas: {
            label: 'Outras Demandas',
            render: () => `
                <div class="szc-card">
                    <h3>Dados do contato <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-stack">
                        <div class="szc-field">
                            <div class="szc-label">Nome de quem entrou em contato</div>
                            <input class="szc-input" data-id="nomeSolicitante" type="text" placeholder="Ex.: Maria Souza">
                        </div>
                        <div class="szc-field">
                            <div class="szc-label">Telefone que cliente entrou em contato</div>
                            <input class="szc-input" data-id="contatoSolicitante" type="text" placeholder="(DDD) 9xxxx-xxxx">
                        </div>
                    </div>
                </div>

                <div class="szc-card">
                    <h3>Demanda para o setor <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-check-list">
                        <div class="szc-check-item" data-show-when="setor=Suporte Técnico">
                            <label class="szc-check-header">
                                <input type="radio" name="setor" data-id="setor" value="Suporte Técnico">
                                <span>Suporte Técnico</span>
                            </label>
                            <div class="szc-subbox">
                                <div class="szc-stack">
                                    <div class="szc-field">
                                        <div class="szc-label">Descreva a solicitação do cliente</div>
                                        <textarea class="szc-textarea" data-id="solicitacaoSuporte" placeholder="Descreva com detalhes..."></textarea>
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">Dados do Roteador</div>
                                        <textarea class="szc-textarea" data-id="dadosRoteador" placeholder="Cole as informações do roteador aqui."></textarea>
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">Dados da ONU</div>
                                        <textarea class="szc-textarea" data-id="dadosONU" placeholder="Cole os dados da ONU aqui."></textarea>
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">Necessário encaminhar para Logística?</div>
                                        <div class="szc-check-list">
                                            <div class="szc-check-item">
                                                <label class="szc-check-header">
                                                    <input type="radio" name="logistica" data-id="logistica" value="Não">
                                                    <span>Não</span>
                                                </label>
                                            </div>
                                            <div class="szc-check-item" data-show-when="logistica=Sim">
                                                <label class="szc-check-header">
                                                    <input type="radio" name="logistica" data-id="logistica" value="Sim">
                                                    <span>Sim</span>
                                                </label>
                                                <div class="szc-subbox">
                                                    <div class="szc-label">Informações para o setor de Logística inserir na O.S.</div>
                                                    <textarea class="szc-textarea" data-id="infoLogistica" placeholder="Insira as informações para o setor de logística"></textarea>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="szc-check-item" data-show-when="setor=Comercial / SAC / Retenção">
                            <label class="szc-check-header">
                                <input type="radio" name="setor" data-id="setor" value="Comercial / SAC / Retenção">
                                <span>Comercial / SAC / Retenção</span>
                            </label>
                            <div class="szc-subbox">
                                <div class="szc-field">
                                    <div class="szc-label">Descreva a solicitação do cliente</div>
                                    <textarea class="szc-textarea" data-id="solicitacaoComercial" placeholder="Descreva com detalhes..."></textarea>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            generate: (v) => {
                const valOrNA = (x) => (x && x.toString().trim()) ? x.toString().trim() : 'Não informado.';
                const linhas = [];

                linhas.push('SOLICITAÇÃO DO CLIENTE');
                linhas.push('');
                linhas.push('Nome do solicitante: ' + valOrNA(v.nomeSolicitante));
                linhas.push('Contato: ' + valOrNA(v.contatoSolicitante));
                linhas.push('');

                if (v.setor === 'Suporte Técnico') {
                    linhas.push('Descrição da solicitação: ' + valOrNA(v.solicitacaoSuporte));
                    linhas.push('');
                    linhas.push('----------- DADOS DO ROTEADOR / ONU PARA DOCUMENTAÇÃO -----------');
                    linhas.push(valOrNA(v.dadosRoteador));
                    linhas.push('');
                    linhas.push('Dados da ONU:');
                    linhas.push(valOrNA(v.dadosONU));
                    linhas.push('');

                    if (v.logistica === 'Sim' && v.infoLogistica && v.infoLogistica.trim()) {
                        linhas.push('---------- Dados para Logística inserir na O.S ----------');
                        linhas.push(v.infoLogistica.trim());
                    }
                } else if (v.setor === 'Comercial / SAC / Retenção') {
                    linhas.push('Descrição da solicitação: ' + valOrNA(v.solicitacaoComercial));
                    linhas.push('');
                } else {
                    linhas.push('Setor não selecionado.');
                }

                return linhas.join('\n');
            },
        },

        abertura: {
            label: 'Abertura',
            render: () => `
                <div class="szc-card">
                    <h3>Canal de Atendimento <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-check-list">
                        <div class="szc-check-item" data-show-when="canal=Telefone">
                            <label class="szc-check-header">
                                <input type="radio" name="canal" data-id="canal" value="Telefone">
                                <span>Telefone</span>
                            </label>
                            <div class="szc-subbox">
                                <div class="szc-label">Protocolo HPBX</div>
                                <input class="szc-input" data-id="protocoloHPBX" type="text" placeholder="Ex.: 123456">
                            </div>
                        </div>
                        <div class="szc-check-item" data-show-when="canal=Sz.Chat">
                            <label class="szc-check-header">
                                <input type="radio" name="canal" data-id="canal" value="Sz.Chat">
                                <span>Sz.Chat</span>
                            </label>
                            <div class="szc-subbox">
                                <div class="szc-label">Protocolo SZ</div>
                                <input class="szc-input" data-id="protocoloSZ" type="text" placeholder="Ex.: 2026030302345">
                            </div>
                        </div>
                        <div class="szc-check-item" data-show-when="canal=E-mail">
                            <label class="szc-check-header">
                                <input type="radio" name="canal" data-id="canal" value="E-mail">
                                <span>E-mail</span>
                            </label>
                            <div class="szc-subbox">
                                <div class="szc-label">Conta do cliente</div>
                                <input class="szc-input" data-id="contaEmail" type="email" placeholder="email@cliente.com">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="szc-card">
                    <h3>Dados do contato <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-stack">
                        <div class="szc-field">
                            <div class="szc-label">Nome de quem entrou em contato</div>
                            <input class="szc-input" data-id="nomeSolicitante" type="text" placeholder="Ex.: Maria Souza">
                        </div>
                        <div class="szc-field">
                            <div class="szc-label">Telefone que cliente entrou em contato</div>
                            <input class="szc-input" data-id="telefoneContato" type="text" placeholder="(DDD) 9xxxx-xxxx">
                        </div>
                        <div class="szc-field">
                            <div class="szc-label">Descreva o relato do(a) cliente</div>
                            <textarea class="szc-textarea" data-id="relatoCliente" placeholder="Descreva com detalhes..."></textarea>
                        </div>
                    </div>
                </div>

                <div class="szc-card">
                    <h3>Tipo de demanda <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-check-list">

                        <div class="szc-check-item" data-show-when="demanda=Sem acesso">
                            <label class="szc-check-header">
                                <input type="radio" name="demanda" data-id="demanda" value="Sem acesso">
                                <span>Sem acesso</span>
                            </label>
                            <div class="szc-subbox">
                                <div class="szc-stack">
                                    <div class="szc-field">
                                        <div class="szc-label">Plano consta como conectado ou desconectado?</div>
                                        <div class="szc-check-list">
                                            <div class="szc-check-item">
                                                <label class="szc-check-header">
                                                    <input type="radio" name="planoStatus" data-id="planoStatus" value="Conectado">
                                                    <span>Conectado</span>
                                                </label>
                                            </div>
                                            <div class="szc-check-item">
                                                <label class="szc-check-header">
                                                    <input type="radio" name="planoStatus" data-id="planoStatus" value="Desconectado">
                                                    <span>Desconectado</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">Há alguma luz vermelha acesa nos equipamentos?</div>
                                        <input class="szc-input" data-id="luzVermelha" type="text" placeholder="Ex.: Sim, na ONU | Sim, apenas no roteador">
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">Os equipamentos foram reiniciados?</div>
                                        <div class="szc-check-list">
                                            <div class="szc-check-item">
                                                <label class="szc-check-header">
                                                    <input type="radio" name="reiniciados" data-id="reiniciados" value="Sim">
                                                    <span>Sim</span>
                                                </label>
                                            </div>
                                            <div class="szc-check-item">
                                                <label class="szc-check-header">
                                                    <input type="radio" name="reiniciados" data-id="reiniciados" value="Não">
                                                    <span>Não</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">O nome da rede Wi-Fi está visível?</div>
                                        <div class="szc-check-list">
                                            <div class="szc-check-item">
                                                <label class="szc-check-header">
                                                    <input type="radio" name="wifiVisivel" data-id="wifiVisivel" value="Sim">
                                                    <span>Sim</span>
                                                </label>
                                            </div>
                                            <div class="szc-check-item">
                                                <label class="szc-check-header">
                                                    <input type="radio" name="wifiVisivel" data-id="wifiVisivel" value="Não">
                                                    <span>Não</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">Atendimentos registrados nos últimos 3 meses</div>
                                        <input class="szc-input" data-id="atend3mSemAcesso" type="text" placeholder="Ex.: Cliente possui 2 atendimentos nos últimos 3 meses">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="szc-check-item" data-show-when="demanda=Conexão lenta">
                            <label class="szc-check-header">
                                <input type="radio" name="demanda" data-id="demanda" value="Conexão lenta">
                                <span>Conexão lenta</span>
                            </label>
                            <div class="szc-subbox">
                                <div class="szc-stack">
                                    <div class="szc-field">
                                        <div class="szc-label">Em quais equipamentos ocorre a dificuldade?</div>
                                        <textarea class="szc-textarea" data-id="equipDificuldade" placeholder="Ex.: celular, notebook, smart tv..."></textarea>
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">Os dispositivos estão conectados via cabo ou Wi-Fi?</div>
                                        <input class="szc-input" data-id="tipoConexao" type="text" placeholder="Ex.: Wi-Fi, cabo, ambos...">
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">A dificuldade ocorre em algum horário específico?</div>
                                        <input class="szc-input" data-id="horarioEspecifico" type="text" placeholder="Ex.: noite, 18h–22h...">
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">A dificuldade afeta algum aplicativo específico?</div>
                                        <textarea class="szc-textarea" data-id="appsAfetados" placeholder="Ex.: YouTube, Netflix, jogos..."></textarea>
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">Atendimentos registrados nos últimos 3 meses</div>
                                        <input class="szc-input" data-id="atend3mConexao" type="text" placeholder="Ex.: Cliente possui 2 atendimentos nos últimos 3 meses">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="szc-check-item" data-show-when="demanda=Alterar senha/rede Wi-Fi">
                            <label class="szc-check-header">
                                <input type="radio" name="demanda" data-id="demanda" value="Alterar senha/rede Wi-Fi">
                                <span>Alterar senha/rede Wi-Fi</span>
                            </label>
                            <div class="szc-subbox">
                                <div class="szc-check-list">
                                    <div class="szc-check-item" data-show-when="alterarSenha=true">
                                        <label class="szc-check-header">
                                            <input type="checkbox" data-id="alterarSenha">
                                            <span>Alteração da senha do Wi-Fi</span>
                                        </label>
                                        <div class="szc-subbox">
                                            <div class="szc-stack">
                                                <div class="szc-field">
                                                    <div class="szc-label">Senha antiga</div>
                                                    <input class="szc-input" data-id="senhaAntiga" type="text" placeholder="Digite a senha antiga">
                                                </div>
                                                <div class="szc-field">
                                                    <div class="szc-label">Senha nova</div>
                                                    <input class="szc-input" data-id="senhaNova" type="text" placeholder="Digite a nova senha">
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="szc-check-item" data-show-when="alterarSSID=true">
                                        <label class="szc-check-header">
                                            <input type="checkbox" data-id="alterarSSID">
                                            <span>Alteração do nome da rede (SSID)</span>
                                        </label>
                                        <div class="szc-subbox">
                                            <div class="szc-stack">
                                                <div class="szc-field">
                                                    <div class="szc-label">Nome atual</div>
                                                    <input class="szc-input" data-id="nomeAtualSSID" type="text" placeholder="Digite o nome atual da rede">
                                                </div>
                                                <div class="szc-field">
                                                    <div class="szc-label">Novo nome</div>
                                                    <input class="szc-input" data-id="novoNomeSSID" type="text" placeholder="Digite o novo nome da rede">
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="szc-stack" style="margin-top:14px;">
                                    <div class="szc-field">
                                        <div class="szc-label">Dados de roteador</div>
                                        <textarea class="szc-textarea" data-id="dadosRoteador" placeholder="Cole as informações do roteador aqui. Caso não haja acesso ou seja Mikrotik, registre aqui."></textarea>
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">Dados de ONU</div>
                                        <textarea class="szc-textarea" data-id="dadosONU" placeholder="Cole os dados da ONU aqui."></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="szc-check-item" data-show-when="demanda=Configuração de equipamento">
                            <label class="szc-check-header">
                                <input type="radio" name="demanda" data-id="demanda" value="Configuração de equipamento">
                                <span>Configuração de equipamento</span>
                            </label>
                            <div class="szc-subbox">
                                <div class="szc-stack">
                                    <div class="szc-field">
                                        <div class="szc-label">Descreva a configuração realizada no equipamento</div>
                                        <textarea class="szc-textarea" data-id="configEquipamento" placeholder="Exemplo: Realizado unificação da rede Wi-fi e ativado IPV6."></textarea>
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">Dados de roteador</div>
                                        <textarea class="szc-textarea" data-id="dadosRoteadorConfig" placeholder="Cole as informações do roteador aqui."></textarea>
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">Dados de ONU</div>
                                        <textarea class="szc-textarea" data-id="dadosONUConfig" placeholder="Cole os dados da ONU aqui."></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="szc-check-item" data-show-when="demanda=Outras">
                            <label class="szc-check-header">
                                <input type="radio" name="demanda" data-id="demanda" value="Outras">
                                <span>Outras</span>
                            </label>
                            <div class="szc-subbox">
                                <div class="szc-label" style="line-height:1.4;">
                                    <strong>Necessário encaminhar equipe técnica no local?</strong><br>
                                    <em>*Aplicável apenas nos seguintes casos:</em><br>
                                    - Verificação de cabo baixo;<br>
                                    - Mudança de local dos equipamentos na mesma residência;<br>
                                    - Cabo ou fonte danificados.
                                </div>
                                <div class="szc-check-list" style="margin-top:8px;">
                                    <div class="szc-check-item">
                                        <label class="szc-check-header">
                                            <input type="radio" name="equipeLocal" data-id="equipeLocal" value="Não">
                                            <span>Não</span>
                                        </label>
                                    </div>
                                    <div class="szc-check-item" data-show-when="equipeLocal=Sim">
                                        <label class="szc-check-header">
                                            <input type="radio" name="equipeLocal" data-id="equipeLocal" value="Sim">
                                            <span>Sim</span>
                                        </label>
                                        <div class="szc-subbox">
                                            <div class="szc-label">Informações para o setor de Logística inserir na O.S.</div>
                                            <textarea class="szc-textarea" data-id="dadosLogistica" placeholder="Descreva as informações para inserir na O.S..."></textarea>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            generate: (v) => {
                const valOrNA = (x) => (x && x.toString().trim()) ? x.toString().trim() : 'Não informado';
                const linhas = [];

                // Canal
                let detalheCanal = '';
                if (v.canal === 'Telefone') detalheCanal = ' - Protocolo HPBX: ' + valOrNA(v.protocoloHPBX);
                else if (v.canal === 'Sz.Chat') detalheCanal = ' - Protocolo SZ: ' + valOrNA(v.protocoloSZ);
                else if (v.canal === 'E-mail') detalheCanal = ' - Conta do cliente: ' + valOrNA(v.contaEmail);

                const canalFinal = (v.canal || 'Não informado') + detalheCanal;

                linhas.push('Canal de Atendimento: ' + canalFinal);
                linhas.push('Nome do solicitante: ' + valOrNA(v.nomeSolicitante));
                linhas.push('Telefone que cliente entrou em contato: ' + valOrNA(v.telefoneContato));
                linhas.push('');
                linhas.push('Relato do(a) cliente:');
                linhas.push(valOrNA(v.relatoCliente));
                linhas.push('');
                linhas.push('Tipo de demanda: ' + (v.demanda || 'Não informado'));
                linhas.push('-'.repeat(42));

                if (v.demanda === 'Sem acesso') {
                    linhas.push(' Detalhamento (Sem acesso)');
                    linhas.push('');
                    linhas.push('Plano consta como: ' + valOrNA(v.planoStatus));
                    linhas.push('Luz vermelha acesa: ' + valOrNA(v.luzVermelha));
                    linhas.push('Equipamentos reiniciados: ' + valOrNA(v.reiniciados));
                    linhas.push('Nome da rede Wi-Fi visível: ' + valOrNA(v.wifiVisivel));
                    linhas.push('Atendimentos nos últimos 3 meses: ' + valOrNA(v.atend3mSemAcesso));
                } else if (v.demanda === 'Conexão lenta') {
                    linhas.push(' Detalhamento (Conexão lenta)');
                    linhas.push('');
                    linhas.push('Equipamentos com dificuldade: ' + valOrNA(v.equipDificuldade));
                    linhas.push('Os dispositivos estão conectados via cabo ou Wi-Fi: ' + valOrNA(v.tipoConexao));
                    linhas.push('A dificuldade ocorre em algum horário específico: ' + valOrNA(v.horarioEspecifico));
                    linhas.push('A dificuldade afeta algum aplicativo específico: ' + valOrNA(v.appsAfetados));
                    linhas.push('Atendimentos nos últimos 3 meses: ' + valOrNA(v.atend3mConexao));
                } else if (v.demanda === 'Alterar senha/rede Wi-Fi') {
                    linhas.push(' Detalhamento da solicitação');
                    linhas.push('');

                    if (v.alterarSenha) {
                        linhas.push('Alteração da senha do Wi-Fi:');
                        linhas.push('- Senha antiga: ' + valOrNA(v.senhaAntiga));
                        linhas.push('- Senha nova: ' + valOrNA(v.senhaNova));
                        linhas.push('');
                    }

                    if (v.alterarSSID) {
                        linhas.push('Alteração do nome da rede (SSID):');
                        linhas.push('- Nome atual: ' + valOrNA(v.nomeAtualSSID));
                        linhas.push('- Novo nome: ' + valOrNA(v.novoNomeSSID));
                        linhas.push('');
                    }

                    if (!v.alterarSenha && !v.alterarSSID) {
                        linhas.push('Nenhuma opção de alteração foi selecionada.');
                        linhas.push('');
                    }

                    linhas.push('----------- DADOS DO ROTEADOR / ONU PARA DOCUMENTAÇÃO -----------');
                    linhas.push('');
                    linhas.push('Dados de roteador:');
                    linhas.push(valOrNA(v.dadosRoteador));
                    linhas.push('');
                    linhas.push('Dados de ONU:');
                    linhas.push(valOrNA(v.dadosONU));
                } else if (v.demanda === 'Configuração de equipamento') {
                    linhas.push('Configuração realizada: ' + valOrNA(v.configEquipamento));
                    linhas.push('');
                    linhas.push('----------- DADOS DO ROTEADOR / ONU PARA DOCUMENTAÇÃO -----------');
                    linhas.push('');
                    linhas.push('Dados de roteador:');
                    linhas.push(valOrNA(v.dadosRoteadorConfig));
                    linhas.push('');
                    linhas.push('Dados de ONU:');
                    linhas.push(valOrNA(v.dadosONUConfig));
                } else if (v.demanda === 'Outras') {
                    linhas.push('Necessário encaminhar equipe técnica: ' + valOrNA(v.equipeLocal));
                    if (v.equipeLocal === 'Sim') {
                        linhas.push('');
                        linhas.push('---------- Dados para Logística inserir na O.S ----------');
                        linhas.push(valOrNA(v.dadosLogistica));
                    }
                }

                return linhas.join('\n');
            },
        },

        whatsapp_monitoramento: {
            label: 'Whatsapp - Monitoramento',
            render: () => `
                <div class="szc-card">
                    <h3>Tipo de evento <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-check-list">
                        <div class="szc-check-item" data-show-when="tipoEvento=alarme">
                            <label class="szc-check-header">
                                <input type="radio" name="tipoEvento" data-id="tipoEvento" value="alarme">
                                <span>Evento com alarme no INT6</span>
                            </label>
                            <div class="szc-subbox">
                                <div class="szc-stack">
                                    <div class="szc-field">
                                        <div class="szc-label">Nome do cliente</div>
                                        <input class="szc-input" data-id="nomeClienteAlarme" type="text" placeholder="Digite o nome do cliente">
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">Validado energia</div>
                                        <div class="szc-check-list">
                                            <div class="szc-check-item">
                                                <label class="szc-check-header">
                                                    <input type="radio" name="energiaAlarme" data-id="energiaAlarme" value="Sim">
                                                    <span>Sim</span>
                                                </label>
                                            </div>
                                            <div class="szc-check-item">
                                                <label class="szc-check-header">
                                                    <input type="radio" name="energiaAlarme" data-id="energiaAlarme" value="Não">
                                                    <span>Não</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="szc-check-item" data-show-when="tipoEvento=ponto">
                            <label class="szc-check-header">
                                <input type="radio" name="tipoEvento" data-id="tipoEvento" value="ponto">
                                <span>Ponto de acesso (não alarmado no INT6)</span>
                            </label>
                            <div class="szc-subbox">
                                <div class="szc-stack">
                                    <div class="szc-field">
                                        <div class="szc-label">Nome do cliente</div>
                                        <input class="szc-input" data-id="nomeClientePonto" type="text" placeholder="Digite o nome do cliente">
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">Ponto de acesso</div>
                                        <input class="szc-input" data-id="pontoAcesso" type="text" placeholder="Digite o ponto de acesso">
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">Validado energia</div>
                                        <div class="szc-check-list">
                                            <div class="szc-check-item">
                                                <label class="szc-check-header">
                                                    <input type="radio" name="energiaPonto" data-id="energiaPonto" value="Sim">
                                                    <span>Sim</span>
                                                </label>
                                            </div>
                                            <div class="szc-check-item">
                                                <label class="szc-check-header">
                                                    <input type="radio" name="energiaPonto" data-id="energiaPonto" value="Não">
                                                    <span>Não</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="szc-check-item" data-show-when="tipoEvento=condominio">
                            <label class="szc-check-header">
                                <input type="radio" name="tipoEvento" data-id="tipoEvento" value="condominio">
                                <span>Condomínio / Edifício (não alarmado no INT6)</span>
                            </label>
                            <div class="szc-subbox">
                                <div class="szc-stack">
                                    <div class="szc-field">
                                        <div class="szc-label">Condomínio</div>
                                        <input class="szc-input" data-id="nomeCondominio" type="text" placeholder="Nome do condomínio">
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">Nome do cliente</div>
                                        <input class="szc-input" data-id="nomeClienteCondominio" type="text" placeholder="Digite o nome do cliente">
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">Ap / Bloco</div>
                                        <input class="szc-input" data-id="apCasaBloco" type="text" placeholder="Ex: Ap 302 / Bloco B">
                                    </div>
                                    <div class="szc-field">
                                        <div class="szc-label">Energia corredor</div>
                                        <div class="szc-check-list">
                                            <div class="szc-check-item">
                                                <label class="szc-check-header">
                                                    <input type="radio" name="energiaCorredor" data-id="energiaCorredor" value="Sim">
                                                    <span>Sim</span>
                                                </label>
                                            </div>
                                            <div class="szc-check-item">
                                                <label class="szc-check-header">
                                                    <input type="radio" name="energiaCorredor" data-id="energiaCorredor" value="Não">
                                                    <span>Não</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="szc-card">
                    <h3>Contato <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-field">
                        <div class="szc-label">Telefone</div>
                        <input class="szc-input" data-id="telefone" type="text" placeholder="(DDD) 9xxxx-xxxx">
                    </div>
                </div>
            `,
            generate: (v) => {
                const valOrNA = (x) => (x && x.toString().trim()) ? x.toString().trim() : 'Não informado.';
                const linhas = [];

                if (v.tipoEvento === 'alarme') {
                    linhas.push('Nome do cliente: ' + valOrNA(v.nomeClienteAlarme));
                    linhas.push('Validado energia: ' + valOrNA(v.energiaAlarme));
                } else if (v.tipoEvento === 'ponto') {
                    linhas.push('Nome do cliente: ' + valOrNA(v.nomeClientePonto));
                    linhas.push('Ponto de acesso: ' + valOrNA(v.pontoAcesso));
                    linhas.push('Validado energia: ' + valOrNA(v.energiaPonto));
                } else if (v.tipoEvento === 'condominio') {
                    linhas.push('Condomínio: ' + valOrNA(v.nomeCondominio));
                    linhas.push('Nome do cliente: ' + valOrNA(v.nomeClienteCondominio));
                    linhas.push('Ap/Bloco: ' + valOrNA(v.apCasaBloco));
                    linhas.push('Energia corredor: ' + valOrNA(v.energiaCorredor));
                } else {
                    linhas.push('Tipo de evento não selecionado.');
                }

                linhas.push('Telefone: ' + valOrNA(v.telefone));

                return linhas.join('\n');
            },
        },

        whatsapp_acionamento: {
            label: 'Whatsapp - Acionamento',
            render: () => `
                <div class="szc-card">
                    <h3>Dados da execução <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-stack">
                        <div class="szc-field">
                            <div class="szc-label">Data da execução do serviço</div>
                            <input class="szc-input" data-id="dataServico" type="date">
                        </div>

                        <div class="szc-field">
                            <div class="szc-label">Nome do Técnico</div>
                            <input class="szc-input" data-id="tecnico" type="text" placeholder="Marcar @técnico no grupo WhatsApp">
                        </div>

                        <div class="szc-field">
                            <div class="szc-label">Restrição de horário</div>
                            <div class="szc-check-list">
                                <div class="szc-check-item">
                                    <label class="szc-check-header">
                                        <input type="radio" name="restricao" data-id="restricao" value="Não">
                                        <span>Não</span>
                                    </label>
                                </div>
                                <div class="szc-check-item" data-show-when="restricao=Sim">
                                    <label class="szc-check-header">
                                        <input type="radio" name="restricao" data-id="restricao" value="Sim">
                                        <span>Sim</span>
                                    </label>
                                    <div class="szc-subbox">
                                        <div class="szc-label">Especifique</div>
                                        <input class="szc-input" data-id="restricaoTexto" type="text" placeholder="Ex: Realizar antes das 14h / Realizar após as 15h">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="szc-card">
                    <h3>Protocolos <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-stack">
                        <div class="szc-field">
                            <div class="szc-label">Protocolo de atendimento</div>
                            <input class="szc-input" data-id="protocoloAtendimento" type="text" placeholder="Digite o protocolo">
                        </div>
                        <div class="szc-field">
                            <div class="szc-label">Protocolo O.S Multifoco</div>
                            <input class="szc-input" data-id="osMultifoco" type="text" placeholder="Digite o protocolo da O.S">
                        </div>
                    </div>
                </div>

                <div class="szc-card">
                    <h3>Localização do atendimento <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-stack">
                        <div class="szc-field">
                            <div class="szc-label">Contato</div>
                            <input class="szc-input" data-id="contato" type="text" placeholder="Telefone / WhatsApp do cliente">
                        </div>
                        <div class="szc-field">
                            <div class="szc-label">Cidade e Bairro</div>
                            <input class="szc-input" data-id="cidade" type="text" placeholder="Cidade e bairro do atendimento">
                        </div>
                    </div>
                </div>

                <div class="szc-card">
                    <h3>Prévia <span class="szc-badge">obrigatório</span></h3>
                    <div class="szc-field">
                        <div class="szc-label">Resumo do problema identificado</div>
                        <textarea class="szc-textarea" data-id="previa" placeholder="Ex.: ONU em LOS, Roteador resetado, Sinal alto, cabo limitando velocidade, etc."></textarea>
                    </div>
                </div>
            `,
            generate: (v) => {
                const valOrNA = (x) => (x && x.toString().trim()) ? x.toString().trim() : 'Não informado.';

                // Converte yyyy-mm-dd para dd/mm/aaaa
                let dataServico = '';
                if (v.dataServico && v.dataServico.trim()) {
                    const partes = v.dataServico.trim().split('-');
                    if (partes.length === 3) {
                        dataServico = partes[2] + '/' + partes[1] + '/' + partes[0];
                    } else {
                        dataServico = v.dataServico.trim();
                    }
                } else {
                    dataServico = 'Não informado.';
                }

                // Restrição: se Sim e tem texto, junta com " – "
                let restricaoFinal = '';
                if (v.restricao === 'Sim') {
                    restricaoFinal = 'Sim';
                    if (v.restricaoTexto && v.restricaoTexto.trim()) {
                        restricaoFinal += ' – ' + v.restricaoTexto.trim();
                    }
                } else if (v.restricao === 'Não') {
                    restricaoFinal = 'Não';
                } else {
                    restricaoFinal = 'Não informado.';
                }

                const linhas = [];
                linhas.push('Data da execução do serviço: ' + dataServico);
                linhas.push('Nome do Técnico: ' + valOrNA(v.tecnico));
                linhas.push('Restrição de horário: ' + restricaoFinal);
                linhas.push('Protocolo de atendimento: ' + valOrNA(v.protocoloAtendimento));
                linhas.push('Protocolo O.S Multifoco: ' + valOrNA(v.osMultifoco));
                linhas.push('Contato: ' + valOrNA(v.contato));
                linhas.push('Cidade: ' + valOrNA(v.cidade));
                linhas.push('Prévia: ' + valOrNA(v.previa));

                return linhas.join('\n');
            },
        },
    };

    // ============ STYLES ============
    const style = document.createElement('style');
    style.textContent = `
        #szchat-popup {
            position: fixed;
            z-index: 999999;
            background: #ffffff;
            border: 1px solid #c7c7c7;
            border-radius: 10px;
            box-shadow: 0 6px 24px rgba(0,0,0,0.2);
            font-family: "Segoe UI", system-ui, Arial, sans-serif;
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
            color: #fff;
            padding: 8px 12px;
            cursor: move;
            display: flex;
            align-items: center;
            justify-content: space-between;
            user-select: none;
            flex-shrink: 0;
        }
        #szchat-header .title { font-weight: bold; font-size: 13px; }
        #szchat-header .subtitle {
            font-weight: normal; font-size: 11px; opacity: 0.9; margin-left: 8px;
            max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        #szchat-header .actions { display: flex; gap: 4px; }
        #szchat-header button {
            background: transparent; border: none; color: #fff; cursor: pointer;
            font-size: 14px; padding: 2px 8px; border-radius: 4px;
        }
        #szchat-header button:hover { background: rgba(255,255,255,0.2); }

        #szchat-toolbar {
            padding: 8px 12px;
            background: #f6f7fb;
            border-bottom: 1px solid #e7eaf0;
            display: flex; gap: 8px; align-items: center;
            flex-shrink: 0;
        }
        #szchat-toolbar select {
            flex: 1;
            padding: 6px 8px;
            border: 1px solid #dbe1ea;
            border-radius: 8px;
            font-size: 12px;
            background: #fff;
        }
        #szchat-toolbar button {
            padding: 6px 10px;
            border: 1px solid #dbe1ea;
            border-radius: 8px;
            background: #fff;
            font-size: 12px;
            cursor: pointer;
            white-space: nowrap;
        }
        #szchat-toolbar button:hover { background: #f0f4ff; border-color: #2563eb; }

        #szchat-body {
            flex: 1;
            overflow-y: auto;
            padding: 10px 12px;
            background: #fafbfd;
            display: flex;
            flex-direction: column;
        }
        #szchat-body::-webkit-scrollbar { width: 8px; }
        #szchat-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

        #szchat-form-area {
            flex: 0 0 auto;
        }

        .szc-card {
            background: #fff;
            border: 1px solid #e7eaf0;
            border-radius: 10px;
            padding: 10px 12px;
            margin-bottom: 10px;
        }
        .szc-card h3 {
            margin: 0 0 8px 0;
            font-size: 13px;
            font-weight: 700;
            color: #111827;
            display: flex; align-items: center; gap: 6px;
        }
        .szc-badge {
            font-size: 10px; font-weight: 700; color: #1e293b;
            background: #eef2ff; border: 1px solid #e0e7ff;
            padding: 2px 6px; border-radius: 999px;
        }
        .szc-stack { display: flex; flex-direction: column; gap: 8px; }
        .szc-field { width: 100%; }
        .szc-label { font-size: 11px; color: #475569; margin: 0 0 4px 0; font-weight: 600; }
        .szc-input, .szc-select, .szc-textarea {
            width: 100%; box-sizing: border-box;
            border: 1px solid #dbe1ea; background: #fff;
            border-radius: 8px; padding: 7px 9px;
            font-size: 12px; outline: none;
            font-family: inherit;
        }
        .szc-textarea { min-height: 60px; resize: vertical; }
        .szc-input:focus, .szc-select:focus, .szc-textarea:focus {
            border-color: rgba(37,99,235,.7);
            box-shadow: 0 0 0 3px rgba(37,99,235,.12);
        }

        .szc-check-list { display: flex; flex-direction: column; gap: 6px; }
        .szc-check-item {
            border: 1px solid #e5e7eb;
            background: #fbfcff;
            border-radius: 8px;
            overflow: hidden;
        }
        .szc-check-header {
            display: flex; align-items: center; gap: 8px;
            padding: 8px 10px;
            font-size: 12px; font-weight: 600;
            cursor: pointer;
        }
        .szc-check-header input[type="checkbox"],
        .szc-check-header input[type="radio"] {
            width: 14px; height: 14px; accent-color: #2563eb; cursor: pointer; flex: 0 0 auto;
        }
        .szc-subbox {
            display: none;
            padding: 8px 10px 10px 30px;
            border-top: 1px solid #e5e7eb;
            background: #fff;
        }
        .szc-check-item.szc-active .szc-subbox { display: block; }

        #szchat-footer {
            border-top: 1px solid #e7eaf0;
            padding: 10px 12px;
            margin: 10px -12px -10px -12px;
            background: #f6f7fb;
            display: flex; flex-direction: column; gap: 6px;
            flex-shrink: 0;
        }
        #szchat-footer .row {
            display: flex; gap: 6px; align-items: center; justify-content: space-between;
        }
        #szchat-footer .status { font-size: 11px; color: #475569; font-style: italic; }
        #szchat-footer .phone { font-family: monospace; font-size: 11px; color: #666; }
        #szchat-footer button {
            padding: 6px 10px;
            border: 1px solid transparent;
            border-radius: 8px;
            font-size: 12px; font-weight: 700;
            cursor: pointer;
        }
        .szc-btn-primary { background: #2563eb; color: #fff; }
        .szc-btn-primary:hover { background: #1d4ed8; }
        .szc-btn-ghost { background: #fff; border-color: #dbe1ea !important; color: #0f172a; }
        .szc-btn-ghost:hover { border-color: #2563eb !important; }
        .szc-btn-danger { background: #fff1f2; border-color: #fecdd3 !important; color: #9f1239; }
        .szc-btn-danger:hover { background: #ffe4e6; }

        #szchat-output {
            width: 100%;
            min-height: 100px;
            box-sizing: border-box;
            font-family: ui-monospace, Menlo, Consolas, monospace;
            font-size: 11.5px;
            background: #1e293b;
            color: #e2e8f0;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 8px;
            outline: none;
            resize: vertical;
            white-space: pre-wrap;
        }

        #szchat-toggle {
            position: fixed;
            z-index: 999998;
            bottom: 20px; right: 20px;
            background: #1181b7;
            color: #fff;
            border: none;
            border-radius: 50%;
            width: 46px; height: 46px;
            cursor: pointer;
            box-shadow: 0 3px 10px rgba(0,0,0,0.25);
            font-size: 20px;
        }
        #szchat-toggle:hover { background: #0e6f9d; }

        .szc-disabled-overlay {
            display: flex; align-items: center; justify-content: center;
            flex: 1;
            color: #999; font-style: italic; padding: 20px; text-align: center;
        }

        .szc-card.szc-error {
            border-color: #ef4444;
            background: #fef2f2;
        }
        .szc-card.szc-error h3 { color: #b91c1c; }

        #szchat-error-banner {
            display: none;
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #7f1d1d;
            font-size: 12px;
            font-weight: 700;
            padding: 8px 10px;
            border-radius: 8px;
            margin-bottom: 10px;
        }
        #szchat-error-banner.szc-visible { display: block; }
    `;
    document.head.appendChild(style);

    // ============ BUILD UI ============
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'szchat-toggle';
    toggleBtn.title = 'Mostrar/ocultar atendimento';
    toggleBtn.textContent = '📝';
    document.body.appendChild(toggleBtn);

    const popup = document.createElement('div');
    popup.id = 'szchat-popup';

    const optionsHtml = Object.entries(SCRIPTS)
    .map(([id, s]) => `<option value="${id}">${s.label}</option>`)
    .join('');

    popup.innerHTML = `
        <div id="szchat-header">
            <div style="display:flex; align-items:center; min-width:0;">
                <span class="title">Atendimento</span>
                <span class="subtitle" id="szchat-subtitle">— sem chat ativo</span>
            </div>
            <div class="actions">
                <button id="szchat-hide" title="Ocultar">✕</button>
            </div>
        </div>
        <div id="szchat-toolbar">
            <select id="szchat-script-select" disabled>
                <option value="">Selecione um script...</option>
                ${optionsHtml}
            </select>
        </div>
        <div id="szchat-body">
            <div id="szchat-form-area">
                <div class="szc-disabled-overlay" id="szchat-empty-state">Selecione um chat para começar.</div>
            </div>
            <div id="szchat-footer" style="display:none;">
                <div class="row" style="display: flex; justify-content: flex-start; gap: 10px;">
                    <button id="szchat-generate" class="szc-btn-primary">⚡ Gerar Script</button>
                    <button id="szchat-copy" class="szc-btn-ghost">📎 Copiar</button>
                </div>
                <textarea id="szchat-output" placeholder="Clique em &quot;Gerar Script&quot; para montar o texto..."></textarea>
                <div class="row">
                    <span class="status" id="szchat-status">—</span>
                    <span class="phone" id="szchat-phone"></span>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(popup);

    const subtitle = popup.querySelector('#szchat-subtitle');
    const phoneLabel = popup.querySelector('#szchat-phone');
    const status = popup.querySelector('#szchat-status');
    const header = popup.querySelector('#szchat-header');
    const hideBtn = popup.querySelector('#szchat-hide');
    const scriptSelect = popup.querySelector('#szchat-script-select');
    const body = popup.querySelector('#szchat-body');
    const formArea = popup.querySelector('#szchat-form-area');
    const footer = popup.querySelector('#szchat-footer');
    const output = popup.querySelector('#szchat-output');
    const generateBtn = popup.querySelector('#szchat-generate');
    const copyBtn = popup.querySelector('#szchat-copy');

    // ============ POSITION / SIZE / VIS ============
    const savedPos = GM_getValue(POS_KEY, { top: 80, left: window.innerWidth - 440 });
    const savedSize = GM_getValue(SIZE_KEY, { width: 400, height: 620 });
    const savedVis = GM_getValue(VIS_KEY, false);

    popup.style.top = savedPos.top + 'px';
    popup.style.left = savedPos.left + 'px';
    popup.style.width = savedSize.width + 'px';
    popup.style.height = savedSize.height + 'px';
    popup.style.display = savedVis ? 'flex' : 'none';

    const ro = new ResizeObserver(() => {
        GM_setValue(SIZE_KEY, { width: popup.offsetWidth, height: popup.offsetHeight });
    });
    ro.observe(popup);

    // ============ DRAG ============
    let dragging = false, dragOffX = 0, dragOffY = 0;
    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        dragging = true;
        const rect = popup.getBoundingClientRect();
        dragOffX = e.clientX - rect.left;
        dragOffY = e.clientY - rect.top;
        e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        let left = Math.max(0, Math.min(window.innerWidth - 80, e.clientX - dragOffX));
        let top = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dragOffY));
        popup.style.left = left + 'px';
        popup.style.top = top + 'px';
    });
    document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        GM_setValue(POS_KEY, { top: parseInt(popup.style.top, 10), left: parseInt(popup.style.left, 10) });
    });

    // ============ TOGGLE ============
    const setVisible = (v) => { popup.style.display = v ? 'flex' : 'none'; GM_setValue(VIS_KEY, v); };
    toggleBtn.addEventListener('click', () => setVisible(popup.style.display === 'none'));
    hideBtn.addEventListener('click', () => setVisible(false));

    // ============ FORM HELPERS ============
    const getFormValues = () => {
        const values = {};
        formArea.querySelectorAll('[data-id]').forEach(el => {
            const id = el.getAttribute('data-id');
            if (el.type === 'checkbox') {
                values[id] = el.checked;
            } else if (el.type === 'radio') {
                if (el.checked) values[id] = el.value;
                else if (!(id in values)) values[id] = values[id] || '';
            } else {
                values[id] = el.value;
            }
        });
        return values;
    };

    const setFormValues = (values) => {
        suppressSave = true;
        try {
            formArea.querySelectorAll('[data-id]').forEach(el => {
                const id = el.getAttribute('data-id');
                if (!(id in values)) return;
                if (el.type === 'checkbox') {
                    el.checked = !!values[id];
                } else if (el.type === 'radio') {
                    el.checked = (el.value === values[id]);
                } else {
                    el.value = values[id] || '';
                }
            });
            updateConditionalBlocks();
        } finally {
            suppressSave = false;
        }
    };

    // Show/hide subboxes based on data-show-when="fieldId=value" (value of "true" = checkbox checked)
    const updateConditionalBlocks = () => {
        const values = getFormValues();
        formArea.querySelectorAll('[data-show-when]').forEach(el => {
            const expr = el.getAttribute('data-show-when');
            const [field, val] = expr.split('=');
            let matches = false;
            if (val === 'true') {
                matches = !!values[field];
            } else {
                matches = (values[field] === val);
            }
            el.classList.toggle('szc-active', matches);
        });
    };

    // ============ SAVE / LOAD ============
    const saveCurrent = () => {
        if (suppressSave || !currentPhone || !currentScriptId) return;
        const state = loadPhoneState(currentPhone);
        state.script = currentScriptId;
        if (!state.data) state.data = {};
        state.data[currentScriptId] = {
            ...(state.data[currentScriptId] || {}),
            fields: getFormValues(),
            output: output.value,
        };
        savePhoneState(currentPhone, state);
        status.textContent = 'Salvo ✓';
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => { if (status.textContent === 'Salvo ✓') status.textContent = ''; }, 1200);
    };

    const debounceSave = () => {
        if (suppressSave) return;
        status.textContent = 'Digitando…';
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveCurrent, 400);
    };

    formArea.addEventListener('input', () => { updateConditionalBlocks(); debounceSave(); });
    formArea.addEventListener('change', () => { updateConditionalBlocks(); debounceSave(); });
    output.addEventListener('input', debounceSave);

    // ============ LOAD A SCRIPT ============
    const loadScript = (scriptId) => {
        currentScriptId = scriptId;

        if (!scriptId || !SCRIPTS[scriptId]) {
            formArea.innerHTML = '<div class="szc-disabled-overlay">Selecione um script acima.</div>';
            footer.style.display = 'none';
            return;
        }

        formArea.innerHTML = SCRIPTS[scriptId].render();
        footer.style.display = 'flex';

        // Load saved data for this phone+script
        const state = loadPhoneState(currentPhone);
        const saved = state.data?.[scriptId] || {};
        setFormValues(saved.fields || {});
        output.value = saved.output || '';

        // Persist current selection
        suppressSave = true;
        state.script = scriptId;
        savePhoneState(currentPhone, state);
        suppressSave = false;

        // Scroll back to top when loading a new script
        body.scrollTop = 0;
    };

    scriptSelect.addEventListener('change', () => {
        loadScript(scriptSelect.value);
    });

    // ============ VALIDATION ============
    const validateRequired = () => {
        // Limpa erros anteriores
        formArea.querySelectorAll('.szc-card.szc-error').forEach(c => c.classList.remove('szc-error'));
        const oldBanner = formArea.querySelector('#szchat-error-banner');
        if (oldBanner) oldBanner.remove();

        const erros = [];

        // Cada card que tem um badge "obrigatório" precisa ter pelo menos um campo preenchido
        formArea.querySelectorAll('.szc-card').forEach(card => {
            const badges = card.querySelectorAll('.szc-badge');
            const isRequired = Array.from(badges).some(b => b.textContent.trim().toLowerCase() === 'obrigatório');
            if (!isRequired) return;

            // Coleta todos os campos com data-id dentro do card (incluindo subboxes visíveis)
            const fields = card.querySelectorAll('[data-id]');
            let preenchido = false;

            fields.forEach(el => {
                // Ignora campos dentro de subboxes ocultas
                const subbox = el.closest('.szc-subbox');
                if (subbox) {
                    const parentItem = subbox.parentElement;
                    if (parentItem && parentItem.classList.contains('szc-check-item') && !parentItem.classList.contains('szc-active')) {
                        return;
                    }
                }

                if (el.type === 'checkbox' || el.type === 'radio') {
                    if (el.checked) preenchido = true;
                } else if (el.value && el.value.trim()) {
                    preenchido = true;
                }
            });

            if (!preenchido) {
                card.classList.add('szc-error');
                const titulo = card.querySelector('h3')?.childNodes[0]?.textContent?.trim() || 'Campo obrigatório';
                erros.push(titulo);
            }
        });

        if (erros.length > 0) {
            const banner = document.createElement('div');
            banner.id = 'szchat-error-banner';
            banner.className = 'szc-visible';
            banner.textContent = '⚠️ Preencha: ' + erros.join(' • ');
            formArea.insertBefore(banner, formArea.firstChild);

            // Rola até o primeiro card com erro
            const firstError = formArea.querySelector('.szc-card.szc-error');
            if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'start' });

            return false;
        }

        return true;
    };

    // ============ BUTTONS ============
    generateBtn.addEventListener('click', () => {
        if (!currentScriptId || !SCRIPTS[currentScriptId]) return;
        if (!validateRequired()) {
            status.textContent = 'Campos obrigatórios faltando';
            return;
        }
        const values = getFormValues();
        try {
            output.value = SCRIPTS[currentScriptId].generate(values);
            saveCurrent();
            status.textContent = 'Gerado ✓';
            setTimeout(() => { if (status.textContent === 'Gerado ✓') status.textContent = ''; }, 1500);
        } catch (e) {
            status.textContent = 'Erro ao gerar';
            console.error(e);
        }
    });

    copyBtn.addEventListener('click', async () => {
        const text = output.value.trim();
        if (!text) { status.textContent = 'Nada para copiar'; return; }
        try {
            await navigator.clipboard.writeText(text);
            status.textContent = 'Copiado ✓';
        } catch {
            try {
                output.select();
                document.execCommand('copy');
                status.textContent = 'Copiado ✓';
            } catch {
                status.textContent = 'Falha ao copiar';
            }
        }
        setTimeout(() => { if (status.textContent === 'Copiado ✓') status.textContent = ''; }, 1500);
    });

    // ============ CHAT SWITCHING ============
    const switchToChat = (phone, displayName) => {
        if (phone === currentPhone) return;

        // Save current state before switch
        if (currentPhone && currentScriptId) saveCurrent();

        currentPhone = phone;
        currentScriptId = null;

        if (!phone) {
            scriptSelect.disabled = true;
            scriptSelect.value = '';
            formArea.innerHTML = '<div class="szc-disabled-overlay">Selecione um chat para começar.</div>';
            footer.style.display = 'none';
            subtitle.textContent = '— sem chat ativo';
            phoneLabel.textContent = '';
            status.textContent = '';
            return;
        }

        scriptSelect.disabled = false;
        subtitle.textContent = displayName ? '— ' + displayName : '— ' + phone;
        phoneLabel.textContent = phone;
        status.textContent = '';

        const state = loadPhoneState(phone);
        const lastScript = state.script;
        if (lastScript && SCRIPTS[lastScript]) {
            scriptSelect.value = lastScript;
            loadScript(lastScript);
        } else {
            scriptSelect.value = '';
            formArea.innerHTML = '<div class="szc-disabled-overlay">Selecione um script acima.</div>';
            footer.style.display = 'none';
        }
    };

    const checkActiveChat = () => {
        const active = document.querySelector('.sz_contact.active');
        if (!active) return switchToChat(null, null);
        const nameEl = active.querySelector('.contact-name[title]');
        if (!nameEl) return switchToChat(null, null);
        const title = nameEl.getAttribute('title');
        const phone = extractPhone(title);
        let displayName = title;
        const m = title.match(/^(.*?)\s*\+/);
        if (m) displayName = m[1].trim();
        switchToChat(phone, displayName);
    };

    // Save on unload / blur
    window.addEventListener('beforeunload', saveCurrent);
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveCurrent(); });

    // Watch for chat switches
    const observer = new MutationObserver(() => checkActiveChat());
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });

    // Initial check
    let tries = 0;
    const initialCheck = setInterval(() => {
        checkActiveChat();
        tries++;
        if (tries > 20 || currentPhone) clearInterval(initialCheck);
    }, 500);
})();
