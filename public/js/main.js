// ============ 万灵缸 · 主循环 ============
import { TAU, el, rand, clamp, rgba, SCALE } from './util.js';
import { SPECIES, pickSpecies, RARITY_COLORS, RARITY_NAMES } from './species.js';
import { World } from './world.js';
import { Fish, STAGE_NAMES, STAGE_NUT, makePasserPersona } from './fish.js';
import { Jellyfish } from './jellyfish.js';
import { Food, Egg, Sparkles, DustMote } from './food.js';
import { Collection } from './collection.js';
import {
  DAY_KEY, LORE_KEY, SLOT_KEY,
  saveFish as saveFishState, readFishSave, readEggSave, clearRunSave,
  buildSnapshot, slotInfo, saveSlot, loadSlot, applyPendingRestore,
} from './save.js';
import { Weather } from './weather.js';
import { Bottle, fetchNote, maybeEnrich } from './bottle.js';
import { MusicBox, listTracks, BOX_SIZE, BOX_LAND_OFFSET } from './musicbox.js';
import { Star, generateLastWords } from './star.js';
import { WhaleStone } from './stone.js';
import { ClockStone } from './clockstone.js';
import { playGenesis, armGenesis } from './genesis.js';
import { AI, ChatPanel, generatePersona, fallbackPersona } from './ai.js';
import * as UI from './ui.js';
import { playSfx, prefs, setMusic, setSfx, setMusicVolume, setBoxTrack, boxMusicState } from './audio.js';

// ---------- 画布 ----------
const canvas = el('tank');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;

// ---------- 世界状态 ----------
const world = new World();
world.whaleOnSpawn = () => UI.toast('🐋 远处有一道巨大的影子游过……', true);

const weather = new Weather(W, H);
weather.onLightning = () => {
  playSfx('thunder');
  for (const f of fishes) f.scare = rand(0.5, 1);
  for (let i = 0; i < 10; i++) {
    spawnPlankton(rand(0, W), rand(H * 0.2, H * 0.7), 0, 0, 3);
  }
};
// 朝霞不出门，晚霞行千里
weather.onFireCloud = (when) => {
  UI.toast(
    when === 'dawn'
      ? '🌅 黎明火烧云烧红了天际——今天多半有雨'
      : '🌇 黄昏火烧云——夜里恐怕有雨，明天倒是晴天',
    true,
  );
};

const collection = new Collection();
window.__wanling = collection; // pickSpecies 用于挑未收录物种

const sparkles = new Sparkles();
const foods = [];
const eggs = [];
const dusts = [];      // 悬浮的发光尘（成年满营养鱼产出，可点击收集）
const ripples = [];
const plankton = [];   // 夜光藻
const bottles = [];    // 海里的漂流瓶（可有多只）
const boxes = [];      // 海里的音乐盒（可有多只；最靠后的一只在奏乐）
let bottleTimer = rand(130, 240); // 漂流瓶出现频率：约 2~4 分钟一只
let boxTimer = rand(200, 380);    // 音乐盒出现频率：约 3.5~6 分钟一只
let boxTracks = [];               // 可选曲目（public/audio/box/ 文件夹），定时刷新
function refreshBoxTracks() { listTracks().then((l) => { boxTracks = l; }).catch(() => {}); }
refreshBoxTracks();
setInterval(refreshBoxTracks, 60000);
const stars = [];      // 长眠鱼儿的星辰
const starQueue = [];  // 待降落的星辰 { x, timer, info, noteP }
const whaleStone = new WhaleStone(); // 鲸之石：嵌在海床里的石碑
const clockStone = new ClockStone(); // 时钟日历：左下角海床上的石板

// 总天数跨刷新保留（键名见 save.js）
try {
  const d = parseInt(localStorage.getItem(DAY_KEY) || '1', 10);
  if (Number.isFinite(d) && d > 0) weather.dayCount = d;
} catch { /* 忽略 */ }
weather.onNewDay = (n) => {
  try { localStorage.setItem(DAY_KEY, String(n)); } catch { /* 忽略 */ }
};

const fishes = [];

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  world.resize(W, H);
  weather.resize(W, H);
  // 窗口变了，沉底的卵/瓶子/星星/饲料跟着挪到新沙床上（否则会被埋进沙里）
  for (const e of eggs) if (e.landed) e.y = world.floorY - 12;
  for (const f of foods) f.y = Math.min(f.y, world.floorY - 5);
  for (const b of bottles) if (b.landed) b.y = world.floorY - 10;
  for (const st of stars) if (st.landed) st.y = world.floorY - 8;
  for (const b of boxes) if (b.landed) b.y = world.floorY - BOX_LAND_OFFSET;
  whaleStone.place(W, world);
  clockStone.place(W, world);
  applyUIScale();
}

resize();

const jellies = [
  new Jellyfish(W, H, 0),
  new Jellyfish(W, H, 1),
];

const cursor = { x: -999, y: -999, active: false, down: false, vx: 0, vy: 0, speed: 0 };
const EGG_COST = 30;
const MAX_FISH = 26;

// 显示自家鱼名字的开关（与路过鱼名字区分）
const SHOW_NAMES_KEY = 'wanling.showFishNames';
function loadShowNames() {
  try { return localStorage.getItem(SHOW_NAMES_KEY) === '1'; } catch { return false; }
}
let showFishNames = loadShowNames();

// HUD 随窗口大小缩放
function applyUIScale() {
  const s = clamp(W / 1250, 0.92, 1.7);
  document.documentElement.style.setProperty('--ui', s.toFixed(3));
}

// ---------- 夜光藻 ----------
function spawnPlankton(x, y, vx, vy, n = 2) {
  for (let i = 0; i < n; i++) {
    plankton.push({
      x: x + rand(-5, 5), y: y + rand(-5, 5),
      vx: vx * 0.1 + rand(-14, 14), vy: vy * 0.1 + rand(-14, 14),
      life: 0, max: rand(0.55, 1.15), size: rand(0.7, 1.9) * SCALE,
      hue: rand(168, 205),
    });
  }
  if (plankton.length > 200) plankton.splice(0, plankton.length - 200);
}

// ---------- 鱼的存档（实现在 save.js；这里包一层，把鱼群和卵喂给它） ----------
function saveFish() {
  saveFishState(fishes, eggs);
}
window.addEventListener('pagehide', saveFish);

// ---------- 初始住民 ----------
function spawnInitial() {
  const saved = readFishSave();

  if (Array.isArray(saved) && saved.length) {
    for (const s of saved) {
      const sp = SPECIES.find((x) => x.id === s.sp);
      if (!sp) continue;
      fishes.push(new Fish(sp, rand(W * 0.2, W * 0.8), rand(H * 0.2, H * 0.65), {
        ageDays: s.age ?? 0,
        nutrition: s.nut ?? 0,
        lifespanStd: s.life,
        lifespanActual: s.lifeAct,
        persona: s.persona || null,
        chatLog: Array.isArray(s.log) ? s.log : [],
      }));
    }
  }

  // 未孵化的卵也回到缸里
  const savedEggs = readEggSave();
  if (Array.isArray(savedEggs)) {
    for (const e of savedEggs) {
      const sp = SPECIES.find((s) => s.id === e.sp);
      if (sp) eggs.push(new Egg(e.x ?? rand(W * 0.3, W * 0.7), sp));
    }
  }

  if (fishes.length) return;

  // 新档：默认小群落，年龄营养随机错开，看起来有老有小
  const lineup = [
    ...Array(3).fill('zebra'),
    'clown', 'tang', 'lantern',
  ];
  for (const id of lineup) {
    const sp = SPECIES.find((s) => s.id === id);
    const ageDays = rand(0, 2.4);
    fishes.push(new Fish(sp, rand(W * 0.2, W * 0.8), rand(H * 0.2, H * 0.6), {
      ageDays,
      nutrition: Math.floor(rand(0, 45)),
    }));
  }
}
spawnInitial();

// 读档后：把存档那一刻的天气、海里的漂流瓶、星辰与音乐盒一并还原（实现在 save.js）
applyPendingRestore({ weather, world, bottles, stars, boxes, Bottle, Star, MusicBox });
syncBoxMusic(); // 存档时海里有音乐盒的话，音乐跟着回来

collection.onchange = () => UI.updateHUD(collection.lumens, residentCount());

