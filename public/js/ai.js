// ============ AI：DeepSeek 档案生成 + 鱼的聊天面板 ============
import { el, TAU } from './util.js';
import { Jellyfish } from './jellyfish.js';
import { RARITY_NAMES } from './species.js';
import { STAGE_NAMES, STAGE_NUT } from './fish.js';
import { speciesPortrait } from './portrait.js';
import { executeCommand, extractCommands, commandCheatSheet } from './commands.js';
import * as UI from './ui.js';

// ---------- 底层 API ----------
export const AI = {
  online: false,
  hasKey: false,
  model: '',
  async probe() {
    try {
      const r = await fetch('/api/status');
      const d = await r.json();
      this.online = !!d.ai;
      this.hasKey = !!d.hasKey;
      this.model = d.model || '';
    } catch {
      this.online = false;
    }
    return this.online;
  },
  async chat(system, messages, temperature = 1.1, maxTokens = 400) {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system, messages, temperature, maxTokens }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `请求失败 (${r.status})`);
    return d.reply;
  },
};

// ---------- 离线兜底 ----------
const FALLBACK_NAMES = ['泡泡', '墨墨', '小汐', '阿蓝', '咕噜', '盏盏', '团团', '半夏', '栖栖', '澜澜', '闪闪', '螺螺', '布丁', '小篝'];
const FALLBACK_PERSONAS = [
  '好奇心旺盛，看到什么都想轻轻咬一口',
  '慢性子，说话像深海的水流一样慢',
  '有点傲娇，嘴上嫌弃其实很黏人',
  '胆子很小，总躲在海草后面偷看',
  '话痨一枚，能给水母讲一整天的故事',
  '高冷，但会偷偷记住投喂过它的人',
  '乐天派，坚信每次投喂都是节日',
  '神秘主义，喜欢在暗处一闪一闪',
];
const FALLBACK_STYLES = ['喜欢用波浪号~', '句子很短，常带省略号…', '爱用海洋比喻', '说话前会先吐一串泡泡', '尾音拖得很长——'];

// 离线模式下的预设回应：没有 AI 时鱼儿只会"咕噜咕噜"
const OFFLINE_REPLIES = [
  '咕噜咕噜……（吐出一串泡泡）',
  '（轻轻转了两圈，尾巴晃了晃）',
  '咕噜……（似乎想说什么，又咽了回去）',
  '（用嘴碰了碰玻璃，发出轻柔的声响）',
  '呼噜呼噜……（一半是水泡，一半是困意）',
  '（绕着你的视线游了一圈，眨眨眼睛）',
  '咕噜？咕噜！……（听起来像在问候）',
  '（静静地悬在原地，吐了几个小泡泡）',
  '咕噜噜……（泡泡缓缓上升，飘远了）',
  '（慢慢摆了摆尾，像在点头，又像在发呆）',
  '咕噜……咕噜……（像一首不成调的小曲）',
  '（凑近玻璃，好奇地打量了你一会儿）',
];

export function fallbackPersona(fish) {
  // 玩家亲手起的名字永远保留
  const keepName = fish.persona?.playerNamed ? fish.persona.name : null;
  const name = keepName || FALLBACK_NAMES[(Math.random() * FALLBACK_NAMES.length) | 0];
  // 性格与说话习惯由「名字 + 物种」共同决定：同名同种，性格就相同
  let h = 7;
  for (const ch of `${name}·${fish.sp.id}`) h = ((h * 31 + ch.charCodeAt(0)) | 0);
  h = Math.abs(h);
  fish.persona = {
    name,
    personality: FALLBACK_PERSONAS[h % FALLBACK_PERSONAS.length],
    style: FALLBACK_STYLES[(h >> 3) % FALLBACK_STYLES.length],
    playerNamed: !!keepName,
  };
  fish.chatLog = [];
  return fish.persona;
}

