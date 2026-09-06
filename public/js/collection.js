// ============ 万灵图鉴：收录进度 + 背包 + localStorage 持久化 ============
import { SPECIES, TEASERS, RARITY_NAMES, RARITY_COLORS } from './species.js';
import { el } from './util.js';
import { speciesPortrait } from './portrait.js';

const KEY = 'wanling.v1';

export class Collection {
  constructor() {
    this.data = { lumens: 80, discovered: {}, fed: 0, hatched: 0, backpack: [], trash: [] };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        Object.assign(this.data, saved);
        this.data.discovered = saved.discovered || {};
        this.data.backpack = Array.isArray(saved.backpack) ? saved.backpack : [];
        this.data.trash = Array.isArray(saved.trash) ? saved.trash : [];
      }
    } catch { /* 损坏就重新开始 */ }
    this.gridEl = el('collection-grid');
    this.progressEl = el('collection-progress');
    this.onchange = null;
    this.onbackpack = null;
    this.render();
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* 隐私模式无所谓 */ }
  }

  _touch() {
    this.save();
    if (this.onchange) this.onchange();
  }

  // ---------- 背包 ----------
  get backpack() { return this.data.backpack; }
  get trash() { return this.data.trash; }

  addToBackpack(item) {
    this.data.backpack.push(item);
    this.save();
    if (this.onbackpack) this.onbackpack();
  }

  removeFromBackpack(id) {
    this.data.backpack = this.data.backpack.filter((b) => b.id !== id);
    this.save();
    if (this.onbackpack) this.onbackpack();
  }

  // 收藏 / 取消收藏
  toggleFav(id) {
    const it = this.data.backpack.find((b) => b.id === id);
    if (!it) return;
    it.fav = !it.fav;
    this.save();
    if (this.onbackpack) this.onbackpack();
  }

  // 移入垃圾箱（可恢复）
  toTrash(id) {
    const idx = this.data.backpack.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const [it] = this.data.backpack.splice(idx, 1);
    it.fav = false;
    this.data.trash.unshift(it);
    this.save();
    if (this.onbackpack) this.onbackpack();
  }

  // 从垃圾箱恢复
  restoreFromTrash(id) {
    const idx = this.data.trash.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const [it] = this.data.trash.splice(idx, 1);
    this.data.backpack.push(it);
    this.save();
    if (this.onbackpack) this.onbackpack();
  }

  // 永久删除
  purgeFromTrash(id) {
    this.data.trash = this.data.trash.filter((b) => b.id !== id);
    this.save();
    if (this.onbackpack) this.onbackpack();
  }

  // 清空垃圾箱
  emptyTrash() {
    this.data.trash = [];
    this.save();
    if (this.onbackpack) this.onbackpack();
  }

  get lumens() { return this.data.lumens; }

  addLumens(n) {
    this.data.lumens = Math.max(0, Math.round((this.data.lumens + n) * 10) / 10);
    this._touch();
  }

  isDiscovered(id) { return !!this.data.discovered[id]; }

  get discoveredCount() {
    return SPECIES.filter((s) => this.isDiscovered(s.id)).length;
  }

  discover(id) {
    this.data.discovered[id] = (this.data.discovered[id] || 0) + 1;
    this.data.hatched++;
    this.render();
    this._touch();
  }

  addFed() {
    this.data.fed++;
    this._touch();
  }

  render() {
    this.progressEl.textContent = `已收录 ${this.discoveredCount} / ${SPECIES.length} 种 · 累计投喂 ${this.data.fed} 次`;
    const cards = [];
    for (const sp of [...SPECIES, ...TEASERS]) {
      const found = this.isDiscovered(sp.id);
      const count = this.data.discovered[sp.id] || 0;
      const rn = RARITY_NAMES[sp.rarity];
      const rc = RARITY_COLORS[sp.rarity];
      const card = document.createElement('div');
      card.className = 'dex-card' + (found ? '' : ' locked');
      card.innerHTML = `
        <span class="rarity-tag r-${sp.rarity}">${rn}</span>
        <h3>${found ? sp.name : '？？？'}</h3>
        <p class="desc">${sp.desc}</p>
        ${sp.id === 'whale' ? '' : `<div class="count">${found ? `已孵化 × ${count}` : '尚未收录'}</div>`}
      `;
      // 头像：直接用缸内同款画法渲染的物种标本
      const portrait = speciesPortrait(sp, 96);
      if (portrait) {
        const cv = document.createElement('canvas');
        cv.className = 'swatch-canvas';
        cv.width = 96;
        cv.height = 96;
        cv.getContext('2d').drawImage(portrait, 0, 0);
        card.prepend(cv);
      } else {
        const sw = document.createElement('div');
        sw.className = 'swatch';
        sw.style.background = sp.body;
        card.prepend(sw);
      }
      cards.push(card);
    }
    this.gridEl.replaceChildren(...cards);
  }

  reset() {
    this.data = { lumens: 80, discovered: {}, fed: 0, hatched: 0, backpack: [], trash: [] };
    this.render();
    this._touch();
  }
}
