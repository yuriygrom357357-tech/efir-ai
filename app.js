import { classify, highlight, CATS, THREATS } from './rules.js';

const $ = (s) => document.querySelector(s);
const SET_KEY = 'efir.settings';
const set = Object.assign({ model: 'onnx-community/whisper-base', lang: 'uk', calls: 'Кобра, Сокіл, Комбат, Північ', keep: 24 }, JSON.parse(localStorage.getItem(SET_KEY) || '{}'));
const saveSet = () => localStorage.setItem(SET_KEY, JSON.stringify(set));
const calls = () => set.calls.split(',').map(s => s.trim()).filter(Boolean);

let msgs = [];            // {id,t,text,cat,threats,dur,audio,pending}
let win = 600000;         // активний часовий зріз, мс (0 = всі)
let seq = 0;

/* ---------- сховище (IndexedDB) ---------- */
let db = null;
const openDB = () => new Promise((res) => {
  const r = indexedDB.open('efir', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('msgs', { keyPath: 'id' });
  r.onsuccess = () => res(r.result);
  r.onerror = () => res(null);
});
const tx = (mode) => db.transaction('msgs', mode).objectStore('msgs');
const dbPut = (m) => { if (db && !m.pending) try { tx('readwrite').put(m); } catch (e) {} };
const dbDel = (id) => { if (db) try { tx('readwrite').delete(id); } catch (e) {} };
const dbAll = () => new Promise((res) => { if (!db) return res([]); const r = tx('readonly').getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); });
const dbClear = () => new Promise((res) => { if (!db) return res(); const r = tx('readwrite').clear(); r.onsuccess = r.onerror = () => res(); });

/* ---------- відображення ---------- */
const hhmmss = (t) => new Date(t).toLocaleTimeString('uk-UA', { hour12: false });
const hhmm = (t) => new Date(t).toLocaleTimeString('uk-UA', { hour12: false, hour: '2-digit', minute: '2-digit' });
const inWin = (m, w = win) => !w || Date.now() - m.t <= w;
const plural = (n, a, b, c) => { const d = n % 10, h = n % 100; return d === 1 && h !== 11 ? a : d >= 2 && d <= 4 && (h < 12 || h > 14) ? b : c; };

function alerts(w = 900000) {
  const cnt = {};
  for (const m of msgs) if (!m.pending && inWin(m, w)) for (const k of m.threats || []) cnt[k] = (cnt[k] || 0) + 1;
  return Object.entries(cnt).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
}

function renderSum() {
  const recent = msgs.filter(m => !m.pending && inWin(m, 600000));
  const al = alerts();
  const el = $('#sum');
  el.className = 'sum';
  if (al.length) {
    const [k, n] = al[0];
    el.classList.add('alert');
    $('#sumLbl').textContent = 'ПОПЕРЕДЖЕННЯ · НАРОСТАННЯ ЗАГРОЗИ';
    $('#sumMain').textContent = `${k}: ${n} ${plural(n, 'згадка', 'згадки', 'згадок')} за 15 хв`;
    $('#sumSub').textContent = al.slice(1).map(([a, b]) => `${a} ×${b}`).join(' · ') || 'Рішення — за оператором.';
  } else {
    const crit = recent.find(m => m.cat === 'crit');
    $('#sumLbl').textContent = 'АКТУАЛЬНЕ ЗВЕДЕННЯ · ЗАРАЗ';
    if (crit) { $('#sumMain').textContent = crit.text; $('#sumSub').textContent = `${hhmm(crit.t)} · остання критична подія за 10 хв`; }
    else if (recent.length) { el.classList.add('calm'); $('#sumMain').textContent = 'Критичних подій немає'; $('#sumSub').textContent = `За 10 хв: ${recent.length} ${plural(recent.length, 'повідомлення', 'повідомлення', 'повідомлень')}`; }
    else { el.classList.add('calm'); $('#sumMain').textContent = 'Ефір мовчить'; $('#sumSub').textContent = live ? 'Слухаю. Повідомлення з’являться тут.' : 'Натисніть «Слухати» — і повідомлення з’являться тут.'; }
  }
  const c = {}; for (const m of recent) c[m.cat] = (c[m.cat] || 0) + 1;
  $('#counts').innerHTML = recent.length ? Object.keys(CATS).map(k => `<span><i style="background:${CATS[k].color}"></i>${CATS[k].name} ${c[k] || 0}</span>`).join('') : '';
}