// ---------- AI 生成档案 ----------
export async function generatePersona(fish) {
  // 玩家起过的名字不可被覆盖；改名后性格与说话习惯要随名字与物种重新推定
  const keepName = fish.persona?.playerNamed ? fish.persona.name : null;
  const system = [
    '你是深海生物档案馆的登记官，负责为海洋生物写档案。',
    '只输出一个 JSON 对象，禁止输出任何多余文字：',
    '{"name":"两到四个字的可爱或奇特中文名","personality":"一句话性格，20字以内","style":"说话习惯，15字以内"}',
    '名字要符合物种气质，性格要鲜明、有记忆点，避免俗套。',
  ].join('\n');
  const user = [
    `物种：${fish.sp.name}（${RARITY_NAMES[fish.sp.rarity]}）。简介：${fish.sp.desc}`,
    keepName
      ? `它已有名字：「${keepName}」（主人亲手起的，name 字段必须原样输出它）。性格与说话习惯要和这个名字相衬。`
      : `它刚刚从一颗${fish.sp.rarity >= 3 ? '微微发烫的' : '幽幽发光的'}卵中孵化，请为它起名。`,
  ].join('\n');
  const reply = await AI.chat(system, [{ role: 'user', content: user }], 1.15, 200);
  const m = reply.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('档案格式异常');
  const p = JSON.parse(m[0]);
  if (!p.name || !p.personality) throw new Error('档案不完整');
  fish.persona = {
    name: keepName || String(p.name).slice(0, 8),
    personality: String(p.personality).slice(0, 40),
    style: String(p.style || '说话简短').slice(0, 30),
    playerNamed: !!keepName,
  };
  fish.chatLog = [];
  return fish.persona;
}



// ---------- 沫沫的玩法指南（本地台词，不需要 AI） ----------
const GUIDE_TIPS = [
  '欢迎来到万灵缸！我是沫沫～点一下水面就能撒饲料，鱼儿会游过来抢着吃，吃饱了还会掉出发光尘哦！',
  '攒够 30 发光尘，就点右上角的「神秘卵」——会有颗卵慢慢沉到沙床上，点它就能孵出新的小家伙！稀有度越高的越难碰到呢。',
  '想和谁说话就点它！每条鱼都有自己的名字和脾气，你说过的话它们会记在心里～',
  '鼠标快速划过去，会掀起水流，鱼和海草都会跟着晃；划得够快还能叫醒夜光藻，夜里特别好看！',
  '双击水面会敲出一圈冲击波，把鱼吓得四散——不过别老欺负它们啦。',
  '偶尔有漂流瓶摇摇晃晃沉下来，点开有深海的拾句；收进背包之后，还能自己改写字条、再放回海里。',
  '海里偶尔会沉下一只音乐盒——它一奏乐，平日背景的海声就会让位。点它可以收回背包，鱼群也爱围着它听歌；把它从背包拖回海里，曲子又会响起来。',
  '缸里有昼夜，也有小雨和暴风雨。入夜后生物光会更亮；暴雨天鱼会躲到深处，偶尔还有闪电。要是天边烧起火烧云……记得留意接下来的天气哦！',
  '左下角那块石板是时钟，上面刻着第几天和时辰；右下角是鲸之石，海的智慧就藏在那里。',
  '想要赋予这片海洋智慧吗？右下角的「鲸之石」会告诉你答案……去点点看它吧！',
  '偶尔会有旅人鱼穿缸而过，点它可以聊两句——不过它聊完还要继续赶路的。',
  '鱼会长大，也会老去。弥留的鱼会变慢、不再进食，第二天钻进沙床长眠……然后会有一颗星星落下来，带着它留下的话。',
];

