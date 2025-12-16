import chalk from 'chalk';
import express from 'express';
import fs from 'fs';
import pino from 'pino';
import path from 'path';
import { fileURLToPath } from 'url';

import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    Browsers,
    delay
} from '@whiskeysockets/baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

global.fake= {
  key: {
    remoteJid: '0@s.whatsapp.net',
    fromMe: false,
    participant: '0@s.whatsapp.net'
  },
  message: {
    extendedTextMessage: {
      text: `🇳🇬:𝗚𝗜𝗙𝗧_𝗠𝗗:🇳🇬`
    }}};

function makeid(length = 10) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

async function sendWelcomeMessage(sock) {
    await delay(7000);
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    try {
        await sock.sendMessage(botNumber, {
            text: `🚀 *GIFT X* Setup Instructions:

- 1️⃣ Copy the session code below
- 2️⃣ Go to your hosting platform 
- 3️⃣ Add environment variable: SESSION_ID
- 4️⃣ Paste the session code as value
- 5️⃣ Deploy your bot and enjoy!`,
        },{quoted:global.fake});
        await delay(500);
        await sock.sendMessage(botNumber, {
            text: `${global.ses}`,
        },{quoted:global.fake});

        console.log(chalk.green('[GIFT-MD] ✅ Startup message sent to User!'));

      try {
    await sock.groupAcceptInvite('BKp9LSJ1kQJH9Hei1fUrOn');
    console.log(chalk.blue('✅ auto-follow WhatsApp group successful'));
} catch (e) {
    console.log(chalk.red(`🚫 Failed to join WhatsApp group: ${e}`));
}

    } catch (error) {
        console.error(chalk.yellow('[GIFT-MD] ⚠️ Could not send startup message:'), error.message);
    }
}
                                                                    
function removeFile(filePath) {
    if (!fs.existsSync(filePath)) return false;
    fs.rmSync(filePath, { recursive: true, force: true });
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/pair', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pair.html'));
});

app.get('/code', async (req, res) => {
    const id = makeid();
    let num = req.query.number;

    console.log(`[GIFT-MD] 📱 Pairing request | ID: ${id} | Number: ${num}`);

    if (!num || num.length < 10) {
        return res.status(400).json({ error: 'Invalid number' });
    }

    async function GIFT_MD_PAIR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        
        try {
            let sock = makeWASocket({
                version: [2, 3000, 1027934701],
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
                },
                printQRInTerminal: false,
                logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
                browser: Browsers.windows('Edge'),
            });

            if (!sock.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                
                const code = await sock.requestPairingCode(num);
                console.log(`[GIFT-MD] ✅ Code: ${code}`);
                
                if (!code || code.length < 6) {
                    await removeFile('./temp/' + id);
                    if (!res.headersSent) {
                        return res.status(500).json({ error: 'Failed' });
                    }
                    return;
                }
                
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            sock.ev.on('creds.update', saveCreds);
            
            sock.ev.on('connection.update', async (s) => {
                const { connection, lastDisconnect } = s;
                
                if (connection === 'open') {
            
                    console.log(`[GIFT-MD] 🎉 Connected | ${id}`);
                    
                    await delay(3000);
                    
                    try {
                        const credsPath = path.join(__dirname, 'temp', id, 'creds.json');
                        
                        if (!fs.existsSync(credsPath)) {
                            console.log('[GIFT-MD] ❌ No creds');
                            return;
                        }
                        
                        let data = fs.readFileSync(credsPath);
                        let b64data = Buffer.from(data).toString('base64');
                        const sessionString = 'GIFT-X:~' + b64data;
        
                        global.ses = sessionString;
                        
                        await delay(1000);
                        
                        await sendWelcomeMessage(sock);
                        
                        console.log(`[GIFT-MD] 📝 Session: ${sessionString.length} chars`);
                        
                        await delay(5000);
                        
                        try {
                            await sock.ws.close();
                            await delay(2000);
                        } catch (e) {}
                        
                        try {
                            await removeFile('./temp/' + id);
                        } catch (e) {}
                        
                        console.log('[GIFT-MD] 🎉 Done!');
                        
                    } catch (err) {
                        console.log('[GIFT-MD] ❌ Error:', err.message);
                    }
                    
                } else if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    
                    if (statusCode === 401 || statusCode === 428) {
                        console.log('[GIFT-MD] ✅ Normal close');
                    } 
                    else if (statusCode && ![DisconnectReason.loggedOut].includes(statusCode)) {
                        await delay(10000);
                        GIFT_MD_PAIR_CODE();
                    } else {
                        try { await removeFile('./temp/' + id); } catch (e) {}
                    }
                }
            });
            
        } catch (err) {
            console.log('[GIFT-MD] ❌ Error:', err.message);
            await removeFile('./temp/' + id);
            if (!res.headersSent) {
                await res.send({ code: 'Unavailable' });
            }
        }
    }

    return await GIFT_MD_PAIR_CODE();
});

app.get('/health', (req, res) => {
    res.json({ status: 'online' });
});

app.use((req, res) => {
    res.status(404).send('404');
});

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════╗
║   🎁 GIFT MD PAIRING SITE      ║
║   ONLINE ✅ Port: ${PORT}
╚════════════════════════════════╝
    `);
});