function renderFeed() {
  const list = msgs.filter(m => inWin(m)).sort((a, b) => b.t - a.t);
  const feed = $('#feed');
  if (!list.length) {
    feed.innerHTML = `<div class="empty"><b>${msgs.length ? 'За цей період тиша' : 'Стрічка порожня'}</b>${msgs.length ? 'Оберіть довший зріз часу.' : 'Підключіть радіостанцію кабелем або покладіть пристрій поруч із динаміком. Для перевірки без радіо — ☰ → «Демо-запис».'}</div>`;
    return;
  }
  const cs = calls();
  feed.innerHTML = list.map(m => m.pending
    ? `<div class="msg pending"><div class="h"><span>${hhmmss(m.t)}</span><span>${m.dur.toFixed(1)} с</span><span class="c">…</span></div><div class="t">розпізнаю…</div></div>`
    : `<button class="msg ${m.cat}" data-id="${m.id}"><div class="h"><span>${hhmmss(m.t)}</span>${m.dur ? `<span>▶ ${m.dur.toFixed(1)} с</span>` : '<span>ТЕКСТ</span>'}<span class="c">${CATS[m.cat].name}</span></div><div class="t">${highlight(m.text, cs)}</div></button>`).join('');
}
const render = () => { renderSum(); renderFeed(); };

let toastT = 0;
function toast(s, ms = 5000) { const t = $('#toast'); t.textContent = s; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }

/* ---------- повідомлення ---------- */
const JUNK = /дякую за перегляд|спасибо за просмотр|субтитр|редактор|коректор|корректор|продовження буде|продолжение следует|підписуйтес|подписывайтес|до зустрічі|до новых встреч|amara\.org/i;
const EMPTY = /^[^\p{L}\p{N}]*$/u;

function addText(text, t = Date.now(), dur = 0, audio = null) {
  text = text.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const { cat, threats } = classify(text);
  const m = { id: `${t}-${seq++}`, t, text, cat, threats, dur, audio };
  msgs.push(m); dbPut(m); render();
  return m;
}

/* ---------- розпізнавання ---------- */
let worker = null, modelState = 'none', modelWait = null, device = '';
const jobs = new Map();

function pill() {
  const p = $('#pModel');
  p.className = 'pill ' + (modelState === 'ready' ? 'ok' : modelState === 'error' ? 'bad' : modelState === 'loading' ? 'warn' : '');
  p.textContent = modelState === 'ready' ? `МОДЕЛЬ · ${device === 'webgpu' ? 'GPU' : 'CPU'}` : modelState === 'loading' ? 'МОДЕЛЬ ↓' : modelState === 'error' ? 'МОДЕЛЬ ✕' : 'МОДЕЛЬ —';
  const n = $('#pNet'); n.className = 'pill ' + (navigator.onLine ? '' : 'ok'); n.textContent = navigator.onLine ? 'МЕРЕЖА Є' : 'АВТОНОМНО';
}

