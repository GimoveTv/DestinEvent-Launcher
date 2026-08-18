/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */
// import panel
import Login from './panels/login.js';
import Home from './panels/home.js';
import Profile from './panels/profile.js';
import Settings from './panels/settings.js';
import Admin from './panels/admin.js';

// import modules
import { logger, config, changePanel, database, popup, setBackground, accountSelect, addAccount, pkg } from './utils.js';
const { AZauth, Microsoft, Mojang } = require('minecraft-java-core');

// libs
const { ipcRenderer } = require('electron');
const fs = require('fs');
const os = require('os');

class Launcher {
    async init() {
        this.initLog();
        console.log('Initializing Launcher...');
        this.shortcut()
        await setBackground()
        this.initFrame();
        this.config = await config.GetConfig().then(res => res).catch(err => err);
        if (await this.config.error) return this.errorConnect()
        this.db = new database();
        await this.initConfigClient();
        this.createPanels(Login, Home, Profile, Settings, Admin);
        this.startLauncher();
    }

    initLog() {
        document.addEventListener('keydown', e => {
            if (e.ctrlKey && e.shiftKey && e.keyCode == 73 || e.keyCode == 123) {
                ipcRenderer.send('main-window-dev-tools-close');
                ipcRenderer.send('main-window-dev-tools');
            }
        })
        new logger(pkg.name, '#7289da')
    }

    shortcut() {
        document.addEventListener('keydown', e => {
            if (e.ctrlKey && e.keyCode == 87) {
                ipcRenderer.send('main-window-close');
            }
        });

        document.addEventListener('click', e => {
            let logoClick = e.target.closest('.clickable-logo, .sidebar-logo, .brand-badge, .top-bar-left');
            if (logoClick) {
                changePanel('home');
            }

            let adminClick = e.target.closest('.admin-btn, #nav-admin, #profile-nav-admin, #admin-nav-admin');
            if (adminClick) {
                changePanel('admin');
            }

            let logoutClick = e.target.closest('#nav-logout, .sidebar-user-item, .sidebar-player-head');
            if (logoutClick && !e.target.closest('#logout-modal')) {
                let logoutModal = document.querySelector('#logout-modal');
                if (logoutModal) {
                    logoutModal.style.display = 'flex';
                }
            }

            let closeLogout = e.target.closest('#close-logout-modal, #cancel-logout-btn');
            if (closeLogout) {
                let logoutModal = document.querySelector('#logout-modal');
                if (logoutModal) logoutModal.style.display = 'none';
            }

            let confirmLogout = e.target.closest('#confirm-logout-btn');
            if (confirmLogout) {
                let logoutModal = document.querySelector('#logout-modal');
                if (logoutModal) logoutModal.style.display = 'none';
                (async () => {
                    let db = new database();
                    let accounts = await db.readAllData('accounts').catch(() => []);
                    for (let acc of accounts) {
                        if (acc?.ID) await db.deleteData('accounts', acc.ID).catch(() => {});
                    }
                    let configClient = await db.readData('configClient').catch(() => null);
                    if (configClient) {
                        configClient.account_selected = null;
                        await db.updateData('configClient', configClient).catch(() => {});
                    }
                    changePanel('login');
                })();
            }

            let logoutModal = document.querySelector('#logout-modal');
            if (logoutModal && e.target === logoutModal) {
                logoutModal.style.display = 'none';
            }
        });
    }


    errorConnect() {
        new popup().openPopup({
            title: this.config.error.code,
            content: this.config.error.message,
            color: 'red',
            exit: true,
            options: true
        });
    }

    initFrame() {
        console.log('Initializing Frame...')
        const platform = os.platform() === 'darwin' ? "darwin" : "other";

        document.querySelector(`.${platform} .frame`).classList.toggle('hide')

        document.querySelector(`.${platform} .frame #minimize`).addEventListener('click', () => {
            ipcRenderer.send('main-window-minimize');
        });

        let maximized = false;
        let maximize = document.querySelector(`.${platform} .frame #maximize`);
        maximize.addEventListener('click', () => {
            if (maximized) ipcRenderer.send('main-window-maximize')
            else ipcRenderer.send('main-window-maximize');
            maximized = !maximized
            maximize.classList.toggle('icon-maximize')
            maximize.classList.toggle('icon-restore-down')
        });

        let dragbar = document.querySelector('.dragbar');
        if (dragbar) {
            dragbar.addEventListener('dblclick', (e) => {
                if (e.target.closest('#minimize, #maximize, #close')) return;
                ipcRenderer.send('main-window-maximize');
            });
        }

        document.querySelector(`.${platform} .frame #close`).addEventListener('click', () => {
            ipcRenderer.send('main-window-close');
        })
    }

    async initConfigClient() {
        console.log('Initializing Config Client...')
        let configClient = await this.db.readData('configClient')

        if (!configClient) {
            await this.db.createData('configClient', {
                account_selected: null,
                instance_select: null,
                java_config: {
                    java_path: null,
                    java_memory: {
                        min: 2,
                        max: 4
                    }
                },
                game_config: {
                    screen_size: {
                        width: 854,
                        height: 480
                    }
                },
                launcher_config: {
                    download_multi: 5,
                    theme: 'auto',
                    closeLauncher: 'close-launcher',
                    intelEnabledMac: true
                }
            })
        }
    }

