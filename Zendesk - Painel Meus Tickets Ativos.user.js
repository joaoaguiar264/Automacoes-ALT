// ==UserScript==
// @name         Zendesk - Painel Meus Tickets Ativos
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Mantém sempre visíveis os tickets da visualização "Meus tickets Abertos"
// @match        https://brasiltecparsupport.zendesk.com/agent/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/Zendesk%20-%20Painel%20Meus%20Tickets%20Ativos.user.js
// @downloadURL  https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/Zendesk%20-%20Painel%20Meus%20Tickets%20Ativos.user.js
// @icon         https://github.com/joaoaguiar264/Automacoes-ALT/raw/refs/heads/main/icon.png
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // CONFIG
    // ============================================================

    // Visualização:
    // 🎯 Meus tickets Abertos
    const VIEW_ID = '41940549244820';

    // Campo:
    // NOME DO CLIENTE
    const CLIENT_NAME_FIELD_ID = 42732255309844;

    // Atualiza a cada 15 segundos
    const REFRESH_MS = 15000;

    const PANEL_ID =
        'alt-open-tickets-panel';

    const STYLE_ID =
        'alt-open-tickets-style';

    const STORAGE_COLLAPSED =
        'altOpenTicketsCollapsed';

    const STORAGE_POSITION =
          'altOpenTicketsPosition';


    // ============================================================
    // ESTADO
    // ============================================================

    let loading = false;

    let firstLoad = true;

    let previousIds =
        new Set();

    let cooldownUntil = 0;

    const userCache =
        new Map();


    // ============================================================
    // UTIL
    // ============================================================

    function escapeHtml(value) {

        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }


    function formatTime(
        date = new Date()
    ) {

        return new Intl.DateTimeFormat(
            'pt-BR',
            {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }
        ).format(date);
    }


    function getCustomField(
        ticket,
        fieldId
    ) {

        const field =
            Array.isArray(
                ticket?.custom_fields
            )

                ? ticket.custom_fields.find(
                    f =>
                        Number(f.id) ===
                        Number(fieldId)
                )

                : null;


        return String(
            field?.value ?? ''
        ).trim();
    }


    // ============================================================
    // API ZENDESK
    // ============================================================

    async function apiFetch(url) {

        const response =
            await fetch(
                url,
                {
                    method: 'GET',

                    credentials:
                        'same-origin',

                    headers: {
                        'Accept':
                            'application/json'
                    },

                    cache:
                        'no-store'
                }
            );


        // Proteção caso o Zendesk limite chamadas
        if (
            response.status === 429
        ) {

            const retryAfter =
                Number(
                    response.headers.get(
                        'Retry-After'
                    )
                ) || 30;


            cooldownUntil =
                Date.now() +
                retryAfter * 1000;


            throw new Error(
                `RATE_LIMIT:${retryAfter}`
            );
        }


        if (!response.ok) {

            throw new Error(
                `HTTP_${response.status}`
            );
        }


        return response.json();
    }


    // ============================================================
    // BUSCA TICKETS DA VIEW
    // ============================================================

    async function loadViewTickets() {

        const tickets = [];

        let url =
            `/api/v2/views/${VIEW_ID}/tickets.json?per_page=100`;

        let pages = 0;


        while (
            url &&
            pages < 10
        ) {

            const data =
                await apiFetch(url);


            if (
                Array.isArray(
                    data.tickets
                )
            ) {

                tickets.push(
                    ...data.tickets
                );
            }


            url =
                data.next_page ||
                null;


            pages++;
        }


        return tickets;
    }


    // ============================================================
    // PEGA NOME DO SOLICITANTE
    // SOMENTE SE NÃO HOUVER "NOME DO CLIENTE"
    // ============================================================

    async function loadMissingUsers(
        tickets
    ) {

        const missingIds =
            [
                ...new Set(

                    tickets

                        .filter(
                            ticket =>
                                !getCustomField(
                                    ticket,
                                    CLIENT_NAME_FIELD_ID
                                )
                        )

                        .map(
                            ticket =>
                                Number(
                                    ticket.requester_id
                                )
                        )

                        .filter(
                            id =>
                                id &&
                                !userCache.has(id)
                        )
                )
            ];


        // Zendesk aceita consulta em lote
        for (
            let i = 0;
            i < missingIds.length;
            i += 100
        ) {

            const chunk =
                missingIds.slice(
                    i,
                    i + 100
                );


            const data =
                await apiFetch(
                    `/api/v2/users/show_many.json?ids=${chunk.join(',')}`
                );


            for (
                const user
                of data.users || []
            ) {

                userCache.set(
                    Number(user.id),

                    user.name ||
                    `Usuário ${user.id}`
                );
            }
        }
    }


    // ============================================================
    // NOME QUE SERÁ MOSTRADO
    // ============================================================

    function getClientName(ticket) {

        // Primeiro tenta NOME DO CLIENTE
        const nomeCliente =
            getCustomField(
                ticket,
                CLIENT_NAME_FIELD_ID
            );


        if (nomeCliente) {
            return nomeCliente;
        }


        // Fallback: solicitante
        return (
            userCache.get(
                Number(
                    ticket.requester_id
                )
            )

            ||

            `Solicitante ${
                ticket.requester_id || '-'
            }`
        );
    }


    // ============================================================
    // CSS
    // ============================================================

    function injectStyle() {

        if (
            document.getElementById(
                STYLE_ID
            )
        ) {
            return;
        }


        const style =
            document.createElement(
                'style'
            );


        style.id =
            STYLE_ID;


        style.textContent = `

            #${PANEL_ID} {

                position: fixed;

                top: 76px;
                right: 14px;

                width: 360px;

                max-height:
                    calc(100vh - 100px);

                z-index: 2147483000;

                display: flex;

                flex-direction: column;

                overflow: hidden;

                border:
                    1px solid
                    rgba(128,128,128,.35);

                border-radius: 10px;

                background:
                    #1f2933;

                color:
                    #fff;

                box-shadow:
                    0 12px 30px
                    rgba(0,0,0,.28);

                font-family:
                    -apple-system,
                    BlinkMacSystemFont,
                    "Segoe UI",
                    sans-serif;

                font-size: 12px;
            }


            #${PANEL_ID} * {
                box-sizing:
                    border-box;
            }


            /* HEADER */

            #${PANEL_ID} .alt-head {

                display: flex;

                align-items: center;

                cursor: move;

                user-select: none;

                touch-action: none;

                gap: 8px;

                min-height: 46px;

                padding:
                    8px 10px;

                background:
                    #111827;

                border-bottom:
                    1px solid
                    rgba(255,255,255,.10);
            }


            #${PANEL_ID} .alt-title {

                font-weight: 700;

                flex: 1;

                font-size: 13px;
            }


            /* CONTADOR */

            #${PANEL_ID} .alt-count {

                min-width: 24px;

                height: 24px;

                padding:
                    0 7px;

                display:
                    inline-flex;

                align-items:
                    center;

                justify-content:
                    center;

                border-radius:
                    999px;

                background:
                    #1f73b7;

                font-weight: 700;
            }


            /* BOTÕES */

            #${PANEL_ID} .alt-icon-btn {

                border: 0;

                background:
                    transparent;

                color:
                    #fff;

                cursor:
                    pointer;

                width: 28px;

                height: 28px;

                border-radius:
                    6px;

                font-size:
                    14px;
            }


            #${PANEL_ID}
            .alt-icon-btn:hover {

                background:
                    rgba(
                        255,
                        255,
                        255,
                        .10
                    );
            }


            /* STATUS ATUALIZAÇÃO */

            #${PANEL_ID} .alt-meta {

                padding:
                    6px 10px;

                color:
                    #b8c4ce;

                background:
                    #18212b;

                border-bottom:
                    1px solid
                    rgba(255,255,255,.08);

                min-height:
                    28px;
            }


            /* LISTA */

            #${PANEL_ID} .alt-body {

                overflow-y:
                    auto;

                min-height:
                    60px;

                max-height:
                    calc(
                        100vh - 180px
                    );
            }


            /* RECOLHIDO */

            #${PANEL_ID}.collapsed
            .alt-meta,

            #${PANEL_ID}.collapsed
            .alt-body {

                display:
                    none;
            }


            /* TICKET */

            #${PANEL_ID}
            .alt-ticket {

                display:
                    block;

                padding:
                    9px 10px;

                color:
                    inherit;

                text-decoration:
                    none;

                border-bottom:
                    1px solid
                    rgba(255,255,255,.07);

                background:
                    transparent;

                transition:
                    background
                    .15s ease;
            }


            #${PANEL_ID}
            .alt-ticket:hover {

                background:
                    rgba(
                        255,
                        255,
                        255,
                        .07
                    );
            }


            /* NOVO */

            #${PANEL_ID}
            .alt-ticket.alt-new {

                background:
                    rgba(
                        31,
                        115,
                        183,
                        .24
                    );
            }


            #${PANEL_ID}
            .alt-row-top {

                display:
                    flex;

                align-items:
                    center;

                gap:
                    7px;

                margin-bottom:
                    3px;
            }


            /* CLIENTE */

            #${PANEL_ID}
            .alt-client {

                flex: 1;

                min-width: 0;

                font-weight:
                    700;

                white-space:
                    nowrap;

                overflow:
                    hidden;

                text-overflow:
                    ellipsis;
            }


            /* ID */

            #${PANEL_ID}
            .alt-ticket-id {

                color:
                    #8fbce2;

                font-family:
                    monospace;
            }


            /* ASSUNTO */

            #${PANEL_ID}
            .alt-subject {

                color:
                    #c7d1da;

                white-space:
                    nowrap;

                overflow:
                    hidden;

                text-overflow:
                    ellipsis;
            }


            /* BADGE NOVO */

            #${PANEL_ID}
            .alt-new-badge {

                padding:
                    2px 5px;

                border-radius:
                    4px;

                background:
                    #1f73b7;

                font-size:
                    9px;

                font-weight:
                    800;
            }


            /* MENSAGENS */

            #${PANEL_ID}
            .alt-empty,

            #${PANEL_ID}
            .alt-error,

            #${PANEL_ID}
            .alt-loading {

                padding:
                    18px 12px;

                text-align:
                    center;

                color:
                    #b8c4ce;
            }


            #${PANEL_ID}
            .alt-error {

                color:
                    #ffb4b4;
            }

        `;


        document.head.appendChild(
            style
        );
    }

    function enableDrag(panel) {
        const header =
              panel.querySelector('.alt-head');

        if (!header) {
            return;
        }


        // =============================================
        // RESTAURA POSIÇÃO SALVA
        // =============================================

        try {

            const saved =
                  JSON.parse(
                      localStorage.getItem(
                          STORAGE_POSITION
                      ) || 'null'
                  );


            if (
                saved &&
                Number.isFinite(saved.left) &&
                Number.isFinite(saved.top)
            ) {

                panel.style.left =
                    `${saved.left}px`;

                panel.style.top =
                    `${saved.top}px`;

                panel.style.right =
                    'auto';
            }

        } catch (error) {

            console.warn(
                '[Meus tickets ativos] Não foi possível restaurar posição.',
                error
            );
        }


        let dragging = false;

        let startX = 0;
        let startY = 0;

        let initialLeft = 0;
        let initialTop = 0;


        // =============================================
        // COMEÇA A ARRASTAR
        // =============================================

        header.addEventListener(
            'pointerdown',
            event => {

                /*
             * Não arrasta quando clicar
             * nos botões ↻ e −
             */
                if (
                    event.target.closest(
                        'button'
                    )
                ) {
                    return;
                }


                dragging = true;


                const rect =
                      panel.getBoundingClientRect();


                startX =
                    event.clientX;

                startY =
                    event.clientY;

                initialLeft =
                    rect.left;

                initialTop =
                    rect.top;


                /*
             * A partir daqui usamos
             * left/top, e não right.
             */
                panel.style.left =
                    `${rect.left}px`;

                panel.style.top =
                    `${rect.top}px`;

                panel.style.right =
                    'auto';


                header.setPointerCapture(
                    event.pointerId
                );


                document.body.style.userSelect =
                    'none';
            }
        );


        // =============================================
        // MOVIMENTO
        // =============================================

        header.addEventListener(
            'pointermove',
            event => {

                if (!dragging) {
                    return;
                }


                const deltaX =
                      event.clientX -
                      startX;

                const deltaY =
                      event.clientY -
                      startY;


                let left =
                    initialLeft +
                    deltaX;

                let top =
                    initialTop +
                    deltaY;


                /*
             * Impede o painel de sair
             * completamente da tela.
             */
                const maxLeft =
                      Math.max(
                          0,
                          window.innerWidth -
                          panel.offsetWidth
                      );


                const maxTop =
                      Math.max(
                          0,
                          window.innerHeight -
                          46
                      );


                left =
                    Math.min(
                    Math.max(
                        0,
                        left
                    ),
                    maxLeft
                );


                top =
                    Math.min(
                    Math.max(
                        0,
                        top
                    ),
                    maxTop
                );


                panel.style.left =
                    `${left}px`;

                panel.style.top =
                    `${top}px`;
            }
        );


        // =============================================
        // TERMINA
        // =============================================

        function stopDrag(event) {

            if (!dragging) {
                return;
            }


            dragging =
                false;


            document.body.style.userSelect =
                '';


            const rect =
                  panel.getBoundingClientRect();


            localStorage.setItem(
                STORAGE_POSITION,

                JSON.stringify({
                    left:
                    Math.round(
                        rect.left
                    ),

                    top:
                    Math.round(
                        rect.top
                    )
                })
            );


            try {

                if (
                    event &&
                    header.hasPointerCapture(
                        event.pointerId
                    )
                ) {

                    header.releasePointerCapture(
                        event.pointerId
                    );
                }

            } catch (_) {}
        }


        header.addEventListener(
            'pointerup',
            stopDrag
        );


        header.addEventListener(
            'pointercancel',
            stopDrag
        );
    }


    // ============================================================
    // CRIA PAINEL
    // ============================================================

    function createPanel() {

        injectStyle();


        const existente =
            document.getElementById(
                PANEL_ID
            );


        if (existente) {
            return existente;
        }


        const panel =
            document.createElement(
                'section'
            );


        panel.id =
            PANEL_ID;


        panel.innerHTML = `

            <div class="alt-head">

                <div class="alt-title">
                    🎯 Meus tickets ativos
                </div>

                <div
                    class="alt-count"
                    id="alt-open-count"
                >
                    –
                </div>

                <button
                    class="alt-icon-btn"
                    id="alt-open-refresh"
                    title="Atualizar agora"
                >
                    ↻
                </button>

                <button
                    class="alt-icon-btn"
                    id="alt-open-collapse"
                    title="Recolher/expandir"
                >
                    −
                </button>

            </div>


            <div
                class="alt-meta"
                id="alt-open-meta"
            >
                Carregando…
            </div>


            <div
                class="alt-body"
                id="alt-open-body"
            >

                <div
                    class="alt-loading"
                >
                    Consultando
                    Meus tickets Abertos…
                </div>

            </div>
        `;


        const collapsed =
            localStorage.getItem(
                STORAGE_COLLAPSED
            ) === '1';


        if (collapsed) {

            panel.classList.add(
                'collapsed'
            );
        }


        document.body.appendChild(
            panel
        );

        enableDrag(panel);

        // Atualizar manualmente
        panel
            .querySelector(
                '#alt-open-refresh'
            )
            .addEventListener(
                'click',
                () =>
                    refreshTickets(
                        true
                    )
            );


        // Recolher
        panel
            .querySelector(
                '#alt-open-collapse'
            )
            .addEventListener(
                'click',
                () => {

                    panel.classList.toggle(
                        'collapsed'
                    );


                    const isCollapsed =
                        panel.classList.contains(
                            'collapsed'
                        );


                    localStorage.setItem(
                        STORAGE_COLLAPSED,

                        isCollapsed
                            ? '1'
                            : '0'
                    );


                    panel
                        .querySelector(
                            '#alt-open-collapse'
                        )
                        .textContent =
                            isCollapsed
                                ? '+'
                                : '−';
                }
            );


        panel
            .querySelector(
                '#alt-open-collapse'
            )
            .textContent =
                collapsed
                    ? '+'
                    : '−';


        return panel;
    }


    // ============================================================
    // RENDERIZA LISTA
    // ============================================================

    function renderTickets(
        tickets
    ) {

        const panel =
            createPanel();


        const body =
            panel.querySelector(
                '#alt-open-body'
            );


        const count =
            panel.querySelector(
                '#alt-open-count'
            );


        const meta =
            panel.querySelector(
                '#alt-open-meta'
            );


        // IDs atuais
        const currentIds =
            new Set(

                tickets.map(
                    ticket =>
                        Number(
                            ticket.id
                        )
                )
            );


        // Entraram agora
        const newIds =
            firstLoad

                ? new Set()

                : new Set(

                    [
                        ...currentIds
                    ].filter(
                        id =>
                            !previousIds.has(
                                id
                            )
                    )
                );


        // Saíram agora
        const removedIds =
            firstLoad

                ? new Set()

                : new Set(

                    [
                        ...previousIds
                    ].filter(
                        id =>
                            !currentIds.has(
                                id
                            )
                    )
                );


        // Contador
        count.textContent =
            String(
                tickets.length
            );


        // Status
        let activity =
            `Atualizado ${formatTime()}`;


        if (
            newIds.size ||
            removedIds.size
        ) {

            const parts = [];


            if (
                newIds.size
            ) {

                parts.push(
                    `+${newIds.size} entrou`
                );
            }


            if (
                removedIds.size
            ) {

                parts.push(
                    `-${removedIds.size} saiu`
                );
            }


            activity +=
                ` • ${parts.join(' • ')}`;
        }


        meta.textContent =
            activity;


        // Mais recentemente atualizado primeiro
        const sorted =
            [...tickets].sort(
                (a, b) => {

                    const da =
                        Date.parse(
                            a.updated_at ||
                            a.created_at ||
                            0
                        ) || 0;


                    const db =
                        Date.parse(
                            b.updated_at ||
                            b.created_at ||
                            0
                        ) || 0;


                    return db - da;
                }
            );


        // Nenhum ticket
        if (
            !sorted.length
        ) {

            body.innerHTML = `

                <div
                    class="alt-empty"
                >
                    Nenhum ticket aberto
                    com você agora.
                </div>
            `;

        }

        else {

            body.innerHTML =
                sorted
                    .map(
                        ticket => {

                            const id =
                                Number(
                                    ticket.id
                                );


                            const client =
                                escapeHtml(
                                    getClientName(
                                        ticket
                                    )
                                );


                            const subject =
                                escapeHtml(
                                    ticket.subject ||
                                    'Sem assunto'
                                );


                            const isNew =
                                newIds.has(
                                    id
                                );


                            return `

                                <a
                                    class="
                                        alt-ticket
                                        ${
                                            isNew
                                                ? 'alt-new'
                                                : ''
                                        }
                                    "

                                    href="
                                        /agent/tickets/${id}
                                    "

                                    target="_blank"

                                    rel="
                                        noopener
                                        noreferrer
                                    "

                                    title="
                                        Abrir ticket #${id}
                                    "
                                >

                                    <div
                                        class="
                                            alt-row-top
                                        "
                                    >

                                        <div
                                            class="
                                                alt-client
                                            "
                                        >
                                            ${client}
                                        </div>


                                        ${
                                            isNew

                                                ? `
                                                    <span
                                                        class="
                                                            alt-new-badge
                                                        "
                                                    >
                                                        NOVO
                                                    </span>
                                                `

                                                : ''
                                        }


                                        <span
                                            class="
                                                alt-ticket-id
                                            "
                                        >
                                            #${id}
                                        </span>

                                    </div>


                                    <div
                                        class="
                                            alt-subject
                                        "
                                    >
                                        ${subject}
                                    </div>

                                </a>
                            `;
                        }
                    )
                    .join('');
        }


        previousIds =
            currentIds;


        firstLoad =
            false;
    }


    // ============================================================
    // ERRO
    // ============================================================

    function renderError(
        error
    ) {

        const panel =
            createPanel();


        const meta =
            panel.querySelector(
                '#alt-open-meta'
            );


        const body =
            panel.querySelector(
                '#alt-open-body'
            );


        if (
            String(
                error?.message ||
                ''
            ).startsWith(
                'RATE_LIMIT:'
            )
        ) {

            const seconds =
                Math.max(
                    1,

                    Math.ceil(
                        (
                            cooldownUntil -
                            Date.now()
                        ) / 1000
                    )
                );


            meta.textContent =
                `Limite temporário do Zendesk • nova tentativa em ~${seconds}s`;


            return;
        }


        meta.textContent =
            `Falha ao atualizar • ${formatTime()}`;


        body.innerHTML = `

            <div class="alt-error">

                Não consegui consultar
                “Meus tickets Abertos”.

                <br>

                ${
                    escapeHtml(
                        error?.message ||
                        error
                    )
                }

            </div>
        `;


        console.error(
            '[Meus tickets ativos]',
            error
        );
    }


    // ============================================================
    // ATUALIZA
    // ============================================================

    async function refreshTickets(
        force = false
    ) {

        if (loading) {
            return;
        }


        if (
            !force &&
            Date.now() <
            cooldownUntil
        ) {

            return;
        }


        loading =
            true;


        const panel =
            createPanel();


        const refreshBtn =
            panel.querySelector(
                '#alt-open-refresh'
            );


        refreshBtn.textContent =
            '…';


        try {

            // Busca tickets
            const tickets =
                await loadViewTickets();


            // Busca nome do solicitante
            // somente quando necessário
            await loadMissingUsers(
                tickets
            );


            // Renderiza
            renderTickets(
                tickets
            );

        }

        catch (
            error
        ) {

            renderError(
                error
            );

        }

        finally {

            loading =
                false;


            refreshBtn.textContent =
                '↻';
        }
    }


    // ============================================================
    // GARANTE QUE O PAINEL SEMPRE EXISTA
    // ============================================================

    function ensurePanel() {

        if (
            !document.body
        ) {

            return;
        }


        createPanel();
    }


    // ============================================================
    // INIT
    // ============================================================

    ensurePanel();


    // Primeira consulta
    refreshTickets();


    // Atualização automática
    setInterval(
        () =>
            refreshTickets(
                false
            ),

        REFRESH_MS
    );


    // Caso o Zendesk remova/recrie DOM
    setInterval(
        ensurePanel,
        2000
    );


    // Zendesk é SPA
    const observer =
        new MutationObserver(
            () => {

                if (
                    !document.getElementById(
                        PANEL_ID
                    )
                ) {

                    ensurePanel();
                }
            }
        );


    observer.observe(
        document.documentElement,
        {
            childList: true,
            subtree: true
        }
    );

})();