// ---------- 交互 ----------
let selected = null;

function selectFish(fish) {
  playSfx('select');
  if (selected && selected !== fish) selected.hold = null;
  selected = fish;
  fish.hold = { x: fish.x, y: fish.y };
  chat.openFor(fish);
}

function selectJelly(j) {
  playSfx('select');
  deselect();
  chat.openFor(j);
}

function deselect() {
  if (selected) selected.hold = null;
  selected = null;
}

function feed(x, y) {
  playSfx('feed');
  const cy = Math.min(y, world.floorY - 20);
  for (let i = 0; i < 3; i++) foods.push(new Food(x, cy));
  ripples.push({ x, y: cy, r: 6, life: 0 });
  spawnPlankton(x, cy, 0, 0, 2);
  if (foods.length > 60) foods.splice(0, foods.length - 60);
}

function shockwave(x, y) {
  playSfx('shock');
  ripples.push({ x, y, r: 10, life: 0 });
  ripples.push({ x, y, r: 10, life: -0.18 });
  for (const f of fishes) {
    const dx = f.x - x, dy = f.y - y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 330) {
      const k = (1 - d / 330) * 430;
      f.vx += (dx / d) * k;
      f.vy += (dy / d) * k * 0.6;
    }
  }
  spawnPlankton(x, y, 0, 0, 12);
}

function residentCount() {
  return fishes.reduce((n, f) => n + (f.passer ? 0 : 1), 0);
}

// ---------- 路过鱼：穿缸而过的旅人 ----------
let passerTimer = rand(20, 45);
let firstPasserShown = false;

function spawnPasser() {
  const pools = {
    clear: ['闲逛散心', '追一段洋流', '去邻居家做客', '觅食路过', '抄近路回家'],
    rain: ['避雨迁徙', '找个避风的水域', '雨里赶路', '闲逛散心', '觅食路过'],
    storm: ['避雨迁徙', '雨里赶路', '找个避风的水域'],
  };
  const pool = pools[weather.state] || pools.clear;
  const purpose = pool[(Math.random() * pool.length) | 0];
  // 大概率常见鱼，小概率罕见鱼，不会出现稀有以上
  const rarity = Math.random() < 0.18 ? 1 : 0;
  const pool2 = SPECIES.filter((s) => s.rarity === rarity);
  const sp = pool2[(Math.random() * pool2.length) | 0];
  const dir = Math.random() < 0.5 ? 1 : -1;
  const f = new Fish(sp, dir > 0 ? -60 : W + 60, rand(H * 0.15, world.floorY - 90), {
    passer: { dir, purpose },
    ageDays: rand(1.2, 6),           // 旅人：随机年龄，至少少年起步
    nutrition: 100,                  // 营养充足，让阶段按年龄至少到少年/成年
  });
  // 化名与性格是本地白送的；只有聊天才消耗 AI token
  if (AI.online) f.persona = makePasserPersona();
  fishes.push(f);
  if (!firstPasserShown && f.persona) {
    firstPasserShown = true;
    UI.toast(`🕊 一位名叫「${f.persona.name}」的旅人正穿缸而过——点它可以说说话`, true);
  }
}

function buyEgg() {
  if (eggs.length >= 2) return UI.toast('缸底已经有卵在等着了 — 找找闪圈的卵，点它孵化');
  if (residentCount() >= MAX_FISH) return UI.toast('缸已经满啦，先和住民们多聊聊吧');
  if (collection.lumens < EGG_COST) return UI.toast(`发光尘不够（还差 ${Math.ceil(EGG_COST - collection.lumens)}），多投喂几次吧`);
  collection.addLumens(-EGG_COST);
  playSfx('egg');
  const sp = pickSpecies(true);
  const egg = new Egg(rand(W * 0.25, W * 0.75), sp);
  egg.onLanded = () => UI.toast('🥚 卵已沉底 — 点它孵化！', true);
  eggs.push(egg);
  UI.toast('一颗神秘卵正在缓缓下沉……');
  UI.updateHUD(collection.lumens, residentCount());
}

async function hatch(egg) {
  if (egg.hatched) return;
  egg.hatched = true;
  eggs.splice(eggs.indexOf(egg), 1);

  const rc = RARITY_COLORS[egg.sp.rarity];
  playSfx('hatch');
  sparkles.burst(egg.x, egg.y, rgba('#ffffff', 0.9), 10, 80);
  sparkles.burst(egg.x, egg.y, rgba(rc, 0.85), 22, 110);
  ripples.push({ x: egg.x, y: egg.y, r: 8, life: 0 });

  const fish = new Fish(egg.sp, egg.x, egg.y - 20, { z: 1.08 });
  fishes.push(fish);
  saveFish();
  const firstTime = !collection.isDiscovered(egg.sp.id);
  collection.discover(egg.sp.id);
  UI.updateHUD(collection.lumens, residentCount());
  UI.toast(
    firstTime ? `🧬 新物种收录：${egg.sp.name} · ${RARITY_NAMES[egg.sp.rarity]}`
              : `孵化出了一条${egg.sp.name}`,
    egg.sp.rarity >= 2 || firstTime,
  );
  if (egg.sp.rarity >= 2) unlockLore('rare', '🌌 深海的低语：从一具巨大的温柔里，生出这么多小生命。');

  // AI 档案
  if (AI.online) {
    try {
      await generatePersona(fish);
      UI.toast(`📝 档案已登记：${fish.persona.name}`);
      if (selected === fish) chat.openFor(fish);
    } catch {
      fallbackPersona(fish);
    }
  } else {
    fallbackPersona(fish);
  }
}

// ---------- 深海叙事：首次事件解锁老水母的线索 ----------
function loadLore() {
  const d = { grown: false, bottle: false, rare: false, bury: false };
  try { return { ...d, ...(JSON.parse(localStorage.getItem(LORE_KEY) || '{}')) }; } catch { return d; }
}
let lore = loadLore();
const LORE_KEYS = ['grown', 'bottle', 'rare', 'bury'];
function loreCount() { return LORE_KEYS.filter((k) => lore[k]).length; }
function unlockLore(key, text) {
  if (lore[key]) return; // 每类只触发一次
  lore[key] = true;
  try { localStorage.setItem(LORE_KEY, JSON.stringify(lore)); } catch { /* 忽略 */ }
  const old = jellies.find((j) => j.sp.id === 'jelly-old');
  if (old) old.unlockedCount = (old.unlockedCount || 0) + 1;
  UI.toast(text, true);
  maybeGenesis();
}
// 四条低语集齐 → 上演藏在海底的故事（只自动演一次，之后可在设置里重看）
function maybeGenesis() {
  if (lore.genesis || loreCount() < LORE_KEYS.length) return;
  lore.genesis = true;
  try { localStorage.setItem(LORE_KEY, JSON.stringify(lore)); } catch { /* 忽略 */ }
  armGenesis(); // 等所有面板安静下来再开场
}
// 加载时，把已保存的解锁数赋给老水母（跨刷新记住进度）
{
  const _old = jellies.find((j) => j.sp.id === 'jelly-old');
  if (_old) _old.unlockedCount = loreCount();
}

async function openBottle(b) {
  if (!b || b.opened || b.bury >= 1) return;
  b.opened = true;
  bottles.splice(bottles.indexOf(b), 1);
  sparkles.burst(b.x, b.y, rgba('#ffe9b0', 0.9), 16, 70);
  ripples.push({ x: b.x, y: b.y, r: 6, life: 0 });

  el('bottle-text').textContent = '……字条正在展开';
  el('bottle-overlay').classList.remove('hidden');
  const core = b.note ?? fetchNote();
  const note = core.startsWith('「') ? core : `「${core}」`;
  el('bottle-text').textContent = note;
  // 收进背包，记录时间
  collection.addToBackpack({ id: `bp${Date.now()}${Math.floor(Math.random() * 999)}`, type: 'bottle', note: core, time: Date.now() });
  UI.toast('🧴 漂流瓶已收进背包');
  unlockLore('bottle', '🌊 深海的低语：有些话，沉得比石头还深。');
  // AI 在后台扩充句库（验收合格才入库）
  maybeEnrich();
}

