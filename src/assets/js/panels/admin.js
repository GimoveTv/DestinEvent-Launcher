/**
 * Panel Admin / Staff — DestinEvent Launcher
 */
import { changePanel, database, popup } from '../utils.js';
import config from '../utils/config.js';

class Admin {
    static id = "admin";

    async init(configData) {
        this.config = configData;
        this.db = new database();
        window.adminInstance = this;

        // Navigation retour
        let backBtn = document.querySelector('#admin-page-back-btn');
        if (backBtn) backBtn.addEventListener('click', () => changePanel('home'));

        let navHome = document.querySelector('#admin-nav-home');
        if (navHome) navHome.addEventListener('click', () => changePanel('home'));

        let settingsBtn = document.querySelector('.settings-btn-admin');
        if (settingsBtn) settingsBtn.addEventListener('click', () => changePanel('settings'));

        // Head joueur sidebar
        this.loadPlayerHead();

        // Logout
        let logoutBtn = document.querySelector('#admin-nav-logout, .admin-player-head');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                let logoutModal = document.querySelector('#logout-modal');
                if (logoutModal) logoutModal.style.display = 'flex';
            });
        }

        await this.render();
        this.attachEvents();
    }

    async loadPlayerHead() {
        let headEl = document.querySelector('.admin-player-head');
        if (!headEl) return;
        let db = new database();
        let configClient = await db.readData('configClient').catch(() => null);
        let account = null;
        if (configClient?.account_selected) {
            account = await db.readData('accounts', configClient.account_selected).catch(() => null);
        }
        if (!account) {
            let all = await db.readAllData('accounts').catch(() => []);
            account = all[0] || null;
        }
        if (account?.name) {
            headEl.style.backgroundImage = `url(https://minotar.net/avatar/${account.name}/32)`;
            headEl.style.backgroundSize = 'cover';
            headEl.style.backgroundRepeat = 'no-repeat';
            headEl.style.borderRadius = '4px';
        }
    }

    async getWhitelistConfig() {
        try {
            let remote = await config.getWhitelist().catch(() => null);
            if (remote && (remote.players || remote.staffs)) return remote;
        } catch (e) {}
        let db = new database();
        let local = await db.readData('whitelistConfig').catch(() => null);
        return local || { enabled: true, players: [], staffs: [], announcement: { active: false, text: '' }, rolloutStartTime: null };
    }

    async saveWhitelistConfig(wlConfig) {
        let db = new database();
        let existing = await db.readData('whitelistConfig').catch(() => null);
        if (existing) {
            await db.updateData('whitelistConfig', wlConfig).catch(() => {});
        } else {
            await db.createData('whitelistConfig', wlConfig).catch(() => {});
        }
        try { await config.updateWhitelist(wlConfig); } catch (e) {}
    }

    async render() {
        let wlConfig = await this.getWhitelistConfig();

        // Stats
        let countPlayers = document.querySelector('#ap-count-players');
        let countStaffs = document.querySelector('#ap-count-staffs');
        let tabCountPlayers = document.querySelector('#ap-tab-count-players');
        let tabCountStaffs = document.querySelector('#ap-tab-count-staffs');

        let pCount = wlConfig.players?.length || 0;
        let sCount = wlConfig.staffs?.length || 0;

        if (countPlayers) countPlayers.textContent = pCount;
        if (countStaffs) countStaffs.textContent = sCount;
        if (tabCountPlayers) tabCountPlayers.textContent = pCount;
        if (tabCountStaffs) tabCountStaffs.textContent = sCount;

        // WL toggle
        let wlCheckbox = document.querySelector('#ap-wl-checkbox');
        let wlStatusText = document.querySelector('#ap-wl-status-text');
        if (wlCheckbox && wlStatusText) {
            wlCheckbox.checked = !!wlConfig.enabled;
            wlStatusText.textContent = wlConfig.enabled ? 'WHITELIST ACTIVEE (OUVERT)' : 'ACCES FERME (STAFFS SEULEMENT)';
            wlStatusText.style.color = wlConfig.enabled ? '#3DBF6E' : '#FF1E43';
        }

        // Annonce
        let announceInput = document.querySelector('#ap-announce-input');
        let clearBtn = document.querySelector('#ap-clear-announce-btn');
        let preview = document.querySelector('#ap-announce-preview');
        let previewText = document.querySelector('#ap-announce-preview-text');
        if (announceInput) {
            if (wlConfig.announcement?.active) {
                announceInput.value = wlConfig.announcement.text || '';
                if (clearBtn) clearBtn.style.display = 'inline-block';
                if (preview) preview.style.display = 'flex';
                if (previewText) previewText.textContent = wlConfig.announcement.text;
            } else {
                announceInput.value = '';
                if (clearBtn) clearBtn.style.display = 'none';
                if (preview) preview.style.display = 'none';
            }
        }

        // Players list
        let playersListEl = document.querySelector('#ap-players-list');
        if (playersListEl) {
            playersListEl.innerHTML = '';
            let playerQuery = (this.searchPlayerQuery || '').toLowerCase().trim();
            let filteredPlayers = (wlConfig.players || []).filter(p => !playerQuery || p.toLowerCase().includes(playerQuery));

            if (!filteredPlayers || filteredPlayers.length === 0) {
                playersListEl.innerHTML = `<div class="admin-empty-tag">${playerQuery ? 'Aucun joueur ne correspond a la recherche' : 'Aucun joueur dans la whitelist'}</div>`;
            } else {
                filteredPlayers.forEach(player => {
                    let tag = document.createElement('div');
                    tag.className = 'admin-tag-pill';
                    tag.innerHTML = `
                        <img class="tag-head-img" src="https://minotar.net/avatar/${player}/24" onerror="this.src='assets/images/default/setve.png'" alt="${player}">
                        <span class="tag-name">${player}</span>
                        <span class="tag-delete" title="Supprimer">&times;</span>
                    `;
                    tag.querySelector('.tag-delete').addEventListener('click', async () => {
                        let cleanP = player.toLowerCase().trim();
                        wlConfig.players = wlConfig.players.filter(p => p && p.toLowerCase().trim() !== cleanP);
                        wlConfig.staffs = wlConfig.staffs.filter(s => s && s.toLowerCase().trim() !== cleanP);
                        await this.saveWhitelistConfig(wlConfig);
                        await this.render();
                    });
                    playersListEl.appendChild(tag);
                });
            }
        }

        // Staffs list
        let staffsListEl = document.querySelector('#ap-staffs-list');
        if (staffsListEl) {
            staffsListEl.innerHTML = '';
            let staffQuery = (this.searchStaffQuery || '').toLowerCase().trim();
            let filteredStaffs = (wlConfig.staffs || []).filter(s => !staffQuery || s.toLowerCase().includes(staffQuery));

            if (!filteredStaffs || filteredStaffs.length === 0) {
                staffsListEl.innerHTML = `<div class="admin-empty-tag">${staffQuery ? 'Aucun membre du staff ne correspond a la recherche' : 'Aucun staff repertorie'}</div>`;
            } else {
                filteredStaffs.forEach(staff => {
                    let tag = document.createElement('div');
                    tag.className = 'admin-tag-pill admin-staff-tag';
                    tag.innerHTML = `
                        <img class="tag-head-img" src="https://minotar.net/avatar/${staff}/24" onerror="this.src='assets/images/default/setve.png'" alt="${staff}">
                        <span class="tag-name">&#128081; ${staff}</span>
                        <span class="tag-delete" title="Supprimer">&times;</span>
                    `;
                    tag.querySelector('.tag-delete').addEventListener('click', async () => {
                        let cleanS = staff.toLowerCase().trim();
                        wlConfig.staffs = wlConfig.staffs.filter(s => s && s.toLowerCase().trim() !== cleanS);
                        wlConfig.players = wlConfig.players.filter(p => p && p.toLowerCase().trim() !== cleanS);
                        await this.saveWhitelistConfig(wlConfig);
                        await this.render();
                    });
                    staffsListEl.appendChild(tag);
                });
            }
        }
    }

    attachEvents() {
        // Tab switching
        let tabPlayersBtn = document.querySelector('#ap-tab-players');
        let tabStaffsBtn = document.querySelector('#ap-tab-staffs');
        let tabPlayersContent = document.querySelector('#ap-tab-content-players');
        let tabStaffsContent = document.querySelector('#ap-tab-content-staffs');

        if (tabPlayersBtn && tabStaffsBtn && tabPlayersContent && tabStaffsContent) {
            tabPlayersBtn.addEventListener('click', () => {
                tabPlayersBtn.classList.add('active-tab');
                tabStaffsBtn.classList.remove('active-tab');
                tabPlayersContent.style.display = 'flex';
                tabStaffsContent.style.display = 'none';
            });

            tabStaffsBtn.addEventListener('click', () => {
                tabStaffsBtn.classList.add('active-tab');
                tabPlayersBtn.classList.remove('active-tab');
                tabStaffsContent.style.display = 'flex';
                tabPlayersContent.style.display = 'none';
            });
        }

        // Search inputs
        let searchPlayerInput = document.querySelector('#ap-search-player-input');
        if (searchPlayerInput) {
            searchPlayerInput.addEventListener('input', (e) => {
                this.searchPlayerQuery = e.target.value;
                this.render();
            });
        }

        let searchStaffInput = document.querySelector('#ap-search-staff-input');
        if (searchStaffInput) {
            searchStaffInput.addEventListener('input', (e) => {
                this.searchStaffQuery = e.target.value;
                this.render();
            });
        }

        // Toggle WL
        let wlCheckbox = document.querySelector('#ap-wl-checkbox');
        if (wlCheckbox) {
            wlCheckbox.addEventListener('change', async (e) => {
                let wlConfig = await this.getWhitelistConfig();
                wlConfig.enabled = e.target.checked;
                if (wlConfig.enabled) {
                    wlConfig.rolloutStartTime = Date.now();
                } else {
                    wlConfig.rolloutStartTime = null;
                }
                await this.saveWhitelistConfig(wlConfig);
                await this.render();
            });
        }

        // Publier annonce
        let publishBtn = document.querySelector('#ap-publish-announce-btn');
        let announceInput = document.querySelector('#ap-announce-input');
        if (publishBtn && announceInput) {
            publishBtn.addEventListener('click', async () => {
                let text = announceInput.value.trim();
                if (!text) return;
                let wlConfig = await this.getWhitelistConfig();
                wlConfig.announcement = { active: true, text };
                await this.saveWhitelistConfig(wlConfig);
                await this.render();
            });
            announceInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') publishBtn.click();
            });
        }

        // Clear annonce
        let clearBtn = document.querySelector('#ap-clear-announce-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                let wlConfig = await this.getWhitelistConfig();
                wlConfig.announcement = { active: false, text: '' };
                await this.saveWhitelistConfig(wlConfig);
                if (announceInput) announceInput.value = '';
                await this.render();
            });
        }

        // Ajouter joueur
        let addPlayerBtn = document.querySelector('#ap-add-player-btn');
        let playerInput = document.querySelector('#ap-player-input');
        if (addPlayerBtn && playerInput) {
            let handle = async () => {
                let name = playerInput.value.trim();
                if (!name) return;
                let wlConfig = await this.getWhitelistConfig();
                if (!wlConfig.players.some(p => p.toLowerCase() === name.toLowerCase())) {
                    wlConfig.players.push(name);
                    await this.saveWhitelistConfig(wlConfig);
                    playerInput.value = '';
                    await this.render();
                }
            };
            addPlayerBtn.addEventListener('click', handle);
            playerInput.addEventListener('keypress', e => { if (e.key === 'Enter') handle(); });
        }

        // Ajouter staff
        let addStaffBtn = document.querySelector('#ap-add-staff-btn');
        let staffInput = document.querySelector('#ap-staff-input');
        if (addStaffBtn && staffInput) {
            let handle = async () => {
                let name = staffInput.value.trim();
                if (!name) return;
                let wlConfig = await this.getWhitelistConfig();
                if (!wlConfig.staffs.some(s => s.toLowerCase() === name.toLowerCase())) {
                    wlConfig.staffs.push(name);
                    await this.saveWhitelistConfig(wlConfig);
                    staffInput.value = '';
                    await this.render();
                }
            };
            addStaffBtn.addEventListener('click', handle);
            staffInput.addEventListener('keypress', e => { if (e.key === 'Enter') handle(); });
        }

        // Purge cache
        let cacheBtn = document.querySelector('#ap-clear-cache-btn');
        if (cacheBtn) {
            cacheBtn.addEventListener('click', () => {
                new popup().openPopup({
                    title: 'Purge du Cache',
                    content: 'Le cache local du launcher a ete reinitialise.',
                    color: 'var(--color)',
                    options: true
                });
                try { localStorage.removeItem('bg_video_volume'); } catch (e) {}
            });
        }
    }
}

export default Admin;
