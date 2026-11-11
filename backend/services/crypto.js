const crypto = require('crypto');

function getKey() {
    const k = process.env.ENCRYPTION_KEY;
    if (!k || k.length !== 64) throw new Error('ENCRYPTION_KEY must be 64 hex characters.');
    return Buffer.from(k, 'hex');
}

function encrypt(text) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
    const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

function decrypt(payload) {
    const [iv, tag, enc] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };