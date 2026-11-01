'use strict';
/* دفتر خرج — حسابداری ساده‌ی شخصی (بدون سرور، بدون رمز؛ داده‌ها فقط روی همین گوشی) */
(() => {

const KEY = 'daftar-kharj-v2';
const OLD = 'daftar-kharj-v1';
const MN = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];

/* بخش‌های مخارج */
const CATS = [
  { id: 'home', name: 'خانه',  icon: '🏠', color: '#0f766e' },
  { id: 'me',   name: 'خودم',  icon: '🙂', color: '#2563eb' },
  { id: 'wife', name: 'همسر',  icon: '👩', color: '#db2777' },
  { id: 'inst', name: 'اقساط', icon: '🏦', color: '#d97706' },
  { id: 'debt', name: 'بدهی',  icon: '📤', color: '#7c3aed' }
];
const GCATS = ['home', 'me', 'wife'];   // بخش‌هایی که گروه (تنقلات، ورزش، …) دارند
const G = (id, name, icon) => ({ id, name, icon });
const DEF_GROUPS = () => ({
  home: [G('chicken','مرغ','🍗'), G('meat','گوشت','🥩'), G('rice','برنج','🍚'), G('oil','روغن','🛢️'),
         G('fruitveg','میوه و سبزی','🥬'), G('dairy','لبنیات و تخم‌مرغ','🥛'), G('bread','نان','🍞'), G('legume','حبوبات','🫘'),
         G('food','خوراک متفرقه','🛒'), G('snack','تنقلات','🍿'), G('bills','قبض‌ها','💡'), G('rent','اجاره و شارژ','🏢'),
         G('stuff','لوازم منزل','🛋️'), G('repair','تعمیرات','🔧'), G('transport','رفت‌وآمد','🚌'), G('other','سایر','📦')],
  me:   [G('snack','تنقلات','🍿'), G('sport','ورزش','🏋️'), G('cloth','لباس','👕'), G('doctor','دکتر و دارو','💊'),
         G('cafe','رستوران و کافه','🍽️'), G('fun','تفریح','🎮'), G('phone','موبایل و اینترنت','📱'), G('edu','آموزش','📚'),
         G('transport','رفت‌وآمد','🚌'), G('other','سایر','📦')],
  wife: [G('snack','تنقلات','🍿'), G('cloth','لباس','👕'), G('beauty','آرایشی و بهداشتی','💄'), G('doctor','دکتر و دارو','💊'),
         G('gift','هدیه','🎁'), G('cafe','رستوران و کافه','🍽️'), G('sport','ورزش','🏋️'), G('other','سایر','📦')]
});

/* ---------- ابزارها ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const toEn = (s) => String(s)
  .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
  .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const num = (s) => { const v = parseInt(toEn(s).replace(/[^\d]/g, ''), 10); return isNaN(v) ? 0 : v; };
const fa = (n) => Math.round(n).toLocaleString('fa-IR');
const fy = (n) => n.toLocaleString('fa-IR', { useGrouping: false });
const sum = (a) => a.reduce((s, t) => s + (t.amount || 0), 0);
const mk = (y, mo) => y * 100 + mo;
const MD = (mo) => (mo <= 6 ? 31 : 30);
const pct = (v, t) => (t ? (Math.round(v / t * 1000) / 10).toLocaleString('fa-IR') + '٪' : '—');

/** مبلغ با علامت (و در صورت نیاز +) */
const m = (n, cls = '', plus = false) => {
  const neg = n < 0 && Math.round(n) !== 0;
  const sign = neg ? '−' : (plus && n > 0 ? '+' : '');
  return `<span class="m ${cls}" dir="ltr">${sign}${fa(Math.abs(n))}</span>`;
};

/* ---------- تاریخ شمسی (Intl مرورگر) ---------- */
function jOf(date) {
  const p = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date);
  const o = {};
  p.forEach((x) => { o[x.type] = x.value; });
  return { y: +(o.year || o.relatedYear), m: +o.month, d: +o.day };
}
const jNow = () => jOf(new Date());
const dayLabel = (t) => `${fa(t.d)} ${MN[t.m - 1]}`;
const fullDate = (t) => `${fa(t.d)} ${MN[t.m - 1]} ${fy(t.y)}`;
const cmp = (a, b) => (mk(a.y, a.m) - mk(b.y, b.m)) || (a.d - b.d) || ((a.ts || 0) - (b.ts || 0));

/* ---------- داده ---------- */
const fresh = () => ({ v: 2, salary: 0, salaryOv: {}, homeBudget: 0, homeItems: 1, allow: { me: 0, wife: 0 }, groups: DEF_GROUPS(), inc: [], exp: [] });
function fix(r) {
  r.salaryOv = r.salaryOv || {}; r.inc = r.inc || []; r.exp = r.exp || [];
  r.groups = r.groups || DEF_GROUPS();
  GCATS.forEach((c) => { if (!Array.isArray(r.groups[c])) r.groups[c] = DEF_GROUPS()[c]; });
  r.homeBudget = r.homeBudget || 0;
  r.allow = Object.assign({ me: 0, wife: 0 }, r.allow || {});
  if (!r.homeItems) {   // نسخه‌ی قبل: اقلام پیش‌فرض خانه را (یک بار) اضافه کن
    const have = new Set(r.groups.home.map((g) => g.id));
    DEF_GROUPS().home.forEach((g) => { if (!have.has(g.id)) r.groups.home.splice(Math.max(0, r.groups.home.length - 1), 0, g); });
    r.homeItems = 1;
  }
  return r;
}
/** تبدیل داده‌های نسخه‌ی قبل (بدون حذف آن‌ها) */
function migrate(o) {
  const n = fresh(); n.salary = o.salary || 0; n.salaryOv = o.salaryOv || {};
  const pn = (id) => { const l = (o.loans || []).find((x) => x.id === id); return l ? l.person : 'قرض'; };
  const cn = (id) => { const c = (o.cats || []).find((x) => x.id === id); return c ? c.name : ''; };
  (o.loans || []).forEach((l) => n.inc.push({ id: l.id, name: l.person, amount: l.amount, note: l.note || '', y: l.y, m: l.m, d: l.d, ts: l.ts || 0 }));
  (o.tx || []).forEach((t) => {
    const b = { id: t.id, amount: t.amount, y: t.y, m: t.m, d: t.d, ts: t.ts || 0 };
    if (t.t === 'exp') {
      const cat = ({ home: 'home', wife: 'wife', me: 'me', inst: 'inst' })[t.cat];
      if (cat === 'inst') n.exp.push({ ...b, cat: 'inst', bank: '', no: 0, note: t.note || '' });
      else n.exp.push({ ...b, cat: cat || 'home', group: 'other', note: [cat ? '' : cn(t.cat), t.note].filter(Boolean).join(' — ') });
    } else if (t.t === 'inc') n.inc.push({ ...b, name: 'درآمد دیگر', note: t.note || '' });
    else if (t.t === 'rep' || t.t === 'fl') n.exp.push({ ...b, cat: 'debt', name: pn(t.loan), note: t.t === 'fl' ? ('خرج برای او ' + (t.note || '')).trim() : (t.note || '') });
  });
  return n;
}
function load() {
  try { const r = JSON.parse(localStorage.getItem(KEY)); if (r && r.v === 2) return fix(r); } catch (e) { /* ignore */ }
  try {
    const o = JSON.parse(localStorage.getItem(OLD));
    if (o && o.v === 1) { const n = migrate(o); try { localStorage.setItem(KEY, JSON.stringify(n)); } catch (e) { /* ignore */ } return n; }
  } catch (e) { /* ignore */ }
  return fresh();
}
let S = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('ذخیره‌سازی ناموفق بود؛ حافظه‌ی مرورگر پر یا بسته است'); }
}

const today = jNow();
let cur = { y: today.y, m: today.m };
let view = 'home';
let expCat = 'home';
let logCat = 'all';
let statTab = 'stats';
let deferred = null, swOK = false;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; if (view === 'home' || view === 'settings') render(); });
window.addEventListener('appinstalled', () => { deferred = null; toast('برنامه نصب شد'); render(); });

const catOf = (id) => CATS.find((c) => c.id === id) || CATS[0];
const grp = (cat, gid) => (S.groups[cat] || []).find((g) => g.id === gid) || { id: gid, name: 'بدون گروه', icon: '📦' };
const monthSalary = (y, mo) => (S.salaryOv[mk(y, mo)] ?? S.salary) || 0;

