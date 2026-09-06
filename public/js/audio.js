// ============ 音频：Web Audio 合成音效 + 深海氛围音景 + 背景音乐 ============
// 零依赖、零素材：短音效用 Web Audio 合成；背景氛围可用合成，也支持用户放入的音频文件。
// 浏览器要求首次用户交互后才能出声，因此用懒加载 + 首次点击解锁。

let ctx = null;          // AudioContext（懒加载）
let masterGain = null;   // 音效总音量
let musicGain = null;    // 音乐/氛围总音量
let ambienceNodes = null;// 氛围音景的节点（start/stop 复用）
let bgAudio = null;      // 背景音乐 <audio>（若有文件）
let unlocked = false;

// ---- 开关状态（存 localStorage，与「显示鱼名」开关一致）----
const MUSIC_KEY = 'wanling.music';
const SFX_KEY = 'wanling.sfx';
function readPref(key) { try { return localStorage.getItem(key) === '1'; } catch { return true; } }
export const prefs = {
  music: readPref(MUSIC_KEY),
  sfx: readPref(SFX_KEY),
};
export function setMusic(v) {
  prefs.music = !!v;
  try { localStorage.setItem(MUSIC_KEY, prefs.music ? '1' : '0'); } catch {}
  applyMusic();
}
export function setSfx(v) {
  prefs.sfx = !!v;
  try { localStorage.setItem(SFX_KEY, prefs.sfx ? '1' : '0'); } catch {}
}

// ---- 懒加载 / 解锁 ----
function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  masterGain = ctx.createGain(); masterGain.gain.value = 0.6; masterGain.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.5; musicGain.connect(ctx.destination);
  return ctx;
}
export function unlock() {
  const c = ensureCtx();
  if (c && c.state === 'suspended') c.resume();
  if (!unlocked) { unlocked = true; applyMusic(); }
}
// 首次用户交互（点击/按键）自动解锁与启动氛围
if (typeof window !== 'undefined') {
  const fire = () => { unlock(); window.removeEventListener('pointerdown', fire); window.removeEventListener('keydown', fire); };
  window.addEventListener('pointerdown', fire);
  window.addEventListener('keydown', fire);
}

// ---- 合成一个渐变包络缓存的振荡器音 ----
function tone({ freq = 440, endFreq = freq, dur = 0.3, type = 'sine', gain = 0.3, attack = 0.01, delay = 0 }) {
  if (!ensureCtx() || !prefs.sfx) return;
  const c = ctx, t0 = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(masterGain);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

// ---- 合成一个短噪声（流水、气泡爆裂等） ----
function noise({ dur = 0.3, gain = 0.2, freq = 800, q = 1, type = 'lowpass', delay = 0 }) {
  if (!ensureCtx() || !prefs.sfx) return;
  const c = ctx, t0 = c.currentTime + delay;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource(); src.buffer = buf;
  const filt = c.createBiquadFilter(); filt.type = type; filt.frequency.value = freq; filt.Q.value = q;
  const g = c.createGain(); g.gain.value = gain;
  src.connect(filt); filt.connect(g); g.connect(masterGain);
  src.start(t0);
}

// ---- 音效表 ----
const SFX = {
  feed()        { tone({ freq: 620, endFreq: 900, dur: 0.12, type: 'sine', gain: 0.12 }); },
  collect()     { tone({ freq: 880, endFreq: 1320, dur: 0.18, type: 'sine', gain: 0.22 }); tone({ freq: 1320, endFreq: 1760, dur: 0.2, type: 'sine', gain: 0.16, delay: 0.05 }); },
  select()      { tone({ freq: 520, endFreq: 640, dur: 0.12, type: 'triangle', gain: 0.14 }); },
  hatch()       { tone({ freq: 300, endFreq: 900, dur: 0.5, type: 'sine', gain: 0.2 }); tone({ freq: 450, endFreq: 1200, dur: 0.5, type: 'triangle', gain: 0.12, delay: 0.08 }); },
  egg()         { tone({ freq: 240, endFreq: 180, dur: 0.3, type: 'sine', gain: 0.18 }); noise({ dur: 0.15, gain: 0.1, freq: 400, type: 'lowpass' }); },
  shock()       { noise({ dur: 0.4, gain: 0.3, freq: 180, type: 'lowpass' }); tone({ freq: 120, endFreq: 60, dur: 0.4, type: 'sine', gain: 0.25 }); },
  thunder()     { noise({ dur: 0.8, gain: 0.28, freq: 120, type: 'lowpass' }); noise({ dur: 0.6, gain: 0.15, freq: 90, type: 'lowpass', delay: 0.1 }); },
  bubble()      { tone({ freq: 350, endFreq: 1200, dur: 0.09, type: 'sine', gain: 0.1 }); },
};
export function playSfx(name) {
  if (!prefs.sfx) return;
  try { SFX[name] && SFX[name](); } catch { /* 忽略 */ }
}

// ---- 深海氛围音景（合成）----
function buildAmbience() {
  const c = ensureCtx();
  if (!c || ambienceNodes) return;
  // 低频水流（滤波白噪声）
  const buf = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { last = last * 0.985 + (Math.random() * 2 - 1) * 0.03; d[i] = last; }
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
  const filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 300;
  const g = c.createGain(); g.gain.value = 0.5;
  src.connect(filt); filt.connect(g); g.connect(musicGain);
  src.start();
  // 周期性微弱气泡上扬
  const bubble = setInterval(() => {
    if (!prefs.music || !ctx || ctx.state !== 'running') return;
    tone({ freq: 200 + Math.random() * 300, endFreq: 900 + Math.random() * 500, dur: 0.3, type: 'sine', gain: 0.05 });
  }, 2600);
  ambienceNodes = { src, g, bubbleSet: bubble, freq: filt };
}
function stopAmbience() {
  if (!ambienceNodes) return;
  try { ambienceNodes.src.stop(); } catch {}
  clearInterval(ambienceNodes.bubbleSet);
  ambienceNodes = null;
}

// ---- 背景音乐：有文件用文件，无则用合成氛围 ----
const BG_SOURCES = ['/audio/music.mp3', '/audio/music.ogg', '/audio/music.wav'];
function tryBgFile() {
  if (bgAudio) return true;
  for (const url of BG_SOURCES) {
    const a = new Audio();
    a.src = url;
    a.loop = true;
    a.volume = 0.6;
    a.addEventListener('canplaythrough', () => { bgAudio = a; }, { once: true });
    a.addEventListener('error', () => { a.removeAttribute('src'); }, { once: true });
    a.load();
    if (a.readyState >= 3) { bgAudio = a; break; }
  }
  return !!bgAudio;
}
function applyMusic() {
  if (!prefs.music) { if (bgAudio) { bgAudio.pause(); } stopAmbience(); return; }
  // 优先文件音乐
  if (bgAudio) { bgAudio.play().catch(() => {}); return; }
  // 无文件则用合成氛围
  buildAmbience();
}
// 探测文件（异步）：拿到就切到文件音乐
tryBgFile();
if (!bgAudio) {
  // 延迟再探测一次，等网络文件 readyState
  setTimeout(() => {
    if (!bgAudio) { bgAudio = tryBgFile(); applyMusic(); }
  }, 1500);
}
