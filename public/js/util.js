// ============ 小工具 ============
export const TAU = Math.PI * 2;

export function hexRGB(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex, a) {
  const [r, g, b] = hexRGB(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** 变暗/提亮: f<1 变暗, f>1 提亮 */
export function shade(hex, f) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  const [r, g, b] = hexRGB(hex);
  return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
}

/** 把 'rgba(r,g,b,a)' 的 alpha 换成 0，用于渐变终点 */
export function fadeColor(c) {
  return c.replace(/[\d.]+\)$/, '0)');
}

export function rand(a, b) {
  return a + Math.random() * (b - a);
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

// 缸内实体（鱼/水母/卵/瓶子/星星/粒子）的全局放大系数，背景不受影响
export const SCALE = 1.35;

export const el = (id) => document.getElementById(id);
