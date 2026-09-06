/**
 * 万灵缸 server — 静态文件 + DeepSeek 代理
 * 零依赖，node server.js 即可运行。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');

// ---- 读取 .env（不覆盖已有环境变量）----
(function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const val = m[2].replace(/^["']|["']$/g, '');
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
})();

const PORT = Number(process.env.PORT) || 3000;

// AI 配置：可在运行中通过 /api/config 热更新（同时写回 .env）
const CFG = {
  key: process.env.DEEPSEEK_API_KEY || '',
  url: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/chat/completions',
  model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
};

function writeConfig(patch) {
  const envPath = path.join(ROOT, '.env');
  let lines;
  if (fs.existsSync(envPath)) {
    lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  } else {
    lines = ['DEEPSEEK_API_KEY=', 'DEEPSEEK_BASE_URL=https://api.deepseek.com/chat/completions', 'DEEPSEEK_MODEL=deepseek-chat', 'PORT=3000'];
  }
  const setLine = (key, val) => {
    const re = new RegExp('^' + key + '=.*$');
    const idx = lines.findIndex((l) => re.test(l));
    const line = key + '=' + val;
    if (idx >= 0) lines[idx] = line; else lines.push(line);
  };
  if ('apiKey' in patch) setLine('DEEPSEEK_API_KEY', patch.apiKey);
  if ('baseUrl' in patch) setLine('DEEPSEEK_BASE_URL', patch.baseUrl);
  if ('model' in patch) setLine('DEEPSEEK_MODEL', patch.model);
  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
}

// 密钥真实验证：向上游发一个 1 token 的最小对话请求，密钥真实可用才算数（60s 缓存；401 立即拉黑）
let verifyCache = { ok: false, at: 0 };

async function verifyKey() {
  if (!CFG.key) return false;
  if (Date.now() - verifyCache.at < 60000) return verifyCache.ok;
  try {
    const r = await fetch(CFG.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CFG.key}` },
      body: JSON.stringify({ model: CFG.model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
      signal: AbortSignal.timeout(10000),
    });
    verifyCache = { ok: r.ok, at: Date.now() };
  } catch {
    verifyCache = { ok: false, at: Date.now() };
  }
  return verifyCache.ok;
}

function configView() {
  return {
    hasKey: Boolean(CFG.key),
    keyTail: CFG.key ? CFG.key.slice(-4) : '',
    baseUrl: CFG.url,
    model: CFG.model,
  };
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req, limit = 512 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ---- DeepSeek 转发 ----
async function callDeepSeek(system, messages, temperature = 1.1, maxTokens = 500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const r = await fetch(CFG.url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CFG.key}`,
      },
      body: JSON.stringify({
        model: CFG.model,
        messages: [{ role: 'system', content: system }, ...messages],
        temperature,
        max_tokens: maxTokens,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401) { verifyCache = { ok: false, at: Date.now() }; } // 密钥无效：石板熄灭
      const msg = data.error?.message || `上游返回 ${r.status}`;
      throw new Error(msg);
    }
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) throw new Error('上游返回为空');
    return reply;
  } finally {
    clearTimeout(timer);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // AI 状态探测：密钥真实可用（上游接口验证通过）才算「已接入」
  if (req.method === 'GET' && url.pathname === '/api/status') {
    const hasKey = Boolean(CFG.key);
    const ai = hasKey ? await verifyKey() : false;
    return send(res, 200, JSON.stringify({ ai, hasKey, model: CFG.model }));
  }

  // 读取 AI 配置（key 只回传尾号，永不回传全文）
  if (req.method === 'GET' && url.pathname === '/api/config') {
    return send(res, 200, JSON.stringify(configView()));
  }

  // 修改 AI 配置：即时生效并写回 .env
  if (req.method === 'POST' && url.pathname === '/api/config') {
    try {
      const body = JSON.parse(await readBody(req));
      const patch = {};
      if (typeof body.apiKey === 'string') {
        patch.apiKey = body.apiKey.trim();
        CFG.key = patch.apiKey;
      }
      if (typeof body.baseUrl === 'string' && /^https?:\/\/.+/.test(body.baseUrl.trim())) {
        patch.baseUrl = body.baseUrl.trim();
        CFG.url = patch.baseUrl;
      }
      if (typeof body.model === 'string' && body.model.trim()) {
        patch.model = body.model.trim();
        CFG.model = patch.model;
      }
      if (Object.keys(patch).length) {
        writeConfig(patch);
        verifyCache.at = 0; // 密语变了，立刻重新验证
      }
      return send(res, 200, JSON.stringify({ ok: true, ...configView() }));
    } catch (err) {
      return send(res, 400, JSON.stringify({ error: err.message || '配置保存失败' }));
    }
  }

  // 聊天/生成档案的统一入口
  if (req.method === 'POST' && url.pathname === '/api/chat') {
    if (!CFG.key) {
      return send(res, 503, JSON.stringify({ error: 'AI 未接入：请把 DeepSeek key 填进 .env 后重启服务' }));
    }
    try {
      const body = JSON.parse(await readBody(req));
      const { system, messages = [], temperature, maxTokens } = body;
      if (!system || !Array.isArray(messages)) {
        return send(res, 400, JSON.stringify({ error: '缺少 system 或 messages' }));
      }
      const reply = await callDeepSeek(system, messages, temperature, maxTokens);
      return send(res, 200, JSON.stringify({ reply }));
    } catch (err) {
      const msg = err.name === 'AbortError' ? 'AI 请求超时' : (err.message || 'AI 请求失败');
      return send(res, 502, JSON.stringify({ error: msg }));
    }
  }

  // 静态文件
  if (req.method === 'GET') {
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, 'forbidden', 'text/plain');
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, 'not found', 'text/plain');
      send(res, 200, data, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
    });
    return;
  }

  send(res, 405, 'method not allowed', 'text/plain');
});

server.listen(PORT, () => {
  console.log(`\n  🌊 万灵缸已注入海水: http://localhost:${PORT}`);
  console.log(`  AI: ${CFG.key ? `已接入 (${CFG.model})` : '未接入 — 可在页面右上角 ⚙️ 里直接配置，或把 key 填进 .env 后重启'}\n`);
});
