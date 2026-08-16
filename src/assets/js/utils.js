/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const { ipcRenderer } = require('electron')
const { Status } = require('minecraft-java-core')
const fs = require('fs');
const pkg = require('../package.json');

import config from './utils/config.js';
import database from './utils/database.js';
import logger from './utils/logger.js';
import popup from './utils/popup.js';
import { skin2D } from './utils/skin.js';
import slider from './utils/slider.js';

async function setBackground(theme) {
    if (typeof theme == 'undefined') {
        let databaseLauncher = new database();
        let configClient = await databaseLauncher.readData('configClient');
        theme = configClient?.launcher_config?.theme || "auto"
        theme = await ipcRenderer.invoke('is-dark-theme', theme).then(res => res)
    }
    let background
    let body = document.body;
    body.className = theme ? 'dark global' : 'light global';
    if (fs.existsSync(`${__dirname}/assets/images/background/easterEgg`) && Math.random() < 0.005) {
        let backgrounds = fs.readdirSync(`${__dirname}/assets/images/background/easterEgg`);
        let Background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
        background = `url(./assets/images/background/easterEgg/${Background})`;
    } else if (fs.existsSync(`${__dirname}/assets/images/background/${theme ? 'dark' : 'light'}`)) {
        let backgrounds = fs.readdirSync(`${__dirname}/assets/images/background/${theme ? 'dark' : 'light'}`);
        let Background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
        background = `linear-gradient(#00000080, #00000080), url(./assets/images/background/${theme ? 'dark' : 'light'}/${Background})`;
    }
    body.style.backgroundImage = background ? background : theme ? '#000' : '#fff';
    body.style.backgroundSize = 'cover';
}

async function changePanel(id) {
    let panel = document.querySelector(`.${id}`);
    let active = document.querySelector(`.active`)
    if (active) active.classList.toggle("active");
    if (panel) panel.classList.add("active");

    if (id === 'profile' && window.profileInstance) {
        window.profileInstance.loadProfile();
    }
}

async function appdata() {
    return await ipcRenderer.invoke('appData').then(path => path)
}

async function addAccount(data) {
    let skin = false
    if (data?.profile?.skins[0]?.base64) skin = await new skin2D().creatHeadTexture(data.profile.skins[0].base64);
    let div = document.createElement("div");
    div.classList.add("account");
    div.id = data.ID;
    div.innerHTML = `
        <div class="profile-image" ${skin ? 'style="background-image: url(' + skin + ');"' : ''}></div>
        <div class="profile-infos">
            <div class="profile-pseudo">${data.name}</div>
            <div class="profile-uuid">${data.uuid}</div>
        </div>
        <div class="delete-profile" id="${data.ID}">
            <div class="icon-account-delete delete-profile-icon"></div>
        </div>
    `
    return document.querySelector('.accounts-list').appendChild(div);
}

async function accountSelect(data) {
    let account = document.getElementById(`${data.ID}`);
    let activeAccount = document.querySelector('.account-select')

    if (activeAccount) activeAccount.classList.toggle('account-select');
    if (account) account.classList.add('account-select');
    
    let pseudoHome = document.querySelector('.profile-pseudo-home');
    if (pseudoHome && data?.name) pseudoHome.textContent = data.name;

    let pseudoDisplay = document.querySelectorAll('.profile-pseudo-display');
    pseudoDisplay.forEach(el => { if (data?.name) el.textContent = data.name; });

    let uuidDisplay = document.querySelectorAll('.profile-uuid-display');
    uuidDisplay.forEach(el => { if (data?.uuid || data?.ID) el.textContent = data.uuid || data.ID; });

    let typeDisplay = document.querySelectorAll('.profile-type-display');
    typeDisplay.forEach(el => { if (data?.meta?.type) el.textContent = data.meta.type; });

    if (data?.profile?.skins[0]?.base64) headplayer(data.profile.skins[0].base64);
}