async function openStar(st) {
  if (!st || st.opened || !st.alive) return;
  st.opened = true;
  stars.splice(stars.indexOf(st), 1);
  sparkles.burst(st.x, st.y, rgba('#fff2c0', 0.9), 18, 80);
  ripples.push({ x: st.x, y: st.y, r: 8, life: 0 });

  const info = st.info || {};
  el('star-info').innerHTML = '';
  const nameLine = document.createElement('p');
  nameLine.className = 'star-name';
  nameLine.textContent = `「${info.name || '无名'}」`;
  const metaLine = document.createElement('p');
  metaLine.className = 'star-meta';
  metaLine.textContent = `${info.species || ''} · ${info.stage || ''} · 享年 ${info.age ?? '?'} 天`;
  el('star-info').append(nameLine, metaLine);
  el('star-last').textContent = st.note || '……它的话还在星光里凝形';
  el('star-overlay').classList.remove('hidden');

  collection.addToBackpack({
    id: `st${Date.now()}${Math.floor(Math.random() * 999)}`,
    type: 'star',
    note: st.note || '',
    meta: info,
    time: Date.now(),
  });
  UI.toast('⭐ 星辰已收进背包，它会替它记得');
}

// ---------- 音乐盒：每只绑定一首曲子，在海里就单曲循环，收回背包即静 ----------
// 海里有多只时，最新的一只在响；它被收回后，前一只接棒
function syncBoxMusic() {
  setBoxTrack(boxes.length ? boxes[boxes.length - 1].track : null);
}

function spawnMusicBox(track) {
  if (boxes.length >= 2) return null;
  if (!track) {
    // 自然生成只挑还没收集到的曲目（背包里的、海里正漂着的都跳过），集齐后就不再漂来
    const pool = collectableTracks();
    if (!pool.length) return null;
    track = pool[(Math.random() * pool.length) | 0];
  }
  const mb = new MusicBox(rand(W * 0.2, W * 0.8), track);
  mb.onLanded = () => UI.toast(`🎵 《${track.name}》音乐盒在沙床上奏响了`, true);
  boxes.push(mb);
  syncBoxMusic();
  UI.toast(`🎵 一只《${track.name}》音乐盒缓缓沉了下来…`, true);
  return mb;
}

// 曲目身份：以文件路径为准（改名才换 key）
const trackKey = (t) => t.src || t.name;

// 背包里已收集的曲目
function collectedTrackKeys() {
  const keys = new Set();
  for (const it of collection.backpack) if (it.type === 'box') keys.add(trackKey(it));
  return keys;
}

// 还能自然生成哪些曲目：排除背包里已有的，以及海里正漂着的
function collectableTracks() {
  const taken = collectedTrackKeys();
  for (const b of boxes) if (b.track) taken.add(trackKey(b.track));
  return boxTracks.filter((t) => !taken.has(trackKey(t)));
}

function collectBox(b) {
  if (!b || b.opened) return;
  b.opened = true;
  boxes.splice(boxes.indexOf(b), 1);
  playSfx('collect');
  sparkles.burst(b.x, b.y, rgba('#ffe9b0', 0.9), 14, 70);
  ripples.push({ x: b.x, y: b.y, r: 6, life: 0 });
  collection.addToBackpack({
    id: `mb${Date.now()}${Math.floor(Math.random() * 999)}`,
    type: 'box',
    name: b.track.name,
    src: b.track.src,
    cover: b.track.cover ?? null,
    time: Date.now(),
  });
  syncBoxMusic(); // 背包空了或前一只接棒，音乐自动切换
  UI.toast(`🎵 《${b.track.name}》音乐盒已收进背包，海面恢复了平日的声音`);
  // 曲目收齐：海里不会再自然漂来音乐盒了，给个收尾
  const inBag = collectedTrackKeys();
  if (boxTracks.length && boxTracks.every((t) => inBag.has(trackKey(t)))) {
    UI.toast('🎵 曲目都收进背包了——海里不会再漂来音乐盒', true);
  }
}

// ---------- 指针 ----------
let lastMove = null;
let lastSpawn = 0;
canvas.addEventListener('pointermove', (e) => {
  const now = performance.now();
  if (lastMove) {
    const dtm = Math.max(8, now - lastMove.t) / 1000;
    const vx = (e.clientX - lastMove.x) / dtm;
    const vy = (e.clientY - lastMove.y) / dtm;
    cursor.vx = cursor.vx * 0.65 + vx * 0.35;
    cursor.vy = cursor.vy * 0.65 + vy * 0.35;
    cursor.speed = Math.hypot(cursor.vx, cursor.vy);
    // 快速划水唤醒夜光藻（节流：最多每 40ms 一粒，拖尾克制一点）
    if (cursor.speed > 170 && now - lastSpawn > 40) {
      lastSpawn = now;
      spawnPlankton(e.clientX, e.clientY, cursor.vx, cursor.vy, 1);
    }
  }
  lastMove = { x: e.clientX, y: e.clientY, t: now };
  cursor.x = e.clientX;
  cursor.y = e.clientY;
  cursor.active = true;
  whaleStone.hover = whaleStone.contains(cursor.x, cursor.y);
});
canvas.addEventListener('pointerleave', () => { cursor.active = false; });
window.addEventListener('pointerup', () => { cursor.down = false; holdFeeding = false; });

// ---------- 长按连续抛饵 ----------
let holdFeeding = false;
let holdTimer = 0;

function hitTest(x, y) {
  if (whaleStone.contains(x, y)) return { type: 'stone' };
  for (const st of stars) {
    if (st.alive && Math.hypot(st.x - x, st.y - y) < 44) return { type: 'star', obj: st };
  }
  for (const b of bottles) {
    if (b.bury < 1 && Math.hypot(b.x - x, b.y - y) < 40) return { type: 'bottle', obj: b };
  }
  for (const b of boxes) {
    if (Math.hypot(b.x - x, b.y - y) < 34 * BOX_SIZE) return { type: 'box', obj: b };
  }
  for (const egg of eggs) {
    if (Math.hypot(egg.x - x, egg.y - y) < 46) return { type: 'egg', obj: egg };
  }
  const sorted = [...fishes].sort((a, b) => b.z - a.z);
  for (const f of sorted) {
    if (Math.hypot(f.x - x, f.y - y) < 24 * f.sizeScale + 10) return { type: 'fish', obj: f };
  }
  for (const j of jellies) {
    if (Math.hypot(j.x - x, j.y - y) < j.r + 22) return { type: 'jelly', obj: j };
  }
  // 发光尘最后判定：尘是在鱼身上产出的，鱼优先，点鱼聊天才不会被截胡
  for (const d of dusts) {
    if (Math.hypot(d.x - x, d.y - y) < 24) return { type: 'dust', obj: d };
  }
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
  cursor.down = true;
  const x = e.clientX, y = e.clientY;
  if (dragItem) return; // 拖着背包里的瓶子时不投饵
  const hit = hitTest(x, y);
  if (hit) return;      // 点到瓶子/卵/鱼：交给 click 处理
  // 落在开阔水域：立即撒一次饵，并进入长按连撒模式
  feed(x, y);
  holdFeeding = true;
  holdTimer = 0;
  fedOnDown = true;
});

canvas.addEventListener('click', (e) => {
  if (dragItem) return;
  const x = e.clientX, y = e.clientY;
  const hit = hitTest(x, y);
  // 双击只留给"开阔水域敲缸"；命中了对象（鱼/尘/卵等）就始终处理，避免快速连点时丢掉第二次
  if (e.detail >= 2 && !hit) return;
  if (hit) {
    if (hit.type === 'dust') return collectDust(hit.obj);
    if (hit.type === 'stone') {
      UI.togglePanel('panel-settings', true);
      loadSettings();
      return;
    }
    if (hit.type === 'star') return openStar(hit.obj);
    if (hit.type === 'bottle') return openBottle(hit.obj);
    if (hit.type === 'box') return collectBox(hit.obj);
    if (hit.type === 'egg') return hatch(hit.obj);
    if (hit.type === 'fish') return selectFish(hit.obj);
    if (hit.type === 'jelly') return selectJelly(hit.obj);
  }
  if (fedOnDown) { fedOnDown = false; return; } // 按下时已经撒过饵了
  feed(x, y);
});
let fedOnDown = false;

canvas.addEventListener('dblclick', (e) => {
  const x = e.clientX, y = e.clientY;
  // 命中了任何可交互对象（鱼/水母/尘/卵/瓶/星/石）就不敲缸，交给 click 处理
  if (hitTest(x, y)) return;
  shockwave(x, y);
});