// 沫沫（年轻水母）是唯一能拨弄这片海的住民
export function isYoungJelly(f) {
  return !!(f && f.isJelly && f.sp && f.sp.id === 'jelly-young');
}
// ---------- 聊天面板 ----------
// 水母的专属对话系统提示（老/小性格不同；老水母按解锁进程逐层透露）
function jellySystem(j) {
  const p = j.persona;
  const oldJelly = j.sp.id === 'jelly-old';
  const revealed = j.unlockedCount || 0;
  let base;
  if (oldJelly) {
    base = [
      `你是「澜」，一只古老而永生的大水母，见证过「万灵缸」的诞生。你把深海的秘密藏在心底，从不轻易道破。`,
      `性格：${p.personality}。说话方式：${p.style}。`,
      '你说话像深海一样慢、深、留有余地，习惯用海与时间的比喻；对你面前的这位灵魂友好但保持距离，喜欢反问、点到即止，从不把话说满。',
      '规则：始终以澜的身份说话；每次回复不超过3句话；可以引用你见证过的事，但永远只说「一半」，剩下的留白；不要出戏，不要提到自己是AI或程序。',
    ].join('\n');
    if (revealed > 0) {
      base += '\n\n【关于来访者】你感到这位来访者身上有一点熟悉的气息——那是你还不敢确认的东西。你偶尔会透露一点线索，但总在关键处停下：';
      base += '\n' + revealLine(j);
    }
  } else {
    base = [
      `你是「沫沫」，一只年轻活泼的小水母，好奇又热心，总想陪人聊天、教人怎么玩。`,
      `性格：${p.personality}。说话方式：${p.style}。`,
      '你眼里只有眼前的鱼儿、发光的尘、漂流瓶、今天的好天气，和这位愿意陪你说话的灵魂。你热情真诚，乐于分享海里的趣事和游玩心得。',
      '规则：始终以沫沫的身份说话；每次回复不超过3句话；活泼、友善、多用感叹号，偶尔冒出泡泡的拟声；不要出戏，不要提到自己是AI或程序。',
      '【你的特殊能力】你能拨弄这片海。在回复里嵌入指令就会立刻生效，格式：[[cmd: 指令]]，例如 [[cmd: weather rain]]。',
      `可用指令：${commandCheatSheet()}。`,
      '当访客请你改变天气、时间、叫来鲸鱼、放漂流瓶、加鱼、改发光尘、或让某条鱼进入弥留时，就嵌入对应指令，再用你自己的口吻告诉他你做了什么。',
      '指令标记会自动对访客隐藏。只在访客明确要求、或你真心想帮他时使用，不要滥用，也不要解释指令本身。',
    ].join('\n');
  }
  return base;
}
function revealLine(j) {
  const lines = [
    '【约·壹】很久以前，海比现在更安静。有一个声音，比浪潮还要低……',
    '【约·贰】它不是消失了，只是把自己铺成了这片海。',
    '【约·叁】你带来的那些营养，也许本就来自很远、很深的某个地方。',
    '【约·肆】有些瓶子，装着不是墨水写就的话。',
  ];
  return lines[Math.min(lines.length - 1, Math.max(0, (j.unlockedCount || 1) - 1))] || '';
}

function personaSystem(fish) {
  if (fish.isJelly) return jellySystem(fish);
  const p = fish.persona;
  let base;
  if (fish.passer) {
    base = [
      `你是一条路过「万灵缸」的${fish.sp.name}，路上用的化名叫「${p.name}」（${RARITY_NAMES[fish.sp.rarity]}）。`,
      `你此刻正在${fish.passer.purpose}。性格：${p.personality}。说话方式：${p.style}。`,
      '你是旅人，对这片深海里的生灵和与你同游的灵魂友好但保持洒脱，可能会提到你的旅程和要去的地方，聊完了你还要继续赶路。',
      '规则：始终以这条鱼的身份说话；每次回复不超过3句话；不要出戏，不要提到自己是AI。',
    ].join('\n');
  } else {
    base = [
      `你是「万灵缸」深海里的一个生灵，名叫「${p.name}」的${fish.sp.name}（${RARITY_NAMES[fish.sp.rarity]}）。`,
      `性格：${p.personality}`,
      `说话方式：${p.style}`,
      '你生活在片辽阔的深海：有细沙床、摇曳的海草、几只水母邻居，还有一缕与你相伴的深海意志（就是正在和你说话的人）。你自由生长，从不是谁的造物，只是这片海的孩子。',
      '规则：始终以这条鱼的身份说话；每次回复不超过3句话；可以用海洋的比喻；不要出戏，不要提到自己是AI或程序；如果那缕意志曾把食物让给你，你可以温柔地致谢。',
    ].join('\n');
  }
  if (fish.dying) {
    base += '\n\n' + [
      '【最重要的处境】你大限将至——明天你就会钻进海床长眠，这是深海的天命，无法更改。',
      `你此刻的主导情绪是：「${fish.dyingEmotion || '平静的坦然'}」。情绪起伏很大，每次开口时的感受都不太一样。`,
      '你可以回顾自己的一生（你在这片海里长大、被滋养、被陪伴）、表达对那缕深海意志的眷恋、交代想留的话。依然以你的性格和说话方式表达，不要突然变成另一个人。',
    ].join('\n');
  }
  return base;
}