function ensureModel() {
  if (modelState === 'ready') return Promise.resolve();
  if (modelWait) return modelWait;
  modelState = 'loading'; pill();
  $('#load').classList.add('on'); $('#loadTxt').textContent = 'Готую модель. Перший раз вона завантажується з мережі, далі працює без неї.'; $('#loadBar').style.width = '0';
  modelWait = new Promise((res, rej) => {
    if (!worker) {
      worker = new Worker('asr-worker.js', { type: 'module' });
      worker.onerror = (e) => { modelState = 'error'; pill(); $('#loadTxt').textContent = 'Не вдалося запустити розпізнавання: ' + (e.message || 'помилка'); modelWait = null; rej(e); };
    }
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress' && m.total) { const mb = (x) => (x / 1048576).toFixed(0); $('#loadBar').style.width = Math.min(100, 100 * m.loaded / m.total) + '%'; $('#loadTxt').textContent = `Завантаження моделі: ${mb(m.loaded)} з ${mb(m.total)} МБ`; }
      else if (m.type === 'ready') { modelState = 'ready'; device = m.device; pill(); $('#load').classList.remove('on'); modelWait = null; res(); }
      else if (m.type === 'result') { const j = jobs.get(m.id); jobs.delete(m.id); if (j) j(m.text, m.ms); }
      else if (m.type === 'error') {
        if (m.stage === 'load') { modelState = 'error'; pill(); $('#loadTxt').textContent = 'Модель не завантажилась: ' + m.message + '. Перевірте мережу й натисніть «Слухати» ще раз.'; modelWait = null; rej(new Error(m.message)); }
        else { const j = jobs.get(m.id); jobs.delete(m.id); if (j) j('', 0); }
      }
    };
    worker.postMessage({ type: 'load', model: set.model });
  });
  return modelWait;
}

function transcribe(audio16k, t) {
  const dur = audio16k.length / 16000;
  const wav = wavBlob(audio16k);
  const ph = { id: `p${t}-${seq++}`, t, dur, pending: true };
  msgs.push(ph); render();
  return new Promise((res) => {
    jobs.set(ph.id, (text, ms) => {
      msgs = msgs.filter(x => x !== ph);
      const ok = text && !EMPTY.test(text) && !JUNK.test(text);
      const m = ok ? addText(text, t, dur, wav) : null;
      if (m) m.ms = ms; else render();
      res(m);
    });
    worker.postMessage({ type: 'run', id: ph.id, audio: audio16k, lang: set.lang }, [audio16k.buffer]);
  });
}

/* ---------- звук: відсікання тиші і нарізка на повідомлення ---------- */
function to16k(x, sr) {
  if (sr === 16000) return x;
  const r = sr / 16000, n = Math.floor(x.length / r), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const a = Math.floor(i * r), b = Math.min(x.length, Math.max(a + 1, Math.floor((i + 1) * r))); let s = 0; for (let j = a; j < b; j++) s += x[j]; out[i] = s / (b - a); }
  return out;
}
function wavBlob(x) {
  const b = new DataView(new ArrayBuffer(44 + x.length * 2)); const w = (o, s) => { for (let i = 0; i < s.length; i++) b.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); b.setUint32(4, 36 + x.length * 2, true); w(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
  b.setUint32(24, 16000, true); b.setUint32(28, 32000, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); w(36, 'data'); b.setUint32(40, x.length * 2, true);
  for (let i = 0; i < x.length; i++) b.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i])) * 32767, true);
  return new Blob([b], { type: 'audio/wav' });
}