// ---------- 面板与按钮 ----------
const chat = new ChatPanel();
UI.initUI({
  onPanelClose: (id) => {
    if (id === 'panel-chat') deselect();
  },
});
el('btn-collection').addEventListener('click', () => UI.togglePanel('panel-collection'));
el('btn-backpack').addEventListener('click', () => { renderBackpack(); UI.togglePanel('panel-backpack'); });
collection.onbackpack = () => { if (!el('panel-backpack').classList.contains('hidden')) renderBackpack(); };
document.querySelectorAll('.bp-tab').forEach((b) => b.addEventListener('click', () => {
  backpackView = b.dataset.view;
  renderBackpack();
}));
el('btn-set-help').addEventListener('click', () => el('set-help').classList.toggle('hidden'));
el('btn-empty-trash').addEventListener('click', () => {
  collection.emptyTrash();
  UI.toast('🧹 垃圾箱已清空');
});
el('btn-egg').addEventListener('click', buyEgg);
el('btn-help').addEventListener('click', () => UI.togglePanel('help-overlay', true));
el('btn-dive').addEventListener('click', () => {
  el('splash').classList.add('hidden');
  worldPaused = false; // 进入游戏：世界恢复运转
  UI.showGameChrome();
});

// ---------- 回标题 / 存档 / 读档 / 重开一局 ----------
function hideAllPanels() {
  chat.close();
  deselect();
  UI.togglePanel('panel-collection', false);
  UI.togglePanel('panel-backpack', false);
  UI.togglePanel('help-overlay', false);
  UI.togglePanel('bottle-overlay', false);
  UI.togglePanel('star-overlay', false);
  UI.togglePanel('panel-settings', false);
}

function resetRun() {
  // 清空当前局的所有实体
  deselect();
  chat.close();
  fishes.length = 0;
  foods.length = 0;
  eggs.length = 0;
  dusts.length = 0;
  ripples.length = 0;
  plankton.length = 0;
  bottles.length = 0;
  stars.length = 0;
  starQueue.length = 0;
  boxes.length = 0;
  syncBoxMusic(); // 盒子都没了，音乐回落到背景乐
  bottleTimer = rand(130, 240);
  boxTimer = rand(200, 380);
  // 删掉旧鱼/卵存档，让 spawnInitial 走"新档"分支
  clearRunSave();
  spawnInitial();
  UI.updateHUD(collection.lumens, residentCount());
  UI.toast('🧹 新的一局开始——缸里已经有了新的住民', true);
}

el('btn-exit').addEventListener('click', () => {
  hideAllPanels();
  UI.hideGameChrome();
  worldPaused = true; // 回到标题：冻结整个世界
  el('splash').classList.remove('hidden');
});

// 设置面板开关
el('btn-settings').addEventListener('click', () => {
  syncAudioToggles();
  syncShowNamesToggle();
  // 四条低语集齐后，设置里多出一个重看序章的入口
  el('btn-genesis').classList.toggle('hidden', loreCount() < LORE_KEYS.length);
  UI.togglePanel('panel-settings-overlay', true);
});
el('btn-genesis').addEventListener('click', () => {
  UI.togglePanel('panel-settings-overlay', false);
  playGenesis();
});

// ---------- 存档槽：手动存档 / 读档（读写实现见 save.js） ----------

// 把此刻的整缸状态打包
function snapshotNow() {
  return buildSnapshot({ fishes, eggs, collection, lore, weather, bottles, stars, boxes });
}

function fmtSlotTime(ts) {
  const d = new Date(ts);
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

function updateSlotUI() {
  const info = slotInfo();
  const saveBtn = el('btn-save');
  const loadBtn = el('btn-load');
  if (info) {
    saveBtn.textContent = `💾 存档 ${fmtSlotTime(info.at)}`;
    saveBtn.title = `覆盖存档槽（当前存档：${fmtSlotTime(info.at)}）`;
    loadBtn.title = `读取 ${fmtSlotTime(info.at)} 的存档（${info.fish} 条鱼）`;
    loadBtn.disabled = false;
  } else {
    saveBtn.textContent = '💾 存档';
    saveBtn.title = '保存到存档槽（可随时读回）';
    loadBtn.title = '还没有手动存档';
    loadBtn.disabled = true;
  }
}

// ---------- 游戏内确认框（代替 window.confirm：不出戏、不冻结渲染） ----------
let confirmResolve = null;
function uiConfirm(text, okLabel = '确定') {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    el('confirm-text').textContent = text;
    el('confirm-ok').textContent = okLabel;
    UI.togglePanel('confirm-overlay', true);
  });
}
function settleConfirm(v) {
  if (!confirmResolve) return;
  const r = confirmResolve;
  confirmResolve = null;
  UI.togglePanel('confirm-overlay', false);
  r(v);
}
el('confirm-ok').addEventListener('click', () => settleConfirm(true));
el('confirm-cancel').addEventListener('click', () => settleConfirm(false));

el('btn-save').addEventListener('click', () => {
  if (saveSlot(snapshotNow())) {
    updateSlotUI();
    UI.toast('💾 已存入存档槽——之后随时可以读回来');
  } else {
    UI.toast('存档失败：浏览器存储空间不足');
  }
});

el('btn-load').addEventListener('click', async () => {
  const info = slotInfo();
  if (!info) return UI.toast('还没有手动存档，先点「存档」');
  const ok = await uiConfirm(`读取 ${fmtSlotTime(info.at)} 的存档？

缸里的鱼、发光尘、图鉴、天气都会回到那一刻（当前进度将被覆盖）。`, '读取');
  if (!ok) return;
  if (loadSlot()) location.reload();
  else UI.toast('读档失败：存档已损坏');
});

updateSlotUI();

el('btn-reset').addEventListener('click', async () => {
  const ok = await uiConfirm('重新开一局？将清空当前缸里的鱼群与未孵化的卵，但会保留图鉴收集进度与发光尘。', '重开');
  if (ok) resetRun();
});