/** محاسبات یک ماه */
function calcMonth(y, mo) {
  const k = mk(y, mo);
  const inK = (a) => a.filter((t) => mk(t.y, t.m) === k).sort(cmp);
  const recv = inK(S.inc), exps = inK(S.exp);
  const salary = monthSalary(y, mo);
  const recvT = sum(recv), incT = salary + recvT;
  const byCat = {}, cnt = {};
  CATS.forEach((c) => { const l = exps.filter((t) => t.cat === c.id); byCat[c.id] = sum(l); cnt[c.id] = l.length; });
  const expT = sum(exps);
  const gAll = {}, gCat = {};
  exps.filter((t) => GCATS.includes(t.cat)).forEach((t) => {
    const g = grp(t.cat, t.group);
    const a = gAll[g.name] || (gAll[g.name] = { name: g.name, icon: g.icon, total: 0, count: 0 });
    a.total += t.amount; a.count++;
    const bc = gCat[t.cat] || (gCat[t.cat] = {});
    const b = bc[g.name] || (bc[g.name] = { name: g.name, icon: g.icon, total: 0, count: 0 });
    b.total += t.amount; b.count++;
  });
  const arr = (o) => Object.values(o).sort((a, b) => b.total - a.total);
  const gc = {}; Object.keys(gCat).forEach((c) => { gc[c] = arr(gCat[c]); });
  const days = (y === today.y && mo === today.m) ? today.d : MD(mo);
  const hp = (S.groups.home || []).map((g) => {
    const spent = sum(exps.filter((t) => t.cat === 'home' && t.group === g.id));
    return { g, plan: g.plan || 0, spent, left: (g.plan || 0) - spent };
  }).filter((x) => x.plan || x.spent).sort((a, b) => (b.plan > 0) - (a.plan > 0));
  const alloc = sum(hp.map((x) => ({ amount: x.plan })));
  const homePlan = { budget: S.homeBudget || 0, alloc, rows: hp, spent: byCat.home, left: (S.homeBudget || 0) - byCat.home };
  const allow = {};
  ['me', 'wife'].forEach((c) => { const b = S.allow[c] || 0; allow[c] = { budget: b, spent: byCat[c], left: b - byCat[c] }; });
  return { y, m: mo, k, salary, recv, recvT, incT, exps, expT, byCat, cnt, homePlan, allow, savings: incT - expT,
           groups: arr(gAll), groupsByCat: gc, days, avg: expT / days,
           top: exps.slice().sort((a, b) => b.amount - a.amount).slice(0, 5) };
}

function descE(t) {
  if (t.cat === 'inst') return { icon: '🏦', title: (t.bank || 'قسط') + (t.no ? ` — قسط ${fa(t.no)}` : ''), sub: t.note || '' };
  if (t.cat === 'debt') return { icon: '📤', title: t.name || 'بدهی', sub: t.note || '' };
  const g = grp(t.cat, t.group);
  return { icon: g.icon, title: g.name, sub: t.note || '' };
}

/* ---------- نمایش ---------- */
const view$ = $('#view'), top$ = $('#top');