class Segmenter {
  constructor(sr, onSeg, onLevel) { this.sr = sr; this.N = Math.round(sr * 0.03); this.rem = new Float32Array(0); this.pre = []; this.cur = null; this.sil = 0; this.run = 0; this.floor = 0.003; this.onSeg = onSeg; this.onLevel = onLevel || (() => {}); }
  push(x) {
    const a = new Float32Array(this.rem.length + x.length); a.set(this.rem); a.set(x, this.rem.length);
    let i = 0; for (; i + this.N <= a.length; i += this.N) this.frame(a.subarray(i, i + this.N));
    this.rem = a.slice(i);
  }
  frame(f) {
    let s = 0; for (let i = 0; i < f.length; i++) s += f[i] * f[i];
    const rms = Math.sqrt(s / f.length);
    if (!this.cur) this.floor = rms < this.floor ? this.floor * 0.7 + rms * 0.3 : this.floor * 0.998 + rms * 0.002;
    const sp = rms > Math.max(0.008, this.floor * 3.2);
    this.onLevel(rms, sp);
    if (!this.cur) {
      this.pre.push(f.slice(0)); if (this.pre.length > 12) this.pre.shift();
      this.run = sp ? this.run + 1 : 0;
      if (this.run >= 3) { this.cur = this.pre; this.pre = []; this.sil = 0; this.voiced = 3; }
    } else {
      this.cur.push(f.slice(0));
      if (sp) { this.sil = 0; this.voiced++; } else this.sil++;
      if (this.sil >= 27 || this.cur.length >= 800) this.flush();
    }
  }
  flush() {
    const fr = this.cur; this.cur = null; this.run = 0;
    if (!fr || this.voiced < 8) return;                       // коротше ~0,25 с мовлення — клацання, не повідомлення
    const keep = fr.length - Math.max(0, this.sil - 8);
    const x = new Float32Array(keep * this.N); for (let i = 0; i < keep; i++) x.set(fr[i], i * this.N);
    this.onSeg(to16k(x, this.sr));
  }
  end() { if (this.cur) this.flush(); }
}

/* ---------- мікрофон / лінійний вхід ---------- */
let live = false, ctx = null, stream = null, node = null, lock = null;
const vuBars = [...document.querySelectorAll('#vu i')];
function level(rms, sp) {
  const v = Math.min(1, Math.sqrt(rms) * 2.2);
  $('#vu').classList.toggle('sp', sp);
  vuBars.forEach((b, i) => { b.style.height = (4 + 26 * Math.max(0, Math.min(1, v * 7 - i * 0.55))) + 'px'; });
}

async function start() {
  const go = $('#bGo'); go.disabled = true; $('#bGoT').textContent = 'ГОТУЮ…';
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    await ctx.resume();
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
    await ensureModel();
    await ctx.audioWorklet.addModule('tap.js');
    const seg = new Segmenter(ctx.sampleRate, (a) => transcribe(a, Date.now() - Math.round(a.length / 16)), level);
    const src = ctx.createMediaStreamSource(stream);
    node = new AudioWorkletNode(ctx, 'tap');
    node.port.onmessage = (e) => seg.push(e.data);
    const mute = ctx.createGain(); mute.gain.value = 0;
    src.connect(node); node.connect(mute); mute.connect(ctx.destination);
    node._src = src; node._seg = seg;
    try { lock = await navigator.wakeLock.request('screen'); } catch (e) {}
    live = true; go.classList.add('live'); $('#bGoT').textContent = 'ЗУПИНИТИ';
  } catch (e) {
    stop();
    toast(e && e.name === 'NotAllowedError' ? 'Немає доступу до мікрофона. Дозвольте його в налаштуваннях браузера.' : 'Не вдалося почати: ' + (e && e.message || e), 8000);
  }
  go.disabled = false; render();
}
function stop() {
  if (node) { try { node._seg.end(); node._src.disconnect(); node.disconnect(); } catch (e) {} node = null; }
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if (lock) { try { lock.release(); } catch (e) {} lock = null; }
  live = false; $('#bGo').classList.remove('live'); $('#bGoT').textContent = 'СЛУХАТИ'; level(0, false); render();
}
$('#bGo').onclick = () => live ? stop() : start();