    createPanels(...panels) {
        let panelsElem = document.querySelector('.panels')
        for (let panel of panels) {
            console.log(`Initializing ${panel.name} Panel...`);
            let div = document.createElement('div');
            div.classList.add('panel', panel.id)
            div.innerHTML = fs.readFileSync(`${__dirname}/panels/${panel.id}.html`, 'utf8');
            panelsElem.appendChild(div);
            new panel().init(this.config);
        }
    }

    async startLauncher() {
        let accounts = await this.db.readAllData('accounts')
        let configClient = await this.db.readData('configClient')
        let account_selected = configClient ? configClient.account_selected : null
        let popupRefresh = new popup();

        if (accounts?.length) {
            for (let account of accounts) {
                let account_ID = account.ID
                if (account.error || !account.name || account.name === 'undefined') {
                    await this.db.deleteData('accounts', account_ID)
                    if (account_ID == account_selected) {
                        configClient.account_selected = null
                        await this.db.updateData('configClient', configClient)
                    }
                    continue
                }
                if (account.meta?.type === 'Xbox') {
                    console.log(`Account Type: ${account.meta.type} | Username: ${account.name}`);
                    popupRefresh.openPopup({
                        title: 'Connexion',
                        content: `Vérification du compte : ${account.name}...`,
                        color: 'var(--color)',
                        background: false
                    });

                    let refresh_accounts = await new Microsoft(this.config.client_id).refresh(account).catch(() => null);

                    if (refresh_accounts && !refresh_accounts.error) {
                        refresh_accounts.ID = account_ID;
                        refresh_accounts.name = refresh_accounts.name || account.name;
                        refresh_accounts.uuid = refresh_accounts.uuid || account.uuid;
                        refresh_accounts.meta = refresh_accounts.meta || account.meta;
                        await this.db.updateData('accounts', refresh_accounts, account_ID);
                    } else {
                        console.warn(`[Account] Refresh warning for ${account.name}, keeping cached session.`);
                    }
                } else if (account.meta?.type == 'AZauth') {
                    console.log(`Account Type: ${account.meta.type} | Username: ${account.name}`);
                    popupRefresh.openPopup({
                        title: 'Connexion',
                        content: `Vérification du compte : ${account.name}...`,
                        color: 'var(--color)',
                        background: false
                    });
                    let refresh_accounts = await new AZauth(this.config.online).verify(account).catch(() => null);

                    if (refresh_accounts && !refresh_accounts.error) {
                        refresh_accounts.ID = account_ID;
                        refresh_accounts.name = refresh_accounts.name || account.name;
                        refresh_accounts.uuid = refresh_accounts.uuid || account.uuid;
                        refresh_accounts.meta = refresh_accounts.meta || account.meta;
                        await this.db.updateData('accounts', refresh_accounts, account_ID);
                    } else {
                        console.warn(`[Account] Refresh warning for ${account.name}, keeping cached session.`);
                    }
                } else if (account.meta?.type == 'Mojang') {
                    console.log(`Account Type: ${account.meta.type} | Username: ${account.name}`);
                    popupRefresh.openPopup({
                        title: 'Connexion',
                        content: `Vérification du compte : ${account.name}...`,
                        color: 'var(--color)',
                        background: false
                    });
                    if (account.meta.online == false) {
                        let refresh_accounts = await Mojang.login(account.name).catch(() => null);
                        if (refresh_accounts) {
                            refresh_accounts.ID = account_ID;
                            refresh_accounts.name = refresh_accounts.name || account.name;
                            refresh_accounts.uuid = refresh_accounts.uuid || account.uuid;
                            refresh_accounts.meta = refresh_accounts.meta || account.meta;
                            await this.db.updateData('accounts', refresh_accounts, account_ID);
                        }
                        continue;
                    }

                    let refresh_accounts = await Mojang.refresh(account).catch(() => null);

                    if (refresh_accounts && !refresh_accounts.error) {
                        refresh_accounts.ID = account_ID;
                        refresh_accounts.name = refresh_accounts.name || account.name;
                        refresh_accounts.uuid = refresh_accounts.uuid || account.uuid;
                        refresh_accounts.meta = refresh_accounts.meta || account.meta;
                        await this.db.updateData('accounts', refresh_accounts, account_ID);
                    } else {
                        console.warn(`[Account] Refresh warning for ${account.name}, keeping cached session.`);
                    }
                } else {
                    console.error(`[Account] ${account.name}: Account Type Not Found`);
                }
            }

            accounts = await this.db.readAllData('accounts')
            configClient = await this.db.readData('configClient')
            account_selected = configClient ? configClient.account_selected : null

            if (!accounts?.length) {
                if (configClient) {
                    configClient.account_selected = null;
                    await this.db.updateData('configClient', configClient);
                }
                popupRefresh.closePopup();
                return changePanel("login");
            }

            let selectedAccount = accounts.find(a => a.ID == account_selected) || accounts[0];
            if (selectedAccount) {
                if (!configClient) {
                    configClient = {
                        account_selected: selectedAccount.ID,
                        instance_select: null,
                        java_config: { java_path: null, java_memory: { min: 2, max: 4 } },
                        game_config: { screen_size: { width: 854, height: 480 } },
                        launcher_config: { download_multi: 5, theme: 'auto', closeLauncher: 'close-launcher', intelEnabledMac: true }
                    };
                } else {
                    configClient.account_selected = selectedAccount.ID;
                }
                await this.db.updateData('configClient', configClient);
                await accountSelect(selectedAccount);
            }

            popupRefresh.closePopup();
            changePanel("home");
        } else {
            popupRefresh.closePopup();
            changePanel('login');
        }
    }
}

new Launcher().init();