function render() {
  $$('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.nav === view));
  top$.innerHTML = view !== 'settings'
    ? `<div class="ttl">دفتر خرج</div>
       <div class="mbar"><button data-act="prevM" aria-label="ماه قبل">▶</button>
       <div class="mn">${MN[cur.m - 1]} ${fy(cur.y)}</div>
       <button data-act="nextM" aria-label="ماه بعد">◀</button></div>`
    : `<div class="ttl">تنظیمات</div><div></div>`;
  $('#fab').hidden = view === 'settings';
  view$.innerHTML = ({ home: vHome, inc: vInc, exp: vExp, stats: vStats, settings: vSettings })[view]();
  if (view === 'settings') bindSettings();
}

const share = (label, icon, v, tot, color, act, id, sign) => {
  const p = tot ? Math.min(100, Math.round(v / tot * 100)) : 0;
  return `<button class="cat" ${act ? `data-act="${act}" data-id="${id}"` : ''}>
    <div class="top"><span class="nm">${icon} ${esc(label)}</span>
    <span class="sm">${m(sign * v, sign > 0 ? 'pos' : 'neg', sign > 0)} <span class="mut">${tot ? pct(v, tot) : ''}</span></span></div>
    <div class="bar"><i style="width:${p}%;background:${color}"></i></div></button>`;
};

function vHome() {
  const r = calcMonth(cur.y, cur.m);
  const empty = !S.salary && !S.inc.length && !S.exp.length && !Object.keys(S.salaryOv).length;
  let h = '';
  if (empty) {
    h += `<div class="card"><h3>شروع کار</h3>
      <p class="sm mut" style="margin:0 0 10px">اول در بخش «ورودی» حقوق ماهانه‌تان را وارد کنید؛ بعد با دکمه‌ی ＋ مخارج را ثبت کنید. هر چه خرج کنید از ورودی کم می‌شود و باقی‌مانده پس‌انداز است.</p>
      <button class="btn" data-nav="inc">رفتن به ورودی</button></div>`;
  }
  if (deferred && !standalone()) h += `<div class="info" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
    <span>برنامه را روی گوشی نصب کنید</span><button class="btn sm" data-act="install">نصب</button></div>`;
  h += `<section class="hero ${r.savings < 0 ? 'bad' : ''}">
    <div class="lbl">پس‌انداز این ماه (ورودی − مخارج)</div>
    <div class="big">${m(r.savings, '', true)} <span class="unit">تومان</span></div>
    ${r.incT ? `<div class="rate">${pct(Math.abs(r.savings), r.incT)} از ورودی ${r.savings < 0 ? 'بیشتر خرج شده' : 'پس‌انداز شده'}</div>` : ''}
    <div class="stats">
      <button class="stat" data-nav="inc"><div class="k">جمع ورودی (+)</div><div class="v">${m(r.incT, '', true)}</div></button>
      <button class="stat" data-nav="exp"><div class="k">جمع مخارج (−)</div><div class="v">${m(-r.expT)}</div></button>
    </div></section>`;
  h += `<div class="card"><h3>ورودی‌ها</h3>
    ${share('حقوق', '💼', r.salary, r.incT, '#16a34a', 'goInc', '', 1)}
    ${share('طلبکاری', '🤝', r.recvT, r.incT, '#16a34a', 'goInc', '', 1)}</div>`;
  h += `<div class="card"><h3>مخارج</h3>${CATS.map((c) => share(c.name, c.icon, r.byCat[c.id], r.expT, c.color, 'goExp', c.id, -1)).join('')}</div>`;
  h += `<div class="btns two"><button class="btn" data-act="monthPdf">⬇️ PDF گزارش ماه</button>
    <button class="btn sec" data-nav="stats">📈 ریز و آمار</button></div>`;
  return h;
}

function vInc() {
  const r = calcMonth(cur.y, cur.m);
  let h = `<section class="hero green"><div class="lbl">جمع ورودی این ماه (+)</div>
    <div class="big">${m(r.incT, '', true)} <span class="unit">تومان</span></div>
    <div class="stats"><button class="stat" data-act="editSalary"><div class="k">حقوق ✎</div><div class="v">${m(r.salary)}</div></button>
    <div class="stat"><div class="k">طلبکاری</div><div class="v">${m(r.recvT)}</div></div></div></section>`;
  h += `<div class="sec-h"><h3>طلبکاری (پول دریافتی از دیگران)</h3><span class="sm mut">${r.recv.length ? fa(r.recv.length) + ' مورد' : ''}</span></div>`;
  h += r.recv.length ? listItems(r.recv, 'inc')
    : `<div class="empty"><b>🤝</b>در این ماه طلبکاری ثبت نشده.<br>هر پولی که از کسی دریافت می‌کنید با ＋ ثبت کنید.</div>`;
  return h;
}

function vExp() {
  const r = calcMonth(cur.y, cur.m);
  const c = catOf(expCat);
  let h = `<section class="hero orange"><div class="lbl">جمع مخارج این ماه (−)</div>
    <div class="big">${m(-r.expT)} <span class="unit">تومان</span></div></section>`;
  h += `<div class="cbs">${CATS.map((x) => `<button class="cb ${x.id === expCat ? 'on' : ''}" style="--c:${x.color}" data-act="pickCat" data-id="${x.id}">
    <i>${x.icon}</i><b>${x.name}</b><span>${m(-r.byCat[x.id])}</span></button>`).join('')}</div>`;
  if (expCat === 'home') h += homePlanCard(r);
  if (expCat === 'me' || expCat === 'wife') h += allowCard(r, expCat);
  const list = r.exps.filter((t) => t.cat === expCat);
  h += `<div class="sec-h"><h3>${c.icon} ${c.name}</h3><span class="sm">${m(-sum(list), 'neg')} <span class="mut">تومان</span></span></div>`;
  if (GCATS.includes(expCat) && r.groupsByCat[expCat]) {
    h += `<div class="chips">${r.groupsByCat[expCat].map((g) => `<span class="chip">${esc(g.icon)} ${esc(g.name)} · ${m(g.total)}</span>`).join('')}</div>`;
  }
  h += list.length ? listItems(list, 'exp', false)
    : `<div class="empty"><b>${c.icon}</b>در این ماه برای «${c.name}» چیزی ثبت نشده.<br>با دکمه‌ی ＋ اضافه کنید.</div>`;
  return h;
}

function planRow(x) {
  const over = x.plan && x.spent > x.plan;
  const p = x.plan ? Math.min(100, Math.round(x.spent / x.plan * 100)) : 0;
  return `<div class="pl ${over ? 'over' : ''}"><div class="top"><span class="nm">${esc(x.g.icon)} ${esc(x.g.name)}</span>
    <span class="sm">${m(x.spent)} ${x.plan ? `<span class="mut">از</span> ${m(x.plan)}` : '<span class="mut">(بدون برنامه)</span>'}</span></div>
    ${x.plan ? `<div class="bar ${over ? 'over' : ''}"><i style="width:${p}%"></i></div>
    <div class="sm ${over ? 'neg' : 'mut'}">${over ? `${m(x.spent - x.plan)} بیشتر از برنامه` : `مانده: ${m(x.left)}`}</div>` : ''}</div>`;
}
function allowCard(r, cat) {
  const a = r.allow[cat], c = catOf(cat);
  const who = cat === 'me' ? 'خودم' : 'همسر';
  if (!a.budget) {
    return `<div class="card"><h3>💰 سهم ماهانه‌ی ${who}</h3>
      <p class="sm mut" style="margin:0 0 10px">یک مبلغ ثابت برای ${who} تعیین کنید تا هر خرج از آن کم شود و مانده‌اش را ببینید.</p>
      <button class="btn" data-act="allowSheet" data-id="${cat}">تعیین سهم ${who}</button></div>`;
  }
  const over = a.spent > a.budget, p = Math.min(100, Math.round(a.spent / a.budget * 100));
  return `<div class="card"><div class="row"><h3 style="margin:0">💰 سهم ماهانه‌ی ${who}</h3>
    <button class="btn sm sec" data-act="allowSheet" data-id="${cat}">ویرایش</button></div>
    <div class="kv3" style="margin-top:8px">
      <div><span class="k">سهم ماه</span><b>${m(a.budget)}</b></div>
      <div><span class="k">خرج‌شده</span><b class="${over ? 'neg' : ''}">${m(a.spent)}</b></div>
      <div style="grid-column:1/-1"><span class="k">${over ? 'بیشتر از سهم' : 'مانده'}</span><b class="${over ? 'neg' : 'pos'}">${m(Math.abs(a.left))}</b></div></div>
    <div class="bar ${over ? 'over' : ''}" style="margin:8px 0 2px"><i style="width:${p}%;${over ? '' : `background:${c.color}`}"></i></div>
    <div class="sm mut">${pct(a.spent, a.budget)} از سهم مصرف شده</div></div>`;
}
function allowSheet(cat) {
  const who = cat === 'me' ? 'خودم' : 'همسر';
  openSheet(`<h2>💰 سهم ماهانه‌ی ${who}</h2>
    <div class="f"><label>مبلغ پیش‌فرض هر ماه (تومان)</label><input type="text" inputmode="numeric" id="f-amt" class="amt" value="${S.allow[cat] ? fa(S.allow[cat]) : ''}" placeholder="مثلاً ۲٬۰۰۰٬۰۰۰"></div>
    <p class="hint">این مبلغ برای همه‌ی ماه‌ها یکسان است. خرج‌های «${who}» از آن کم می‌شوند؛ صفر یعنی بدون سهم.</p>
    <div class="btns"><button class="btn" data-act="saveAllow" data-id="${cat}">ذخیره</button></div>`,
    () => setTimeout(() => $('#f-amt')?.focus(), 260));
}

function homePlanCard(r) {
  const hp = r.homePlan;
  if (!hp.budget && !hp.alloc) {
    return `<div class="card"><h3>🧮 برنامه‌ی ماهانه‌ی خانه</h3>
      <p class="sm mut" style="margin:0 0 10px">کل پول خانه را مشخص کنید و بین اقلام (مرغ، گوشت، برنج، روغن و …) تقسیم کنید تا هر قلم سقف داشته باشد و مصرف را از قبل کنترل کنید.</p>
      <button class="btn" data-act="planSheet">تعریف برنامه‌ی خانه</button></div>`;
  }
  const un = hp.budget - hp.alloc, over = hp.budget && hp.spent > hp.budget;
  const p = hp.budget ? Math.min(100, Math.round(hp.spent / hp.budget * 100)) : 0;
  return `<div class="card"><div class="row"><h3 style="margin:0">🧮 برنامه‌ی ماهانه‌ی خانه</h3>
    <button class="btn sm sec" data-act="planSheet">ویرایش</button></div>
    ${hp.budget ? `<div class="kv3" style="margin-top:8px">
      <div><span class="k">کل پول خانه</span><b>${m(hp.budget)}</b></div>
      <div><span class="k">تقسیم‌شده</span><b>${m(hp.alloc)}</b></div>
      <div><span class="k">خرج‌شده</span><b class="${over ? 'neg' : ''}">${m(hp.spent)}</b></div>
      <div><span class="k">مانده</span><b class="${hp.left < 0 ? 'neg' : 'pos'}">${m(hp.left)}</b></div>
      ${un !== 0 ? `<div style="grid-column:1/-1"><span class="k">${un > 0 ? 'هنوز تقسیم‌نشده' : 'بیشتر از کل پول تقسیم شده'}</span><b class="${un < 0 ? 'neg' : 'loanc'}">${m(Math.abs(un))}</b></div>` : ''}</div>
      <div class="bar ${over ? 'over' : ''}" style="margin:8px 0 4px"><i style="width:${p}%"></i></div>` : ''}
    <div style="margin-top:8px">${r.homePlan.rows.map(planRow).join('')}</div></div>`;
}

function listItems(arr, kind, showCat) {
  let h = '', last = null;
  arr.slice().sort(cmp).reverse().forEach((t) => {
    if (t.d !== last) { h += `<div class="day">${dayLabel(t)}</div>`; last = t.d; }
    if (kind === 'inc') {
      h += `<button class="item" data-act="editInc" data-id="${t.id}"><div class="ic">🤝</div>
        <div class="mid"><div class="t">${esc(t.name)}</div><div class="s">${esc(t.note || 'طلبکاری')}</div></div>
        <div class="a">${m(t.amount, 'pos', true)}</div></button>`;
    } else {
      const d = descE(t), c = catOf(t.cat);
      h += `<button class="item" data-act="editExp" data-id="${t.id}"><div class="ic">${d.icon}</div>
        <div class="mid"><div class="t">${esc(d.title)}${showCat ? `<span class="tagc" style="--c:${c.color}">${c.name}</span>` : ''}</div>
        <div class="s">${esc(d.sub || (GCATS.includes(t.cat) ? 'بدون توضیح' : ''))}</div></div>
        <div class="a">${m(-t.amount, 'neg')}</div></button>`;
    }
  });
  return h;
}

function vStats() {
  const r = calcMonth(cur.y, cur.m);
  let h = `<div class="tabs2"><button class="${statTab === 'stats' ? 'on' : ''}" data-act="statTab" data-id="stats">آمار ماه</button>
    <button class="${statTab === 'log' ? 'on' : ''}" data-act="statTab" data-id="log">ریز مخارج</button></div>`;
  if (statTab === 'log') {
    const chips = [{ id: 'all', name: 'همه' }].concat(CATS);
    h += `<div class="chips">${chips.map((c) => `<button class="chip ${logCat === c.id ? 'on' : ''}" data-act="logCat" data-id="${c.id}">${c.name}</button>`).join('')}</div>`;
    const list = logCat === 'all' ? r.exps : r.exps.filter((t) => t.cat === logCat);
    h += `<div class="sec-h"><h3>${fa(list.length)} مورد</h3><span class="sm">${m(-sum(list), 'neg')} <span class="mut">تومان</span></span></div>`;
    h += list.length ? listItems(list, 'exp', true) : `<div class="empty"><b>🧾</b>مخارجی در این ماه ثبت نشده.</div>`;
    return h;
  }
  h += `<div class="card"><h3>خلاصه‌ی ${MN[cur.m - 1]}</h3><div class="kv3">
    <div><span class="k">ورودی</span><b class="pos">${m(r.incT, '', true)}</b></div>
    <div><span class="k">مخارج</span><b class="neg">${m(-r.expT)}</b></div>
    <div><span class="k">پس‌انداز</span><b class="${r.savings < 0 ? 'neg' : 'pos'}">${m(r.savings, '', true)}</b></div>
    <div><span class="k">تعداد ثبت</span><b>${fa(r.exps.length)}</b></div>
    <div style="grid-column:1/-1"><span class="k">میانگین خرج روزانه (${fa(r.days)} روز)</span><b>${m(r.avg)}</b></div></div></div>`;
  if (!r.expT) return h + `<div class="empty"><b>📈</b>برای دیدن آمار، چند خرج ثبت کنید.</div>`;
  if (r.homePlan.budget || r.homePlan.alloc) h += homePlanCard(r).replace('data-act="planSheet"', 'data-act="planSheet"');
  if (r.allow.me.budget || r.allow.wife.budget) {
    h += `<div class="card"><h3>سهم شخصی (خودم و همسر)</h3>${['me', 'wife'].filter((c) => r.allow[c].budget).map((c) => {
      const a = r.allow[c], cc = catOf(c), over = a.spent > a.budget;
      return `<div class="pl ${over ? 'over' : ''}"><div class="top"><span class="nm">${cc.icon} ${cc.name}</span><span class="sm">${m(a.spent)} <span class="mut">از</span> ${m(a.budget)}</span></div>
        <div class="bar ${over ? 'over' : ''}"><i style="width:${Math.min(100, Math.round(a.spent / a.budget * 100))}%"></i></div>
        <div class="sm ${over ? 'neg' : 'mut'}">${over ? `${m(a.spent - a.budget)} بیشتر از سهم` : `مانده: ${m(a.left)}`}</div></div>`;
    }).join('')}</div>`;
  }
  h += `<div class="card"><h3>سهم هر بخش از مخارج</h3>${CATS.filter((c) => r.byCat[c.id]).map((c) => share(c.name, c.icon, r.byCat[c.id], r.expT, c.color, '', '', -1)).join('')}</div>`;
  if (r.groups.length) {
    const gt = sum(r.groups);
    h += `<div class="card"><h3>مصرف به تفکیک گروه (خانه + خودم + همسر)</h3>${r.groups.map((g) => share(`${g.name} · ${fa(g.count)} بار`, g.icon, g.total, gt, '#0f766e', '', '', -1)).join('')}</div>`;
    h += `<div class="card"><h3>گروه‌ها در هر بخش</h3>${GCATS.filter((c) => r.groupsByCat[c]).map((c) => {
      const cc = catOf(c);
      return `<details class="dd"><summary><span>${cc.icon} ${cc.name}</span><span class="sm">${m(-r.byCat[c], 'neg')}</span></summary>
        ${r.groupsByCat[c].map((g) => `<div class="gr"><span>${esc(g.icon)} ${esc(g.name)} <span class="mut">(${fa(g.count)})</span></span><span>${m(g.total)} <span class="mut">${pct(g.total, r.byCat[c])}</span></span></div>`).join('')}</details>`;
    }).join('')}</div>`;
  }
  h += `<div class="card"><h3>بزرگ‌ترین خرج‌ها</h3>${r.top.map((t) => {
    const d = descE(t), c = catOf(t.cat);
    return `<div class="row sm" style="padding:4px 0;border-bottom:1px dashed var(--line)"><span>${esc(d.icon)} ${esc(d.title)} <span class="tagc" style="--c:${c.color}">${c.name}</span><span class="mut"> ${dayLabel(t)}</span></span><b>${m(-t.amount, 'neg')}</b></div>`;
  }).join('')}</div>`;
  h += `<div class="btns"><button class="btn" data-act="monthPdf">⬇️ دانلود PDF کامل این ماه</button></div>`;
  return h;
}

function installCard() {
  if (standalone()) return `<div class="card"><h3>📲 نصب روی گوشی</h3><p class="sm pos" style="margin:0">✅ برنامه نصب شده و در حالت برنامه باز است.</p></div>`;
  const ok = (v) => (v ? '✅' : '❌');
  const https = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  return `<div class="card"><h3>📲 نصب روی گوشی</h3>
    ${deferred ? `<button class="btn" data-act="install">نصب برنامه</button>` : `<p class="sm" style="margin:0 0 6px">اگر دکمه‌ی نصب نمی‌آید: در <bdi>Chrome</bdi> منوی سه‌نقطه را بزنید و «نصب برنامه» (<bdi>Install app</bdi>) یا «افزودن به صفحه‌ی اصلی» (<bdi>Add to Home screen</bdi>) را انتخاب کنید.</p>`}
    <div class="kv3" style="margin-top:8px"><div><span class="k">آدرس امن (https)</span><b>${ok(https)}</b></div>
    <div><span class="k">سرویس‌ورکر</span><b>${ok(swOK)}</b></div></div>
    <p class="hint" style="margin-bottom:0">نصب فقط وقتی کار می‌کند که برنامه را از آدرس https (مثلاً GitHub Pages) و داخل <b>Chrome</b> باز کنید؛ نه از داخل فایل زیپ، نه از مرورگر داخلی تلگرام/ایتا/بله.</p></div>`;
}

function vSettings() {
  return installCard() + `<div class="card"><h3>حقوق ماهانه (پیش‌فرض)</h3>
    <div class="f"><input type="text" inputmode="numeric" class="amt" id="s-salary" value="${S.salary ? fa(S.salary) : ''}" placeholder="مثلاً ۲۰٬۰۰۰٬۰۰۰"></div>
    <p class="hint">برای یک ماه خاص (عیدی، اضافه‌کار) در بخش «ورودی» روی «حقوق» بزنید.</p></div>
  ${GCATS.map((c) => { const cc = catOf(c); return `<div class="card"><h3>${cc.icon} گروه‌های «${cc.name}»</h3>
    <div class="gl" data-cat="${c}">${S.groups[c].map((g) => groupRow(c, g)).join('')}</div>
    <button class="btn sec" data-act="addGroup" data-id="${c}">＋ گروه جدید</button></div>`; }).join('')}
  <p class="hint" style="margin-top:-4px">گروه‌ها برای دسته‌بندی هر خرج هستند (تنقلات، ورزش، لباس، دکتر …). تغییر نام یا حذف گروه روی آمار همان گروه اثر می‌گذارد.</p>
  <div class="card"><h3>پشتیبان‌گیری</h3>
    <p class="hint" style="margin-top:0">داده‌ها فقط روی همین گوشی ذخیره می‌شوند. گاهی نسخه‌ی پشتیبان بگیرید و برای خودتان بفرستید.</p>
    <div class="btns two"><button class="btn sec" data-act="backup">⬇️ ذخیره‌ی پشتیبان</button>
    <button class="btn sec" data-act="restore">⬆️ بازیابی</button></div>
    <input type="file" id="restoreFile" accept=".json,application/json" hidden>
    <div class="btns"><button class="btn red" data-act="wipe">پاک‌کردن همه‌ی اطلاعات</button></div></div>
  <p class="hint" style="text-align:center">دفتر خرج — بدون رمز و بدون حساب کاربری</p>`;
}
const groupRow = (c, g) => `<div class="ce g" data-cat="${c}" data-id="${esc(g.id)}">
  <input class="ico" data-f="icon" value="${esc(g.icon)}" maxlength="4" aria-label="آیکون">
  <input data-f="name" value="${esc(g.name)}" placeholder="نام گروه" aria-label="نام گروه">
  <button class="x" data-act="delGroup" data-cat="${c}" data-id="${esc(g.id)}" aria-label="حذف">✕</button></div>`;

function bindSettings() {
  const s = $('#s-salary');
  s.addEventListener('input', () => fmtInput(s));
  s.addEventListener('change', () => { S.salary = num(s.value); save(); toast('ذخیره شد'); });
  $$('.ce.g').forEach((row) => {
    const g = (S.groups[row.dataset.cat] || []).find((x) => x.id === row.dataset.id);
    $$('input', row).forEach((inp) => inp.addEventListener('change', () => {
      if (!g) return;
      if (inp.dataset.f === 'name') g.name = inp.value.trim() || g.name; else g.icon = inp.value.trim() || '📦';
      save(); toast('ذخیره شد');
    }));
  });
  $('#restoreFile').addEventListener('change', doRestore);
}

function fmtInput(el) { const n = num(el.value); el.value = n ? fa(n) : ''; }

/* ---------- پیام و برگه ---------- */
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200);
}
let sheetOpen = false;
function openSheet(html, mount) {
  const sh = $('#sheet'); const p = $('.panel', sh);
  p.innerHTML = `<div class="grab"></div>` + html;
  sh.hidden = false; p.scrollTop = 0;
  requestAnimationFrame(() => sh.classList.add('show'));
  if (!sheetOpen) { history.pushState({ sheet: 1 }, ''); sheetOpen = true; }
  $$('.amt', p).forEach((a) => a.addEventListener('input', () => fmtInput(a)));
  if (mount) mount(p);
}
function closeSheet(fromPop) {
  if (!sheetOpen) return;
  sheetOpen = false;
  const sh = $('#sheet'); sh.classList.remove('show');
  setTimeout(() => { if (!sheetOpen) { sh.hidden = true; $('.panel', sh).innerHTML = ''; } }, 220);
  if (!fromPop) history.back();
}
window.addEventListener('popstate', () => { if (sheetOpen) closeSheet(true); });

