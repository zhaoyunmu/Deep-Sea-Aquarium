// ============ AI：DeepSeek 档案生成 + 鱼的聊天面板 ============
import { el, TAU } from './util.js';
import { RARITY_NAMES } from './species.js';
import { STAGE_NAMES, STAGE_NUT } from './fish.js';
import { speciesPortrait } from './portrait.js';
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
  const seed = Math.floor(Math.random() * 997);
  // 玩家亲手起的名字永远保留
  const keepName = fish.persona?.playerNamed ? fish.persona.name : null;
  fish.persona = {
    name: keepName || FALLBACK_NAMES[seed % FALLBACK_NAMES.length],
    personality: FALLBACK_PERSONAS[(seed >> 2) % FALLBACK_PERSONAS.length],
    style: FALLBACK_STYLES[(seed >> 4) % FALLBACK_STYLES.length],
    playerNamed: !!keepName,
  };
  fish.chatLog = [];
  return fish.persona;
}

// ---------- AI 生成档案 ----------
export async function generatePersona(fish) {
  const system = [
    '你是深海生物档案馆的登记官，负责为刚孵化的海洋生物生成档案。',
    '只输出一个 JSON 对象，禁止输出任何多余文字：',
    '{"name":"两到四个字的可爱或奇特中文名","personality":"一句话性格，20字以内","style":"说话习惯，15字以内"}',
    '名字要符合物种气质，性格要鲜明、有记忆点，避免俗套。',
  ].join('\n');
  const user = `物种：${fish.sp.name}（${RARITY_NAMES[fish.sp.rarity]}）。简介：${fish.sp.desc} 它刚刚从一颗${fish.sp.rarity >= 3 ? '微微发烫的' : '幽幽发光的'}卵中孵化。`;
  const reply = await AI.chat(system, [{ role: 'user', content: user }], 1.15, 200);
  const m = reply.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('档案格式异常');
  const p = JSON.parse(m[0]);
  if (!p.name || !p.personality) throw new Error('档案不完整');
  // 玩家起过的名字不可被 AI 覆盖
  const keepName = fish.persona?.playerNamed ? fish.persona.name : null;
  fish.persona = {
    name: keepName || String(p.name).slice(0, 8),
    personality: String(p.personality).slice(0, 40),
    style: String(p.style || '说话简短').slice(0, 30),
    playerNamed: !!keepName,
  };
  fish.chatLog = [];
  return fish.persona;
}