// ---------- 导出 / 导入存档（分享你的缸） ----------
el('btn-export').addEventListener('click', () => {
  const snap = snapshotNow();
  snap.wanlingSave = 1; // 文件标识：导入时校验用
  const blob = new Blob([JSON.stringify(snap)], { type: 'application/json' });
  const a = document.createElement('a');
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  a.href = URL.createObjectURL(blob);
  a.download = `万灵缸存档_${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  UI.toast('📤 存档已导出——发给别人，就能捞一捞你的缸');
});

el('btn-import').addEventListener('click', () => el('import-file').click());
el('import-file').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let snap = null;
  try { snap = JSON.parse(await file.text()); } catch { snap = null; }
  // 宽松校验：不认文件标识也行，但鱼册和图鉴数据必须长得像
  if (!snap || !Array.isArray(snap.fish) || typeof snap.collection !== 'object' || snap.collection === null) {
    return UI.toast('这不是万灵缸的存档文件哦');
  }
  const when = snap.at ? fmtSlotTime(snap.at) : '未知时间';
  const ok = await uiConfirm(`导入 ${when} 的存档？

缸里的鱼、发光尘、图鉴、天气都会换成文件里的那一刻（当前进度将被覆盖）。`, '导入');
  if (!ok) return;
  try {
    localStorage.setItem(SLOT_KEY, JSON.stringify(snap));
    if (loadSlot()) location.reload();
    else UI.toast('导入失败：内容无法写入存档槽');
  } catch {
    UI.toast('导入失败：文件太大或已损坏');
  }
});

// ---------- 显示鱼名开关 ----------
const namesCheck = el('show-names-check');
function syncShowNamesToggle() {
  namesCheck.checked = showFishNames;
}
function setShowNames(v) {
  showFishNames = !!v;
  try { localStorage.setItem(SHOW_NAMES_KEY, showFishNames ? '1' : '0'); } catch { /* 隐私模式无所谓 */ }
  syncShowNamesToggle();
}
namesCheck.addEventListener('change', () => setShowNames(namesCheck.checked));
syncShowNamesToggle(); // 初始同步

// ---------- 音乐 / 音效开关 ----------
const musicCheck = el('music-check');
const sfxCheck = el('sfx-check');
function syncAudioToggles() {
  musicCheck.checked = prefs.music;
  sfxCheck.checked = prefs.sfx;
}
musicCheck.addEventListener('change', () => setMusic(musicCheck.checked));
sfxCheck.addEventListener('change', () => setSfx(sfxCheck.checked));
syncAudioToggles();

// 音乐音量滑杆
const musicVol = el('music-vol');
musicVol.value = String(prefs.musicVolume);
musicVol.addEventListener('input', () => setMusicVolume(parseFloat(musicVol.value)));

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    settleConfirm(false);
    deselect();
    chat.close();
    UI.togglePanel('panel-collection', false);
    UI.togglePanel('panel-backpack', false);
    UI.togglePanel('help-overlay', false);
    UI.togglePanel('bottle-overlay', false);
    UI.togglePanel('star-overlay', false);
    UI.togglePanel('panel-settings-overlay', false);
  }
});

// ---------- AI 状态 ----------
AI.probe().then((online) => {
  UI.setAIStatus(AI.online, AI.model, AI.hasKey);
  if (!online) {
    setTimeout(() => UI.toast('💡 鲸之石仍在沉睡——点右下角的它，用正确的密语唤醒海洋的智慧'), 2500);
  }
});

// ---------- AI 设置面板 ----------
async function loadSettings() {
  try {
    const cfg = await fetch('/api/config').then((r) => r.json());
    el('set-key-state').textContent = cfg.hasKey ? `已保存（尾号 ${cfg.keyTail}）` : '未设置';
    el('set-url').value = cfg.baseUrl;
    el('set-model').value = cfg.model;
    el('set-key').value = '';
  } catch {
    el('set-key-state').textContent = '读取失败';
  }
}

el('set-save').addEventListener('click', async () => {
  const body = {};
  const k = el('set-key').value.trim();
  if (k) body.apiKey = k;
  const u = el('set-url').value.trim();
  if (u) {
    if (!/^https?:\/\/.+/.test(u)) return UI.toast('接口地址要以 http(s):// 开头哦');
    body.baseUrl = u;
  }
  const m = el('set-model').value.trim();
  if (m) body.model = m;
  if (!Object.keys(body).length) return UI.toast('没有要保存的修改');
  try {
    const r = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || '保存失败');
    UI.toast(d.hasKey ? '🐋 密语已刻入——鲸之石亮了，海洋的智慧醒了' : '已保存——但还没有密语，鱼儿暂时不能说话', d.hasKey);
    await AI.probe();
    UI.setAIStatus(AI.online, AI.model, AI.hasKey);
    await loadSettings();
  } catch (err) {
    UI.toast(`保存失败：${err.message}`);
  }
});

el('set-clear').addEventListener('click', async () => {
  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: '' }),
    });
    await AI.probe();
    UI.setAIStatus(AI.online, AI.model, AI.hasKey);
    await loadSettings();
    UI.toast('已抹去密语');
  } catch {
    UI.toast('清除失败');
  }
});

// ---------- 吃饭 ----------
function mealtime() {
  for (const f of fishes) {
    if (f.dying || f.burrowing) continue; // 弥留的鱼不再进食
    const eatR = 15 * f.sizeScale + 5;
    for (const food of foods) {
      if (food.eaten) continue;
      if (Math.hypot(food.x - f.x, food.y - f.y) < eatR) {
        food.eaten = true;
        f.energy++;
        collection.addFed();
        // 营养点 +2，最多吃到本阶段上限（上限内才长身体）
        const before = f.nutrition;
        f.nutrition = Math.min(f.nutrition + 2, STAGE_NUT[f.stage]);
        if (f.nutrition !== before && selected === f) chat.updateGrowth(f);
        sparkles.burst(f.x, f.y, rgba('#ffd77a', 0.8), 6, 46);
        break;
      }
    }
  }
  for (let i = foods.length - 1; i >= 0; i--) {
    if (foods[i].gone) foods.splice(i, 1);
  }
}

// ---------- 发光尘：成年且营养满格的鱼定时产出悬浮发光尘 ----------
function updateDust(dt) {
  for (const f of fishes) {
    if (f.passer || f.dying || f.burrowing) { f.dustAboutTo = false; continue; }
    // 只有成年（stage 2）且营养满格才产尘
    const matureFull = f.stage >= 2 && f.nutrition >= STAGE_NUT[f.stage];
    if (!matureFull) { f.dustAboutTo = false; continue; }
    f.dustTimer -= dt;
    // 即将产出：<1.5s 时发蓝光预告
    f.dustAboutTo = f.dustTimer < 1.5;
    if (f.dustTimer <= 0) {
      f.dustTimer = rand(60, 120);          // 每 1~2 分钟产一批
      const n = 1 + ((Math.random() * 4) | 0); // 1-4 颗
      for (let i = 0; i < n; i++) dusts.push(new DustMote(f.x, f.y, 1));
      sparkles.burst(f.x, f.y - 6, rgba('#6fe3ff', 0.9), 8, 60);
    }
  }
  // 鼠标停靠处每帧只做一次命中测试：停在鱼/卵/瓶等身上时不自动收尘，别跟玩家的点击抢
  const hover = cursor.active ? hitTest(cursor.x, cursor.y) : null;
  for (let i = dusts.length - 1; i >= 0; i--) {
    dusts[i].update(dt, performance.now() / 1000, world);
    const d = dusts[i];
    // 鼠标靠近即自动收集（仅当没停在别的对象上）：动效与点击收集一致（走同一 collectDust）
    if (cursor.active && (!hover || hover.type === 'dust') && Math.hypot(d.x - cursor.x, d.y - cursor.y) < 46) {
      collectDust(d);
      if (d.gone) dusts.splice(i, 1);
      continue;
    }
    if (d.gone) dusts.splice(i, 1);
  }
}

// 点击收集一颗发光尘
function collectDust(d) {
  if (d.collected) return;
  d.collected = true;
  playSfx('collect');
  collection.addLumens(d.n);
  sparkles.burst(d.x, d.y, rgba('#6fe3ff', 0.9), 8, 70);
  UI.updateHUD(collection.lumens, residentCount());
}

// ---------- 背包：漂流瓶收纳与放飞 ----------
let dragItem = null;
let ghostEl = null;

let backpackView = 'main';

function renderBackpack() {
  const list = el('backpack-list');
  const items = collection.backpack;
  const trash = collection.trash;
  const counts = { main: items.filter((i) => !i.fav).length, fav: items.filter((i) => i.fav).length, trash: trash.length };

  document.querySelectorAll('.bp-tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === backpackView);
    b.textContent = { main: `收集 ${counts.main}`, fav: `♡ ${counts.fav}`, trash: `🗑 ${counts.trash}` }[b.dataset.view];
  });
  el('btn-empty-trash').classList.toggle('hidden', backpackView !== 'trash' || trash.length === 0);
  el('backpack-foot').textContent = {
    main: '按住拖到海里放飞 · ✏️ 改写话语 · ♡ 收藏进收藏夹',
    fav: '收藏夹里存着你的收集 · 不会因为你手滑而消失',
    trash: '♻ 可恢复 · 「永久删除」不可找回',
  }[backpackView];
  el('backpack-count').textContent = {
    main: items.length ? `共 ${counts.main} 件收集` : '空空如也，去海里捡瓶子吧',
    fav: counts.fav ? `收藏了 ${counts.fav} 件最珍贵的` : '收藏夹还是空的 — 点字条旁的 ♡',
    trash: trash.length ? '这里的东西随时可以恢复' : '垃圾箱是空的',
  }[backpackView];

  const buildRow = (item, trashed) => {
    const isStar = item.type === 'star';
    const isBox = item.type === 'box';
    const row = document.createElement('div');
    row.className = 'bp-item' + (isStar ? ' bp-star' : '') + (trashed ? ' trashed' : '');

    let iconEl;
    if (isBox && item.cover) {
      iconEl = document.createElement('img');
      iconEl.className = 'bp-ico bp-cover';
      iconEl.src = item.cover;
      iconEl.alt = '';
    } else {
      iconEl = document.createElement('span');
      iconEl.className = 'bp-ico';
      iconEl.textContent = isStar ? '⭐' : isBox ? '🎵' : '🧴';
    }

    const text = document.createElement('div');
    text.className = 'bp-text';
    const note = document.createElement('p');
    note.className = 'bp-note';
    if (isStar) {
      note.textContent = item.note || '……';
    } else if (isBox) {
      note.textContent = `《${item.name}》音乐盒`;
    } else {
      note.textContent = item.note.startsWith('「') ? item.note : `「${item.note}」`;
    }
    const time = document.createElement('p');
    time.className = 'bp-time';
    const d = new Date(item.time);
    const timeStr = `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    time.textContent = isStar
      ? `${item.meta?.name || '无名'} · ${item.meta?.species || ''} · ${timeStr} 收入`
      : `${timeStr} 捞起`;
    text.append(note, time);

      row.append(iconEl, text);

    if (!trashed) {
      // 收藏
      const fav = document.createElement('button');
      fav.className = 'bp-act bp-fav' + (item.fav ? ' on' : '');
      fav.title = item.fav ? '取消收藏' : '收藏进收藏夹';
      fav.textContent = item.fav ? '♥' : '♡';
      fav.addEventListener('pointerdown', (e) => e.stopPropagation());
      fav.addEventListener('click', (e) => { e.stopPropagation(); collection.toggleFav(item.id); });
      // 改写话语
      const edit = document.createElement('button');
      edit.className = 'bp-act bp-edit';
      edit.title = '修改话语';
      edit.textContent = '✏️';
      edit.addEventListener('pointerdown', (e) => e.stopPropagation());
      edit.addEventListener('click', (e) => { e.stopPropagation(); startNoteEdit(row, item); });
      // 丢进垃圾箱
      const del = document.createElement('button');
      del.className = 'bp-act bp-del';
      del.title = '丢进垃圾箱';
      del.textContent = '🗑';
      del.addEventListener('pointerdown', (e) => e.stopPropagation());
      del.addEventListener('click', (e) => { e.stopPropagation(); collection.toTrash(item.id); UI.toast('已移入垃圾箱'); });
      // 爱心(收藏夹)里的珍藏不能丢进垃圾桶，因此不显示删除按钮；音乐盒没有话语可改写
      row.append(fav);
      if (!isBox) row.append(edit);
      if (backpackView !== 'fav') row.append(del);

      const hint = document.createElement('span');
      hint.className = 'bp-hint';
      hint.textContent = '按住拖到海里';
      row.append(hint);
      row.addEventListener('pointerdown', (e) => startBottleDrag(e, item));
    } else {
      const restore = document.createElement('button');
      restore.className = 'bp-act bp-restore';
      restore.textContent = '♻ 恢复';
      restore.addEventListener('pointerdown', (e) => e.stopPropagation());
      restore.addEventListener('click', (e) => { e.stopPropagation(); collection.restoreFromTrash(item.id); UI.toast('已放回背包'); });
      const purge = document.createElement('button');
      purge.className = 'bp-act bp-del';
      purge.textContent = '永久删除';
      purge.addEventListener('pointerdown', (e) => e.stopPropagation());
      purge.addEventListener('click', (e) => { e.stopPropagation(); collection.purgeFromTrash(item.id); });
      row.append(restore, purge);
    }
    return row;
  };

  const rows = [];
  if (backpackView === 'trash') {
    for (const item of trash) rows.push(buildRow(item, true));
    if (!rows.length) rows.push(bpEmpty('垃圾箱是空的'));
  } else {
    const src = backpackView === 'fav'
      ? items.filter((i) => i.fav)
      : backpackView === 'main' ? items.filter((i) => !i.fav) : items;
    for (const item of src) rows.push(buildRow(item, false));
    if (!rows.length) {
      rows.push(bpEmpty(backpackView === 'fav' ? '收藏夹还是空的 — 点字条旁的 ♡' : '空空如也，去海里捡瓶子吧'));
    }
  }
  list.replaceChildren(...rows);
}