async function headplayer(skinBase64) {
    let skin = await new skin2D().creatHeadTexture(skinBase64);
    let heads = document.querySelectorAll('.player-head, .profile-player-head');
    heads.forEach(h => h.style.backgroundImage = `url(${skin})`);
}

async function setStatus(opt) {
    let nameServerElement = document.querySelector('.server-status-name');
    let statusServerElement = document.querySelector('.server-status-text');
    let statusDotWrapper = document.querySelector('.status-player-count');
    let playersOnline = document.querySelector('.player-count') || document.querySelector('.status-player-count .player-count');

    let topBarText = document.querySelector('.status-top-text');
    let topBarDot = document.querySelector('.status-pulse-dot');
    let topBarIndicator = document.querySelector('.status-indicator-top');

    if (!opt || !opt.ip) {
        if (statusServerElement) {
            statusServerElement.classList.add('red');
            statusServerElement.innerHTML = `Fermé - 0 ms`;
        }
        if (statusDotWrapper) statusDotWrapper.classList.add('red');
        if (playersOnline) playersOnline.innerHTML = '0';
        if (topBarText) topBarText.textContent = 'HORS LIGNE';
        if (topBarIndicator) topBarIndicator.style.borderColor = 'rgba(224, 38, 58, 0.3)';
        if (topBarDot) { topBarDot.style.background = '#E0263A'; topBarDot.style.boxShadow = '0 0 8px #E0263A'; }
        return;
    }

    let { ip, port, nameServer } = opt;
    if (nameServerElement && nameServer) nameServerElement.innerHTML = nameServer;

    try {
        let status = new Status(ip, parseInt(port) || 25565);
        let statusServer = await status.getStatus().then(res => res).catch(err => err);

        if (statusServer && !statusServer.error) {
            if (statusServerElement) {
                statusServerElement.classList.remove('red');
                statusServerElement.innerHTML = `En ligne - ${statusServer.ms ? statusServer.ms : 0} ms`;
            }
            if (statusDotWrapper) statusDotWrapper.classList.remove('red');
            if (playersOnline) playersOnline.innerHTML = statusServer.playersConnect !== undefined ? statusServer.playersConnect : '0';

            if (topBarText) topBarText.textContent = 'EN LIGNE';
            if (topBarIndicator) topBarIndicator.style.borderColor = 'rgba(61, 191, 110, 0.3)';
            if (topBarDot) { topBarDot.style.background = '#3DBF6E'; topBarDot.style.boxShadow = '0 0 8px #3DBF6E'; }
        } else {
            if (statusServerElement) {
                statusServerElement.classList.add('red');
                statusServerElement.innerHTML = `Fermé - 0 ms`;
            }
            if (statusDotWrapper) statusDotWrapper.classList.add('red');
            if (playersOnline) playersOnline.innerHTML = '0';

            if (topBarText) topBarText.textContent = 'HORS LIGNE';
            if (topBarIndicator) topBarIndicator.style.borderColor = 'rgba(224, 38, 58, 0.3)';
            if (topBarDot) { topBarDot.style.background = '#E0263A'; topBarDot.style.boxShadow = '0 0 8px #E0263A'; }
        }
    } catch (err) {
        if (statusServerElement) {
            statusServerElement.classList.add('red');
            statusServerElement.innerHTML = `Fermé - 0 ms`;
        }
        if (statusDotWrapper) statusDotWrapper.classList.add('red');
        if (playersOnline) playersOnline.innerHTML = '0';

        if (topBarText) topBarText.textContent = 'HORS LIGNE';
        if (topBarIndicator) topBarIndicator.style.borderColor = 'rgba(224, 38, 58, 0.3)';
        if (topBarDot) { topBarDot.style.background = '#E0263A'; topBarDot.style.boxShadow = '0 0 8px #E0263A'; }
    }
}


export {
    appdata as appdata,
    changePanel as changePanel,
    config as config,
    database as database,
    logger as logger,
    popup as popup,
    setBackground as setBackground,
    skin2D as skin2D,
    addAccount as addAccount,
    accountSelect as accountSelect,
    slider as Slider,
    pkg as pkg,
    setStatus as setStatus
}