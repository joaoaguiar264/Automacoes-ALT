// ==UserScript==
// @name         Zendesk - Atalho AutoISP
// @namespace    http://tampermonkey.net/
// @version      1.5.0
// @description  Abre automaticamente no AutoISP o cliente do ticket ativo do Zendesk
// @author       ALT
// @match        https://brasiltecparsupport.zendesk.com/agent/*
// @match        https://autoisp.gegnet.com.br/subscribers*
// @updateURL    https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/Zendesk%20-%20Atalho%20AutoISP.user.js
// @downloadURL  https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/Zendesk%20-%20Atalho%20AutoISP.user.js
// @icon         https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/icon.png
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const ZENDESK_HOST = 'brasiltecparsupport.zendesk.com';
    const AUTOISP_HOST = 'autoisp.gegnet.com.br';

    const AUTOISP_URL =
        'https://autoisp.gegnet.com.br/subscribers';

    const BTN_ID =
        'alt-autoisp-zendesk-button';

    // Campo "NOME DO CLIENTE" do Zendesk
    const NAME_FIELD_ID =
        '42732255309844';

    const QUERY_PARAM =
        'alt_nome';


    // ============================================================
    // UTIL
    // ============================================================

    function normalizeName(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
    }


    // ============================================================
    // ZENDESK
    // ============================================================

    function getSelectedTicketId() {

        const tab = document.querySelector(
            'a[data-test-id="header-tab"]' +
            '[data-entity-type="TICKET_ENTITY_TYPE"]' +
            '[data-entity-is-selected="true"]'
        );

        if (!tab) {
            return null;
        }

        return (
            tab.getAttribute(
                'data-entity-id'
            ) ||

            (
                tab.getAttribute('href') || ''
            ).match(
                /\/tickets\/(\d+)/
            )?.[1] ||

            null
        );
    }


    function getActiveTicketRoot() {

        const ticketId =
            getSelectedTicketId();

        if (!ticketId) {
            return null;
        }

        return document.querySelector(
            `[data-test-id="ticket-${ticketId}-standard-layout"]` +
            `[data-is-active="true"]`
        );
    }


    function getClientFullName() {

        const root =
            getActiveTicketRoot();

        if (!root) {
            return null;
        }


        // --------------------------------------------------------
        // MÉTODO PRINCIPAL
        // Campo exato "NOME DO CLIENTE"
        // --------------------------------------------------------

        const exactField =
            root.querySelector(
                `[data-test-id="ticket-form-field-text-field-${NAME_FIELD_ID}"] input`
            );

        const exactValue =
            exactField?.value?.trim();

        if (exactValue) {
            return exactValue;
        }


        // --------------------------------------------------------
        // FALLBACK
        // Caso o Zendesk mude alguma estrutura externa
        // --------------------------------------------------------

        const labels =
            Array.from(
                root.querySelectorAll(
                    'label'
                )
            );

        const nameLabel =
            labels.find(
                (label) =>
                    normalizeName(
                        label.textContent
                    ).includes(
                        'NOME DO CLIENTE'
                    )
            );

        if (!nameLabel) {
            return null;
        }


        const fieldContainer =
            nameLabel.closest(
                '[data-test-id^="ticket-form-field"]'
            ) ||

            nameLabel
                .parentElement
                ?.parentElement;


        const input =
            fieldContainer
                ?.querySelector(
                    'input'
                );


        return (
            input
                ?.value
                ?.trim() ||

            null
        );
    }


    function openClientInAutoISP() {

        const name =
            getClientFullName();


        if (!name) {

            alert(
                'Não encontrei o campo NOME DO CLIENTE no ticket ativo.'
            );

            return;
        }


        console.log(
            '[ALT AutoISP] Cliente:',
            name
        );


        const url =
            new URL(
                AUTOISP_URL
            );


        url.searchParams.set(
            QUERY_PARAM,
            name
        );


        window.open(
            url.toString(),
            '_blank',
            'noopener,noreferrer'
        );
    }


    // ============================================================
    // BOTÃO NO ZENDESK
    // ============================================================

    function createZendeskButton() {

        if (
            document.getElementById(
                BTN_ID
            )
        ) {
            return;
        }


        const button =
            document.createElement(
                'button'
            );


        button.id =
            BTN_ID;

        button.type =
            'button';

        button.title =
            'Abrir cliente no AutoISP';


        button.innerHTML = `
            <span
                style="
                    font-size:18px;
                    line-height:1;
                "
            >
                ↗
            </span>

            <span>
                AutoISP
            </span>
        `;


        Object.assign(
            button.style,
            {
                position: 'fixed',

                right: '10px',
                bottom: '190px',

                zIndex: '999998',

                height: '42px',

                padding:
                    '0 13px',

                border:
                    '0',

                borderRadius:
                    '9px',

                background:
                    '#0c3455',

                color:
                    '#fff',

                fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',

                fontSize:
                    '12px',

                fontWeight:
                    '600',

                cursor:
                    'pointer',

                boxShadow:
                    '0 4px 14px rgba(0,0,0,.18)',

                display:
                    'flex',

                alignItems:
                    'center',

                gap:
                    '7px'
            }
        );


        button.addEventListener(
            'mouseenter',
            () => {

                button.style.transform =
                    'scale(1.04)';
            }
        );


        button.addEventListener(
            'mouseleave',
            () => {

                button.style.transform =
                    '';
            }
        );


        button.addEventListener(
            'click',
            openClientInAutoISP
        );


        document.body.appendChild(
            button
        );
    }


    function initZendesk() {

        createZendeskButton();


        const observer =
            new MutationObserver(
                () => {

                    createZendeskButton();
                }
            );


        observer.observe(
            document.body,
            {
                childList: true,
                subtree: true
            }
        );
    }


    // ============================================================
    // AUTOISP
    // ============================================================

    function dispatchSearchEvents(
        input
    ) {

        input.dispatchEvent(
            new Event(
                'input',
                {
                    bubbles: true
                }
            )
        );


        input.dispatchEvent(
            new Event(
                'change',
                {
                    bubbles: true
                }
            )
        );


        /*
         * O AutoISP usa DataTables.
         * Disparar keyup faz o filtro
         * da coluna reagir como se fosse digitado.
         */

        input.dispatchEvent(
            new KeyboardEvent(
                'keyup',
                {
                    bubbles: true,
                    cancelable: true,

                    key: 'Enter',
                    code: 'Enter',

                    keyCode: 13,
                    which: 13
                }
            )
        );
    }


    function initAutoISP() {

        const url =
              new URL(
                  window.location.href
              );

        const name =
              url.searchParams
        .get(
            QUERY_PARAM
        )
        ?.trim();

        /*
     * Se abriu o AutoISP normalmente,
     * sem vir do Zendesk,
     * não faz nada.
     */
        if (!name) {
            return;
        }

        console.log(
            '[ALT AutoISP] Pesquisando:',
            name
        );

        /*
     * Remove o parâmetro da URL.
     */
        url.searchParams.delete(
            QUERY_PARAM
        );

        history.replaceState(
            null,
            '',
            url.pathname +
            url.search +
            url.hash
        );

        let attempts = 0;

        const maxAttempts = 80;

        const timer =
              setInterval(
                  () => {

                      attempts++;

                      /*
                 * Campo NOME da tabela
                 */
                      const input =
                            document.querySelector(
                                '#subscriber_index_table thead ' +
                                'input.form-control.input-sm' +
                                '[placeholder="Nome"]'
                            );

                      if (!input) {

                          if (
                              attempts >=
                              maxAttempts
                          ) {
                              clearInterval(
                                  timer
                              );
                          }

                          return;
                      }

                      /*
                 * Preenche a pesquisa.
                 */
                      input.focus();

                      input.value =
                          name;

                      dispatchSearchEvents(
                          input
                      );

                      /*
                 * A partir daqui NÃO clica
                 * em absolutamente nada.
                 *
                 * Apenas deixa o AutoISP
                 * filtrado com todos os
                 * planos encontrados.
                 */
                      clearInterval(
                          timer
                      );

                      console.log(
                          '[ALT AutoISP] Busca preenchida. Escolha o plano manualmente.'
                      );

                  },

                  250
              );
    }


    // ============================================================
    // INIT
    // ============================================================

    if (
        window.location.host ===
        ZENDESK_HOST
    ) {

        initZendesk();

    }
    else if (
        window.location.host ===
        AUTOISP_HOST
    ) {

        initAutoISP();
    }

})();
