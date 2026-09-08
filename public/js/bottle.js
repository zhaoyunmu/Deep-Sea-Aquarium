// ============ 漂流瓶：沉底可读，收进背包后可再放飞，落入沙中会慢慢掩埋 ============
// 文案策略：开瓶从「经典句库 + AI 通过验收的句子」里直接抽成品；
// AI 在后台按经典句的气质批量写新句子，验收合格后入库，句库越玩越丰富。
import { TAU, rand, clamp, SCALE } from './util.js';
import { DAY_SECONDS } from './fish.js';
import { AI } from './ai.js';

const CANNED = [
  '「如果你捡到这只瓶子，说明洋流今天心情不错。」',
  '「别急，珊瑚长成礁也要一千年。」',
  '「上面世界的雨声，从下面听像掌声。」',
  '「嗅不足春香，尝不满夏生。」——小河',
  '「鱼的记忆不止七秒——只是我们不想记住的事太多。」',
  '「愿你被温柔地网住，再被温柔地放走。」',
  '「春天没有国籍，白云是世界的公民。」——北岛',
  '「把心事写进沙子里吧，潮水会替你保管。」',
  '「暗处发光的，从来不止灯。」',
];
const CANNED_CORE = CANNED.map((s) => s.replace(/^[「『"']+/, '').replace(/[」』"']+$/, ''));

// 名人名言（带署名）。显示为「句子。」——作者；开瓶时若以「开头则原样展示
const QUOTES = [
  '「面朝大海,春暖花开。」——海子',
  '「海内存知己,天涯若比邻。」——王勃',
  '「生如夏花之绚烂,死如秋叶之静美。」——泰戈尔',
  '「天空没有留下鸟的痕迹,但我已飞过。」——泰戈尔',
  '「凡是过往,皆为序章。」——莎士比亚',
  '「黑夜给了我黑色的眼睛,我却用它寻找光明。」——顾城',
  '「你不可能横渡海洋,除非你敢于把海岸抛在身后。」——哥伦布',
  '「一个人可以被毁灭,但不能被打败。」——海明威',
  '「凡是不能杀死我的,必将使我更强大。」——尼采',
  '「此情可待成追忆,只是当时已惘然。」——李商隐',
  '「玲珑骰子安红豆,入骨相思知不知。」——温庭筠',
  '「曾经沧海难为水,除却巫山不是云。」——元稹',
  '「既然选择了远方,便只顾风雨兼程。」——汪国真',
  '「到远方去,到远方去,熟悉的地方没有风景。」——汪国真',
  '「万物皆有裂痕,那是光照进来的地方。」——莱昂纳德·科恩',
  '「黑夜无论怎样悠长,白昼总会到来。」——莎士比亚',
  '「心若没有栖息的地方,到哪里都是流浪。」——三毛',
  '「岁月极美,在于它必然的流逝。春花、秋月、夏日、冬雪。」——三毛',
  '「重要的东西,用眼睛是看不见的。」——圣埃克苏佩里《小王子》',
];

// AI 写并通过验收的句子，存在本地
const NOTES_KEY = 'wanling.notes.v1';
const NOTE_CAP = 60;
const library = { aiNotes: [], enriching: false };

function loadAiNotes() {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    library.aiNotes = Array.isArray(arr) ? arr.filter((t) => typeof t === 'string') : [];
  } catch { library.aiNotes = []; }
}
function saveAiNotes() {
  try { localStorage.setItem(NOTES_KEY, JSON.stringify(library.aiNotes.slice(-NOTE_CAP))); } catch { /* 无所谓 */ }
}
loadAiNotes();

function allNotes() {
  return [...CANNED_CORE, ...library.aiNotes];
}

// ---------- 验收：不合格的 AI 句子直接打回 ----------
function validateNote(raw) {
  if (typeof raw !== 'string') return null;
  let t = raw.trim();
  if (t.includes('\n')) return null;
  t = t.replace(/^\d+\s*[.、:：]\s*/, '');            // 去序号
  t = t.replace(/^[「『"']+[」』"']?/, '').replace(/[」』"']+$/, ''); // 去引号
  t = t.trim();
  if (!t) return null;
  if (/^(好的|当然|以下是|这是|收到|嗯)/.test(t)) return null; // 对话式前缀
  if (/[「」『』#*`_\[\]<>|]/.test(t)) return null;  // 内嵌括号 / Markdown
  if (/[a-zA-Z]{4,}/.test(t)) return null;           // 夹带英文
  const cjk = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  if (cjk < 6 || cjk > 26) return null;              // 字数 6~26
  return t;
}

function sampleNotes(n) {
  const pool = [...CANNED_CORE];
  const out = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
  }
  return out.map((s) => `「${s}」`).join('\n');
}

function noteSystemPrompt(samples) {
  return [
    '你是深海的漂流瓶管理员。下面是你过去写的字条，请保持完全一致的气质——温柔、诗意、有海洋意象、耐人寻味，绝不说教：',
    samples,
    '现在写一张全新的字条：一句话，10 到 22 个字，用「」包裹。只输出这一句，不要解释，不要与示例重复。',
  ].join('\n');
}

// 生成一张新字条（最多尝试两次），返回去掉「」的正文或 null
export async function generateNote() {
  for (let i = 0; i < 2; i++) {
    try {
      const reply = await AI.chat(
        noteSystemPrompt(sampleNotes(3)),
        [{ role: 'user', content: '写一张全新的字条。' }],
        1.3,
        120,
      );
      const firstLine = reply.split(/\r?\n/).map((x) => x.trim()).find(Boolean) || reply;
      const note = validateNote(firstLine);
      if (note) return note;
    } catch { /* 再试或放弃 */ }
  }
  return null;
}

// 开瓶时抽一句：所有句子（经典句 / 名人名言 / AI 句）概率相等，放进统一池子均匀抽取
export function fetchNote() {
  const pool = [...CANNED_CORE, ...library.aiNotes, ...QUOTES];
  if (!pool.length) return '……';
  return pool[(Math.random() * pool.length) | 0];
}

// 后台扩库：让 AI 写 5 张新字条，验收合格后入库（去重）
// 库满后依然继续：新句子入库时淘汰最旧的 AI 句子（经典句永不淘汰）
export function maybeEnrich() {
  if (!AI.online || library.enriching) return;
  library.enriching = true;
  setTimeout(async () => {
    try {
      const reply = await AI.chat(
        noteSystemPrompt(sampleNotes(4)),
        [{ role: 'user', content: '写 5 张全新的字条，一行一张。' }],
        1.3,
        320,
      );
      const added = [];
      for (const line of reply.split(/\r?\n/)) {
        const t = validateNote(line);
        if (t && !allNotes().includes(t) && !added.includes(t)) added.push(t);
      }
      if (added.length) {
        library.aiNotes.push(...added);
        const cap = Math.max(0, NOTE_CAP - CANNED_CORE.length);
        if (library.aiNotes.length > cap) library.aiNotes = library.aiNotes.slice(-cap);
        saveAiNotes();
      }
    } catch { /* 静默失败 */ }
    library.enriching = false;
  }, 2000);
}

export class Bottle {
  constructor(x, note = null) {
    this.x = x;
    this.y = -26;
    this.vy = 22;
    this.phase = rand(0, TAU);
    this.landed = false;
    this.opened = false;
    this.note = note;      // 背包里拿出来的瓶子自带字条
    this.sandAge = 0;      // 落底后经过的天数
    this.bury = 0;         // 0=崭新 1=完全被沙掩埋
    this.onLanded = null;
  }

  get attractable() {
    // 完全被沙掩埋后，鱼就不再被它吸引了
    return this.landed && this.bury < 1;
  }

  update(dt, t, world) {
    this.phase += dt;
    if (!this.landed) {
      this.vy = Math.min(75, this.vy + 16 * dt);
      this.y += this.vy * dt;
      this.x += Math.sin(this.phase * 1.2) * 13 * dt;
      if (this.y >= world.floorY - 10) {
        this.landed = true;
        this.y = world.floorY - 10;
        if (this.onLanded) this.onLanded();
      }
    } else {
      // 一天过后完全没入沙中
      this.sandAge += dt / DAY_SECONDS;
      this.bury = clamp(this.sandAge, 0, 1);
    }
  }

  draw(ctx, t, env = { glow: 1 }) {
    const fade = 1 - this.bury * 0.92;
    const dy = this.bury * 11;
    const pulse = 0.6 + 0.4 * Math.sin(t * 1.8 + this.phase);
    const glowA = (0.25 + pulse * 0.3) * Math.min(1.4, env.glow) * (1 - this.bury);

    // 光晕
    if (glowA > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(this.x, this.y + dy, 0, this.x, this.y + dy, 40);
      g.addColorStop(0, `rgba(255,236,180,${(glowA * 0.4).toFixed(3)})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.x, this.y + dy, 40 * SCALE, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // 瓶身
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(this.x, this.y + dy);
    ctx.rotate(0.32 + Math.sin(this.phase * 0.8) * 0.08);
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = 'rgba(190,235,215,0.18)';
    ctx.strokeStyle = 'rgba(200,255,225,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-9, -14, 18, 30, 8);
    ctx.fill();
    ctx.stroke();
    // 瓶颈与木塞
    ctx.fillStyle = 'rgba(190,235,215,0.22)';
    ctx.beginPath();
    ctx.roundRect(-4.5, -22, 9, 10, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#8a6d4a';
    ctx.beginPath();
    ctx.roundRect(-5, -27, 10, 7, 3);
    ctx.fill();
    // 瓶中的纸卷
    ctx.fillStyle = `rgba(255,242,200,${(0.45 + pulse * 0.3) * fade})`;
    ctx.beginPath();
    ctx.roundRect(-5.5, -6, 11, 15, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,40,0.5)';
    ctx.lineWidth = 0.8;
    for (const ly of [-2, 1, 4]) {
      ctx.beginPath();
      ctx.moveTo(-3.5, ly);
      ctx.lineTo(3.5, ly);
      ctx.stroke();
    }
    ctx.restore();
  }
}

