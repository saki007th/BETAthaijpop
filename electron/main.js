// ==========================================
// electron/main.js - Discord Rich Presence Bridge
// โหลดหน้าเว็บจาก GitHub Pages (อัปเดตเว็บเมื่อไหร่ แอปเห็นทันที)
// Bridge พอร์ต 8787 สำหรับเว็บเบราว์เซอร์ที่อยากส่งสถานะให้ Discord
// ==========================================
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const http = require('http');
const net = require('net');
const crypto = require('crypto');

// URL ของเว็บ (แก้จาก GitHub Pages หรือ set env WEB_URL)
const WEB_URL = process.env.WEB_URL || 'https://saki007th.github.io/BETAthaijpop/';
const BRIDGE_PORT = 8787;

let mainWindow = null;
let ipcSocket = null;
let isRpcReady = false;
let connectedClientId = null;
let lastActivity = null;

// ==========================================
// 🎧 ระบบเชื่อมต่อ Discord Local IPC โดยตรง
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
        if (pipeIndex > 9) { resolve(false); return; }

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
            if (ipcSocket === socket) { ipcSocket = null; isRpcReady = false; connectedClientId = null; }
        });
        socket.once('connect', () => {
            ipcSocket = socket;
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
                    } else if (op === 2) { onFail(); }
                }
            } catch (e) {}
        });
        setTimeout(() => { if (!settled) onFail(); }, 1500);
    });
}

async function sendDiscordActivity(payload) {
    if (!payload) return false;
    const targetClientId = payload.clientId || process.env.DISCORD_CLIENT_ID || '1234567890123456789';
    lastActivity = payload;
    const connected = await connectDiscordIpc(targetClientId);
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
        type: 2,
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
            cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity },
            nonce: crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
        }));
        return true;
    } catch (e) { isRpcReady = false; return false; }
}

async function clearDiscordActivity() {
    lastActivity = null;
    if (!ipcSocket || !isRpcReady) return true;
    try {
        ipcSocket.write(encodeFrame(1, {
            cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: null },
            nonce: crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
        }));
        return true;
    } catch (e) { return false; }
}

// ==========================================
// 🌐 Bridge Server พอร์ต 8787 (สำหรับเว็บเบราว์เซอร์ที่อยากส่งสถานะให้ Discord)
// ==========================================
function startBridgeServer() {
    const server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }

        if (req.method === 'GET' && req.url === '/api/discord/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: true, rpcReady: isRpcReady }));
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
        res.writeHead(404); res.end('Not Found');
    });
    server.listen(BRIDGE_PORT, '127.0.0.1', () => console.log(`Bridge ready on :${BRIDGE_PORT}`));
    server.on('error', (e) => console.warn('Bridge port in use:', e.message));
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440, height: 880,
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
    mainWindow.loadURL(WEB_URL);
}

app.whenReady().then(async () => {
    startBridgeServer();

    ipcMain.handle('discord:update-presence', async (_event, activity) => await sendDiscordActivity(activity));
    ipcMain.handle('discord:clear-presence', async () => await clearDiscordActivity());
    ipcMain.handle('discord:get-status', async () => ({ isElectron: true, rpcReady: isRpcReady }));

    createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('will-quit', () => { try { if (ipcSocket) ipcSocket.destroy(); } catch (e) {} });
