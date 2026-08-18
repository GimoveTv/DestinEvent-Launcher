/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */
import { changePanel, database, config, setStatus, logger, pkg, accountSelect, addAccount, popup, appdata } from '../utils.js'
const { Launch } = require('minecraft-java-core')
const { ipcRenderer } = require('electron')

class Home {
    static id = "home";

    async init(configData) {
        this.config = configData;
        this.db = new database();
        window.homeInstance = this;

        this.initMedia();
        this.news();
        await this.instancesSelect();
        this.startRealtimeLoops();
        await this.checkWhitelistAndAccess();
        await this.initAdminModal();

        let clickableLogos = document.querySelectorAll('.clickable-logo');
        clickableLogos.forEach(logo => {
            logo.addEventListener('click', () => changePanel('home'));
        });

        let settingsBtn = document.querySelector('.settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', e => changePanel('settings'));
        }

        let navProfile = document.querySelector('#nav-profile');
        if (navProfile) {
            navProfile.addEventListener('click', () => changePanel('profile'));
        }
    }

    startRealtimeLoops() {
        if (window.destinStatusInterval) clearInterval(window.destinStatusInterval);
        if (window.destinMaintInterval) clearInterval(window.destinMaintInterval);

        const checkStatus = async () => {
            try {
                let configClient = await this.db.readData('configClient').catch(() => null);
                let instanceSelect = configClient ? configClient.instance_select : null;
                let instancesList = await config.getInstanceList().catch(() => null);

                if (Array.isArray(instancesList) && instancesList.length > 0) {
                    // Chercher l'instance sélectionnée avec un status valide, sinon n'importe laquelle avec un status
                    let activeInstance = instancesList.find(i => i.name == instanceSelect && i.status && i.status.ip)
                        || instancesList.find(i => i.status && i.status.ip)
                        || instancesList[0];
                    if (activeInstance && activeInstance.status && activeInstance.status.ip) {
                        await setStatus(activeInstance.status);
                    }
                }
            } catch (e) {
                console.error('Realtime status check error:', e);
            }
        };

        // Rafraîchissement immédiat + Boucle en temps réel toutes les 3 secondes (3000ms)
        checkStatus();
        window.destinStatusInterval = setInterval(checkStatus, 3000);

        // 2. Polling Temps Réel de Maintenance & Fermeture Automatique du Launcher/Jeu (toutes les 5s)
        window.destinMaintInterval = setInterval(async () => {
            try {
                let cfg = await config.GetConfig().catch(() => null);
                if (cfg && cfg.maintenance) {
                    clearInterval(window.destinStatusInterval);
                    clearInterval(window.destinMaintInterval);

                    let playBtn = document.querySelector('.play-btn');
                    if (playBtn) {
                        playBtn.disabled = true;
                        playBtn.textContent = 'EN MAINTENANCE';
                        playBtn.style.background = '#4A4A5A';
                        playBtn.style.cursor = 'not-allowed';
                    }

                    // Popup de Maintenance en temps réel avec message explicite
                    let popupMaint = new popup();
                    popupMaint.openPopup({
                        title: 'MAINTENANCE EN COURS',
                        content: `${cfg.maintenance_message || 'Le launcher est actuellement en maintenance.'}<br><br><span style="color:#EDEAE0;font-size:0.85rem;">Fermeture du launcher dans 5 secondes...</span>`,
                        color: '#E0263A',
                        options: true,
                        exit: true
                    });

                    // Fermeture automatique du launcher dans 5 secondes
                    setTimeout(() => {
                        ipcRenderer.send('main-window-close');
                    }, 5000);
                }
            } catch (e) {
                console.error('Maintenance realtime check error:', e);
            }
        }, 5000);
    }

    initMedia() {
        let globalBgVideo = document.querySelector('#global-bg-video');
        let volumeSlider = document.querySelector('#bg-volume-slider');
        let audioVolText = document.querySelector('.audio-vol-text');
        let audioIcon = document.querySelector('.audio-icon');
        let audioToggleBtn = document.querySelector('#audio-toggle-btn');

        if (globalBgVideo) {
            let savedVol = localStorage.getItem('bg_video_volume');
            let initialVol = savedVol !== null ? parseInt(savedVol) : 20; // 20% par défaut

            globalBgVideo.volume = initialVol / 100;
            globalBgVideo.muted = initialVol === 0;

            if (volumeSlider) volumeSlider.value = initialVol;
            if (audioVolText) audioVolText.textContent = `${initialVol}%`;
            if (audioIcon) {
                audioIcon.innerHTML = initialVol === 0 ? '&#128263;' : initialVol < 50 ? '&#128265;' : '&#128266;';
            }

            if (volumeSlider) {
                volumeSlider.addEventListener('input', (e) => {
                    let val = parseInt(e.target.value);
                    globalBgVideo.volume = val / 100;
                    globalBgVideo.muted = val === 0;

                    if (audioVolText) audioVolText.textContent = `${val}%`;
                    if (audioIcon) {
                        audioIcon.innerHTML = val === 0 ? '&#128263;' : val < 50 ? '&#128265;' : '&#128266;';
                    }
                    localStorage.setItem('bg_video_volume', val);
                });
            }

            if (audioToggleBtn) {
                audioToggleBtn.addEventListener('click', (e) => {
                    if (e.target.id === 'bg-volume-slider') return;
                    if (globalBgVideo.muted || globalBgVideo.volume === 0) {
                        let restoreVol = parseInt(localStorage.getItem('bg_video_volume') || '20') || 20;
                        if (restoreVol === 0) restoreVol = 20;
                        globalBgVideo.muted = false;
                        globalBgVideo.volume = restoreVol / 100;
                        if (volumeSlider) volumeSlider.value = restoreVol;
                        if (audioVolText) audioVolText.textContent = `${restoreVol}%`;
                        if (audioIcon) audioIcon.innerHTML = restoreVol < 50 ? '&#128265;' : '&#128266;';
                    } else {
                        globalBgVideo.muted = true;
                        if (volumeSlider) volumeSlider.value = 0;
                        if (audioVolText) audioVolText.textContent = '0%';
                        if (audioIcon) audioIcon.innerHTML = '&#128263;';
                    }
                });
            }

            globalBgVideo.addEventListener('error', () => {
                let bgWrapper = document.querySelector('.global-bg-wrapper');
                if (bgWrapper) bgWrapper.style.display = 'none';
            });
        }
    }

    async news() {
        let newsZone = document.querySelector('.news-list');
        if (!newsZone) return;
        let news = await config.getNews(this.config).catch(err => err);
        if (news && Array.isArray(news) && news.length > 0) {
            // Trier les actualités par date décroissante (les plus récentes en premier)
            news.sort((a, b) => new Date(b.publish_date || b.date || 0) - new Date(a.publish_date || a.date || 0));
            newsZone.innerHTML = '';
            for (let i = 0; i < news.length; i++) {
                let date = this.getdate(news[i].publish_date || news[i].date || Date.now());

                let newsBlock = document.createElement('div');
                newsBlock.classList.add('news-block');

                newsBlock.innerHTML = `
                    <div class="news-header">
                        <div class="header-text">
                            <div class="title">${news[i].title || 'Actualité'}</div>
                        </div>
                        <div class="date">${date.day} ${date.month} ${date.year}</div>
                    </div>
                    <div class="news-content">
                        <div class="bbWrapper">${news[i].content || news[i].message || ''}</div>
                    </div>
                    <div class="news-author">Auteur - <span>${news[i].author || 'Admin'}</span></div>
                `;
                newsZone.appendChild(newsBlock);
            }
        } else {
            newsZone.innerHTML = '<div class="news-block"><div class="news-header"><div class="header-text"><div class="title">Aucune actualité disponible</div></div></div></div>';
        }
    }

    async instancesSelect() {
        let configClient = await this.db.readData('configClient')
        let instanceSelect = configClient ? configClient.instance_select : null
        let instancesList = await config.getInstanceList().catch(err => err)
        let auth = await this.db.readData('accounts', configClient ? configClient.account_selected : null)
        if (auth) accountSelect(auth);
        let instanceBTN = document.querySelector('.play-instance')

        function updateInstanceUI(name) {
            let instanceDisplays = document.querySelectorAll('.instance-name-display');
            instanceDisplays.forEach(el => el.textContent = name || 'Destin Event');
        }

        function updateAccessStatus(isAuthorized) {
            let accessBadge = document.querySelector('.access-status-badge');
            let accessText = document.querySelector('.access-status-text');
            if (accessBadge && accessText) {
                if (isAuthorized) {
                    accessBadge.className = 'access-status-badge access-authorized';
                    accessText.textContent = 'Autorisé';
                } else {
                    accessBadge.className = 'access-status-badge access-pending';
                    accessText.textContent = 'En attente';
                }
            }
        }

        if (Array.isArray(instancesList) && instancesList.length > 0) {
            if (!instanceSelect) {
                let newInstanceSelect = instancesList.find(i => i.whitelistActive == false) || instancesList[0];
                if (newInstanceSelect && configClient) {
                    configClient.instance_select = newInstanceSelect.name;
                    instanceSelect = newInstanceSelect.name;
                    await this.db.updateData('configClient', configClient);
                }
            }

            updateInstanceUI(instanceSelect || instancesList[0].name);

            for (let instance of instancesList) {
                if (instance.name == instanceSelect) {
                    await setStatus(instance.status);
                }
            }
        } else {
            updateInstanceUI('DestinEvent');
            await setStatus(null);
        }

        await this.checkWhitelistAndAccess();

        if (instanceBTN) {
            instanceBTN.onclick = () => this.startGame();
        }
    }

    async getWhitelistConfig() {
        let wlConfig = await this.db.readData('whitelistConfig', 1).catch(() => null);
        let defaultStaffs = ['GimoveTTv', 'GimoveTv', 'KillaIsBack'];

        if (!wlConfig) {
            wlConfig = {
                ID: 1,
                enabled: true,
                players: [...defaultStaffs],
                staffs: [...defaultStaffs]
            };
            await this.db.updateData('whitelistConfig', wlConfig, 1);
        } else {
            let updated = false;
            if (!Array.isArray(wlConfig.staffs)) wlConfig.staffs = [];
            if (!Array.isArray(wlConfig.players)) wlConfig.players = [];

            for (let name of defaultStaffs) {
                if (!wlConfig.staffs.some(s => s.toLowerCase().trim() === name.toLowerCase().trim())) {
                    wlConfig.staffs.push(name);
                    updated = true;
                }
                if (!wlConfig.players.some(p => p.toLowerCase().trim() === name.toLowerCase().trim())) {
                    wlConfig.players.push(name);
                    updated = true;
                }
            }

            if (updated) {
                await this.db.updateData('whitelistConfig', wlConfig, 1);
            }
        }
        return wlConfig;
    }

    async saveWhitelistConfig(wlConfig) {
        wlConfig.ID = 1;
        await this.db.updateData('whitelistConfig', wlConfig, 1);
        await this.checkWhitelistAndAccess();
    }

    async checkWhitelistAndAccess() {
        let configClient = await this.db.readData('configClient').catch(() => null);
        let auth = null;
        if (configClient?.account_selected) {
            auth = await this.db.readData('accounts', configClient.account_selected).catch(() => null);
        }
        if (!auth) {
            let allAccounts = await this.db.readAllData('accounts').catch(() => []);
            if (allAccounts && allAccounts.length > 0) {
                auth = allAccounts[0];
                if (configClient) {
                    configClient.account_selected = auth.ID;
                    await this.db.updateData('configClient', configClient);
                }
            }
        }
        let wlConfig = await this.getWhitelistConfig();

        let pseudo = auth?.name ? auth.name.trim() : '';
        let cleanPseudo = pseudo.toLowerCase().trim();
        let defaultAdmins = ['gimovettv', 'gimovetv', 'killaisback'];

        let isStaff = cleanPseudo ? (
            wlConfig.staffs.some(s => s && s.toLowerCase().trim() === cleanPseudo) ||
            defaultAdmins.includes(cleanPseudo)
        ) : false;

        let isWhitelisted = cleanPseudo ? (
            wlConfig.players.some(p => p && p.toLowerCase().trim() === cleanPseudo) ||
            isStaff
        ) : false;

        if (cleanPseudo && defaultAdmins.includes(cleanPseudo)) {
            let needsSave = false;
            if (!wlConfig.staffs.some(s => s && s.toLowerCase().trim() === cleanPseudo)) {
                wlConfig.staffs.push(pseudo);
                needsSave = true;
            }
            if (!wlConfig.players.some(p => p && p.toLowerCase().trim() === cleanPseudo)) {
                wlConfig.players.push(pseudo);
                needsSave = true;
            }
            if (needsSave) {
                await this.db.updateData('whitelistConfig', wlConfig, 1);
            }
        }

        let playBtn = document.querySelector('.play-btn');
        let accessBadge = document.querySelector('.access-status-badge');
        let accessText = document.querySelector('.access-status-text');
        let adminBtns = document.querySelectorAll('#nav-admin, #profile-nav-admin, .admin-btn');
        let pseudoTypeHome = document.querySelector('.profile-type-home');
        let pseudoHome = document.querySelector('.profile-pseudo-home');

        if (auth?.name && pseudoHome) {
            pseudoHome.textContent = auth.name;
        }

        if (pseudoTypeHome) {
            pseudoTypeHome.textContent = isStaff ? "MEMBRE DU STAFF" : "SURVIVANT DESTIN EVENT";
        }

        adminBtns.forEach(btn => {
            btn.style.display = isStaff ? 'flex' : 'none';
        });

        let isAuthorized = false;
        let statusLabel = '';
        let statusClass = 'access-pending';
        let btnText = 'JOUER';

        if (isStaff) {
            isAuthorized = true;
            statusLabel = 'Staff (Accès Permanent)';
            statusClass = 'access-authorized';
            btnText = 'JOUER';
        } else if (!wlConfig.enabled) {
            isAuthorized = false;
            statusLabel = 'Accès Fermé';
            statusClass = 'access-pending';
            btnText = 'ACCÈS FERMÉ';
        } else if (isWhitelisted) {
            isAuthorized = true;
            statusLabel = 'Autorisé';
            statusClass = 'access-authorized';
            btnText = 'JOUER';
        } else {
            isAuthorized = false;
            statusLabel = 'Non Whitelisté';
            statusClass = 'access-pending';
            btnText = 'NON AUTORISÉ';
        }

        if (accessBadge && accessText) {
            accessBadge.className = `access-status-badge ${statusClass}`;
            accessText.textContent = statusLabel;
        }

        if (playBtn) {
            if (isAuthorized) {
                playBtn.disabled = false;
                playBtn.textContent = 'JOUER';
                playBtn.classList.remove('blocked-play-btn');
            } else {
                playBtn.disabled = true;
                playBtn.textContent = btnText;
                playBtn.classList.add('blocked-play-btn');
            }
        }

        let flashBanner = document.querySelector('#flash-banner');
        let flashBannerText = document.querySelector('#flash-banner-text');
        if (flashBanner && flashBannerText) {
            if (wlConfig.announcement && wlConfig.announcement.active && wlConfig.announcement.text) {
                flashBannerText.textContent = wlConfig.announcement.text;
                flashBanner.style.display = 'flex';
            } else {
                flashBanner.style.display = 'none';
            }
        }

        return { isAuthorized, isStaff, isWhitelisted, wlConfig };
    }

    async initAdminModal() {
        let adminBtn = document.querySelector('#nav-admin');
        let adminModal = document.querySelector('#admin-modal');
        let closeAdminModal = document.querySelector('#close-admin-modal');

        if (adminBtn && adminModal) {
            adminBtn.addEventListener('click', async () => {
                adminModal.style.display = 'flex';
                await this.renderAdminModal();
            });
        }

        if (closeAdminModal && adminModal) {
            closeAdminModal.addEventListener('click', () => {
                adminModal.style.display = 'none';
            });
        }

        if (adminModal) {
            adminModal.addEventListener('click', (e) => {
                if (e.target === adminModal) {
                    adminModal.style.display = 'none';
                }
            });
        }

        let wlCheckbox = document.querySelector('#admin-wl-checkbox');
        if (wlCheckbox) {
            wlCheckbox.addEventListener('change', async (e) => {
                let wlConfig = await this.getWhitelistConfig();
                wlConfig.enabled = e.target.checked;
                await this.saveWhitelistConfig(wlConfig);
                await this.renderAdminModal();
            });
        }

        // Annonce Flash Live
        let publishAnnounceBtn = document.querySelector('#admin-publish-announce-btn');
        let clearAnnounceBtn = document.querySelector('#admin-clear-announce-btn');
        let announceInput = document.querySelector('#admin-announce-input');

        if (publishAnnounceBtn && announceInput) {
            publishAnnounceBtn.addEventListener('click', async () => {
                let text = announceInput.value.trim();
                if (!text) return;
                let wlConfig = await this.getWhitelistConfig();
                wlConfig.announcement = { active: true, text: text };
                await this.saveWhitelistConfig(wlConfig);
                await this.renderAdminModal();
            });
        }

        if (clearAnnounceBtn) {
            clearAnnounceBtn.addEventListener('click', async () => {
                let wlConfig = await this.getWhitelistConfig();
                wlConfig.announcement = { active: false, text: '' };
                await this.saveWhitelistConfig(wlConfig);
                if (announceInput) announceInput.value = '';
                await this.renderAdminModal();
            });
        }

        // Purge Cache
        let clearCacheBtn = document.querySelector('#admin-clear-cache-btn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', async () => {
                let popupCache = new popup();
                popupCache.openPopup({
                    title: 'Purge du Cache',
                    content: 'Le cache local du launcher a été réinitialisé avec succès.',
                    color: 'var(--color)',
                    options: true
                });
                try {
                    localStorage.removeItem('bg_video_volume');
                } catch (e) {}
            });
        }

        let addPlayerBtn = document.querySelector('#admin-add-player-btn');
        let playerInput = document.querySelector('#admin-player-input');
        if (addPlayerBtn && playerInput) {
            let handleAddPlayer = async () => {
                let name = playerInput.value.trim();
                if (!name) return;
                let wlConfig = await this.getWhitelistConfig();
                if (!wlConfig.players.some(p => p.toLowerCase() === name.toLowerCase())) {
                    wlConfig.players.push(name);
                    await this.saveWhitelistConfig(wlConfig);
                    playerInput.value = '';
                    await this.renderAdminModal();
                }
            };
            addPlayerBtn.addEventListener('click', handleAddPlayer);
            playerInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleAddPlayer();
            });
        }

        let addStaffBtn = document.querySelector('#admin-add-staff-btn');
        let staffInput = document.querySelector('#admin-staff-input');
        if (addStaffBtn && staffInput) {
            let handleAddStaff = async () => {
                let name = staffInput.value.trim();
                if (!name) return;
                let wlConfig = await this.getWhitelistConfig();
                if (!wlConfig.staffs.some(s => s.toLowerCase() === name.toLowerCase())) {
                    wlConfig.staffs.push(name);
                    await this.saveWhitelistConfig(wlConfig);
                    staffInput.value = '';
                    await this.renderAdminModal();
                }
            };
            addStaffBtn.addEventListener('click', handleAddStaff);
            staffInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleAddStaff();
            });
        }
    }

    async renderAdminModal() {
        let wlConfig = await this.getWhitelistConfig();

        let countPlayers = document.querySelector('#admin-count-players');
        let countStaffs = document.querySelector('#admin-count-staffs');
        if (countPlayers) countPlayers.textContent = wlConfig.players ? wlConfig.players.length : 0;
        if (countStaffs) countStaffs.textContent = wlConfig.staffs ? wlConfig.staffs.length : 0;

        let announceInput = document.querySelector('#admin-announce-input');
        let clearAnnounceBtn = document.querySelector('#admin-clear-announce-btn');
        if (announceInput) {
            if (wlConfig.announcement && wlConfig.announcement.active) {
                announceInput.value = wlConfig.announcement.text || '';
                if (clearAnnounceBtn) clearAnnounceBtn.style.display = 'inline-block';
            } else {
                announceInput.value = '';
                if (clearAnnounceBtn) clearAnnounceBtn.style.display = 'none';
            }
        }

        let wlCheckbox = document.querySelector('#admin-wl-checkbox');
        let wlStatusText = document.querySelector('#admin-wl-status-text');
        if (wlCheckbox && wlStatusText) {
            wlCheckbox.checked = wlConfig.enabled;
            wlStatusText.textContent = wlConfig.enabled ? "WHITELIST ACTIVÉE (OUVERT AUX WHITELISTÉS)" : "ACCÈS FERMÉ (STAFFS SEULEMENT)";
            wlStatusText.style.color = wlConfig.enabled ? "#3DBF6E" : "#FF1E43";
        }

        let playersListElem = document.querySelector('#admin-players-list');
        if (playersListElem) {
            playersListElem.innerHTML = '';
            if (wlConfig.players.length === 0) {
                playersListElem.innerHTML = '<div class="admin-empty-tag">Aucun joueur dans la whitelist</div>';
            } else {
                wlConfig.players.forEach(player => {
                    let tag = document.createElement('div');
                    tag.className = 'admin-tag-pill';
                    tag.innerHTML = `
                        <span class="tag-name">${player}</span>
                        <span class="tag-delete" title="Supprimer">&times;</span>
                    `;
                    tag.querySelector('.tag-delete').addEventListener('click', async () => {
                        wlConfig.players = wlConfig.players.filter(p => p !== player);
                        await this.saveWhitelistConfig(wlConfig);
                        await this.renderAdminModal();
                    });
                    playersListElem.appendChild(tag);
                });
            }
        }

        let staffsListElem = document.querySelector('#admin-staffs-list');
        if (staffsListElem) {
            staffsListElem.innerHTML = '';
            if (wlConfig.staffs.length === 0) {
                staffsListElem.innerHTML = '<div class="admin-empty-tag">Aucun staff répertorié</div>';
            } else {
                wlConfig.staffs.forEach(staff => {
                    let tag = document.createElement('div');
                    tag.className = 'admin-tag-pill admin-staff-tag';
                    tag.innerHTML = `
                        <span class="tag-name">&#128081; ${staff}</span>
                        <span class="tag-delete" title="Supprimer">&times;</span>
                    `;
                    tag.querySelector('.tag-delete').addEventListener('click', async () => {
                        wlConfig.staffs = wlConfig.staffs.filter(s => s !== staff);
                        await this.saveWhitelistConfig(wlConfig);
                        await this.renderAdminModal();
                    });
                    staffsListElem.appendChild(tag);
                });
            }
        }
    }

    async startGame() {
        let accessCheck = await this.checkWhitelistAndAccess();
        if (!accessCheck.isAuthorized) {
            let popupError = new popup();
            popupError.openPopup({
                title: 'Accès Refusé',
                content: accessCheck.wlConfig && !accessCheck.wlConfig.enabled
                    ? 'Le serveur est actuellement fermé par l\'administration.'
                    : 'Vous n\'êtes pas présent sur la Whitelist du serveur DestinEvent.',
                color: 'red',
                options: true
            });
            return;
        }

        let launch = new Launch();
        let configClient = await this.db.readData('configClient');
        let instance = await config.getInstanceList().catch(err => null);
        let authenticator = await this.db.readData('accounts', configClient ? configClient.account_selected : null);

        let options = (Array.isArray(instance) && instance.length > 0)
            ? (instance.find(i => i.name == configClient?.instance_select) || instance[0])
            : null;

        if (!options) {
            let popupError = new popup();
            popupError.openPopup({
                title: 'Erreur',
                content: 'Impossible de charger les données du jeu. Vérifiez votre connexion internet.',
                color: 'red',
                options: true
            });
            return;
        }

        let playInstanceBTN = document.querySelector('.play-instance');
        let infoStartingBOX = document.querySelector('.info-starting-game');
        let infoStarting = document.querySelector(".info-starting-game-text");
        let progressBar = document.querySelector('.progress-bar');
        let launchSpeed = document.querySelector('.launch-speed');
        let launchPct = document.querySelector('.launch-percentage');
        let launchEta = document.querySelector('.launch-eta');
        let infoLaunchError = document.querySelector('.info-launch-error');
        let errorMsgText = document.querySelector('.error-msg-text');
        let retryLaunchBtn = document.querySelector('.retry-launch-btn');

        let opt = {
            url: options.url,
            authenticator: authenticator,
            timeout: 10000,
            path: `${await appdata()}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`,
            instance: options.name,
            version: options.loader ? options.loader.minecraft_version : '1.21.1',
            detached: configClient?.launcher_config?.closeLauncher == "close-all" ? false : true,
            downloadFileMultiple: configClient?.launcher_config?.download_multi !== undefined ? configClient.launcher_config.download_multi : true,
            intelEnabledMac: configClient?.launcher_config?.intelEnabledMac || false,

            loader: {
                type: options.loader ? options.loader.loader_type : 'neoforge',
                build: options.loader ? options.loader.loader_version : 'latest',
                enable: options.loader ? (options.loader.loader_type == 'none' ? false : true) : true
            },

            verify: options.verify !== undefined ? options.verify : false,

            ignored: options.ignored ? [...options.ignored] : [],

            java: {
                path: configClient?.java_config?.java_path || null,
            },

            JVM_ARGS: options.jvm_args ? options.jvm_args : [],
            GAME_ARGS: options.game_args ? options.game_args : [],

            screen: {
                width: configClient?.game_config?.screen_size?.width || 854,
                height: configClient?.game_config?.screen_size?.height || 480
            },

            memory: {
                min: `${(configClient?.java_config?.java_memory?.min || 1) * 1024}M`,
                max: `${(configClient?.java_config?.java_memory?.max || 4) * 1024}M`
            }
        }

        launch.Launch(opt);

        playInstanceBTN.style.display = "none"
        infoStartingBOX.style.display = "block"
        if (infoLaunchError) infoLaunchError.style.display = "none";
        progressBar.style.display = "";
        if (launchSpeed) launchSpeed.textContent = "0.0 Mo/s";
        if (launchPct) launchPct.textContent = "0%";
        if (launchEta) launchEta.textContent = "--:--";
        ipcRenderer.send('main-window-progress-load')

        launch.on('extract', extract => {
            ipcRenderer.send('main-window-progress-load')
            infoStarting.innerHTML = "Extraction & installation..."
            console.log(extract);
        });

        launch.on('progress', (progress, size) => {
            let pct = Math.min(100, Math.max(0, ((progress / size) * 100))).toFixed(0);
            infoStarting.innerHTML = "Téléchargement des mods..."
            if (launchPct) launchPct.textContent = `${pct}%`;
            ipcRenderer.send('main-window-progress', { progress, size })
            progressBar.value = progress;
            progressBar.max = size;
        });

        launch.on('check', (progress, size) => {
            let pct = Math.min(100, Math.max(0, ((progress / size) * 100))).toFixed(0);
            infoStarting.innerHTML = "Vérification des fichiers..."
            if (launchPct) launchPct.textContent = `${pct}%`;
            ipcRenderer.send('main-window-progress', { progress, size })
            progressBar.value = progress;
            progressBar.max = size;
        });

        launch.on('estimated', (time) => {
            let minutes = Math.floor(time / 60);
            let seconds = Math.floor(time % 60);
            if (launchEta) launchEta.textContent = `${minutes}m ${seconds}s`;
        });

        launch.on('speed', (speed) => {
            let mbs = (speed / (1024 * 1024)).toFixed(1);
            if (launchSpeed) launchSpeed.textContent = `${mbs} Mo/s`;
        });

        launch.on('patch', patch => {
            console.log(patch);
            ipcRenderer.send('main-window-progress-load')
            infoStarting.innerHTML = "Patch des fichiers en cours..."
        });

        launch.on('data', (e) => {
            progressBar.style.display = "none"
            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send("main-window-hide")
            };
            new logger('Minecraft', '#36b030');
            ipcRenderer.send('main-window-progress-load')
            infoStarting.innerHTML = "Lancement de Minecraft..."
            console.log(e);
        });

        launch.on('close', code => {
            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send("main-window-show")
            };
            ipcRenderer.send('main-window-progress-reset')
            infoStartingBOX.style.display = "none"
            playInstanceBTN.style.display = "flex"
            infoStarting.innerHTML = "Vérification des fichiers..."
            new logger(pkg.name, '#7289da');
            console.log('Close');
        });

        launch.on('error', err => {
            ipcRenderer.send('main-window-progress-reset')
            new logger(pkg.name, '#7289da');

            if (infoLaunchError && errorMsgText) {
                infoLaunchError.style.display = "flex";
                errorMsgText.textContent = err.error || "Une erreur s'est produite lors du téléchargement.";

                if (retryLaunchBtn) {
                    retryLaunchBtn.onclick = () => {
                        infoStartingBOX.style.display = "none";
                        playInstanceBTN.style.display = "flex";
                        this.startGame();
                    };
                }
            } else {
                let popupError = new popup();
                popupError.openPopup({
                    title: 'Erreur',
                    content: err.error,
                    color: 'red',
                    options: true
                });
                infoStartingBOX.style.display = "none";
                playInstanceBTN.style.display = "flex";
            }

            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send("main-window-show")
            };
            console.log(err);
        });
    }

    getdate(e) {
        let date = new Date(e)
        let year = date.getFullYear()
        let month = date.getMonth() + 1
        let day = date.getDate()
        let allMonth = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
        return { year: year, month: allMonth[month - 1], day: day }
    }
}
export default Home;