function bpEmpty(text) {
  const p = document.createElement('p');
  p.className = 'bp-empty';
  p.textContent = text;
  return p;
}

// 玩家改写背包里的话语
function startNoteEdit(row, item) {
  const noteP = row.querySelector('.bp-note');
  if (!noteP || row.querySelector('.bp-note-input')) return;
  const input = document.createElement('input');
  input.className = 'bp-note-input';
  input.maxLength = 60;
  input.value = item.note;
  input.addEventListener('pointerdown', (e) => e.stopPropagation());
  noteP.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    const v = input.value.trim().slice(0, 60);
    if (v && v !== item.note) {
      item.note = v;
      collection.save();
      UI.toast('✍️ 话语已改写');
    }
    renderBackpack();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { done = true; renderBackpack(); }
  });
  input.addEventListener('blur', commit);
}

function startBottleDrag(e, item) {
  e.preventDefault();
  dragItem = { ...item };
  ghostEl = document.createElement('div');
  ghostEl.className = 'bp-ghost';
  ghostEl.textContent = item.type === 'star' ? '⭐' : item.type === 'box' ? '🎵' : '🧴'; // 图标与所拖物品统一
  document.body.appendChild(ghostEl);
  moveGhost(e.clientX, e.clientY);
  window.addEventListener('pointermove', moveGhost);
  window.addEventListener('pointerup', endBottleDrag, { once: true });
}

function moveGhost(e) {
  if (!ghostEl) return;
  ghostEl.style.left = `${e.clientX}px`;
  ghostEl.style.top = `${e.clientY}px`;
}

function endBottleDrag(e) {
  window.removeEventListener('pointermove', moveGhost);
  const item = dragItem;
  dragItem = null;
  if (ghostEl) { ghostEl.remove(); ghostEl = null; }
  if (!item) return;
  // 只有松手在海面上才算放飞
  const target = document.elementFromPoint(e.clientX, e.clientY);
  if (target === canvas) {
    throwFromBackpack(item, e.clientX, e.clientY);
  } else {
    UI.toast('要拖到海里再松手哦');
  }
}

function throwFromBackpack(item, x, y) {
  collection.removeFromBackpack(item.id);
  if (item.type === 'box') {
    const mb = new MusicBox(clamp(x, 30, W - 30), { name: item.name, src: item.src, cover: item.cover ?? null });
    mb.y = clamp(y, 24, world.floorY - 20);
    mb.vy = 26;
    boxes.push(mb);
    syncBoxMusic(); // 盒子一入水，曲子就替代背景乐
    ripples.push({ x: mb.x, y: mb.y, r: 6, life: 0 });
    UI.toast(`🎵 《${item.name}》音乐盒又开始奏乐了`);
    return;
  }
  if (item.type === 'star') {
    const st = new Star(clamp(x, 30, W - 30), item.meta || { name: '无名' }, item.note || null);
    st.y = clamp(y, 24, world.floorY - 20);
    st.vy = 26;
    st.onLanded = () => UI.toast('⭐ 星星静静躺在沙床上，照亮一小片海');
    stars.push(st);
    ripples.push({ x: st.x, y: st.y, r: 6, life: 0 });
    UI.toast('⭐ 星辰重新回到了海里');
    return;
  }
  const b = new Bottle(clamp(x, 30, W - 30), item.note);
  b.y = clamp(y, 24, world.floorY - 24);
  b.vy = 30;
  b.onLanded = () => UI.toast('瓶子轻轻落在了沙床上…');
  bottles.push(b);
  ripples.push({ x: b.x, y: b.y, r: 6, life: 0 });
  UI.toast('🧴 漂流瓶重新回到了海里');
}

// ---------- 环境状态 chip ----------
let lastEnvUpd = 0;
function updateEnvChip(t) {
  if (t - lastEnvUpd < 1) return;
  lastEnvUpd = t;
  const p = weather.phase(t);
  let ico = '☀️', label;
  if (p < 0.06) { ico = '🌅'; label = '黎明'; }
  else if (p < 0.42) { ico = '☀️'; label = '白天'; }
  else if (p < 0.56) { ico = '🌇'; label = '黄昏'; }
  else if (p < 0.94) { ico = '🌙'; label = '夜晚'; }
  else { ico = '🌅'; label = '黎明'; }
  if (weather.state === 'rain') { label += ' · 🌧️ 小雨'; }
  else if (weather.state === 'storm') { label += ' · ⛈️ 暴风雨'; }
  if (weather.fire > 0.3) { label += ' · 🔥 火烧云'; }
  el('env-ico').textContent = ico;
  el('env-label').textContent = label;
}

