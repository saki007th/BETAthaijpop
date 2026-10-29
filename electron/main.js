// ==========================================
// electron/main.js - Desktop App & Discord Rich Presence Bridge
// เชื่อมต่อ Discord Desktop ผ่าน Local IPC Pipe โดยตรง (ไม่ต้องพึ่งแพ็กเกจเสริม)
// รองรับทั้งการฟังในแอปโดยตรง และการเปิดรับคำสั่งจากหน้าเว็บเบราว์เซอร์ (พอร์ต 8787)
// ==========================================
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const net = require('net');
const crypto = require('crypto');

// ค่าเริ่มต้น Application ID (สามารถเปลี่ยนได้จากหน้าเว็บ หรือตั้งผ่านตัวแปรแวดล้อม)
let currentClientId = process.env.DISCORD_CLIENT_ID || '1234567890123456789';
const WEB_PORT = 8080;
const BRIDGE_PORT = 8787;

let mainWindow = null;
let ipcSocket = null;
let isRpcReady = false;
let connectedClientId = null;
let lastActivity = null;
let reconnectTimer = null;

// ==========================================
// 🎧 ระบบเชื่อมต่อ Discord Local IPC โดยตรง (รองรับ type 2 = Listening + ปก YouTube)
// ==========================================
function getDiscordIpcPath(id = 0) {
    if (process.platform === 'win32') {
        return `\\\\?\\pipe\\discord-ipc-${id}`;
    }
    const env = process.env;
    const dir = env.XDG_RUNTIME_DIR || env.TMPDIR || env.TMP || env.TEMP || '/tmp';
    return path.join(dir, `discord-ipc-${id}`);
}

function encodeFrame(op, data) {
    const payload = Buffer.from(JSON.stringify(data), 'utf8');
    const packet = Buffer.alloc(8 + payload.length);
    packet.writeInt32LE(op, 0);
    packet.writeInt32LE(payload.length, 4);
    payload.copy(packet, 8);
    return packet;
}

function connectDiscordIpc(clientId, pipeIndex = 0) {
    if (!clientId || clientId === 'YOUR_CLIENT_ID_HERE' || clientId === '1234567890123456789') {
        return Promise.resolve(false);
    }
    if (ipcSocket && isRpcReady && connectedClientId === clientId) {
        return Promise.resolve(true);
    }
    if (ipcSocket) {
        try { ipcSocket.destroy(); } catch (e) {}
        ipcSocket = null;
        isRpcReady = false;
    }

    return new Promise((resolve) => {
        if (pipeIndex > 9) {
            resolve(false);
            return;
        }

        const socket = net.createConnection(getDiscordIpcPath(pipeIndex));
        let settled = false;

        const onFail = () => {
            if (settled) return;
            settled = true;
            try { socket.destroy(); } catch (e) {}
            resolve(connectDiscordIpc(clientId, pipeIndex + 1));
        };

        socket.once('error', onFail);
        socket.once('close', () => {
            if (ipcSocket === socket) {
                ipcSocket = null;
                isRpcReady = false;
                connectedClientId = null;
            }
        });

        socket.once('connect', () => {
            ipcSocket = socket;
            // OP 0 = HANDSHAKE
            socket.write(encodeFrame(0, { v: 1, client_id: String(clientId) }));
        });

        socket.on('data', (chunk) => {
            if (settled) return;
            try {
                if (chunk.length >= 8) {
                    const op = chunk.readInt32LE(0);
                    const len = chunk.readInt32LE(4);
                    const jsonStr = chunk.slice(8, 8 + len).toString('utf8');
                    const msg = JSON.parse(jsonStr);
                    if (op === 1 && (msg.evt === 'READY' || msg.cmd === 'DISPATCH')) {
                        settled = true;
                        isRpcReady = true;
                        connectedClientId = clientId;
                        resolve(true);
                        if (lastActivity) sendDiscordActivity(lastActivity);
                    } else if (op === 2) {
                        onFail();
                    }
                }
            } catch (e) {}
        });

        setTimeout(() => {
            if (!settled) onFail();
        }, 1500);
    });
}