/* ---------- тест: файл і демо ---------- */
async function runFile(buf, label) {
  try {
    toast(`${label}: готую модель…`, 60000);
    await ensureModel();
    const ac = ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)());
    const ab = await ac.decodeAudioData(buf);
    const ch = ab.getChannelData(0), segs = [];
    const seg = new Segmenter(ab.sampleRate, (a) => segs.push(a));
    for (let i = 0; i < ch.length; i += 4096) seg.push(ch.subarray(i, Math.min(ch.length, i + 4096)));
    seg.end();
    if (!segs.length) return toast(`${label}: мовлення не знайдено`);
    toast(`${label}: ${segs.length} ${plural(segs.length, 'фрагмент', 'фрагменти', 'фрагментів')}, розпізнаю…`, 60000);
    const t0 = Date.now() - segs.length * 1000;
    const t1 = performance.now(); let audioSec = 0;
    for (let i = 0; i < segs.length; i++) { audioSec += segs[i].length / 16000; await transcribe(segs[i], t0 + i * 1000); }
    const rt = (performance.now() - t1) / 1000;
    toast(`${label}: готово. ${audioSec.toFixed(0)} с звуку розпізнано за ${rt.toFixed(1)} с`, 9000);
  } catch (e) { toast(`${label}: ` + (e && e.message || e), 9000); }
}
$('#bDemo').onclick = async () => { closeSheets(); try { const r = await fetch('demo/demo.mp3'); await runFile(await r.arrayBuffer(), 'Демо'); } catch (e) { toast('Демо-запис недоступний: ' + e.message); } };
$('#bFile').onclick = () => $('#file').click();
$('#file').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) { closeSheets(); await runFile(await f.arrayBuffer(), 'Файл'); } };
$('#bManual').onclick = () => { const v = $('#manual').value.split('\n').map(s => s.trim()).filter(Boolean); v.forEach((s, i) => addText(s, Date.now() - (v.length - i - 1) * 1000)); $('#manual').value = ''; if (v.length) closeSheets(); };

/* ---------- відтворення фрагмента ---------- */
let player = null;
$('#feed').onclick = (e) => {
  const b = e.target.closest('.msg[data-id]'); if (!b) return;
  const m = msgs.find(x => x.id === b.dataset.id); if (!m || !m.audio) return;
  if (player) { player.pause(); document.querySelectorAll('.msg.playing').forEach(x => x.classList.remove('playing')); }
  player = new Audio(URL.createObjectURL(m.audio)); b.classList.add('playing');
  player.onended = () => b.classList.remove('playing'); player.play().catch(() => b.classList.remove('playing'));
};

/* ---------- SITREP ---------- */
function sitrep() {
  const list = msgs.filter(m => !m.pending && inWin(m)).sort((a, b) => a.t - b.t);
  const per = win ? ({ 600000: '10 хв', 1800000: '30 хв', 3600000: '1 год', 7200000: '2 год' })[win] : 'весь журнал';
  const c = {}; const th = {};
  for (const m of list) { c[m.cat] = (c[m.cat] || 0) + 1; for (const k of m.threats || []) th[k] = (th[k] || 0) + 1; }
  const span = list.length > 1 ? Math.max(1, (list[list.length - 1].t - list[0].t) / 60000) : 1;
  const rate = list.length / span;
  const lines = (cat, n = 8) => list.filter(m => m.cat === cat).slice(-n).map(m => `  ${hhmm(m.t)}  ${m.text}`).join('\n') || '  —';
  const al = alerts();
  return [
    `SITREP · ${new Date().toLocaleDateString('uk-UA')} ${hhmm(Date.now())} · період: ${per}`,
    '',
    `1. ЕФІР: ${list.length} ${plural(list.length, 'повідомлення', 'повідомлення', 'повідомлень')}, інтенсивність ${rate >= 4 ? 'висока' : rate >= 1.5 ? 'помірна' : 'низька'}.`,
    `   Загроза ${c.crit || 0} · тактика ${c.tact || 0} · логістика ${c.log || 0} · координати ${c.coord || 0} · фон ${c.noise || 0}`,
    '',
    '2. КРИТИЧНІ ПОДІЇ:', lines('crit'),
    '',
    '3. ЗАГРОЗИ (кількість згадок): ' + (Object.entries(th).filter(([k]) => k !== 'Втрати / евакуація').map(([k, n]) => `${k} ×${n}`).join(', ') || '—'),
    al.length ? '   УВАГА: ' + al.map(([k, n]) => `${k} — ${n} за 15 хв`).join('; ') : null,
    '',
    `4. СВІЙ ПІДРОЗДІЛ: згадок втрат/евакуації — ${th['Втрати / евакуація'] || 0}.`,
    '   Логістика і потреби:', lines('log', 5),
    '',
    '5. ОБСТАНОВКА / ПЕРЕМІЩЕННЯ:', lines('tact', 5),
    '',
    '6. КООРДИНАТИ / ОРІЄНТИРИ:', lines('coord', 5),
    '',
    'Сформовано автоматично за словником тригерів. Потребує перевірки оператором.'
  ].filter(x => x !== null).join('\n');
}
const exportJson = () => JSON.stringify({ app: 'Ефір-ШІ / SITREP-AI прототип', exported: new Date().toISOString(), messages: msgs.filter(m => !m.pending).sort((a, b) => a.t - b.t).map(m => ({ time: new Date(m.t).toISOString(), text: m.text, category: m.cat, threats: m.threats, duration_s: m.dur || null })) }, null, 2);
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); }