/* ---------- فرم‌ها ---------- */
function dateSel(d, p = 'd') {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const yrs = []; for (let y = today.y - 3; y <= today.y + 1; y++) yrs.push(y);
  if (!yrs.includes(d.y)) yrs.push(d.y);
  return `<div class="dts">
    <select id="${p}-d">${days.map((x) => `<option value="${x}" ${x === d.d ? 'selected' : ''}>${fa(x)}</option>`).join('')}</select>
    <select id="${p}-m">${MN.map((n, i) => `<option value="${i + 1}" ${i + 1 === d.m ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <select id="${p}-y">${yrs.sort().map((x) => `<option value="${x}" ${x === d.y ? 'selected' : ''}>${fy(x)}</option>`).join('')}</select></div>`;
}
function readDate(p = 'd') {
  const y = +$(`#${p}-y`).value, mo = +$(`#${p}-m`).value;
  return { y, m: mo, d: Math.min(+$(`#${p}-d`).value, MD(mo)) };
}
const defDate = () => ((today.y === cur.y && today.m === cur.m) ? { ...today } : { y: cur.y, m: cur.m, d: 1 });
const dl = (id, items) => `<datalist id="${id}">${[...new Set(items.filter(Boolean))].map((p) => `<option value="${esc(p)}">`).join('')}</datalist>`;

function chooser() {
  openSheet(`<h2>چه چیزی ثبت کنم؟</h2><div class="btns two">
    <button class="btn sec" data-act="newRecv">🤝 طلبکاری (ورودی)</button>
    ${CATS.map((c) => `<button class="btn sec" data-act="newExp" data-id="${c.id}">${c.icon} خرج ${c.name}</button>`).join('')}</div>`);
}

function recvForm(pre = {}) {
  const edit = !!pre.id, date = pre.y ? { y: pre.y, m: pre.m, d: pre.d } : defDate();
  openSheet(`<h2>${edit ? 'ویرایش — ' : ''}طلبکاری</h2>
    <div class="f"><label>نام شخص</label><input type="text" id="f-name" list="dl-n" value="${esc(pre.name || '')}" placeholder="مثلاً برادرم">${dl('dl-n', S.inc.map((x) => x.name))}</div>
    <div class="f"><label>مبلغ (تومان)</label><input type="text" inputmode="numeric" id="f-amt" class="amt" value="${pre.amount ? fa(pre.amount) : ''}" placeholder="۰" autocomplete="off"></div>
    <div class="f"><label>تاریخ</label>${dateSel(date)}</div>
    <div class="f"><label>توضیحات</label><input type="text" id="f-note" value="${esc(pre.note || '')}"></div>
    <div class="btns ${edit ? 'two' : ''}"><button class="btn" data-act="save">ذخیره</button>
    ${edit ? `<button class="btn red" data-act="del">حذف</button>` : ''}</div>`,
    (p) => { p._ctx = { k: 'inc', pre }; if (!edit) setTimeout(() => $('#f-name')?.focus(), 260); });
}

function expForm(cat, pre = {}) {
  const edit = !!pre.id, c = catOf(cat), date = pre.y ? { y: pre.y, m: pre.m, d: pre.d } : defDate();
  let h = `<h2>${edit ? 'ویرایش — ' : ''}خرج ${c.icon} ${c.name}</h2>`;
  if (cat === 'inst') {
    h += `<div class="f"><label>نام بانک / وام</label><input type="text" id="f-bank" list="dl-b" value="${esc(pre.bank || '')}" placeholder="مثلاً بانک ملی">${dl('dl-b', S.exp.filter((x) => x.cat === 'inst').map((x) => x.bank))}</div>
      <div class="f"><label>شماره‌ی قسط</label><input type="text" inputmode="numeric" id="f-no" value="${pre.no ? fa(pre.no) : ''}" placeholder="مثلاً ۵"></div>`;
  } else if (cat === 'debt') {
    h += `<div class="f"><label>نام شخص (طلبکار)</label><input type="text" id="f-name" list="dl-n" value="${esc(pre.name || '')}" placeholder="مثلاً برادرم">${dl('dl-n', S.exp.filter((x) => x.cat === 'debt').map((x) => x.name).concat(S.inc.map((x) => x.name)))}</div>`;
  }
  h += `<div class="f"><label>مبلغ (تومان)</label><input type="text" inputmode="numeric" id="f-amt" class="amt" value="${pre.amount ? fa(pre.amount) : ''}" placeholder="۰" autocomplete="off"></div>`;
  if (GCATS.includes(cat)) {
    const gs = S.groups[cat];
    const sel = gs.some((g) => g.id === pre.group) ? pre.group : (gs[0] && gs[0].id);
    const hpRows = cat === 'home' ? calcMonth(date.y, date.m).homePlan.rows : [];
    h += `<div class="f"><label>${cat === 'home' ? 'این خرج مربوط به کدام قلم است؟' : 'این خرج مربوط به کدام گروه است؟'}</label><div class="cgrid">${gs.map((g, i) => {
      const pr = hpRows.find((x) => x.g.id === g.id);
      const left = pr && pr.plan ? `<small class="${pr.left < 0 ? 'neg' : ''}">مانده ${fa(pr.left)}</small>` : '';
      return `<input type="radio" name="f-grp" id="grp-${i}" value="${esc(g.id)}" ${g.id === sel ? 'checked' : ''}><label for="grp-${i}"><b>${esc(g.icon)}</b>${esc(g.name)}${left}</label>`;
    }).join('')}</div></div>`;
  }
  h += `<div class="f"><label>تاریخ</label>${dateSel(date)}</div>
    <div class="f"><label>${GCATS.includes(cat) ? 'دلیل خرج' : 'توضیحات'}</label><input type="text" id="f-note" value="${esc(pre.note || '')}" placeholder="${GCATS.includes(cat) ? 'مثلاً خرید میوه‌ی شب یلدا' : ''}"></div>
    <div class="btns ${edit ? 'two' : ''}"><button class="btn" data-act="save">ذخیره</button>
    ${edit ? `<button class="btn red" data-act="del">حذف</button>` : ''}</div>`;
  openSheet(h, (p) => {
    p._ctx = { k: 'exp', cat, pre };
    if (cat === 'inst' && !edit) {
      const bank = $('#f-bank', p);
      bank.addEventListener('change', () => {
        const last = S.exp.filter((x) => x.cat === 'inst' && x.bank === bank.value.trim()).sort(cmp).pop();
        if (!last) return;
        if (!num($('#f-amt', p).value)) $('#f-amt', p).value = fa(last.amount);
        if (!num($('#f-no', p).value)) $('#f-no', p).value = fa((last.no || 0) + 1);
      });
    }
    if (!edit) setTimeout(() => ($('#f-bank') || $('#f-name') || $('#f-amt'))?.focus(), 260);
  });
}

function planSheet() {
  const items = S.groups.home;
  openSheet(`<h2>🧮 برنامه‌ی ماهانه‌ی خانه</h2>
    <div class="f"><label>کل پول خانه در ماه (تومان)</label><input type="text" inputmode="numeric" id="p-total" class="amt" value="${S.homeBudget ? fa(S.homeBudget) : ''}" placeholder="مثلاً ۸٬۰۰۰٬۰۰۰"></div>
    <div class="info" id="p-sum"></div>
    <div class="f"><label>سهم هر قلم (۰ = بدون سقف)</label>
    ${items.map((g, i) => `<div class="pr"><span>${esc(g.icon)} ${esc(g.name)}</span><input type="text" inputmode="numeric" class="amt pi" data-i="${i}" value="${g.plan ? fa(g.plan) : ''}" placeholder="۰"></div>`).join('')}</div>
    <div class="f"><label>قلم جدید</label><div class="pr"><input type="text" id="p-new" placeholder="مثلاً ماهی"><button class="btn sm sec" data-act="addPlanItem">افزودن</button></div></div>
    <div class="btns"><button class="btn" data-act="savePlan">ذخیره‌ی برنامه</button></div>`,
    (p) => {
      p._plan = true;
      if (p._planUpd) p.removeEventListener('input', p._planUpd);
      const upd = () => {
        if (!$('#p-total', p)) return;
        const tot = num($('#p-total', p).value), al = $$('.pi', p).reduce((s, e) => s + num(e.value), 0), d = tot - al;
        $('#p-sum', p).innerHTML = `تقسیم‌شده: <b>${m(al)}</b>` + (tot ? ` — ${d >= 0 ? 'هنوز تقسیم‌نشده' : 'بیشتر از کل پول'}: <b class="${d < 0 ? 'neg' : ''}">${m(Math.abs(d))}</b>` : '');
      };
      p._planUpd = upd; p.addEventListener('input', upd); upd();
    });
}
function readPlan(p) {
  S.homeBudget = num($('#p-total', p).value);
  $$('.pi', p).forEach((e) => { const g = S.groups.home[+e.dataset.i]; if (g) g.plan = num(e.value); });
}

function editSalary() {
  const k = mk(cur.y, cur.m), has = S.salaryOv[k] !== undefined;
  openSheet(`<h2>حقوق ${MN[cur.m - 1]} ${fy(cur.y)}</h2>
    <div class="f"><label>مبلغ (تومان)</label><input type="text" inputmode="numeric" id="f-amt" class="amt" value="${monthSalary(cur.y, cur.m) ? fa(monthSalary(cur.y, cur.m)) : ''}" placeholder="۰"></div>
    <div class="btns">
      <button class="btn" data-act="saveSalary" data-id="month">فقط برای این ماه</button>
      <button class="btn sec" data-act="saveSalary" data-id="all">به‌عنوان حقوق پیش‌فرض همه‌ی ماه‌ها</button>
      ${has ? `<button class="btn ghost" data-act="saveSalary" data-id="reset">برگشت به حقوق پیش‌فرض (${fa(S.salary)})</button>` : ''}</div>`,
    () => setTimeout(() => $('#f-amt')?.focus(), 260));
}

/* ---------- ذخیره‌ها ---------- */
const upsert = (arr, rec) => { const i = arr.findIndex((x) => x.id === rec.id); if (i >= 0) arr[i] = rec; else arr.push(rec); };
function saveForm() {
  const p = $('.panel'), { k, cat, pre } = p._ctx;
  const amount = num($('#f-amt').value);
  if (!amount) return toast('مبلغ را وارد کنید');
  const rec = { id: pre.id || uid(), amount, note: $('#f-note').value.trim(), ...readDate(), ts: pre.ts || Date.now() };
  if (k === 'inc') {
    const name = $('#f-name').value.trim();
    if (!name) return toast('نام شخص را وارد کنید');
    rec.name = name; upsert(S.inc, rec);
  } else {
    rec.cat = cat;
    if (cat === 'inst') {
      const bank = $('#f-bank').value.trim();
      if (!bank) return toast('نام بانک را وارد کنید');
      rec.bank = bank; rec.no = num($('#f-no').value);
    } else if (cat === 'debt') {
      const name = $('#f-name').value.trim();
      if (!name) return toast('نام شخص را وارد کنید');
      rec.name = name;
    } else {
      const g = $('input[name=f-grp]:checked'); rec.group = g ? g.value : 'other';
    }
    upsert(S.exp, rec);
  }
  save(); cur = { y: rec.y, m: rec.m };
  let msg = 'ثبت شد';
  if (rec.cat === 'home') {
    const x = calcMonth(rec.y, rec.m).homePlan.rows.find((r) => r.g.id === rec.group);
    if (x && x.plan && x.spent > x.plan) msg = `⚠️ ثبت شد؛ «${x.g.name}» ${fa(x.spent - x.plan)} تومان بیشتر از برنامه شد`;
  }
  if ((rec.cat === 'me' || rec.cat === 'wife')) {
    const a = calcMonth(rec.y, rec.m).allow[rec.cat];
    if (a.budget && a.spent > a.budget) msg = `⚠️ ثبت شد؛ از سهم ${rec.cat === 'me' ? 'خودم' : 'همسر'} ${fa(a.spent - a.budget)} تومان بیشتر خرج شد`;
  }
  closeSheet(); render(); toast(msg);
}
function delForm() {
  const { k, pre } = $('.panel')._ctx;
  if (!confirm('این مورد حذف شود؟')) return;
  if (k === 'inc') S.inc = S.inc.filter((x) => x.id !== pre.id); else S.exp = S.exp.filter((x) => x.id !== pre.id);
  save(); closeSheet(); render(); toast('حذف شد');
}
function saveSalary(mode) {
  const v = num($('#f-amt').value), key = mk(cur.y, cur.m);
  if (mode === 'reset') delete S.salaryOv[key];
  else if (mode === 'all') { S.salary = v; delete S.salaryOv[key]; }
  else S.salaryOv[key] = v;
  save(); closeSheet(); render(); toast('ذخیره شد');
}

/* ---------- پشتیبان ---------- */
function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
}
function backup() {
  const d = new Date();
  saveBlob(new Blob([JSON.stringify(S)], { type: 'application/json' }),
    `daftar-kharj-backup-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`);
  toast('فایل پشتیبان ذخیره شد');
}
function doRestore(e) {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      let r = JSON.parse(rd.result);
      if (r && r.v === 1) r = migrate(r);
      if (!r || r.v !== 2 || !Array.isArray(r.inc) || !Array.isArray(r.exp)) throw new Error('bad');
      if (!confirm('اطلاعات فعلی با این پشتیبان جایگزین می‌شود. ادامه؟')) return;
      S = fix(r); save(); render(); toast('بازیابی شد');
    } catch (err) { toast('فایل پشتیبان معتبر نیست'); }
  };
  rd.readAsText(f); e.target.value = '';
}

