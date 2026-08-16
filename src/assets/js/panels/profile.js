/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */
import { changePanel, database, config, skin2D, setStatus } from '../utils.js'

class Profile {
    static id = "profile";

    async init(configData) {
        this.config = configData;
        this.db = new database();

        this.initNav();
        this.loadProfile();
    }

    initNav() {
        let navHome = document.querySelector('#profile-nav-home');
        if (navHome) {
            navHome.addEventListener('click', () => changePanel('home'));
        }

        let settingsBtn = document.querySelector('.profile-settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => changePanel('settings'));
        }
    }

    async loadProfile() {
        try {
            let configClient = await this.db.readData('configClient');
            if (configClient?.account_selected) {
                let auth = await this.db.readData('accounts', configClient.account_selected);
                if (auth) {
                    // Update pseudo
                    let pseudoDisplay = document.querySelector('.profile-pseudo-display');
                    if (pseudoDisplay) pseudoDisplay.textContent = auth.name || 'GimoveTTv';

                    // Update avatar head
                    if (auth?.profile?.skins[0]?.base64) {
                        let skin = await new skin2D().creatHeadTexture(auth.profile.skins[0].base64);
                        let headElem = document.querySelector('.profile-player-head');
                        if (headElem) headElem.style.backgroundImage = `url(${skin})`;
                    }

                    // Check server access whitelist status
                    let instancesList = await config.getInstanceList().catch(() => []);
                    let instanceSelect = configClient?.instance_select;
                    let isAuthorized = true;

                    for (let instance of instancesList) {
                        if (instance.whitelistActive) {
                            let whitelist = instance.whitelist.find(w => w == auth.name);
                            if (whitelist !== auth.name) {
                                isAuthorized = false;
                            }
                        }
                    }

                    let accessTextElem = document.querySelector('.access-status-text-profile');
                    if (accessTextElem) {
                        if (isAuthorized) {
                            accessTextElem.textContent = 'Autorisé';
                            accessTextElem.className = 'stat-value text-green access-status-text-profile';
                        } else {
                            accessTextElem.textContent = 'En attente';
                            accessTextElem.className = 'stat-value text-yellow access-status-text-profile';
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Error loading profile page data:', err);
        }
    }
}

export default Profile;