const closeSheets = () => document.querySelectorAll('.sheet').forEach(s => s.classList.remove('on'));
document.querySelectorAll('.sheet').forEach(s => s.addEventListener('click', (e) => { if (e.target === s || e.target.closest('[data-close]')) closeSheets(); }));
$('#bRep').onclick = () => { $('#repTxt').textContent = sitrep(); $('#shRep').classList.add('on'); };
$('#bCopy').onclick = async () => { try { await navigator.clipboard.writeText($('#repTxt').textContent); toast('Скопійовано', 2000); } catch (e) { toast('Не вдалося скопіювати — виділіть текст вручну'); } };
$('#bShare').onclick = async () => { const text = $('#repTxt').textContent; if (navigator.share) { try { await navigator.share({ text }); } catch (e) {} } else $('#bCopy').click(); };
$('#bJson').onclick = $('#bExport').onclick = () => download(`efir-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`, exportJson(), 'application/json');

/* ---------- налаштування ---------- */
$('#bSet').onclick = () => { $('#sModel').value = set.model; $('#sLang').value = set.lang; $('#sCalls').value = set.calls; $('#sKeep').value = String(set.keep); wipeArm = false; $('#bWipe').textContent = 'Стерти все'; $('#shSet').classList.add('on'); };
$('#sModel').onchange = (e) => { set.model = e.target.value; saveSet(); modelState = 'none'; modelWait = null; pill(); toast('Нова модель завантажиться під час наступного запуску розпізнавання', 5000); };
$('#sLang').onchange = (e) => { set.lang = e.target.value; saveSet(); };
$('#sCalls').onchange = (e) => { set.calls = e.target.value; saveSet(); render(); };
$('#sKeep').onchange = (e) => { set.keep = +e.target.value; saveSet(); prune(); };
let wipeArm = false;
$('#bWipe').onclick = async () => {
  if (!wipeArm) { wipeArm = true; $('#bWipe').textContent = 'Ще раз — стерти безповоротно'; return; }
  if (live) stop();
  msgs = []; await dbClear(); wipeArm = false; closeSheets(); render(); toast('Журнал і записи стерто', 3000);
};
$('#chips').onclick = (e) => { const b = e.target.closest('.chip'); if (!b) return; document.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b)); win = +b.dataset.w; renderFeed(); };

function prune() { const lim = Date.now() - set.keep * 3600000; const old = msgs.filter(m => m.t < lim); if (old.length) { old.forEach(m => dbDel(m.id)); msgs = msgs.filter(m => m.t >= lim); render(); } }

/* ---------- запуск ---------- */
(async () => {
  db = await openDB();
  msgs = await dbAll();
  prune(); pill(); render();
  setInterval(() => { prune(); render(); }, 30000);
  addEventListener('online', pill); addEventListener('offline', pill);
  document.addEventListener('visibilitychange', async () => { if (live && document.visibilityState === 'visible' && !lock) try { lock = await navigator.wakeLock.request('screen'); } catch (e) {} });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  window.__efir = { Segmenter, addText, sitrep, msgs: () => msgs, state: () => ({ modelState, device, live }), runFile };
})();