/* ================= PDF بدون کتابخانه ================= */
const RCSS = `
.rp{width:720px;font-family:'Vazirmatn','Noto Naskh Arabic','Noto Sans Arabic','Droid Arabic Naskh',Tahoma,Arial,sans-serif;direction:rtl;color:#0f172a;background:#fff;padding:10px 16px;font-size:14px;line-height:1.7;box-sizing:border-box}
.rp *{box-sizing:border-box}
.rp h1{font-size:23px;margin:0;color:#0f766e}
.rp h2{font-size:16px;margin:0 0 6px;color:#0f766e;border-bottom:2px solid #99f6e4;padding-bottom:3px}
.rp .sub{color:#64748b;font-size:12.5px;margin:0 0 4px}
.rp table{width:100%;border-collapse:collapse;font-size:13px}
.rp th{background:#0f766e;color:#fff;padding:4px 8px;text-align:right;font-weight:700}
.rp td{padding:4px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top}
.rp tr.t td{font-weight:700;background:#f0fdfa;border-top:2px solid #0f766e}
.rp .n{text-align:left;white-space:nowrap}
.rp .m{unicode-bidi:isolate;white-space:nowrap}
.rp .neg{color:#dc2626}.rp .pos{color:#15803d}
.rp .note{font-size:12px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 10px}
.rp .sm{font-size:12px;color:#64748b}
`;
const blk = (inner) => `<div class="rp"><style>${RCSS}</style>${inner}</div>`;
const tbl = (head, rows) => `<table><tr>${head.map((x) => `<th>${x}</th>`).join('')}</tr>${rows.join('')}</table>`;
const tr = (cells, cls = '') => `<tr class="${cls}">${cells.map((c) => `<td${c && c.n ? ' class="n"' : ''}>${c && c.h !== undefined ? c.h : c}</td>`).join('')}</tr>`;
const N = (n, cls = '', plus = false) => ({ n: 1, h: m(n, cls, plus) });

