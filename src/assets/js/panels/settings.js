/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

import { changePanel, accountSelect, addAccount, database, Slider, config, setStatus, popup, appdata, setBackground } from '../utils.js'
const { ipcRenderer } = require('electron');
const os = require('os');

class Settings {
    static id = "settings";
    async init(config) {
        this.config = config;
        this.db = new database();
        window.settingsInstance = this;
        this.navBTN();
        this.accounts();
        await this.loadAccounts();
        this.ram();
        this.javaPath();
        this.resolution();
        this.launcher();
    }

    async loadAccounts() {
        let accountsList = document.querySelector('.accounts-list');
        if (!accountsList) return;
        accountsList.innerHTML = '';
        let accounts = await this.db.readAllData('accounts');
        let configClient = await this.db.readData('configClient');
        let selectedId = configClient ? configClient.account_selected : null;

        if (Array.isArray(accounts)) {
            let seenKeys = new Set();
            for (let acc of accounts) {
                let key = `${acc?.name}_${acc?.uuid || acc?.ID}`;
                if (acc && acc.name && acc.name !== 'undefined' && !seenKeys.has(key)) {
                    seenKeys.add(key);
                    await addAccount(acc);
                } else if (acc) {
                    await this.db.deleteData('accounts', acc.ID);
                }
            }
        }

        if (selectedId) {
            let activeElem = document.getElementById(`${selectedId}`);
            if (activeElem) activeElem.classList.add('account-select');
        }
    }

    navBTN() {
        document.querySelector('.nav-box').addEventListener('click', e => {
            if (e.target.classList.contains('nav-settings-btn')) {
                let id = e.target.id

                let activeSettingsBTN = document.querySelector('.active-settings-BTN')
                let activeContainerSettings = document.querySelector('.active-container-settings')

                if (id == 'save') {
                    if (activeSettingsBTN) activeSettingsBTN.classList.toggle('active-settings-BTN');
                    document.querySelector('#account').classList.add('active-settings-BTN');

                    if (activeContainerSettings) activeContainerSettings.classList.toggle('active-container-settings');
                    document.querySelector(`#account-tab`).classList.add('active-container-settings');
                    return changePanel('home')
                }

                if (activeSettingsBTN) activeSettingsBTN.classList.toggle('active-settings-BTN');
                e.target.classList.add('active-settings-BTN');

                if (activeContainerSettings) activeContainerSettings.classList.toggle('active-container-settings');
                document.querySelector(`#${id}-tab`).classList.add('active-container-settings');
            }
        })
    }

    accounts() {
        document.querySelector('.accounts-list').addEventListener('click', async e => {
            let popupAccount = new popup();
            try {
                let deleteBtn = e.target.closest('.delete-profile');
                let accountElem = e.target.closest('.account');

                if (deleteBtn) {
                    let id = parseInt(deleteBtn.dataset.id || deleteBtn.id || (accountElem ? accountElem.id : null));
                    popupAccount.openPopup({
                        title: 'Déconnexion',
                        content: 'Suppression du compte...',
                        color: 'var(--color)'
                    });

                    await this.db.deleteData('accounts', id);

                    let allAccounts = await this.db.readAllData('accounts');
                    let configClient = await this.db.readData('configClient');

                    if (!allAccounts || allAccounts.length === 0) {
                        if (configClient) {
                            configClient.account_selected = null;
                            await this.db.updateData('configClient', configClient);
                        }
                        await this.loadAccounts();
                        return changePanel('login');
                    }

                    if (configClient && (configClient.account_selected == id || !configClient.account_selected)) {
                        configClient.account_selected = allAccounts[0].ID;
                        await accountSelect(allAccounts[0]);
                        let updatedConfig = await this.setInstance(allAccounts[0]);
                        if (updatedConfig) {
                            updatedConfig.account_selected = allAccounts[0].ID;
                            await this.db.updateData('configClient', updatedConfig);
                        }
                    }
                    await this.loadAccounts();
                    return;
                }

                if (accountElem) {
                    let id = parseInt(accountElem.id);
                    if (accountElem.classList.contains('add')) return;

                    popupAccount.openPopup({
                        title: 'Connexion',
                        content: 'Veuillez patienter...',
                        color: 'var(--color)'
                    });

                    let account = await this.db.readData('accounts', id);
                    if (account) {
                        let updatedConfig = await this.setInstance(account);
                        await accountSelect(account);
                        if (updatedConfig) {
                            updatedConfig.account_selected = account.ID;
                            await this.db.updateData('configClient', updatedConfig);
                        }
                        await this.loadAccounts();
                    }
                }
            } catch (err) {
                console.error('Error handling account action:', err);
            } finally {
                popupAccount.closePopup();
            }
        });
    }

