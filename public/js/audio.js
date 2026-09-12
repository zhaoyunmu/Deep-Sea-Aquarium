// ============ 音频：Web Audio 合成音效 + 深海氛围音景 + 背景音乐 ============
// 零依赖、零素材：短音效用 Web Audio 合成；背景氛围可用合成，也支持用户放入的音频文件。
// 浏览器要求首次用户交互后才能出声，因此用懒加载 + 首次点击解锁。

let ctx = null;          // AudioContext（懒加载）
let masterGain = null;   // 音效总音量
let musicGain = null;    // 音乐/氛围总音量
let ambienceNodes = null;// 氛围音景的节点（start/stop 复用）
let bgAudio = null;      // 背景音乐 <audio>（若有文件）
let boxAudio = null;     // 音乐盒 <audio>（盒子在海里时接管音乐）
let activeBox = null;    // 正在奏乐的盒子曲目 { name, src, cover } | null
let unlocked = false;

// ---- 开关状态（存 localStorage，与「显示鱼名」开关一致）----
const MUSIC_KEY = 'wanling.music';
const SFX_KEY = 'wanling.sfx';
const MUSIC_VOL_KEY = 'wanling.musicVol';
function readPref(key, def = true) { try { const v = localStorage.getItem(key); return v === null ? def : v; } catch { return def; } }
export const prefs = {
  music: readPref(MUSIC_KEY) !== '0',
  sfx: readPref(SFX_KEY) !== '0',
  musicVolume: parseFloat(readPref(MUSIC_VOL_KEY, '0.7')) || 0.7,
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
export function setMusicVolume(v) {
  prefs.musicVolume = clamp01(v);
  try { localStorage.setItem(MUSIC_VOL_KEY, String(prefs.musicVolume)); } catch {}
  // 应用到当前正在播放的声音源
  if (bgAudio) bgAudio.volume = prefs.musicVolume;
  if (boxAudio) boxAudio.volume = prefs.musicVolume;
  if (musicGain) musicGain.gain.value = prefs.musicVolume * 0.5;
}
function clamp01(v) { return Math.max(0, Math.min(1, isFinite(v) ? v : 0.7)); }

// ---- 懒加载 / 解锁 ----
function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  masterGain = ctx.createGain(); masterGain.gain.value = 0.6; masterGain.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.5; musicGain.connect(ctx.destination);
  // 保活：非零极低频“底噪”。浏览器按“是否有持续声音输出”判断是否挂起 AudioContext，
  // 故不能用 gain=0 的静音；用几乎听不见的低频底噪让 context 保持 running，音效才稳定。
  try {
    const keepBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const kd = keepBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < kd.length; i++) { last = last * 0.99 + (Math.random() * 2 - 1) * 0.02; kd[i] = last; }
    const keep = ctx.createBufferSource(); keep.buffer = keepBuf; keep.loop = true;
    const keepFilt = ctx.createBiquadFilter(); keepFilt.type = 'lowpass'; keepFilt.frequency.value = 160;
    const keepGain = ctx.createGain(); keepGain.gain.value = 0.0011; // ≈ -59dB，几乎听不见
    keep.connect(keepFilt); keepFilt.connect(keepGain); keepGain.connect(ctx.destination);
    keep.start();
  } catch { /* 忽略 */ }
  return ctx;
}
// 浏览器可能因“一段时间没声音”把 AudioContext 挂起（省电），发声前先恢复
function ensureRunning() {
  const c = ctx;
  if (c && c.state === 'suspended') c.resume().catch(() => {});
  return c;
}
export function unlock() {
  const c = ensureCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
  if (!unlocked) { unlocked = true; applyMusic(); }
}
// 每次交互都尝试恢复（而非只首次），避免关掉音乐后被浏览器挂起导致的音效丢失
if (typeof window !== 'undefined') {
  const resumeNow = () => {
    ensureCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    applyMusic(); // 用户手势：此时 play 被浏览器允许，启动/恢复背景音乐
  };
  window.addEventListener('pointerdown', resumeNow);
  window.addEventListener('keydown', resumeNow);
  // 页面失焦/切后台时浏览器常会挂起 AudioContext；回到页面时主动恢复，避免音效丢/延迟
  window.addEventListener('focus', resumeNow);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resumeNow(); });
}