// ---------- 聊天面板 ----------
function personaSystem(fish) {
  const p = fish.persona;
  let base;
  if (fish.passer) {
    base = [
      `你是一条路过「万灵缸」的${fish.sp.name}，路上用的化名叫「${p.name}」（${RARITY_NAMES[fish.sp.rarity]}）。`,
      `你此刻正在${fish.passer.purpose}。性格：${p.personality}。说话方式：${p.style}。`,
      '你是旅人，对缸里的住民和访客友好但保持洒脱，可能会提到你的旅程和要去的地方，聊完了你还要继续赶路。',
      '规则：始终以这条鱼的身份说话；每次回复不超过3句话；不要出戏，不要提到自己是AI。',
    ].join('\n');
  } else {
    base = [
      `你是「万灵缸」深海缸里的一条名叫「${p.name}」的${fish.sp.name}（${RARITY_NAMES[fish.sp.rarity]}）。`,
      `性格：${p.personality}`,
      `说话方式：${p.style}`,
      '你生活在缸中：有细沙床、摇曳的海草、几只水母邻居，和一位偶尔来投喂的访客（就是正在和你说话的人）。',
      '规则：始终以这条鱼的身份说话；每次回复不超过3句话；可以用海洋的比喻；不要出戏，不要提到自己是AI或程序；如果访客投喂过你，可以顺便感谢。',
    ].join('\n');
  }
  if (fish.dying) {
    base += '\n\n' + [
      '【最重要的处境】你大限将至——明天你就会钻进海床长眠，这是深海的天命，无法更改。',
      `你此刻的主导情绪是：「${fish.dyingEmotion || '平静的坦然'}」。情绪起伏很大，每次开口时的感受都不太一样。`,
      '你可以回顾自己的一生（你在这口缸里长大、被投喂、被陪伴）、表达对访客的感情、交代想留的话。依然以你的性格和说话方式表达，不要突然变成另一个人。',
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
    this.personaBtn = el('btn-persona');

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.input.value.trim();
      if (!text || this.busy || !this.fish) return;
      this.input.value = '';
      this.send(text);
    });
    el('btn-rename').addEventListener('click', () => this.startRename());
    this.personaBtn.addEventListener('click', () => this.regeneratePersona());
  }

  openFor(fish, { onSelectPersona } = {}) {
    this.fish = fish;
    this.onSelectPersona = onSelectPersona;
    // 离线模式下给没名字的缸内住民一个本地档案（路过鱼保持无名）
    if (!fish.persona && !AI.online && !fish.passer) fallbackPersona(fish);
    this.nameEl.textContent = fish.persona ? fish.persona.name : '未登记的小家伙';
    this.speciesEl.textContent = `${fish.sp.name} · ${RARITY_NAMES[fish.sp.rarity]}`;
    // 路过鱼的名字不可修改：隐藏改名按钮
    el('btn-rename').style.display = fish.passer ? 'none' : '';
    this.updateGrowth(fish);
    this.updateProfile(fish);
    this.drawAvatar(fish);
    this.log.replaceChildren();
    this.panel.classList.remove('hidden');
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
        // 离线：鱼儿只会咕噜咕噜
        hello = OFFLINE_REPLIES[(Math.random() * OFFLINE_REPLIES.length) | 0];
      } else if (fish.persona) {
        hello = `${fish.persona.name}：${fish.persona.personality}——你在叫我吗？`;
      } else if (fish.passer) {
        hello = '（一位路过的旅人还没开口。AI 在线时它才有化名，能聊上几句。）';
      } else {
        hello = '（它似乎还没有名字，试试上面的 ✏️ 或下面的「生成档案」）';
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
    if (!fish || !AI.online) return;
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
    const t = performance.now() / 1000;
    let envDesc = '缸里很平静';
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
      '你是万灵缸的旁白。为访客生成 3 条「快捷短语」——访客点击后会原文发给这条鱼。',
      `鱼儿：${fish.persona?.name || '未命名'}（${fish.sp.name}，${stage}）。性格：${fish.persona?.personality || '神秘'}。说话方式：${fish.persona?.style || ''}。`,
      `它 ${fish.ageDays.toFixed(1)} 天大（寿命 ${fish.lifespanStd} 天），${hunger}，${interacted}。缸里现在${envDesc}。`,
      fish.dying
        ? '它已进入弥留——这三句请以访客的口吻问它一生的话题：这一生开心吗、有没有遗憾、最想被记住的是什么、有什么想托付给你的、它害怕吗。温柔真诚，像好好的告别。'
        : '三句以访客的口吻切入：对它的提问、寒暄、夸奖或关心，也可以聊聊当下的天气、吃的、缸里的生活。',
      '要求：以访客（玩家）的第一人称对鱼儿说话，不是鱼的台词；每条不超过 14 个字，口语化、有温度；三条角度不同。只输出 JSON：{"suggestions":["…","…","…"]}',
    ].join('\n');
    const reply = await AI.chat(system, [{ role: 'user', content: '生成 3 条快捷短语。' }], 1.2, 160);
    const m = reply.match(/\{[\s\S]*\}/);
    if (!m) return [];
    const parsed = JSON.parse(m[0]);
    return (parsed.suggestions || []).filter((s) => typeof s === 'string' && s.trim()).slice(0, 3);
  }

  // 成长状态：阶段 / 营养条 / 年龄与寿命
  updateGrowth(fish) {
    if (!fish) return;
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
      box.innerHTML = '<p class="profile-empty">还没有档案 — 点 ✏️ 给它起名，或点下方「✨ 生成档案」让登记官写一份</p>';
      return;
    }
    const rows = [];
    if (fish.persona.personality) rows.push(`<div class="profile-row"><span class="profile-key">性格</span><span>${fish.persona.personality}</span></div>`);
    if (fish.persona.style) rows.push(`<div class="profile-row"><span class="profile-key">习惯</span><span>${fish.persona.style}</span></div>`);
    if (fish.persona.playerNamed) rows.push('<div class="profile-row named"><span class="profile-key">命名</span><span>这个名字是你起的，AI 不会改</span></div>');
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
        if (this.onSelectPersona) this.onSelectPersona(fish);
      }
      input.replaceWith(this.nameEl);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { done = true; input.replaceWith(this.nameEl); }
    });
    input.addEventListener('blur', commit);
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
    this.push('me', text);
    const typing = this.showTyping();
    this.busy = true;

    // 弥留的鱼情绪波动大：每次开口前随机一种主导情绪
    if (fish.dying) {
      const EMOTIONS = ['深深的绝望', '平静的坦然', '绵长的伤感', '释然的快乐', '对访客的不舍', '幽默的豁达', '满心的感激'];
      fish.dyingEmotion = EMOTIONS[(Math.random() * EMOTIONS.length) | 0];
    }

    if (!fish.persona) {
      try {
        await this.regeneratePersona(true);
      } catch { fallbackPersona(fish); }
      if (fish.persona) {
        // persona 可能刚生成，补一个名字气泡
        typing.remove();
        this.push('sys', `档案生成完毕，它叫「${fish.persona.name}」`);
        this.nameEl.textContent = fish.persona.name;
        if (this.onSelectPersona) this.onSelectPersona(fish);
      } else typing.remove();
    }

    if (!AI.online) {
      typing.remove();
      // 没有 AI 时，鱼儿只会用预设的"咕噜咕噜"回应
      const reply = OFFLINE_REPLIES[(Math.random() * OFFLINE_REPLIES.length) | 0];
      this.push('fish', reply);
      this.busy = false;
      return;
    }

    try {
      fish.chatLog.push({ role: 'user', content: text });
      const reply = await AI.chat(personaSystem(fish), fish.chatLog.slice(-12), 1.15, 300);
      fish.chatLog.push({ role: 'assistant', content: reply });
      typing.remove();
      this.push('fish', reply);
    } catch (err) {
      typing.remove();
      this.push('sys', `（它似乎没听见：${err.message}）`);
    }
    this.busy = false;
  }

  async regeneratePersona(silent = false) {
    const fish = this.fish;
    if (!fish) return;
    if (!AI.online) {
      if (!silent) this.push('sys', 'AI 未接入，暂时无法生成档案');
      return;
    }
    if (!silent) {
      this.personaBtn.textContent = '✍️ 登记中…';
      this.personaBtn.disabled = true;
    }
    try {
      const p = await generatePersona(fish);
      this.nameEl.textContent = p.name;
      this.updateProfile(fish);
      if (!silent) {
        this.push('sys', p.playerNamed
          ? `档案重新写好了——名字保持你起的「${p.name}」`
          : `档案更新：它现在叫「${p.name}」`);
        this.push('fish', `${p.name}：嗯——这个名字，我喜欢。`);
      }
      if (this.onSelectPersona) this.onSelectPersona(fish);
    } catch (err) {
      if (!silent) this.push('sys', `登记失败：${err.message}`);
    }
    this.personaBtn.textContent = '✨ 生成档案';
    this.personaBtn.disabled = false;
  }

  // 小头像：按物种颜色画一条 mini 鱼
  drawAvatar(fish) {
    const c = this.avatar;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
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
