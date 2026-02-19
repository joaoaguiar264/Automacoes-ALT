// ==UserScript==
// @name         Baixar Mídia SZ.CHAT
// @version      2025-07-10
// @description  Baixa todas as imagens e vídeos das conversas no SZ.Chat em um arquivo ZIP
// @author       Vogel
// @icon         https://www.google.com/s2/favicons?sz=64&domain=gegnet.com.br
// @downloadURL  https://github.com/gu1zo/scriptsGG/blob/main/baixar-anexos-sz.user.js
// @match        *://*.ggnet.sz.chat/*
// @match        *://clusterscpr.sz.chat/*
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// ==/UserScript==

(function() {
    'use strict';

    function addDownloadButton() {
        let container = document.querySelector(".tags-sessions");
        if (!container) return;

        let menu = container.querySelector(".menu.tags.ft-scroll");
        if (!menu) return;

        let button = document.createElement("a");
        button.setAttribute("data-v-5cbb963e", "");
        button.className = "item text-ellipsis";
        button.innerHTML = '<i data-v-5cbb963e class="icon tag"></i> Baixar Mídia';
        button.style.cursor = "pointer";
        button.addEventListener("click", processMedia);

        menu.insertBefore(button, null); // Adiciona o botão no menu
    }

    function processMedia() {
        let mediaUrls = [];

        let listItems = document.querySelectorAll('#list_mensagens > ul > li');
        if (listItems.length === 0) {
            alert("Nenhuma mensagem encontrada.");
            return;
        }

        listItems.forEach((li) => {
            // Buscar imagens
            let imgElement = li.querySelector('span div div div div:nth-child(2) div div span a img');
            if (imgElement) {
                mediaUrls.push({ url: imgElement.src, type: 'image' });
            }

            // Buscar vídeos
            let videoElement = li.querySelector('span div div div div:nth-child(2) div div span div div div:nth-child(2) video');
            if (videoElement) {
                mediaUrls.push({ url: videoElement.src, type: 'video' });
            }
        });

        console.log("Mídia encontrada:", mediaUrls);

        if (mediaUrls.length > 0) {
            downloadMediaAndZip(mediaUrls);
        } else {
            alert("Nenhuma mídia para baixar.");
        }
    }

    async function downloadMediaAndZip(mediaUrls) {
        let zip = new JSZip();
        let count = 0;

        for (let media of mediaUrls) {
            try {
                let response = await fetch(media.url);
                let blob = await response.blob();
                let extension = media.type === 'image' ? 'jpg' : 'mp4';
                let filename = `midia_${count + 1}.${extension}`;

                zip.file(filename, blob);
                console.log(`Baixado ${count + 1}/${mediaUrls.length}: ${media.url}`);
                count++;
            } catch (error) {
                console.error("Erro ao baixar a mídia:", media.url, error);
            }
        }

        zip.generateAsync({ type: "blob" }).then(content => {
            let a = document.createElement("a");
            a.href = URL.createObjectURL(content);
            a.download = "midia.zip";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
    }

    // Aguarda o carregamento da página e adiciona o botão
    setTimeout(addDownloadButton, 3000);
})();