/** جدول چندتکه‌ای (هر تکه یک بلوک تا صفحه‌بندی راحت باشد) */
function chunked(title, head, rows, totalRow, CH = 9) {
  const out = [];
  for (let i = 0; i < rows.length; i += CH) {
    const part = rows.slice(i, i + CH), last = i + CH >= rows.length;
    out.push(blk((i === 0 ? `<h2>${title}</h2>` : '<p class="sub">ادامه‌ی جدول</p>') + tbl(head, last && totalRow ? part.concat([totalRow]) : part)));
  }
  return out;
}

function monthBlocks(y, mo) {
  const r = calcMonth(y, mo);
  const title = `${MN[mo - 1]} ${fy(y)}`;
  const now = new Date();
  const printed = `${fullDate(jOf(now))} — ساعت ${now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`;
  const B = [];

  B.push(blk(`<h1>گزارش مالی ${title}</h1><p class="sub">تاریخ تهیه‌ی گزارش: ${printed} — مبالغ به تومان</p><h2>خلاصه‌ی ماه</h2>` +
    tbl(['شرح', 'مبلغ', 'سهم از مخارج'], [
      tr(['حقوق', N(r.salary, 'pos', true), '—']),
      tr(['طلبکاری', N(r.recvT, 'pos', true), '—']),
      tr(['جمع ورودی (+)', N(r.incT, 'pos', true), '—'], 't'),
      ...CATS.map((c) => tr([`مخارج ${c.name}`, N(-r.byCat[c.id], 'neg'), pct(r.byCat[c.id], r.expT)])),
      tr(['جمع مخارج (−)', N(-r.expT, 'neg'), r.expT ? pct(r.expT, r.expT) : '—'], 't'),
      tr(['پس‌انداز (ورودی − مخارج)', N(r.savings, r.savings < 0 ? 'neg' : 'pos', true), '—'], 't')
    ])));

  if (r.recv.length) {
    B.push(...chunked('ریز طلبکاری (ورودی)', ['تاریخ', 'نام', 'توضیحات', 'مبلغ'],
      r.recv.map((t) => tr([dayLabel(t), esc(t.name), esc(t.note || ''), N(t.amount, 'pos', true)])),
      tr(['جمع', '', '', N(r.recvT, 'pos', true)], 't')));
  }

  CATS.forEach((c) => {
    const list = r.exps.filter((t) => t.cat === c.id);
    if (!list.length) return;
    const total = r.byCat[c.id];
    let head, rows;
    if (GCATS.includes(c.id)) {
      head = ['تاریخ', 'گروه', 'دلیل خرج', 'مبلغ'];
      rows = list.map((t) => tr([dayLabel(t), esc(grp(c.id, t.group).name), esc(t.note || ''), N(-t.amount, 'neg')]));
    } else if (c.id === 'inst') {
      head = ['تاریخ', 'بانک', 'شماره‌ی قسط', 'توضیحات', 'مبلغ'];
      rows = list.map((t) => tr([dayLabel(t), esc(t.bank || ''), t.no ? fa(t.no) : '—', esc(t.note || ''), N(-t.amount, 'neg')]));
    } else {
      head = ['تاریخ', 'نام', 'توضیحات', 'مبلغ'];
      rows = list.map((t) => tr([dayLabel(t), esc(t.name || ''), esc(t.note || ''), N(-t.amount, 'neg')]));
    }
    const totRow = tr(['جمع ' + c.name].concat(Array(head.length - 2).fill('')).concat([N(-total, 'neg')]), 't');
    B.push(...chunked(`مخارج ${c.name} — ریز هر خرج`, head, rows, totRow));
    if (r.groupsByCat[c.id]) {
      B.push(blk(`<h2>مصرف ${c.name} به تفکیک گروه</h2>` + tbl(['گروه', 'تعداد', 'مبلغ', `سهم از ${c.name}`],
        r.groupsByCat[c.id].map((g) => tr([esc(g.name), fa(g.count), N(-g.total, 'neg'), pct(g.total, total)])))));
    }
    if ((c.id === 'me' || c.id === 'wife') && r.allow[c.id].budget) {
      const a = r.allow[c.id];
      B.push(blk(`<h2>سهم ماهانه‌ی ${c.name}</h2>` + tbl(['شرح', 'مبلغ'], [
        tr(['سهم ماه', N(a.budget)]), tr(['خرج‌شده', N(-a.spent, 'neg')]),
        tr([a.left < 0 ? 'بیشتر از سهم' : 'مانده‌ی سهم', N(a.left, a.left < 0 ? 'neg' : 'pos')], 't')])));
    }
    if (c.id === 'home' && (r.homePlan.budget || r.homePlan.alloc)) {
      const hp = r.homePlan;
      B.push(blk(`<h2>کنترل برنامه‌ی ماهانه‌ی خانه</h2>` + tbl(['قلم', 'برنامه', 'خرج‌شده', 'مانده'],
        hp.rows.map((x) => tr([esc(x.g.name), x.plan ? N(x.plan) : '—', N(-x.spent, 'neg'), x.plan ? N(x.left, x.left < 0 ? 'neg' : 'pos') : '—']))
          .concat([tr(['جمع / کل پول خانه', N(hp.budget || hp.alloc), N(-hp.spent, 'neg'), hp.budget ? N(hp.left, hp.left < 0 ? 'neg' : 'pos') : '—'], 't')]))
        + (hp.budget && hp.alloc !== hp.budget ? `<p class="sub" style="margin-top:4px">${hp.alloc < hp.budget ? 'مبلغ تقسیم‌نشده' : 'مبلغ تقسیم‌شده بیش از کل پول'}: ${m(Math.abs(hp.budget - hp.alloc))}</p>` : '')));
    }
  });

  if (r.groups.length) {
    const gt = sum(r.groups);
    B.push(blk(`<h2>آمار کل مصرف به تفکیک گروه (خانه + خودم + همسر)</h2>` + tbl(['گروه', 'تعداد', 'مبلغ', 'سهم از این سه بخش'],
      r.groups.map((g) => tr([esc(g.name), fa(g.count), N(-g.total, 'neg'), pct(g.total, gt)]))
        .concat([tr(['جمع', fa(sum(r.groups.map((g) => ({ amount: g.count })))), N(-gt, 'neg'), '۱۰۰٪'], 't')]))));
  }

  const big = r.top[0];
  B.push(blk(`<h2>آمار پایان ماه</h2>` + tbl(['شاخص', 'مقدار'], [
      tr(['تعداد خرج‌های ثبت‌شده', fa(r.exps.length)]),
      tr([`میانگین خرج روزانه (${fa(r.days)} روز)`, N(r.avg)]),
      tr(['بزرگ‌ترین خرج', big ? `${esc(descE(big).title)} (${esc(catOf(big.cat).name)}) — ${dayLabel(big)} — ${m(big.amount)}` : '—']),
      tr(['درصد پس‌انداز از ورودی', r.incT ? pct(r.savings, r.incT) : '—'])
    ]) + `<div class="note" style="margin-top:8px"><b>روش محاسبه:</b>
      ورودی = حقوق + طلبکاری (مثبت). مخارج = خانه + خودم + همسر + اقساط + بدهی (منفی، کسر می‌شود).<br>
      پس‌انداز = جمع ورودی − جمع مخارج.</div>`));
  return B;
}