    async setInstance(auth) {
        let configClient = await this.db.readData('configClient');
        if (!configClient) {
            configClient = {
                account_selected: null,
                instance_select: null,
                java_config: { java_path: null, java_memory: { min: 2, max: 4 } },
                game_config: { screen_size: { width: 854, height: 480 } },
                launcher_config: { download_multi: 5, theme: 'auto', closeLauncher: 'close-launcher', intelEnabledMac: true }
            };
        }
        let instanceSelect = configClient.instance_select;
        let instancesList = await config.getInstanceList().catch(() => []);

        if (Array.isArray(instancesList) && auth?.name) {
            for (let instance of instancesList) {
                if (instance.whitelistActive) {
                    let whitelist = instance.whitelist ? instance.whitelist.find(w => w == auth.name) : null;
                    if (whitelist !== auth.name) {
                        if (instance.name == instanceSelect) {
                            let newInstanceSelect = instancesList.find(i => i.whitelistActive == false) || instancesList[0];
                            if (newInstanceSelect) {
                                configClient.instance_select = newInstanceSelect.name;
                                await setStatus(newInstanceSelect.status);
                            }
                        }
                    }
                }
            }
        }
        return configClient;
    }

    async ram() {
        let config = await this.db.readData('configClient');
        let totalMem = Math.trunc(os.totalmem() / 1073741824 * 10) / 10;
        let freeMem = Math.trunc(os.freemem() / 1073741824 * 10) / 10;

        document.getElementById("total-ram").textContent = `${totalMem} Go`;
        document.getElementById("free-ram").textContent = `${freeMem} Go`;

        let sliderDiv = document.querySelector(".memory-slider");
        sliderDiv.setAttribute("max", Math.trunc((80 * totalMem) / 100));

        let ram = config?.java_config?.java_memory ? {
            ramMin: config.java_config.java_memory.min,
            ramMax: config.java_config.java_memory.max
        } : { ramMin: "1", ramMax: "2" };

        if (totalMem < ram.ramMin) {
            config.java_config.java_memory = { min: 1, max: 2 };
            this.db.updateData('configClient', config);
            ram = { ramMin: "1", ramMax: "2" }
        };

        let slider = new Slider(".memory-slider", parseFloat(ram.ramMin), parseFloat(ram.ramMax));

        let minSpan = document.querySelector(".slider-touch-left span");
        let maxSpan = document.querySelector(".slider-touch-right span");

        minSpan.setAttribute("value", `${ram.ramMin} Go`);
        maxSpan.setAttribute("value", `${ram.ramMax} Go`);

        slider.on("change", async (min, max) => {
            let config = await this.db.readData('configClient');
            minSpan.setAttribute("value", `${min} Go`);
            maxSpan.setAttribute("value", `${max} Go`);
            config.java_config.java_memory = { min: min, max: max };
            this.db.updateData('configClient', config);
        });
    }

    async javaPath() {
        let javaPathText = document.querySelector(".java-path-txt")
        javaPathText.textContent = `${await appdata()}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}/runtime`;

        let configClient = await this.db.readData('configClient')
        let javaPath = configClient?.java_config?.java_path || 'Utiliser la version de java livre avec le launcher';
        let javaPathInputTxt = document.querySelector(".java-path-input-text");
        let javaPathInputFile = document.querySelector(".java-path-input-file");
        javaPathInputTxt.value = javaPath;

        document.querySelector(".java-path-set").addEventListener("click", async () => {
            javaPathInputFile.value = '';
            javaPathInputFile.click();
            await new Promise((resolve) => {
                let interval;
                interval = setInterval(() => {
                    if (javaPathInputFile.value != '') resolve(clearInterval(interval));
                }, 100);
            });

            if (javaPathInputFile.value.replace(".exe", '').endsWith("java") || javaPathInputFile.value.replace(".exe", '').endsWith("javaw")) {
                let configClient = await this.db.readData('configClient')
                let file = javaPathInputFile.files[0].path;
                javaPathInputTxt.value = file;
                configClient.java_config.java_path = file
                await this.db.updateData('configClient', configClient);
            } else alert("Le nom du fichier doit être java ou javaw");
        });

        document.querySelector(".java-path-reset").addEventListener("click", async () => {
            let configClient = await this.db.readData('configClient')
            javaPathInputTxt.value = 'Utiliser la version de java livre avec le launcher';
            configClient.java_config.java_path = null
            await this.db.updateData('configClient', configClient);
        });
    }