// ---------- 调试/测试钩子 ----------
window.__tank = {
  fishes, eggs, foods, dusts, jellies, collection, weather, bottles, stars, starQueue, world, cursor, boxes,
  get boxTracks() { return boxTracks; },
  get boxPool() { return collectableTracks(); },
  get boxMusic() { return boxMusicState(); },
  get bottleTimer() { return bottleTimer; },
  set bottleTimer(v) { bottleTimer = v; },
  get passerTimer() { return passerTimer; },
  set passerTimer(v) { passerTimer = v; },
  feed, buyEgg, hatch, selectFish, shockwave, saveFish, collectDust, selectJelly, unlockLore,
  collectBox,
  spawnBox: spawnMusicBox,
  spawnDust: (x, y, n) => { const d = new DustMote(x ?? W * 0.5, y ?? H * 0.5, n ?? 2); dusts.push(d); return d; },
  spawnFish: (id) => { const sp = SPECIES.find((s) => s.id === id) || SPECIES[0]; const f = new Fish(sp, W * 0.35, H * 0.35); fishes.push(f); return f; },
  spawnBottle: (x, note) => { const b = new Bottle(x ?? rand(W * 0.3, W * 0.7), note ?? null); bottles.push(b); return b; },
  throwFromBackpack,
  playGenesis,
  lore: () => lore,
};

// ---------- 名牌文字宽度缓存（名字几乎不变，不必每帧 measureText） ----------
const textWCache = new Map();
function textW(text) {
  const key = ctx.font + '\u0000' + text;
  let w = textWCache.get(key);
  if (w === undefined) {
    if (textWCache.size > 400) textWCache.clear();
    w = ctx.measureText(text).width;
    textWCache.set(key, w);
  }
  return w;
}

// ---------- 围观力场：漂流瓶 / 星辰共用 ----------
// 远处的鱼被吸引（拉力随距离衰减、带保底），近处的鱼绕着兜圈（切向力 + 半径弹簧）。
// 兴趣系数 k = 兴趣(entity) ×（路过鱼 ? passerK : 1），0.15 以下视为毫无兴趣。
function swirlAttract(entities, fishes, dt, o) {
  const val = (v, e) => (typeof v === 'function' ? v(e) : v);
  for (const e of entities) {
    const k0 = o.interest ? o.interest(e) : 1;
    if (k0 < 0.15) continue;
    const cx = e.x;
    const cy = val(o.centerY, e);
    const orbitR = val(o.orbitR, e);
    const pullA = val(o.pullA, e);
    for (const f of fishes) {
      if (o.skip && o.skip(f)) continue;
      const dx = cx - f.x, dy = cy - f.y;
      const d = Math.hypot(dx, dy);
      if (d >= o.radius || d <= 1) continue;
      const k = k0 * (o.passerK && f.passer ? o.passerK : 1);
      if (o.cur) o.cur(f, k);
      const dir = f.seed % 2 < 1 ? 1 : -1;
      if (d > o.orbitBreak) {
        const pull = (pullA + (1 - d / o.radius) * o.pullB) * k;
        f.vx += (dx / d) * pull * dt;
        f.vy += (dy / d) * pull * dt;
      } else {
        const tx = -dy / d, ty = dx / d;
        const radial = (d - orbitR) * o.radialK; // 太近往外推，太远往里拉
        f.vx += (tx * o.spin * dir * k + (dx / d) * radial) * dt;
        f.vy += (ty * o.spin * dir * 0.45 * k + (dy / d) * radial * 0.45) * dt;
      }
    }
  }
}

