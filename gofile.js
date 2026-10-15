const axios = require('axios');

async function resolveGofile(url) {
    try {
        const contentIdMatch = url.match(/\/d\/([a-zA-Z0-9]+)/);
        if (!contentIdMatch) return null;
        const contentId = contentIdMatch[1];

        // 1. Get Guest Token
        const tokenRes = await axios.post('https://api.gofile.io/accounts', {}, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });
        
        if (tokenRes.data.status !== 'ok') return null;
        const token = tokenRes.data.data.token;

        // 2. Get File Info (we also need the 'wt' parameter in modern GoFile API, or just Authorization header)
        // We'll pass the token as Authorization Bearer
        const infoRes = await axios.get(`https://api.gofile.io/contents/${contentId}?wt=4fd6sg89d7s6`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });

        if (infoRes.data.status !== 'ok') return null;

        const children = infoRes.data.data.children;
        const firstChildKey = Object.keys(children)[0];
        const fileData = children[firstChildKey];

        return fileData.link;
    } catch (err) {
        console.error("Error resolving GoFile:", err.message);
        return null;
    }
}

module.exports = { resolveGofile };
