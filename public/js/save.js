// ============ 存档：鱼的常规自动存档 + 手动存档槽 + 读档恢复（纯读写，无渲染） ============
// main.js 只负责喂状态和接 UI 按钮；localStorage 的键名全部集中在这里，
// 别处一律 import 这些常量，杜绝魔法字符串各写一份。
import { clamp } from './util.js';
import { CYCLE } from './weather.js';
import { STORAGE_KEY as COLLECTION_KEY } from './collection.js';
import { BOX_LAND_OFFSET } from './musicbox.js';

export const FISH_KEY = 'wanling.fish.v1';
export const SLOT_KEY = 'wanling.slot.v1';            // 手动存档槽
export const PENDING_KEY = 'wanling.pendingRestore';  // 读档后待恢复的世界状态
export const LORE_KEY = 'wanling.lore';
export const DAY_KEY = 'wanling.day';

// 读档瞬间禁止自动保存覆盖（pagehide / 定时器都会触发 saveFish）
let suppressSave = false;

/** 把当前鱼群与卵写进常规存档键（fishes 里路过鱼不入册） */
export function saveFish(fishes, eggs) {
  if (suppressSave) return;
  try {
    localStorage.setItem(FISH_KEY, JSON.stringify(
      fishes.filter((f) => !f.passer).slice(0, 30).map((f) => ({
        sp: f.sp.id,
        age: +f.ageDays.toFixed(2),
        nut: f.nutrition,
        life: f.lifespanStd,
        lifeAct: +f.lifespanActual.toFixed(2),
        persona: f.persona,
        log: (f.chatLog || []).slice(-20),
      })),
    ));
    // 未孵化的卵也要存档，别让玩家白花钱
    localStorage.setItem(FISH_KEY + '.eggs', JSON.stringify(
      eggs.filter((e) => !e.hatched).map((e) => ({ x: Math.round(e.x), sp: e.sp.id })),
    ));
  } catch { /* 存不下就算了 */ }
}

/** 读取鱼的常规存档（null = 新档） */
export function readFishSave() {
  try { return JSON.parse(localStorage.getItem(FISH_KEY) || 'null'); } catch { return null; }
}

export function readEggSave() {
  try { return JSON.parse(localStorage.getItem(FISH_KEY + '.eggs') || 'null'); } catch { return null; }
}

/** 重开一局：删掉旧鱼/卵存档，让 spawnInitial 走"新档"分支 */
export function clearRunSave() {
  try {
    localStorage.removeItem(FISH_KEY);
    localStorage.removeItem(FISH_KEY + '.eggs');
  } catch { /* 隐私模式无所谓 */ }
}

/**
 * 把此刻的整缸状态打包成可导出的快照。
 * state = { fishes, eggs, collection, lore, weather, bottles, stars, boxes }
 */
export function buildSnapshot(state) {
  const { fishes, eggs, collection, lore, weather, bottles, stars, boxes } = state;
  saveFish(fishes, eggs);   // 先把当前鱼群写进常规存档键
  collection.save();
  let fish = [], eggList = [];
  try {
    fish = JSON.parse(localStorage.getItem(FISH_KEY) || '[]');
    eggList = JSON.parse(localStorage.getItem(FISH_KEY + '.eggs') || '[]');
  } catch { /* 忽略 */ }
  return {
    at: Date.now(),
    fish,
    eggs: eggList,
    collection: JSON.parse(JSON.stringify(collection.data)),
    lore: { ...lore },
    weather: {
      phase: weather.phase(performance.now() / 1000), // 存相位而非 t0：t0 跨刷新无法还原时刻
      state: weather.state,
      stateTimer: weather.stateTimer,
      rainI: weather.rainI,
      stormI: weather.stormI,
      fireDawn: weather.fireDawn,
      fireDusk: weather.fireDusk,
      dayCount: weather.dayCount,
    },
    bottles: bottles.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), landed: b.landed, note: b.note ?? null, sandAge: b.sandAge, fav: !!b.fav })),
    stars: stars.map((s) => ({ x: Math.round(s.x), y: Math.round(s.y), landed: s.landed, info: s.info, note: s.note ?? null, age: s.age, fav: !!s.fav })),
    boxes: boxes.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), landed: b.landed, track: b.track, fav: !!b.fav })),
  };
}

