// ============ 物种图鉴数据 ============
// shape: sleek 细长 | round 圆身 | angel 高身 | squid 鱿 | nautilus 鹦鹉螺 | angler 鮟鱇 | ribbon 带状
export const RARITY_NAMES = ['常见', '罕见', '稀有', '史诗', '传说'];
export const RARITY_COLORS = ['#9fb8c6', '#6fe3ff', '#b48cff', '#ff9d6f', '#ffd77a'];
export const RARITY_WEIGHTS = [42, 27, 16, 10, 5];

export const SPECIES = [
  {
    id: 'zebra', name: '斑马光纹鱼', rarity: 0, shape: 'sleek', size: 0.68, speed: 1.3, school: 2.0,
    depth: [0.12, 0.55], body: '#8fd8f0', belly: '#eafbff', accent: '#255f86', glow: 'rgba(120,220,255,0.16)',
    desc: '成群结队的小小光纹，受惊时会整齐地集体转向。',
  },
  {
    id: 'clown', name: '橙幕小丑鱼', rarity: 0, shape: 'round', size: 0.8, speed: 1.0, school: 0.6,
    depth: [0.2, 0.6], body: '#ff9a3c', belly: '#ffd9ad', accent: '#f4f9ff', glow: 'rgba(255,160,70,0.14)',
    desc: '总以为自己藏进了海葵，其实缸里并没有海葵。',
  },
  {
    id: 'tang', name: '蓝月倒吊', rarity: 1, shape: 'round', size: 0.92, speed: 1.1, school: 0.5,
    depth: [0.15, 0.6], body: '#2f7de0', belly: '#7fb8ff', accent: '#ffd23c', glow: 'rgba(70,140,255,0.18)',
    desc: '一抹流动的深蓝，尾鳍上挂着两枚小小的月亮。',
  },
  {
    id: 'neon', name: '霓虹灯鱼', rarity: 0, shape: 'sleek', size: 0.55, speed: 1.35, school: 2.2,
    depth: [0.15, 0.5], body: '#5cc8e8', belly: '#e8fcff', accent: '#ff5c8a', glow: 'rgba(90,220,255,0.26)',
    lureDots: true,
    desc: '身上有一条会发光的霓虹带，成群游过时像一段电流。',
  },
  {
    id: 'butterfly', name: '柠檬蝴蝶鱼', rarity: 1, shape: 'round', size: 0.78, speed: 1.0, school: 0.5,
    depth: [0.15, 0.55], body: '#ffd23c', belly: '#fff3c4', accent: '#2b2b33', glow: 'rgba(255,210,60,0.18)',
    eyeBand: true,
    desc: '眼睛上蒙着一条黑色面纱，像一位柠檬味的小侠客。',
  },
  {
    id: 'glasscat', name: '玻璃猫灯鱼', rarity: 1, shape: 'sleek', size: 0.7, speed: 1.2, school: 1.6,
    depth: [0.2, 0.6], body: '#bfe3ef', belly: '#f2fcff', accent: '#8fd0e8', glow: 'rgba(200,240,255,0.2)',
    ghost: true,
    desc: '身体透明得能看见心事，灯一照就只剩轮廓。',
  },
  {
    id: 'lantern', name: '灯笼鱼', rarity: 1, shape: 'sleek', size: 0.7, speed: 1.0, school: 1.4,
    depth: [0.35, 0.8], body: '#40607e', belly: '#9fc3d8', accent: '#1d344f', glow: 'rgba(140,230,255,0.22)',
    lure: '#aef4ff', lureDots: true,
    desc: '提着一盏小灯在昏暗处巡夜，灯下常有微光尘埃。',
  },
  {
    id: 'lionfish', name: '霞光蓑鲉', rarity: 2, shape: 'angel', size: 1.0, speed: 0.7, school: 0.3,
    depth: [0.25, 0.7], body: '#d95f4c', belly: '#ffd9c2', accent: '#7a2a22', glow: 'rgba(255,120,90,0.2)',
    spiky: true,
    desc: '撑开一扇斑斓的羽扇，美得很张扬，也略有脾气。',
  },
  {
    id: 'angelfish', name: '月光神仙鱼', rarity: 2, shape: 'angel', size: 0.95, speed: 0.85, school: 0.4,
    depth: [0.18, 0.62], body: '#cfe2ec', belly: '#f4fbff', accent: '#3a5f7d', glow: 'rgba(200,235,255,0.2)',
    desc: '游动时像一片竖起来的月光，缓慢而庄重。',
  },
  {
    id: 'firefly', name: '萤火鱿', rarity: 2, shape: 'squid', size: 0.72, speed: 1.15, school: 1.2,
    depth: [0.25, 0.7], body: '#3d5a80', belly: '#bfe8ff', accent: '#9ff2ff', glow: 'rgba(120,242,255,0.3)',
    desc: '全身缀满会呼吸的光点，夜里像一小段星河。',
  },
  {
    id: 'flamesquid', name: '火焰乌贼', rarity: 3, shape: 'squid', size: 0.82, speed: 1.1, school: 0.8,
    depth: [0.35, 0.8], body: '#e8552f', belly: '#ffb37a', accent: '#ffd23c', glow: 'rgba(255,110,50,0.28)',
    desc: '会喷火焰颜色的墨，舞起来像深海里的一簇火苗。',
  },
  {
    id: 'nautilus', name: '星纹鹦鹉螺', rarity: 3, shape: 'nautilus', size: 1.0, speed: 0.6, school: 0,
    depth: [0.55, 0.9], body: '#d8cdb8', belly: '#fff7e8', accent: '#8a6d4a', glow: 'rgba(255,230,180,0.16)',
    desc: '活化石。它转一圈螺旋，要花掉四亿年。',
  },
  {
    id: 'dragon', name: '赤鳞龙鱼', rarity: 3, shape: 'sleek', size: 1.15, speed: 1.2, school: 0.3,
    depth: [0.4, 0.85], body: '#c22f2f', belly: '#ff8a5c', accent: '#2a0d10', glow: 'rgba(255,90,60,0.22)',
    fangs: true, elongate: 1.25,
    desc: '深海熔岩的颜色。据说它心情好的时候鳞片会发烫。',
  },
  {
    id: 'angler', name: '深海鮟鱇', rarity: 3, shape: 'angler', size: 1.1, speed: 0.55, school: 0,
    depth: [0.72, 0.95], body: '#232d3c', belly: '#5c7186', accent: '#141a24', glow: 'rgba(160,220,255,0.24)',
    lure: '#d8f6ff', fangs: true,
    desc: '提灯的伏击者。微笑的弧度稍微有点吓人，但它是善意的。',
  },
  {
    id: 'koi', name: '鎏金锦鲤', rarity: 4, shape: 'round', size: 1.2, speed: 0.9, school: 0.3,
    depth: [0.12, 0.55], body: '#ffb63c', belly: '#fff2cf', accent: '#e8452a', glow: 'rgba(255,200,90,0.3)',
    desc: '一道游动的鎏金。见者据说会有好运，缸主表示确实。',
  },
  {
    id: 'ray', name: '月影鳐', rarity: 4, shape: 'ray', size: 1.35, speed: 0.55, school: 0,
    depth: [0.25, 0.65], body: '#8fa8c8', belly: '#e8f2fc', accent: '#5c7ba6', glow: 'rgba(170,205,255,0.24)',
    desc: '一双翅膀慢慢扇动，像月光下掠过的一段影子。',
  },

];

// 未收录但会在图鉴里留下剪影的传说生物
export const TEASERS = [
  { id: 'whale', name: '？？？？？', rarity: 4, body: '#0a1626', accent: '#0a1626',
    desc: '偶尔有巨大的影子从缸外掠过……那不是缸里的住民。' },
];

export function pickSpecies(preferUndiscovered = true) {
  // 先按权重抽稀有度，再在该层内尽量挑未收录的
  const total = RARITY_WEIGHTS.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  let rarity = 0;
  for (let i = 0; i < RARITY_WEIGHTS.length; i++) {
    if (roll < RARITY_WEIGHTS[i]) { rarity = i; break; }
    roll -= RARITY_WEIGHTS[i];
  }
  let pool = SPECIES.filter(s => s.rarity === rarity);
  if (preferUndiscovered && pool.length > 1) {
    const fresh = pool.filter(s => !window.__wanling?.isDiscovered(s.id));
    if (fresh.length) pool = fresh;
  }
  return pool[(Math.random() * pool.length) | 0];
}
