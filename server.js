const express = require('express');
const http = require('http'); // 改為 http，不用 https
const WebSocket = require('ws');
const QRCode = require('qrcode');
const os = require('os');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const pairMap = {}; // code → screen ws

app.use(express.static('public'));

// 取得伺服器外部 IP（可顯示給 client）
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

// 主頁顯示 QRCode 和配對按鈕
app.get('/', async (req, res) => {
  const pairCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const ip = getLocalIP();
  const controllerUrl = `https://${req.headers.host}/name.html?code=${pairCode}`;
  const qr = await QRCode.toDataURL(controllerUrl);
  res.send(`
    <html><body style="text-align:center;font-family:sans-serif;margin-top:50px;">
      <h2>請掃描開始遊戲</h2>
      <p>配對碼：<b>${pairCode}</b></p>
      <img src="${qr}" width="250" />
      <br><br>
      <button onclick="location.href='screen.html?code=${pairCode}'">我是螢幕端</button>
      <script>
        localStorage.setItem('pairCode', '${pairCode}');
        localStorage.setItem('pairIP', '${ip}');
      </script>
    </body></html>
  `);
});

// WebSocket 控制轉發
wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch { return; }

    if (data.type === 'register' && data.role === 'screen') {
      pairMap[data.code] = ws;
    }

    if (data.type === 'control') {
      const screen = pairMap[data.code];
      if (screen) screen.send(JSON.stringify(data));
    }
  });

  ws.on('close', () => {
    // 可選加：清理對應的 code
  });
});

// 用環境變數指定 port（Railway / Render 會設定 process.env.PORT）
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ 伺服器啟動在 http://localhost:${PORT}`);
});