/** 存档槽的概要信息（null = 还没有手动存档） */
export function slotInfo() {
  try {
    const s = JSON.parse(localStorage.getItem(SLOT_KEY) || 'null');
    if (!s || !s.at) return null;
    return { at: s.at, fish: (s.fish || []).length };
  } catch { return null; }
}

export function saveSlot(snapshot) {
  try {
    localStorage.setItem(SLOT_KEY, JSON.stringify(snapshot));
    return true;
  } catch { return false; }
}

/** 把存档写回常规存储键，然后由调用方刷新页面（所有既有加载逻辑都会读到它） */
export function loadSlot() {
  suppressSave = true; // 关键：别让卸载时的自动保存把还原的数据再盖回去
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SLOT_KEY) || 'null'); } catch { s = null; }
  if (!s) return false;
  try {
    localStorage.setItem(FISH_KEY, JSON.stringify(s.fish || []));
    localStorage.setItem(FISH_KEY + '.eggs', JSON.stringify(s.eggs || []));
    if (s.collection) localStorage.setItem(COLLECTION_KEY, JSON.stringify(s.collection));
    if (s.lore) localStorage.setItem(LORE_KEY, JSON.stringify(s.lore));
    localStorage.setItem(PENDING_KEY, JSON.stringify({ weather: s.weather, bottles: s.bottles, stars: s.stars, boxes: s.boxes }));
    return true;
  } catch { return false; }
}

/**
 * 读档后：把存档那一刻的天气、海里的漂流瓶、星辰与音乐盒一并还原。
 * ctx = { weather, world, bottles, stars, boxes, Bottle, Star, MusicBox }
 */
export function applyPendingRestore(ctx) {
  const { weather, world, bottles, stars, boxes, Bottle, Star, MusicBox } = ctx;
  let pw = null;
  try {
    pw = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
  } catch { pw = null; }
  if (!pw) return;
  try { localStorage.removeItem(PENDING_KEY); } catch { /* 忽略 */ }
  if (pw.weather) {
    // t0 是相对「那一次会话」时钟的偏移，跨刷新没有意义；存档里存的是昼夜相位，
    // 在这里按当前会话的时钟重新折算成 t0
    const w = { ...pw.weather };
    const phase = w.phase;
    delete w.t0;    // 旧版存档残留的 t0 直接丢弃
    delete w.phase; // 相位只是载体，别覆盖 weather.phase() 方法
    Object.assign(weather, w);
    if (Number.isFinite(phase)) {
      weather.t0 = phase * CYCLE - performance.now() / 1000;
    }
  }
  if (Array.isArray(pw.bottles)) {
    for (const b of pw.bottles) {
      const nb = new Bottle(clamp(b.x, 20, world.w - 20), b.note ?? null);
      nb.y = b.landed ? world.floorY - 10 : Math.min(b.y ?? 0, world.floorY - 20);
      nb.landed = !!b.landed;
      nb.sandAge = b.sandAge ?? 0;
      nb.bury = clamp(nb.sandAge, 0, 1);
      nb.fav = !!b.fav;
      bottles.push(nb);
    }
  }
  if (Array.isArray(pw.stars)) {
    for (const s of pw.stars) {
      const ns = new Star(clamp(s.x, 20, world.w - 20), s.info || { name: '无名' }, s.note ?? null);
      ns.y = s.landed ? world.floorY - 8 : Math.min(s.y ?? 0, world.floorY - 20);
      ns.landed = !!s.landed;
      ns.age = s.age ?? 0;
      ns.fav = !!s.fav;
      stars.push(ns);
    }
  }
  if (Array.isArray(pw.boxes)) {
    for (const b of pw.boxes) {
      if (!b.track || !b.track.src) continue;
      const nb = new MusicBox(clamp(b.x, 20, world.w - 20), b.track);
      nb.y = b.landed ? world.floorY - BOX_LAND_OFFSET : Math.min(b.y ?? 0, world.floorY - BOX_LAND_OFFSET - 6);
      nb.landed = !!b.landed;
      nb.fav = !!b.fav;
      boxes.push(nb);
    }
  }
}
