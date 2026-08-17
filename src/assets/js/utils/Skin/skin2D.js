/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */
const nodeFetch = require('node-fetch')

export class skin2D {
    async creatHeadTexture(data) {
        let image = await getData(data)
        return await new Promise((resolve, reject) => {
            if (image.complete && image.naturalWidth !== 0) {
                try {
                    let cvs = document.createElement('canvas');
                    cvs.width = 8;
                    cvs.height = 8;
                    let ctx = cvs.getContext('2d');
                    ctx.drawImage(image, 8, 8, 8, 8, 0, 0, 8, 8);
                    ctx.drawImage(image, 40, 8, 8, 8, 0, 0, 8, 8);
                    return resolve(cvs.toDataURL());
                } catch (err) {
                    return reject(err);
                }
            }
            image.addEventListener('load', () => {
                try {
                    let cvs = document.createElement('canvas');
                    cvs.width = 8;
                    cvs.height = 8;
                    let ctx = cvs.getContext('2d');
                    ctx.drawImage(image, 8, 8, 8, 8, 0, 0, 8, 8);
                    ctx.drawImage(image, 40, 8, 8, 8, 0, 0, 8, 8);
                    return resolve(cvs.toDataURL());
                } catch (err) {
                    return reject(err);
                }
            });
            image.addEventListener('error', err => reject(err));
        });
    }
}

async function getData(data) {
    if (data.startsWith('http')) {
        let response = await nodeFetch(data);
        let buffer = await response.buffer();
        data = `data:image/png;base64,${await buffer.toString('base64')}`;
    }
    let img = new Image();
    img.src = data;
    return img;
}