async function blockToJpeg(html, W, SC) {
  const holder = document.createElement('div');
  holder.style.cssText = `position:fixed;left:-10000px;top:0;width:${W}px;visibility:hidden`;
  holder.innerHTML = html;
  document.body.appendChild(holder);
  await (document.fonts && document.fonts.ready);
  const root = holder.firstElementChild;
  const h = Math.ceil(root.getBoundingClientRect().height) + 2;
  const xml = new XMLSerializer().serializeToString(root);
  holder.remove();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}"><foreignObject x="0" y="0" width="${W}" height="${h}">${xml}</foreignObject></svg>`;
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res; img.onerror = () => rej(new Error('render'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  const c = document.createElement('canvas');
  c.width = W * SC; c.height = h * SC;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.scale(SC, SC); g.drawImage(img, 0, 0);
  const b64 = c.toDataURL('image/jpeg', 0.92).split(',')[1];
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return { jpeg: u, w: c.width, h: c.height, cssH: h };
}

function buildPDF(pages, PW, PH) {
  const enc = new TextEncoder(); const chunks = []; let pos = 0; const off = [];
  const w = (u) => { const b = typeof u === 'string' ? enc.encode(u) : u; chunks.push(b); pos += b.length; };
  let n = 2;
  const ids = pages.map((p) => ({ pid: ++n, cid: ++n, im: p.items.map(() => ++n) }));
  const total = n;
  w('%PDF-1.4\n%âãÏÓ\n');
  off[1] = pos; w('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  off[2] = pos; w(`2 0 obj\n<< /Type /Pages /Kids [${ids.map((o) => o.pid + ' 0 R').join(' ')}] /Count ${pages.length} >>\nendobj\n`);
  pages.forEach((p, i) => {
    const o = ids[i];
    const xo = p.items.map((it, j) => `/Im${j} ${o.im[j]} 0 R`).join(' ');
    off[o.pid] = pos;
    w(`${o.pid} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << ${xo} >> >> /Contents ${o.cid} 0 R >>\nendobj\n`);
    const cs = p.items.map((it, j) => `q ${it.pw.toFixed(2)} 0 0 ${it.ph.toFixed(2)} ${it.x.toFixed(2)} ${(PH - it.y - it.ph).toFixed(2)} cm /Im${j} Do Q`).join('\n');
    off[o.cid] = pos; w(`${o.cid} 0 obj\n<< /Length ${cs.length} >>\nstream\n${cs}\nendstream\nendobj\n`);
    p.items.forEach((it, j) => {
      off[o.im[j]] = pos;
      w(`${o.im[j]} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${it.w} /Height ${it.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${it.jpeg.length} >>\nstream\n`);
      w(it.jpeg); w('\nendstream\nendobj\n');
    });
  });
  const xr = pos;
  let x = `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= total; i++) x += String(off[i]).padStart(10, '0') + ' 00000 n \n';
  w(x + `trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`);
  return new Blob(chunks, { type: 'application/pdf' });
}

let busy = false;
async function makePDF(blocks, filename) {
  if (busy) return; busy = true;
  toast('در حال ساخت PDF…');
  try {
    const W = 720, SC = 2, PW = 595.28, PH = 841.89, MX = 28, MY = 30, FOOT = 22;
    const k = (PW - 2 * MX) / W;
    const pages = [{ items: [] }]; let y = MY;
    for (const b of blocks) {
      const r = await blockToJpeg(b, W, SC);
      const ph = r.cssH * k;
      if (y + ph > PH - MY - FOOT && pages[pages.length - 1].items.length) { pages.push({ items: [] }); y = MY; }
      pages[pages.length - 1].items.push({ jpeg: r.jpeg, w: r.w, h: r.h, x: MX, y, pw: W * k, ph });
      y += ph + 5;
    }
    for (let i = 0; i < pages.length; i++) {
      const f = await blockToJpeg(blk(`<p class="sub" style="text-align:center;margin:0">دفتر خرج — صفحه ${fa(i + 1)} از ${fa(pages.length)}</p>`), W, SC);
      pages[i].items.push({ jpeg: f.jpeg, w: f.w, h: f.h, x: MX, y: PH - MY - f.cssH * k + 6, pw: W * k, ph: f.cssH * k });
    }
    saveBlob(buildPDF(pages, PW, PH), filename);
    toast('PDF ساخته شد و در دانلودها ذخیره می‌شود');
  } catch (e) {
    console.error(e);
    toast('ساخت PDF ناموفق بود');
  } finally { busy = false; }
}

/* ---------- رویدادها ---------- */
const ACT = {
  prevM() { cur = cur.m === 1 ? { y: cur.y - 1, m: 12 } : { y: cur.y, m: cur.m - 1 }; render(); },
  nextM() { cur = cur.m === 12 ? { y: cur.y + 1, m: 1 } : { y: cur.y, m: cur.m + 1 }; render(); },
  fab() { if (view === 'inc') recvForm(); else if (view === 'exp') expForm(expCat); else chooser(); },
  closeSheet() { closeSheet(); },
  pickCat(el) { expCat = el.dataset.id; render(); },
  logCat(el) { logCat = el.dataset.id; render(); },
  statTab(el) { statTab = el.dataset.id; render(); },
  goInc() { view = 'inc'; render(); window.scrollTo(0, 0); },
  goExp(el) { expCat = el.dataset.id; view = 'exp'; render(); window.scrollTo(0, 0); },
  editSalary() { editSalary(); },
  saveSalary(el) { saveSalary(el.dataset.id); },
  newRecv() { recvForm(); },
  newExp(el) { expForm(el.dataset.id); },
  editInc(el) { const t = S.inc.find((x) => x.id === el.dataset.id); if (t) recvForm(t); },
  editExp(el) { const t = S.exp.find((x) => x.id === el.dataset.id); if (t) expForm(t.cat, t); },
  save() { saveForm(); },
  del() { delForm(); },
  install() {
    if (!deferred) return toast('از منوی Chrome گزینه‌ی نصب برنامه را بزنید');
    deferred.prompt(); deferred.userChoice.finally(() => { deferred = null; render(); });
  },
  allowSheet(el) { allowSheet(el.dataset.id); },
  saveAllow(el) { S.allow[el.dataset.id] = num($('#f-amt').value); save(); closeSheet(); render(); toast('سهم ذخیره شد'); },
  planSheet() { planSheet(); },
  savePlan() { readPlan($('.panel')); save(); closeSheet(); render(); toast('برنامه‌ی خانه ذخیره شد'); },
  addPlanItem() {
    const p = $('.panel'), name = $('#p-new', p).value.trim();
    if (!name) return toast('نام قلم را وارد کنید');
    readPlan(p);
    S.groups.home.splice(Math.max(0, S.groups.home.length - 1), 0, { id: uid(), name, icon: '📦', plan: 0 });
    save(); planSheet(); toast('قلم اضافه شد');
  },
  addGroup(el) {
    const c = el.dataset.id;
    S.groups[c].push({ id: uid(), name: 'گروه جدید', icon: '📦' }); save(); render();
  },
  delGroup(el) {
    const c = el.dataset.cat, g = S.groups[c].find((x) => x.id === el.dataset.id);
    if (!g) return;
    const n = S.exp.filter((t) => t.cat === c && t.group === g.id).length;
    if (!confirm(`گروه «${g.name}» حذف شود؟${n ? `\n${fa(n)} خرج ثبت‌شده در این گروه «بدون گروه» می‌شود.` : ''}`)) return;
    S.groups[c] = S.groups[c].filter((x) => x.id !== g.id); save(); render();
  },
  backup() { backup(); },
  restore() { $('#restoreFile').click(); },
  wipe() {
    if (!confirm('همه‌ی اطلاعات (ورودی‌ها، مخارج، تنظیمات) پاک شود؟ این کار برگشت ندارد.')) return;
    if (!confirm('مطمئن هستید؟ اگر پشتیبان ندارید، اطلاعات از بین می‌رود.')) return;
    S = fresh(); save(); render(); toast('پاک شد');
  },
  monthPdf() { makePDF(monthBlocks(cur.y, cur.m), `گزارش-${MN[cur.m - 1]}-${cur.y}.pdf`); }
};

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (nav) { view = nav.dataset.nav; render(); window.scrollTo(0, 0); return; }
  const a = e.target.closest('[data-act]');
  if (a && ACT[a.dataset.act]) ACT[a.dataset.act](a);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && sheetOpen && e.target.matches('input[type=text]')) {
    const b = $('.panel [data-act=save]'); if (b) b.click();
  }
});

/* ---------- شروع ---------- */
render();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  navigator.serviceWorker.ready.then(() => { swOK = true; if (view === 'settings') render(); }).catch(() => {});
}
window.__app = { get S() { return S; }, calcMonth, monthBlocks, makePDF, render, setView(v) { view = v; render(); }, cur: () => cur };
})();