// ---------- 主循环 ----------
let last = performance.now();
let saveTimer = 0;
let worldPaused = true; // 页面加载即在标题界面：先暂停，点「潜入水面」才运转
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  // 尺寸哨兵：任何来源的窗口变化都能触发重排
  if (window.innerWidth !== W || window.innerHeight !== H) resize();
  const env = weather.env(t);

  weather.update(dt, t);
  world.update(dt, t);
  world.stir(fishes, cursor, dt);
  for (const j of jellies) j.update(dt, t, W, H);
  for (const f of fishes) {
    f.update(dt, t, world, fishes, foods, cursor, env);
    if (f.justGrew) {
      f.justGrew = false;
      UI.toast(`🐟 「${f.persona?.name || f.sp.name}」长成了${STAGE_NAMES[f.stage]}！`, true);
      if (selected === f) chat.updateGrowth(f);
      if (f.stage >= 2) unlockLore('grown', '🌾 深海的低语：营养从不属于我，它只是路过我。');
    }
  }
  // 路过鱼游出屏幕，就此道别
  for (let i = fishes.length - 1; i >= 0; i--) {
    const f = fishes[i];
    if (f.passer && !f.hold && (f.x < -130 || f.x > W + 130)) {
      fishes.splice(i, 1);
      if (selected === f) { deselect(); chat.close(); }
    }
  }
  // 弥留播报 + 钻沙扬沙 + 钻沙完成
  for (let i = fishes.length - 1; i >= 0; i--) {
    const f = fishes[i];
    if (f.justDying) {
      f.justDying = false;
      UI.toast(`🕯 「${f.persona?.name || f.sp.name}」的大限快到了……`, true);
      if (selected === f) chat.updateGrowth(f);
    }
    if (f.burrowing) {
      f._sandT = (f._sandT || 0) + dt;
      if (f._sandT > 0.22) {
        f._sandT = 0;
        sparkles.burst(f.x + rand(-16, 16), world.floorY - 8, rgba('#c9b28a', 0.75), 4, 46, false);
      }
      if (f.burrowT >= 10) {
        const info = { name: f.persona?.name || f.sp.name, species: f.sp.name, stage: STAGE_NAMES[f.stage], age: +f.ageDays.toFixed(1) };
        const noteP = generateLastWords(f);
        const idx = fishes.indexOf(f);
        if (idx >= 0) fishes.splice(idx, 1);
        if (selected === f) { deselect(); chat.close(); }
        starQueue.push({ x: f.burrowX, timer: 60, info, noteP });
        sparkles.burst(f.burrowX, world.floorY - 10, rgba('#c9b28a', 0.9), 16, 70, false);
        UI.toast(`🌊 「${info.name}」已长眠于沙床之下`, true);
        unlockLore('bury', '🌫 深海的低语：它沉下去的时候，像一整片海在休息。');
      }
    }
  }
  for (const food of foods) food.update(dt, t, world);
  for (const egg of eggs) egg.update(dt, t, world);
  for (const b of bottles) b.update(dt, t, world);
  for (const st of stars) st.update(dt, t, world);
  for (const b of boxes) b.update(dt, t, world);
  // 完全没入沙中的瓶子从海里消失
  for (let i = bottles.length - 1; i >= 0; i--) {
    if (bottles[i].bury >= 1) bottles.splice(i, 1);
  }
  sparkles.update(dt);
  mealtime();
  updateDust(dt);

  // 长按连撒鱼饵（每 0.5 秒一撮）
  if (holdFeeding && cursor.down && !dragItem) {
    holdTimer += dt;
    if (holdTimer >= 0.5) {
      holdTimer -= 0.5;
      feed(cursor.x, cursor.y);
    }
  }

  // 漂流瓶吸引鱼群围观：路过鱼与弥留的鱼都毫无兴趣；下坠时吸引力满格，陷沙越深越没鱼搭理
  for (const f of fishes) if (!f.passer) f._bottleCur = null;
  swirlAttract(bottles, fishes, dt, {
    radius: 620, orbitBreak: 140,
    orbitR: (b) => (b.landed ? 80 : 92),        // 下坠时圈子稍大，别碰到瓶身
    centerY: (b) => b.y - (b.landed ? 52 : 34), // 兜圈中心：瓶子上方
    pullA: (b) => (b.landed ? 120 : 170), pullB: 180,
    spin: 130, radialK: 1.6,
    interest: (b) => 1 - b.bury,
    skip: (f) => f.passer || f.dying,
    cur: (f, k) => { f._bottleCur = k; },
  });

  // 星辰：对鱼的吸引力比漂流瓶更大，路过鱼也偶尔驻足（旅人鱼只是稍作停留）
  swirlAttract(stars, fishes, dt, {
    radius: 700, orbitBreak: 150, orbitR: 88,
    centerY: (st) => st.y - (st.landed ? 46 : 40),
    pullA: 0, pullB: 340,
    spin: 140, radialK: 1.5,
    interest: (st) => (st.alive ? 1 : 0),
    skip: (f) => f.dying || f.burrowing,
    passerK: 0.4,
    cur: (f) => { f._bottleCur = 1; },
  });

  // 音乐盒：鱼群围观听歌（收回背包后自然散去；弥留的鱼不被打扰）
  swirlAttract(boxes, fishes, dt, {
    radius: 520, orbitBreak: 130, orbitR: 76,
    centerY: (b) => b.y - 30,
    pullA: 40, pullB: 260,
    spin: 110, radialK: 1.4,
    skip: (f) => f.dying || f.burrowing,
    passerK: 0.5,
  });

  // 夜光藻漂移
  for (let i = plankton.length - 1; i >= 0; i--) {
    const p = plankton[i];
    p.life += dt;
    p.x += p.vx * dt + Math.sin(t * 1.5 + p.hue) * 4 * dt;
    p.y += p.vy * dt;
    p.vx *= 0.965; p.vy *= 0.965;
    p.vy -= 3 * dt; // 微微上浮
    if (p.life > p.max) plankton.splice(i, 1);
  }

  // 漂流瓶事件：海里没有瓶子且背包不缺时，偶尔自然沉一只下来
  if (bottles.length === 0) {
    bottleTimer -= dt;
    if (bottleTimer <= 0) {
      const b = new Bottle(rand(W * 0.18, W * 0.82), null);
      b.onLanded = () => UI.toast('🧴 一只漂流瓶沉到了沙床上…', true);
      bottles.push(b);
      bottleTimer = rand(130, 240);
    }
  }

  // 音乐盒事件：海里最多同时两只，比漂流瓶更稀罕（没导入曲目时不会有）
  if (boxes.length < 2) {
    boxTimer -= dt;
    if (boxTimer <= 0) {
      boxTimer = rand(200, 380);
      spawnMusicBox();
    }
  }

  // 星辰降临：长眠一分钟后，一颗星星带着遗言落进缸里
  for (let i = starQueue.length - 1; i >= 0; i--) {
    const q = starQueue[i];
    q.timer -= dt;
    if (q.timer <= 0) {
      const st = new Star(q.x, q.info, null);
      if (q.noteP) q.noteP.then((n) => { st.note = n; }).catch(() => {});
      stars.push(st);
      starQueue.splice(i, 1);
      UI.toast('⭐ 一颗星星落进了缸里……', true);
    }
  }
  for (let i = stars.length - 1; i >= 0; i--) {
    if (!stars[i].alive) stars.splice(i, 1); // 三天后星光熄灭
  }

  // 鱼的存档：每 8 秒存一次（路过鱼不入册）
  saveTimer += dt;
  if (saveTimer > 8) { saveTimer = 0; saveFish(); }

  // 路过鱼：平时少见，下雨变多，暴雨更多
  passerTimer -= dt;
  if (passerTimer <= 0) {
    passerTimer = weather.state === 'storm' ? rand(14, 30) : weather.state === 'rain' ? rand(26, 55) : rand(55, 110);
    const passerCount = fishes.reduce((n, f) => n + (f.passer ? 1 : 0), 0);
    if (passerCount < 3) spawnPasser();
  }

  // 涟漪
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.life += dt;
    if (r.life > 0) r.r += 60 * dt;
    if (r.life > 0.9) ripples.splice(i, 1);
  }

  // ---- 绘制 ----
  world.drawBack(ctx, t, env);
  // 两块石板先画：它们躺在海床上，鱼、尘埃、饲料、瓶子、星星都从它们前面经过
  whaleStone.draw(ctx, t);
  clockStone.draw(ctx, t, weather.dayCount, weather.hourAt(t), weather.hourFrac(t));
  for (const j of jellies) j.draw(ctx, t);
  for (const f of [...fishes].sort((a, b) => a.z - b.z)) f.draw(ctx, t, env);
  for (const food of foods) food.draw(ctx);
  for (const d of dusts) d.draw(ctx, t);
  for (const egg of eggs) egg.draw(ctx, t);
  for (const b of bottles) b.draw(ctx, t, env);
  for (const st of stars) st.draw(ctx, t);
  for (const b of boxes) b.draw(ctx, t, env, boxes[boxes.length - 1] === b);
  sparkles.draw(ctx);
  world.drawMid(ctx, t, env);

  // 夜光藻（夜里的重头戏）
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of plankton) {
    const a = Math.sin(Math.PI * clamp(p.life / p.max, 0, 1));
    const bright = 0.18 + env.night * 0.82;
    ctx.fillStyle = `hsla(${p.hue}, 95%, 72%, ${(a * bright).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.6 + a * 0.6), 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  world.drawFront(ctx, t);
  weather.drawSurfaceFX(ctx);
  weather.drawVeil(ctx);

  // 点击涟漪
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const r of ripples) {
    if (r.life < 0) continue;
    const a = 0.5 * (1 - r.life / 0.9);
    ctx.strokeStyle = `rgba(160,230,255,${a})`;
    ctx.lineWidth = r.r < 40 ? 1.6 : 1.2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();

  // 选中态：光环 + 名牌
  if (selected) {
    const L = selected.length;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(160,240,255,${0.4 + 0.2 * Math.sin(t * 4)})`;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.arc(selected.x, selected.y, L * 1.1 + 8, 0, TAU);
    ctx.stroke();
    ctx.restore();

    const name = selected.persona ? selected.persona.name : '未登记';
    ctx.font = '14px "Microsoft YaHei", sans-serif';
    const tw = textW(name);
    const bx = selected.x - tw / 2 - 12;
    const by = selected.y - L - 34;
    ctx.fillStyle = 'rgba(4,16,30,0.8)';
    ctx.strokeStyle = 'rgba(111,227,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bx, by, tw + 24, 26, 13);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d8ecf5';
    ctx.fillText(name, bx + 12, by + 18);
  }

  // 路过鱼头顶的小名牌：一眼认出这是旅人（半透明旅人风）
  for (const f of fishes) {
    if (!f.passer || !f.persona || selected === f) continue;
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    const tw = textW(f.persona.name);
    const bx = f.x - tw / 2 - 10;
    const by = f.y - f.length - 26;
    ctx.fillStyle = 'rgba(4,16,30,0.5)';
    ctx.beginPath();
    ctx.roundRect(bx, by, tw + 20, 20, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(216,236,245,0.72)';
    ctx.fillText(f.persona.name, bx + 10, by + 14);
  }

  // 自家鱼常显名牌：开启「显示鱼名」时，展示所有非选中自家鱼的名字（与旅人样式区分）
  if (showFishNames) {
    for (const f of fishes) {
      if (f.passer || !f.persona || selected === f) continue;
      const name = f.persona.name;
      const rc = RARITY_COLORS[f.sp.rarity] || RARITY_COLORS[0];
      ctx.font = '13px "Microsoft YaHei", sans-serif';
      const tw = textW(name);
      const bx = f.x - tw / 2 - 11;
      const by = f.y - f.length - 28;
      // 自家鱼名牌：按物种稀有度着色（描边 + 微光），文字保持高亮
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(rc, 0.10 + 0.05 * Math.sin(t * 2 + f.seed));
      ctx.beginPath();
      ctx.roundRect(bx, by, tw + 22, 24, 12);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(8,28,46,0.82)';
      ctx.strokeStyle = rgba(rc, 0.85);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(bx, by, tw + 22, 24, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#d8ecf5';
      ctx.fillText(name, bx + 11, by + 16.5);
    }
  }

  UI.updateHUD(collection.lumens, residentCount());
  UI.setEggReady(
    collection.lumens >= EGG_COST && eggs.length < 2 && residentCount() < MAX_FISH,
    eggs.length,
  );
  updateEnvChip(t);
}
function loop(now) {
  lastRaf = now;
  if (!worldPaused) tick(now);
  requestAnimationFrame(loop);
}
// 看门狗：rAF 被浏览器节流（如标签页在后台）时，用定时器补帧，保证鱼继续成长
let lastRaf = performance.now();
setInterval(() => {
  if (!worldPaused && performance.now() - lastRaf > 250) tick(performance.now());
}, 100);
resize();
// 标题界面：先渲染一帧静态深海作为背景，随后保持暂停
tick(performance.now());
requestAnimationFrame(loop);