// ---- 合成一个渐变包络缓存的振荡器音 ----
// music=true 时归音乐总线（受音乐开关与音量滑杆控制），否则归音效总线
function tone({ freq = 440, endFreq = freq, dur = 0.3, type = 'sine', gain = 0.3, attack = 0.01, delay = 0, music = false }) {
  const c = ensureRunning();
  if (!c || (music ? !prefs.music : !prefs.sfx)) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(music ? musicGain : masterGain);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

// ---- 合成一个短噪声（流水、气泡爆裂等） ----
function noise({ dur = 0.3, gain = 0.2, freq = 800, q = 1, type = 'lowpass', delay = 0 }) {
  const c = ensureRunning();
  if (!c || !prefs.sfx) return;
  const t0 = c.currentTime + delay;
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
  thunder()     { noise({ dur: 0.9, gain: 0.5, freq: 110, type: 'lowpass' }); noise({ dur: 0.7, gain: 0.32, freq: 75, type: 'lowpass', delay: 0.12 }); tone({ freq: 70, endFreq: 40, dur: 0.6, type: 'sine', gain: 0.32, delay: 0.04 }); },
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
  // 周期性微弱气泡上扬（属于氛围乐：走音乐总线，受音乐开关控制）
  const bubble = setInterval(() => {
    if (!prefs.music || !ctx || ctx.state !== 'running') return;
    tone({ freq: 200 + Math.random() * 300, endFreq: 900 + Math.random() * 500, dur: 0.3, type: 'sine', gain: 0.05, music: true });
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
    a.volume = prefs.musicVolume;
    a.addEventListener('canplaythrough', () => { bgAudio = a; applyMusic(); }, { once: true });
    a.addEventListener('error', () => { a.removeAttribute('src'); }, { once: true });
    a.load();
    if (a.readyState >= 3) { bgAudio = a; break; }
  }
  return !!bgAudio;
}
// ---- 音乐盒接管：盒子在海里时，用它自己的曲子（单曲循环）替代背景乐 ----
// 状态做进 applyMusic（每次用户手势都会调它），所以必须在这里感知，而不是在外面硬切
export function setBoxTrack(track) {
  const src = track ? track.src : null;
  if ((activeBox ? activeBox.src : null) === src) return; // 没变化
  activeBox = track;
  applyMusic();
}

export function boxMusicState() {
  return {
    active: !!activeBox,
    name: activeBox ? activeBox.name : null,
    playing: !!(boxAudio && !boxAudio.paused && !boxAudio.ended),
  };
}

function applyMusic() {
  if (!prefs.music) {
    if (bgAudio) bgAudio.pause();
    if (boxAudio) boxAudio.pause();
    stopAmbience();
    return;
  }
  // 音乐盒在场：停掉背景乐与氛围，盒子自己的曲子单曲循环
  if (activeBox) {
    if (bgAudio) bgAudio.pause();
    stopAmbience();
    if (!boxAudio) {
      boxAudio = new Audio();
      boxAudio.loop = true;
    }
    if (boxAudio.getAttribute('src') !== activeBox.src) {
      boxAudio.src = activeBox.src;
      boxAudio.volume = prefs.musicVolume;
    }
    boxAudio.play().catch(() => {}); // 未交互时被拦截也没关系：下次手势的 resumeNow 会重试
    return;
  }
  // 盒子不在了：停掉盒中曲，回落到背景乐 / 氛围
  if (boxAudio) boxAudio.pause();
  // 优先文件音乐：先停掉合成氛围，避免叠声
  if (bgAudio) { stopAmbience(); bgAudio.play().catch(() => {}); return; }
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
