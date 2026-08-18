/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const pkg = require('../package.json');
const nodeFetch = require("node-fetch");
const convert = require('xml-js');
let url = pkg.user ? `${pkg.url}/${pkg.user}` : pkg.url

let config = `${url}/config`;
let articles = `${url}/articles`;

class Config {
    GetConfig() {
        return new Promise((resolve, reject) => {
            nodeFetch(config).then(async config => {
                if (config.status === 200) return resolve(config.json());
                else return reject({ error: { code: config.statusText, message: 'server not accessible' } });
            }).catch(error => {
                return reject({ error });
            })
        })
    }

    async getInstanceList() {
        let urlInstance = `${url}/instances`
        let instances = await nodeFetch(urlInstance).then(res => res.json()).catch(err => err)
        let instancesList = []
        instances = Object.entries(instances)

        for (let [name, data] of instances) {
            let instance = data
            instancesList.push(instance)
        }
        return instancesList
    }

    async getNews(config) {
        if (config && config.rss) {
            return new Promise((resolve, reject) => {
                nodeFetch(config.rss).then(async config => {
                    if (config.status === 200) {
                        let news = [];
                        let response = await config.text()
                        response = (JSON.parse(convert.xml2json(response, { compact: true })))?.rss?.channel?.item;

                        if (!Array.isArray(response)) response = [response];
                        for (let item of response) {
                            news.push({
                                title: item.title._text,
                                content: item['content:encoded']._text,
                                author: item['dc:creator']._text,
                                publish_date: item.pubDate._text
                            })
                        }
                        return resolve(news);
                    }
                    else return reject({ error: { code: config.statusText, message: 'server not accessible' } });
                }).catch(error => reject({ error }))
            })
        } else {
            return new Promise((resolve, reject) => {
                nodeFetch(articles).then(async config => {
                    if (config.status === 200) return resolve(config.json());
                    else return reject({ error: { code: config.statusText, message: 'server not accessible' } });
                }).catch(error => {
                    return reject({ error });
                })
            })
        }
    }

    async getWhitelist() {
        let whitelistPhpUrl = 'https://destinevent.alwaysdata.net/launcher/whitelist-launcher/whitelist.php';
        let whitelistJsonUrl = 'https://destinevent.alwaysdata.net/launcher/whitelist-launcher/whitelist.json';
        try {
            let res = await nodeFetch(whitelistPhpUrl, { timeout: 4000 });
            if (res.status === 200) {
                return await res.json();
            }
        } catch (e) {}

        try {
            let resJson = await nodeFetch(whitelistJsonUrl, { timeout: 4000 });
            if (resJson.status === 200) {
                return await resJson.json();
            }
        } catch (e) {}

        return null;
    }

    async updateWhitelist(data) {
        let whitelistPhpUrl = 'https://destinevent.alwaysdata.net/launcher/whitelist-launcher/whitelist.php';
        try {
            let res = await nodeFetch(whitelistPhpUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                timeout: 5000
            });
            if (res.status === 200) {
                let json = await res.json();
                return json?.data || json;
            }
        } catch (e) {}
        return null;
    }
}

export default new Config;