async function sendDiscordActivity(payload) {
    if (!payload) return false;
    const targetClientId = payload.clientId || currentClientId;
    if (targetClientId) currentClientId = targetClientId;

    lastActivity = payload;
    const connected = await connectDiscordIpc(currentClientId);
    if (!connected || !ipcSocket || !isRpcReady) return false;

    const now = Date.now();
    const elapsedSec = Number(payload.elapsed || (payload.start && payload.start.seconds) || 0);
    const durationSec = Number(payload.duration || (payload.end && payload.end.seconds) || 0);

    const timestamps = {};
    if (elapsedSec >= 0) {
        timestamps.start = Math.floor(now - (elapsedSec * 1000));
        if (durationSec > 0 && durationSec > elapsedSec) {
            timestamps.end = Math.floor(timestamps.start + (durationSec * 1000));
        }
    }

    const activity = {
        type: 2, // 2 = Listening ("กำลังฟัง...")
        details: String(payload.songTitle || payload.state || 'กำลังฟังเพลง').slice(0, 128),
        state: String(payload.artist || payload.details || 'Ultimate JP Mix').slice(0, 128),
        timestamps
    };

    if (payload.thumbUrl) {
        activity.assets = {
            large_image: payload.thumbUrl,
            large_text: String(payload.songTitle || 'Ultimate JP Mix').slice(0, 128)
        };
    }

    if (Array.isArray(payload.buttons) && payload.buttons.length > 0) {
        activity.buttons = payload.buttons.slice(0, 2).map(b => ({
            label: String(b.label || '🎧 ฟังเพลงนี้').slice(0, 32),
            url: String(b.url || '')
        })).filter(b => b.url.startsWith('http'));
    }

    try {
        ipcSocket.write(encodeFrame(1, {
            cmd: 'SET_ACTIVITY',
            args: {
                pid: process.pid,
                activity
            },
            nonce: crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
        }));
        return true;
    } catch (e) {
        isRpcReady = false;
        return false;
    }
}

async function clearDiscordActivity() {
    lastActivity = null;
    if (!ipcSocket || !isRpcReady) return true;
    try {
        ipcSocket.write(encodeFrame(1, {
            cmd: 'SET_ACTIVITY',
            args: {
                pid: process.pid,
                activity: null
            },
            nonce: crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
        }));
        return true;
    } catch (e) {
        return false;
    }
}

// ==========================================
// 🌐 เซิร์ฟเวอร์จำลองสำหรับเปิดหน้าเว็บ + Bridge พอร์ต 8787 (เผื่อเปิดจาก Chrome/Edge)
// ==========================================
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

function startStaticServer() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            let urlPath = decodeURIComponent(req.url.split('?')[0]);
            if (urlPath === '/') urlPath = '/index.html';
            const filePath = path.join(__dirname, '..', urlPath);
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                fs.readFile(filePath, (err, data) => {
                    if (err) { res.writeHead(404); return res.end('Not Found'); }
                    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
                    res.end(data);
                });
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });
        server.listen(WEB_PORT, '127.0.0.1', () => resolve(server));
        server.on('error', () => resolve(null));
    });
}

function startBridgeServer() {
    const server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            return res.end();
        }

        if (req.method === 'GET' && req.url === '/api/discord/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: true, rpcReady: isRpcReady, clientId: currentClientId }));
        }

        if (req.method === 'POST' && req.url === '/api/discord/presence') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const ok = await sendDiscordActivity(data);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok, rpcReady: isRpcReady }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: e.message }));
                }
            });
            return;
        }

        if (req.method === 'POST' && req.url === '/api/discord/clear') {
            clearDiscordActivity().then(() => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            });
            return;
        }

        res.writeHead(404);
        res.end('Not Found');
    });

    server.listen(BRIDGE_PORT, '127.0.0.1', () => {});
    server.on('error', () => {});
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 880,
        title: 'Ultimate JP Mix',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.resolve(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http')) shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.loadURL(`http://127.0.0.1:${WEB_PORT}`);
}

app.whenReady().then(async () => {
    await startStaticServer();
    startBridgeServer();

    ipcMain.handle('discord:update-presence', async (_event, activity) => {
        return await sendDiscordActivity(activity);
    });

    ipcMain.handle('discord:clear-presence', async () => {
        return await clearDiscordActivity();
    });

    ipcMain.handle('discord:get-status', async () => {
        return { isElectron: true, rpcReady: isRpcReady, clientId: currentClientId };
    });

    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    try { if (ipcSocket) ipcSocket.destroy(); } catch (e) {}
});
