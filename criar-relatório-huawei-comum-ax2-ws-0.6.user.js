// ==UserScript==
// @name         Cria Relatorio Roteadores Huawei Comuns AX2 WS
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  try to take over the world!
// @author       Wesley GG
// @match        https://*/html/index.html
// @icon         https://www.google.com/s2/favicons?sz=64&domain=gegnet.com.br
// @license      MIT
// @grant        GM_setClipboard
// ==/UserScript==

//12345667890

//ntwk/lan_server
// caso necessário será no parâmetro dnsmode false/true


// Função para obter o cookie
function getCookie(name) {
    var value = "; " + document.cookie;
    var parts = value.split("; " + name + "=");
    if (parts.length == 2) return parts.pop().split(";").shift();
}

// Obtém o IP do domínio que o usuário está acessando
var ip = window.location.hostname;

// URL base
var url = "https://" + ip + "/";

// Caminho para API
var url_api = "https://" + ip + "/api/";

// Criação de headers
var headers = {
    "Accept": "application/json, text/javascript, /; q=0.01",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Connection": "keep-alive",
    "Host": ip,
    "Referer": url + "html/index.html",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 OPR/107.0.0.0",
    "X-Requested-With": "XMLHttpRequest",
    "_ResponseFormat": "JSON",
    "sec-ch-ua": "\"Not A(Brand\";v=\"99\", \"Opera GX\";v=\"107\", \"Chromium\";v=\"121\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\""
};

function getUptime(){
    let path = 'system/deviceinfo';
    let url = url_api + path;

    return fetch(url, { headers: headers }).then(response => response.json().then(data => {
        if (data.UpTime >= 86400) {
            const dias = Math.floor(data.UpTime / 86400);
            return dias === 1 ? "1 dia" : dias + " dias";
        } else if (data.UpTime >= 3600) {
            const horas = Math.floor(data.UpTime / 3600);
            return horas === 1 ? "1 hora" : horas + " horas";
        } else if (data.UpTime >= 60) {
            const minutos = Math.floor(data.UpTime / 60);
            return minutos === 1 ? "1 minuto" : minutos + " minutos";
        } else {
            return data.UpTime === 1 ? "1 segundo" : data.UpTime + " segundos";
        }
    }));
}

// Função para obter informações da WAN
function getWAN() {
    var path = 'ntwk/wan?type=active';
    var url = url_api + path;
    return fetch(url, { headers: headers }).then(response => response.json().then(data => {
        if (data.DNSOverrideAllowed === true){
            return data.IPv4DnsServers.split(",");
        }else{
            return false;
        }
    }));
}

// Função para obter o status do UPnP
function getUPnPStatus() {
    var url = url_api + "ntwk/lan_upnp";
    return fetch(url, { headers: headers }).then(response => response.json()).then(data => data.enable);
}

// Função para obter informações das redes 2.4GHz
function getRedesInfo24GHz() {
    var url = url_api + "system/diagnose_wlan_basic?type=1";
    return fetch(url, { headers: headers }).then(response => response.json()).then(data => ({ canal: data.MaxBitRate === "Auto" ? "em auto" : "no canal " + data.Channel, largura_banda: data.Bandwidth + " MHz" }));
}

// Função para obter informações das redes 5GHz
function getRedesInfo5GHz() {
    var url = url_api + "system/diagnose_wlan_basic?type=2";
    return fetch(url, { headers: headers }).then(response => response.json()).then(data => ({ canal: data.MaxBitRate === "Auto" ? "em auto" : "no canal " + data.Channel, largura_banda: data.Bandwidth + " MHz" }));
}

// Função para obter informações do dispositivo
function getDeviceInfo() {
    var url = url_api + "system/deviceinfo";
    return fetch(url, { headers: headers }).then(response => response.json()).then(data => [data.FriendlyName, data.SoftwareVersion]);
}

// Função para obter o número de dispositivos conectados no momento
function ConectadosNoMomento() {
    var url = url_api + "system/HostInfo";
    return fetch(url, { headers: headers }).then(response => response.json()).then(data => data.filter(device => device.Active === true).length);
}

// Função para obter o status do IPv6
function getIPV6status() {
    var url = url_api + "ntwk/ipv6_enable";
    return fetch(url, { headers: headers }).then(response => response.json()).then(data => {
        if (data.Enable === 1) {
            var url_ipv6_type = url_api + "ntwk/ipv6_wan";
            return fetch(url_ipv6_type, { headers: headers }).then(response_ipv6_type => response_ipv6_type.json()).then(data_ipv6_type => data_ipv6_type.X_IPv6AddressingType);
        } else {
            return false;
        }
    });
}

// Função para obter o status de priorização do 5G
function getPriorizar5G() {
    var url = url_api + "ntwk/WlanGuideBasic?type=notshowpassall";
    return fetch(url, { headers: headers }).then(response => response.json()).then(data => data.DbhoEnable);
}


function constructScript(){
    // Monta a string com as informações
    Promise.all([getDeviceInfo(), ConectadosNoMomento(), getWAN(), getUPnPStatus(), getRedesInfo24GHz(), getRedesInfo5GHz(), getIPV6status(), getPriorizar5G(), getUptime()]).then(values => {
        var deviceInfo = values[0];
        var connectedDevices = values[1];
        var upnpStatus = values[3];
        var redes24GHz = values[4];
        var redes5GHz = values[5];
        var ipv6Status = values[6];
        var priorizar5G = values[7];
        var getUptime = values[8];
        var dnsWAN;
        var dns_padrao_gg = ["187.85.152.10", "187.85.152.11"];

        // Verifica se values[2] não é falso e se é igual ao dns_padrao_gg
        if (values[2] !== false && JSON.stringify(values[2]) === JSON.stringify(dns_padrao_gg)){
            dnsWAN = "Habilitado no padrão";
        } else if (values[2] !== false && JSON.stringify(values[2]) !== JSON.stringify(dns_padrao_gg)){
            dnsWAN = "Habilitado";
        } else {
            dnsWAN = "Desabilitado";
        }

        var script = `Cliente possui um ${deviceInfo[0]} ${deviceInfo[1]}
Equipamentos conectados no momento: ${connectedDevices}
DNS WAN ${dnsWAN}
DNS LAN ${dnsWAN}
Priorizar 5G ${priorizar5G ? 'Habilitado' : 'Desabilitado'}
IPv6 ${ipv6Status ? 'Habilitado em ' + ipv6Status : 'Desabilitado'}
UPnP ${upnpStatus ? 'Habilitado' : 'Desabilitado'}
Rede 2.4 com canal ${redes24GHz.canal} e largura em ${redes24GHz.largura_banda}
Rede 5G com canal ${redes5GHz.canal} e largura em ${redes5GHz.largura_banda}
Uptime: ${getUptime}`;
        console.log("[!] Copiado para área de Transferência");

        GM_setClipboard(script);
        console.log(script);
    });
}


function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executeRepeatedly() {
  let c = 0;
  while (true) {
    let path = document.location.href
    if (path.indexOf("home") !== -1 && c === 0){
        constructScript();
        c = 1;
    }
    await delay(500);
  }
}

executeRepeatedly();