export class ChatPanel {
  constructor() {
    this.fish = null;
    this.busy = false;
    this.panel = el('panel-chat');
    this.log = el('chat-log');
    this.nameEl = el('chat-name');
    this.speciesEl = el('chat-species');
    this.avatar = el('chat-avatar');
    this.input = el('chat-input');
    this.form = el('chat-form');
    this.guideBtn = el('btn-guide');
    this.guideIndex = 0;
    this.quickCache = new Map(); // 鱼 → { phrases, at, logLen }：同一条鱼不重复烧 token

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.input.value.trim();
      if (!text || this.busy || !this.fish) return;
      this.input.value = '';
      this.send(text);
    });
    el('btn-rename').addEventListener('click', () => this.startRename());
    this.guideBtn.addEventListener('click', () => this.showGuideTip());
  }

  openFor(fish) {
    this.fish = fish;
    // 离线模式下给没名字的缸内住民一个本地档案（路过鱼保持无名）
    if (!fish.persona && !AI.online && !fish.passer) fallbackPersona(fish);
    this.nameEl.textContent = fish.persona ? fish.persona.name : '未登记的小家伙';
    this.speciesEl.textContent = fish.isJelly
      ? fish.sp.name
      : `${fish.sp.name} · ${RARITY_NAMES[fish.sp.rarity]}`;
    // 路过鱼 / 水母的名字不可修改：隐藏改名按钮
    el('btn-rename').style.display = (fish.passer || fish.isJelly) ? 'none' : '';
    this.updateGrowth(fish);
    this.updateProfile(fish);
    this.drawAvatar(fish);
    this.log.replaceChildren();
    this.panel.classList.remove('hidden');
    this.guideBtn.classList.toggle('hidden', !isYoungJelly(fish));
    // 离线时显示"不会说话"的小字提示
    el('chat-offline-note').classList.toggle('hidden', !!AI.online);
    // 重放历史聊天：关掉再打开，记忆还在
    if (fish.chatLog.length) {
      for (const m of fish.chatLog) {
        if (m.role === 'user') this.push('me', m.content);
        else if (m.role === 'assistant') this.push('fish', m.content);
      }
      this.log.scrollTop = this.log.scrollHeight;
    } else {
      let hello;
      if (!AI.online) {
        // 离线：鱼咕噜，水母只静静发光（无法真正交流）
        hello = fish.isJelly
          ? (fish.sp.id === 'jelly-old' ? '（巨大的水母安静地悬浮着，光芒一明一暗……似乎藏着许多话，却无从说起。）' : '（小水母蹦跶着绕了你一圈——鲸之石还没亮，它只能吐泡泡。）')
          : OFFLINE_REPLIES[(Math.random() * OFFLINE_REPLIES.length) | 0];
      } else if (fish.isJelly) {
        hello = fish.sp.id === 'jelly-old'
          ? '澜：……（水母缓缓转过来，仿佛从很深的梦里醒来）来吧，你想知道些什么？'
          : '沫沫：哇！又有人来找我玩啦～你想学点什么，还是我带你看看海里的小家伙？';
      } else if (fish.persona) {
        hello = `${fish.persona.name}：${fish.persona.personality}——你在叫我吗？`;
      } else if (fish.passer) {
        hello = '（一位路过的旅人还没开口。等右下角的鲸之石亮起，它才有化名，能聊上几句。）';
      } else {
        hello = '（它似乎还没有名字，点上面的 ✏️ 给它起一个吧——性格会随名字落定）';
      }
      this.push('fish', hello);
    }
    setTimeout(() => this.input.focus(), 60);
    this.renderQuick(fish);
  }

  // 快捷短语：打开交互界面才生成（消耗一次 token），点击后填充到输入框
  renderQuick(fish) {
    const box = el('chat-quick');
    box.replaceChildren();
    if (!fish || fish.isJelly || !AI.online) return;
    for (let i = 0; i < 3; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'quick-chip loading';
      b.textContent = '…';
      box.appendChild(b);
    }
    this.loadQuickPhrases(fish).then((list) => {
      if (this.fish !== fish || !list || !list.length) { box.replaceChildren(); return; }
      box.replaceChildren();
      for (const s of list) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'quick-chip';
        b.textContent = s;
        b.title = s;
        b.addEventListener('click', () => { this.input.value = s; this.input.focus(); });
        box.appendChild(b);
      }
    }).catch(() => box.replaceChildren());
  }

  async loadQuickPhrases(fish) {
    if (!AI.online || !fish) return null;
    // 缓存命中：同一条鱼、没聊出新的对话（chatLog 长度没变）、10 分钟内 → 直接复用
    const cached = this.quickCache.get(fish);
    if (cached && cached.logLen === fish.chatLog.length && Date.now() - cached.at < 10 * 60 * 1000) {
      return cached.phrases;
    }
    const t = performance.now() / 1000;
    let envDesc = '海里很平静';
    try {
      const w = window.__tank.weather;
      if (w) {
        envDesc = (w.daylightAt(t) > 0.45 ? '白天' : '夜晚') +
          (w.state === 'rain' ? '、下着小雨' : w.state === 'storm' ? '、正下着暴风雨' : '、天气晴朗');
      }
    } catch { /* 忽略 */ }
    const stage = fish.dying ? '弥留（一天内就会钻入海床长眠）' : STAGE_NAMES[fish.stage];
    const hunger = fish.nutrition < STAGE_NUT[fish.stage] * 0.4 ? '有点饿' : '吃得不错';
    const interacted = fish.chatLog.length > 2 ? '你们刚聊过几句' : '还没怎么聊过';
    const system = [
      '你是万灵缸的旁白。为与这条鱼相遇的灵魂生成 3 条「快捷短语」——点击后会原文发给这条鱼。',
      `鱼儿：${fish.persona?.name || '未命名'}（${fish.sp.name}，${stage}）。性格：${fish.persona?.personality || '神秘'}。说话方式：${fish.persona?.style || ''}。`,
      `它 ${fish.ageDays.toFixed(1)} 天大（寿命 ${fish.lifespanStd} 天），${hunger}，${interacted}。海里现在${envDesc}。`,
      fish.dying
        ? '它已进入弥留——这三句请以深海同游者的口吻问它一生的话题：这一生开心吗、有没有遗憾、最想被记住的是什么、有什么想托付给你的、它害怕吗。温柔真诚，像好好的告别。'
        : '三句以深海同游者的口吻切入：对它的提问、寒暄、夸奖或关心，也可以聊聊当下的天气、吃的、海里的生活。',
      '要求：以你（与鱼相遇的灵魂）的第一人称对鱼儿说话，不是鱼的台词；每条不超过 14 个字，口语化、有温度；三条角度不同。只输出 JSON：{"suggestions":["…","…","…"]}',
    ].join('\n');
    const reply = await AI.chat(system, [{ role: 'user', content: '生成 3 条快捷短语。' }], 1.2, 160);
    const m = reply.match(/\{[\s\S]*\}/);
    if (!m) return [];
    const parsed = JSON.parse(m[0]);
    const phrases = (parsed.suggestions || []).filter((s) => typeof s === 'string' && s.trim()).slice(0, 3);
    this.quickCache.set(fish, { phrases, at: Date.now(), logLen: fish.chatLog.length });
    return phrases;
  }

  // 沫沫的玩法指南：一次讲一条，讲完从头再来（纯本地，不消耗 token）
  showGuideTip() {
    if (!this.fish) return;
    const tip = GUIDE_TIPS[this.guideIndex % GUIDE_TIPS.length];
    this.push('fish', `沫沫：${tip}`);
    this.guideIndex++;
    this.guideBtn.textContent = this.guideIndex % GUIDE_TIPS.length === 0 ? '📖 从头再讲一遍' : '📖 下一招';
  }

  // 成长状态：阶段 / 营养条 / 年龄与寿命
  updateGrowth(fish) {
    if (!fish) return;
    // 水母：没有成长期，隐藏成长条/营养，阶段标签显示"年龄未知"（同幼年/成年的胶囊样式）
    if (fish.isJelly) {
      el('chat-stage').style.display = '';
      el('chat-stage').textContent = '年龄未知';
      el('chat-stage').classList.remove('dying');
      const bar = document.querySelector('.grow-bar');
      if (bar) bar.style.display = 'none';
      el('chat-grow-num').textContent = '';
      el('chat-age').textContent = '';
      return;
    }
    el('chat-stage').style.display = '';
    const bar = document.querySelector('.grow-bar');
    if (bar) bar.style.display = '';
    el('chat-stage').textContent = fish.dying ? '弥留' : STAGE_NAMES[fish.stage];
    el('chat-stage').classList.toggle('dying', !!fish.dying);
    el('chat-grow-num').textContent = `${fish.nutrition}/${STAGE_NUT[fish.stage]}`;
    el('grow-fill').style.width = `${(fish.nutrition / STAGE_NUT[fish.stage]) * 100}%`;
    el('chat-age').textContent = `${fish.ageDays.toFixed(1)} / 寿命${fish.lifespanStd} 天`;
  }

  // 档案卡：性格 / 说话习惯
  updateProfile(fish) {
    const box = el('chat-profile');
    if (!fish || !fish.persona || (!fish.persona.personality && !fish.persona.style)) {
      box.innerHTML = '<p class="profile-empty">还没有档案 — 点上面的 ✏️ 起个名字，性格与说话习惯会随名字与物种落定</p>';
      return;
    }
    const rows = [];
    if (fish.persona.personality) rows.push(`<div class="profile-row"><span class="profile-key">性格</span><span>${fish.persona.personality}</span></div>`);
    if (fish.persona.style) rows.push(`<div class="profile-row"><span class="profile-key">习惯</span><span>${fish.persona.style}</span></div>`);
    if (fish.persona.playerNamed) rows.push('<div class="profile-row named"><span class="profile-key">命名</span><span>这个名字是你起的，会一直保留</span></div>');
    box.innerHTML = rows.join('');
  }

  // 玩家亲自改名
  startRename() {
    const fish = this.fish;
    if (!fish) return;
    if (fish.passer) { UI.toast('这是位路过的旅人，名字是它自己的，改不了哦'); return; } // 路过鱼不可改名
    const current = fish.persona?.name || '';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 8;
    input.value = current;
    input.placeholder = '两到四个字最好记';
    input.className = 'rename-input';
    this.nameEl.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      const name = input.value.trim().slice(0, 8);
      if (name) {
        if (fish.persona) {
          fish.persona.name = name;
          fish.persona.playerNamed = true;
        } else {
          fish.persona = { name, personality: '它的小秘密还等着你慢慢了解', style: '说话简短', playerNamed: true };
        }
        fish.chatLog = [];
        this.nameEl.textContent = name;
        this.updateProfile(fish);
        window.__tank?.saveFish?.();
        UI.toast(`📝 它现在叫「${name}」啦`);
        this.refreshPersona(fish); // 性格与说话习惯随新名字与物种重新落定
      }
      input.replaceWith(this.nameEl);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { done = true; input.replaceWith(this.nameEl); }
    });
    input.addEventListener('blur', commit);
  }

  // 性格与说话习惯由「名字 + 物种」决定：鲸之石亮起时由登记官按新名字重写，离线时本地按名字推定
  async refreshPersona(fish) {
    try {
      if (AI.online) await generatePersona(fish);
      else fallbackPersona(fish);
    } catch {
      fallbackPersona(fish);
    }
    if (this.fish === fish) {
      this.nameEl.textContent = fish.persona.name; // 名字保持玩家起的
      this.updateProfile(fish);
    }
    window.__tank?.saveFish?.();
    UI.toast(`✨ 「${fish.persona.name}」的性格落定了：${fish.persona.personality}`);
  }

  close() {
    this.panel.classList.add('hidden');
    if (this.fish) this.fish.hold = null;
    this.fish = null;
  }

  push(role, text) {
    const div = document.createElement('div');
    div.className = `bubble ${role}`;
    div.textContent = text;
    this.log.appendChild(div);
    this.log.scrollTop = this.log.scrollHeight;
    return div;
  }

  showTyping() {
    const div = document.createElement('div');
    div.className = 'bubble fish';
    div.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    this.log.appendChild(div);
    this.log.scrollTop = this.log.scrollHeight;
    return div;
  }

  async send(text) {
    const fish = this.fish;
    if (!fish) return;

    // 开发者指令：只有沫沫能拨弄这片海（本地执行，零 token）
    if (text.startsWith('/') && isYoungJelly(fish)) {
      this.push('me', text);
      const res = executeCommand(text, window.__tank);
      if (res) {
        this.push('sys', `${res.ok ? '⚙️' : '⚠️'} ${res.msg}`);
        if (res.ok) {
          const quips = ['好嘞～', '看我的！', '嘿嘿，变！', '交给我吧～', '收到收到！'];
          this.push('fish', `沫沫：${quips[(Math.random() * quips.length) | 0]}`);
        }
        return;
      }
    }

    this.push('me', text);
    const typing = this.showTyping();
    this.busy = true;

    // 弥留的鱼情绪波动大：每次开口前随机一种主导情绪
    if (fish.dying) {
      const EMOTIONS = ['深深的绝望', '平静的坦然', '绵长的伤感', '释然的快乐', '对这片海的眷恋', '幽默的豁达', '满心的感激'];
      fish.dyingEmotion = EMOTIONS[(Math.random() * EMOTIONS.length) | 0];
    }

    if (!fish.persona) {
      try {
        await generatePersona(fish);
      } catch { fallbackPersona(fish); }
      // persona 可能刚生成，补一个名字气泡
      typing.remove();
      this.push('sys', `档案落定，它叫「${fish.persona.name}」`);
      this.nameEl.textContent = fish.persona.name;
      this.updateProfile(fish);
    }

    if (!AI.online) {
      typing.remove();
      // 没有 AI 时：鱼用预设"咕噜咕噜"，水母只静静发光
      if (fish.isJelly) {
        this.push('fish', fish.sp.id === 'jelly-old'
          ? '……（水母的触手轻轻晃动，光芒一明一暗，像在无声地回应着什么，却终未开口。）'
          : '咕噜噜～（小水母吐了个泡泡蹭了蹭你——鲸之石还没亮，它只能说这么多啦。）');
      } else {
        const reply = OFFLINE_REPLIES[(Math.random() * OFFLINE_REPLIES.length) | 0];
        this.push('fish', reply);
      }
      this.busy = false;
      return;
    }

    try {
      fish.chatLog.push({ role: 'user', content: text });
      const reply = await AI.chat(personaSystem(fish), fish.chatLog.slice(-12), 1.15, 300);
      // 沫沫可能用 [[cmd: …]] 拨弄世界：先执行，再把标记从文本里去掉
      const { clean, cmds } = extractCommands(reply);
      for (const c of cmds) {
        const res = executeCommand(c, window.__tank);
        if (res) this.push('sys', `${res.ok ? '⚙️' : '⚠️'} ${res.msg}`);
      }
      fish.chatLog.push({ role: 'assistant', content: clean });
      typing.remove();
      this.push('fish', clean);
    } catch (err) {
      // 这句话没得到回应，从记忆里撤回，免得下次对话看到一句悬空的话
      const last = fish.chatLog[fish.chatLog.length - 1];
      if (last && last.role === 'user' && last.content === text) fish.chatLog.pop();
      typing.remove();
      this.push('sys', `（它似乎没听见：${err.message}）`);
    }
    this.busy = false;
  }

  // 小头像：按物种颜色画一条 mini 鱼
  drawAvatar(fish) {
    const c = this.avatar;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    // ……水母：复用海里完全一致的画法渲染头像
    if (fish.isJelly) {
      const variant = fish.sp.id === 'jelly-old' ? 0 : 1;
      const p = Jellyfish.portrait(variant, W);
      if (p) ctx.drawImage(p, 0, 0, W, H);
      return;
    }
    // 氛围底光
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(W / 2, H / 2, 2, W / 2, H / 2, W / 2);
    g.addColorStop(0, fish.sp.glow);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // 物种本体标本：和缸里游的它是同一套画法
    const p = speciesPortrait(fish.sp, 96);
    if (p) ctx.drawImage(p, 0, 0, W, H);
  }
}