    async resolution() {
        let configClient = await this.db.readData('configClient')
        let resolution = configClient?.game_config?.screen_size || { width: 1920, height: 1080 };

        let width = document.querySelector(".width-size");
        let height = document.querySelector(".height-size");
        let resolutionReset = document.querySelector(".size-reset");

        width.value = resolution.width;
        height.value = resolution.height;

        width.addEventListener("change", async () => {
            let configClient = await this.db.readData('configClient')
            configClient.game_config.screen_size.width = width.value;
            await this.db.updateData('configClient', configClient);
        })

        height.addEventListener("change", async () => {
            let configClient = await this.db.readData('configClient')
            configClient.game_config.screen_size.height = height.value;
            await this.db.updateData('configClient', configClient);
        })

        resolutionReset.addEventListener("click", async () => {
            let configClient = await this.db.readData('configClient')
            configClient.game_config.screen_size = { width: '854', height: '480' };
            width.value = '854';
            height.value = '480';
            await this.db.updateData('configClient', configClient);
        })
    }

    async launcher() {
        let configClient = await this.db.readData('configClient');

        let maxDownloadFiles = configClient?.launcher_config?.download_multi || 5;
        let maxDownloadFilesInput = document.querySelector(".max-files");
        let maxDownloadFilesReset = document.querySelector(".max-files-reset");
        maxDownloadFilesInput.value = maxDownloadFiles;

        maxDownloadFilesInput.addEventListener("change", async () => {
            let configClient = await this.db.readData('configClient')
            configClient.launcher_config.download_multi = maxDownloadFilesInput.value;
            await this.db.updateData('configClient', configClient);
        })

        maxDownloadFilesReset.addEventListener("click", async () => {
            let configClient = await this.db.readData('configClient')
            maxDownloadFilesInput.value = 5
            configClient.launcher_config.download_multi = 5;
            await this.db.updateData('configClient', configClient);
        })

        let themeBox = document.querySelector(".theme-box");
        let theme = configClient?.launcher_config?.theme || "auto";

        if (theme == "auto") {
            document.querySelector('.theme-btn-auto').classList.add('active-theme');
        } else if (theme == "dark") {
            document.querySelector('.theme-btn-sombre').classList.add('active-theme');
        } else if (theme == "light") {
            document.querySelector('.theme-btn-clair').classList.add('active-theme');
        }

        themeBox.addEventListener("click", async e => {
            if (e.target.classList.contains('theme-btn')) {
                let activeTheme = document.querySelector('.active-theme');
                if (e.target.classList.contains('active-theme')) return
                activeTheme?.classList.remove('active-theme');

                if (e.target.classList.contains('theme-btn-auto')) {
                    setBackground();
                    theme = "auto";
                    e.target.classList.add('active-theme');
                } else if (e.target.classList.contains('theme-btn-sombre')) {
                    setBackground(true);
                    theme = "dark";
                    e.target.classList.add('active-theme');
                } else if (e.target.classList.contains('theme-btn-clair')) {
                    setBackground(false);
                    theme = "light";
                    e.target.classList.add('active-theme');
                }

                let configClient = await this.db.readData('configClient')
                configClient.launcher_config.theme = theme;
                await this.db.updateData('configClient', configClient);
            }
        })

        let closeBox = document.querySelector(".close-box");
        let closeLauncher = configClient?.launcher_config?.closeLauncher || "close-launcher";

        if (closeLauncher == "close-launcher") {
            document.querySelector('.close-launcher').classList.add('active-close');
        } else if (closeLauncher == "close-all") {
            document.querySelector('.close-all').classList.add('active-close');
        } else if (closeLauncher == "close-none") {
            document.querySelector('.close-none').classList.add('active-close');
        }

        closeBox.addEventListener("click", async e => {
            if (e.target.classList.contains('close-btn')) {
                let activeClose = document.querySelector('.active-close');
                if (e.target.classList.contains('active-close')) return
                activeClose?.classList.toggle('active-close');

                let configClient = await this.db.readData('configClient')

                if (e.target.classList.contains('close-launcher')) {
                    e.target.classList.toggle('active-close');
                    configClient.launcher_config.closeLauncher = "close-launcher";
                    await this.db.updateData('configClient', configClient);
                } else if (e.target.classList.contains('close-all')) {
                    e.target.classList.toggle('active-close');
                    configClient.launcher_config.closeLauncher = "close-all";
                    await this.db.updateData('configClient', configClient);
                } else if (e.target.classList.contains('close-none')) {
                    e.target.classList.toggle('active-close');
                    configClient.launcher_config.closeLauncher = "close-none";
                    await this.db.updateData('configClient', configClient);
                }
            }
        })
    }
}
export default Settings;