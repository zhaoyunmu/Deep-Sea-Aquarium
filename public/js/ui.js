// ============ UI：HUD / toast / 面板开关 ============
import { el } from './util.js';

let lastLumens = -1;
let lastFish = -1;
let lastEggState = null;

export function updateHUD(lumens, fishCount) {
  if (lumens !== lastLumens) {
    el('lumens-count').textContent = lumens % 1 === 0 ? lumens : lumens.toFixed(1);
    lastLumens = lumens;
  }
  if (fishCount !== lastFish) {
    el('fish-count').textContent = fishCount;
    lastFish = fishCount;
  }
}

// 神秘卵按钮：可买/不可买的观感 + 缸里卵的数量提示
export function setEggReady(ready, eggCount) {
  const state = `${ready}|${eggCount}`;
  if (state === lastEggState) return;
  lastEggState = state;
  const btn = el('btn-egg');
  btn.classList.toggle('lack', !ready);
  btn.classList.toggle('pending', eggCount > 0);
}

// 鲸之石状态：只有密钥真实可用（服务端向上游验证通过）才会亮起
export function setAIStatus() { /* 石碑直接读 AI.online */ }

export function toast(text, rare = false, dur = 3600) {
  const wrap = el('toasts');
  const t = document.createElement('div');
  t.className = 'toast' + (rare ? ' rare' : '');
  t.textContent = text;
  wrap.appendChild(t);
  while (wrap.children.length > 3) wrap.firstChild.remove();
  setTimeout(() => t.classList.add('fade'), dur);
  setTimeout(() => t.remove(), dur + 700);
}

export function togglePanel(id, show) {
  const p = el(id);
  const willShow = show ?? p.classList.contains('hidden');
  p.classList.toggle('hidden', !willShow);
  return willShow;
}

export function initUI({ onPanelClose }) {
  // 通用关闭按钮
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.close;
      el(id).classList.add('hidden');
      if (onPanelClose) onPanelClose(id);
    });
  });
}

export function showGameChrome() {
  el('hud').classList.remove('hidden');
  el('exit-bar').classList.remove('hidden');
  el('hint').classList.remove('hidden');
  setTimeout(() => {
    const h = el('hint');
    if (h) {
      h.style.opacity = '0';
      setTimeout(() => h.classList.add('hidden'), 1200);
    }
  }, 16000);
}

export function hideGameChrome() {
  el('hud').classList.add('hidden');
  el('exit-bar').classList.add('hidden');
  el('hint').classList.add('hidden');
}
