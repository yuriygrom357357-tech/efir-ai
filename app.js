import { classify, highlight, CATS, THREAT_EN } from './rules.js';

const $ = (s) => document.querySelector(s);
const NATIVE = !!window.Capacitor;   // запущено як встановлений застосунок, модель лежить усередині
const SET_KEY = 'efir.settings';
const set = Object.assign({ engine: 'local', input: '', mode: 'mic', model: 'onnx-community/whisper-base', lang: 'uk', ui: 'uk', calls: 'Кобра, Сокіл, Комбат, Північ', keep: 24 }, JSON.parse(localStorage.getItem(SET_KEY) || '{}'));
const saveSet = () => localStorage.setItem(SET_KEY, JSON.stringify(set));
const calls = () => set.calls.split(',').map(s => s.trim()).filter(Boolean);

/* ---------- мови інтерфейсу ---------- */
const pl = (n, a, b, c) => { const d = n % 10, h = n % 100; return d === 1 && h !== 11 ? a : d >= 2 && d <= 4 && (h < 12 || h > 14) ? b : c; };
const I = {
  uk: {
    lInput: 'ДЖЕРЕЛО ЗВУКУ', inAuto: 'Автоматично (вибирає система)', modeMic: 'Мікрофон · шумозаглушення', modeLine: 'Кабель · без обробки', inNow: 'Зараз слухаю: ', inIdle: 'Активний вхід буде видно після натискання «Слухати».',
    lEngine: 'РОЗПІЗНАВАННЯ', engLocal: 'НА ПРИСТРОЇ', engCloud: 'ІНТЕРНЕТ', cloudWarn: 'Інтернет-режим: звук іде на сервери Google. Швидко, але не для бойового ефіру.', cloudPill: 'GOOGLE · ІНТЕРНЕТ', cloudNet: (c) => `Інтернет-режим не запустився (код: ${c}). Він працює лише в Google Chrome з увімкненим інтернетом. Повертаю розпізнавання на пристрої.`, cloudLive: 'слухаю…',
    auto: 'АВТО', tabSit: 'Зведення', tabAn: 'Аналітика 24 год', anAxis: 'повідомлень за годину', slowHint: 'Повільно розпізнає? ☰ → Модель → «Tiny — найшвидша».',
    listen: 'СЛУХАТИ', stop: 'ЗУПИНИТИ', prep: 'ГОТУЮ…', net: 'МЕРЕЖА Є', off: 'АВТОНОМНО', model: 'МОДЕЛЬ', mic: 'МІКРОФОН', micOn: 'СЛУХАЮ',
    modelTitle: 'МОДЕЛЬ РОЗПІЗНАВАННЯ', loadWeb: 'Готую модель. Перший раз вона завантажується з мережі, далі працює без неї.', loadNative: 'Запускаю модель розпізнавання…',
    loading: (a, b) => `Завантаження моделі: ${a} з ${b} МБ`, loadFail: (m) => `Модель не завантажилась: ${m}. Перевірте мережу й натисніть «Слухати» ще раз.`, workerFail: 'Не вдалося запустити розпізнавання: ',
    sumNow: 'АКТУАЛЬНЕ ЗВЕДЕННЯ · ЗАРАЗ', sumAlert: 'ПОПЕРЕДЖЕННЯ · НАРОСТАННЯ ЗАГРОЗИ', silent: 'Ефір мовчить', hintLive: 'Слухаю. Повідомлення з’являться тут.', hint: 'Натисніть «Слухати» — і повідомлення з’являться тут.',
    noCrit: 'Критичних подій немає', lastCrit: 'остання критична подія за 10 хв', in10: (n) => `За 10 хв: ${n} ${pl(n, 'повідомлення', 'повідомлення', 'повідомлень')}`,
    mentions: (k, n) => `${k}: ${n} ${pl(n, 'згадка', 'згадки', 'згадок')} за 15 хв`, operator: 'Рішення — за оператором.',
    emptyT: 'Стрічка порожня', emptyD: 'Підключіть радіостанцію кабелем або покладіть пристрій поруч із динаміком. Для перевірки без радіо — ☰ → «Демо-запис».', quietT: 'За цей період тиша', quietD: 'Оберіть довший зріз часу.',
    recog: 'розпізнаю…', text: 'ТЕКСТ', s: 'с', c10: '10 хв', c30: '30 хв', c60: '1 год', c120: '2 год', call: 'Всі',
    copy: 'Копіювати', share: 'Поділитися', copied: 'Скопійовано', copyFail: 'Не вдалося скопіювати — виділіть текст вручну',
    setTitle: 'Тест і налаштування', lTest: 'ТЕСТ БЕЗ РАДІОСТАНЦІЇ', demo: 'Демо-запис', file: 'Аудіофайл…', manualPh: 'Або введіть повідомлення текстом, по одному в рядку', addText: 'Додати текст у стрічку',
    lModel: 'МОДЕЛЬ РОЗПІЗНАВАННЯ', mTiny: 'Tiny — найшвидша, найменша', mBase: 'Base — баланс, ≈ 200 МБ', mSmall: 'Small — точніша, найбільша', mFast: 'Швидка — рекомендовано (UA, EN)', mWhisper: 'Whisper — повільніша, запасна', fastPill: 'ШВИДКА', fastFail: 'Швидка модель не запустилась, працює Whisper. Причина:', autoSlow: 'АВТО та російська працюють на повільнішій моделі. Для швидкості оберіть UA або EN.',
    lLang: 'МОВА ЕФІРУ', spUk: 'Українська', spEn: 'Англійська', spRu: 'Російська (ефір противника)', spAuto: 'Визначати автоматично',
    lCalls: 'ПОЗИВНІ (ЧЕРЕЗ КОМУ)', lKeep: 'ЗБЕРІГАТИ ЗАПИСИ', k24: '24 години', k48: '48 годин', k72: '72 години', lData: 'ДАНІ', export: 'Експорт JSON', wipe: '⚠ СТЕРТИ ВСЕ', wipe2: 'НАТИСНІТЬ ЩЕ РАЗ — СТЕРТИ БЕЗПОВОРОТНО', wiped: 'Журнал і записи стерто',
    aboutWeb: 'Розпізнавання і всі дані — лише на цьому пристрої. Мережа потрібна один раз, щоб завантажити модель.', aboutNative: 'Розпізнавання і всі дані — лише на цьому пристрої. Модель вбудована, мережа не потрібна.',
    newModel: 'Нова модель завантажиться під час наступного запуску розпізнавання', noMic: 'Немає доступу до мікрофона. Дозвольте його в налаштуваннях.', startFail: 'Не вдалося почати: ',
    fPrep: (l) => `${l}: готую модель…`, fNone: (l) => `${l}: мовлення не знайдено`, fRun: (l, n) => `${l}: ${n} ${pl(n, 'фрагмент', 'фрагменти', 'фрагментів')}, розпізнаю…`, fDone: (l, a, r) => `${l}: готово. ${a} с звуку розпізнано за ${r} с`, demoL: 'Демо', fileL: 'Файл', demoFail: 'Демо-запис недоступний: ',
    periods: { 600000: '10 хв', 1800000: '30 хв', 3600000: '1 год', 7200000: '2 год', 0: 'весь журнал' }
  },
  en: {
    lInput: 'AUDIO SOURCE', inAuto: 'Automatic (system default)', modeMic: 'Microphone · noise suppression', modeLine: 'Cable · no processing', inNow: 'Now listening to: ', inIdle: 'The active input is shown after you press Listen.',
    lEngine: 'RECOGNITION', engLocal: 'ON DEVICE', engCloud: 'INTERNET', cloudWarn: 'Internet mode: audio goes to Google servers. Fast, but not for live combat traffic.', cloudPill: 'GOOGLE · ONLINE', cloudNet: (c) => `Internet mode did not start (code: ${c}). It works only in Google Chrome with a network connection. Switching back to on-device recognition.`, cloudLive: 'listening…',
    auto: 'AUTO', tabSit: 'Summary', tabAn: '24 h analytics', anAxis: 'messages per hour', slowHint: 'Slow transcription? ☰ → Model → “Tiny — fastest”.',
    listen: 'LISTEN', stop: 'STOP', prep: 'STARTING…', net: 'ONLINE', off: 'OFFLINE', model: 'MODEL', mic: 'MIC', micOn: 'LISTENING',
    modelTitle: 'SPEECH MODEL', loadWeb: 'Preparing the model. It downloads once, then works without a network.', loadNative: 'Starting the speech model…',
    loading: (a, b) => `Downloading model: ${a} of ${b} MB`, loadFail: (m) => `Model failed to load: ${m}. Check the network and press Listen again.`, workerFail: 'Could not start recognition: ',
    sumNow: 'CURRENT SUMMARY · NOW', sumAlert: 'WARNING · THREAT BUILDING', silent: 'Net is silent', hintLive: 'Listening. Messages will appear here.', hint: 'Press Listen and messages will appear here.',
    noCrit: 'No critical events', lastCrit: 'latest critical event in the last 10 min', in10: (n) => `Last 10 min: ${n} message${n === 1 ? '' : 's'}`,
    mentions: (k, n) => `${k}: ${n} mention${n === 1 ? '' : 's'} in 15 min`, operator: 'The decision is the operator’s.',
    emptyT: 'Feed is empty', emptyD: 'Connect the radio by cable or place the device next to its speaker. To test without a radio: ☰ → Demo recording.', quietT: 'Nothing in this period', quietD: 'Pick a longer time window.',
    recog: 'transcribing…', text: 'TEXT', s: 's', c10: '10 min', c30: '30 min', c60: '1 h', c120: '2 h', call: 'All',
    copy: 'Copy', share: 'Share', copied: 'Copied', copyFail: 'Could not copy — select the text manually',
    setTitle: 'Test & settings', lTest: 'TEST WITHOUT A RADIO', demo: 'Demo recording', file: 'Audio file…', manualPh: 'Or type messages as text, one per line', addText: 'Add text to the feed',
    lModel: 'SPEECH MODEL', mTiny: 'Tiny — fastest, smallest', mBase: 'Base — balanced, ≈ 200 MB', mSmall: 'Small — more accurate, largest', mFast: 'Fast — recommended (UA, EN)', mWhisper: 'Whisper — slower, fallback', fastPill: 'FAST', fastFail: 'Fast model failed to start, using Whisper. Reason:', autoSlow: 'AUTO and Russian use the slower model. Pick UA or EN for speed.',
    lLang: 'RADIO LANGUAGE', spUk: 'Ukrainian', spEn: 'English', spRu: 'Russian (enemy traffic)', spAuto: 'Detect automatically',
    lCalls: 'CALLSIGNS (COMMA-SEPARATED)', lKeep: 'KEEP RECORDS FOR', k24: '24 hours', k48: '48 hours', k72: '72 hours', lData: 'DATA', export: 'Export JSON', wipe: '⚠ ERASE EVERYTHING', wipe2: 'TAP AGAIN — ERASE FOR GOOD', wiped: 'Log and recordings erased',
    aboutWeb: 'Recognition and all data stay on this device. A network is needed once, to download the model.', aboutNative: 'Recognition and all data stay on this device. The model is built in; no network needed.',
    newModel: 'The new model will load the next time recognition starts', noMic: 'No microphone access. Allow it in settings.', startFail: 'Could not start: ',
    fPrep: (l) => `${l}: preparing the model…`, fNone: (l) => `${l}: no speech found`, fRun: (l, n) => `${l}: ${n} segment${n === 1 ? '' : 's'}, transcribing…`, fDone: (l, a, r) => `${l}: done. ${a} s of audio transcribed in ${r} s`, demoL: 'Demo', fileL: 'File', demoFail: 'Demo recording unavailable: ',
    periods: { 600000: '10 min', 1800000: '30 min', 3600000: '1 h', 7200000: '2 h', 0: 'whole log' }
  }
};
const L = () => I[set.ui] || I.uk;
const EN = () => set.ui === 'en';
const catName = (k) => EN() ? CATS[k].en : CATS[k].name;
const thrName = (k) => EN() ? (THREAT_EN[k] || k) : k;
const loc = () => EN() ? 'en-GB' : 'uk-UA';

function applyLang() {
  document.documentElement.lang = EN() ? 'en' : 'uk';
  document.querySelectorAll('[data-i]').forEach(e => { e.textContent = L()[e.dataset.i]; });
  document.querySelectorAll('[data-ip]').forEach(e => { e.placeholder = L()[e.dataset.ip]; });
  $('#bLang').textContent = EN() ? 'UA' : 'EN';
  document.querySelectorAll('#spk .chip').forEach(c => c.classList.toggle('on', c.dataset.l === set.lang));
  $('#engRow').hidden = !SR;
  document.querySelectorAll('#eng .chip').forEach(c => { c.classList.toggle('on', c.dataset.e === engine()); c.classList.toggle('cloud', c.dataset.e === 'cloud'); });
  $('#n1').textContent = EN() ? 'EFIR-AI · ЕФІР-ШІ' : 'ЕФІР-ШІ';
  $('#bGoT').textContent = live ? L().stop : L().listen;
  $('#bWipe').textContent = L().wipe;
  $('#about').textContent = NATIVE ? L().aboutNative : L().aboutWeb;
  pill(); render();
}

const diag = [];          // журнал діагностики: показується в налаштуваннях
function log(s) { const line = `${new Date().toLocaleTimeString('uk-UA', { hour12: false })} ${s}`; diag.push(line); if (diag.length > 60) diag.shift(); console.log('EFIR ' + s); const d = document.querySelector('#diag'); if (d) d.textContent = diag.join('\n'); }
let msgs = [];            // {id,t,text,cat,threats,dur,audio,pending}
let win = 600000;         // активний часовий зріз, мс (0 = всі)
let seq = 0;
const seen = new Set();   // які картки вже показано (щоб анімувати лише нові)

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
const hhmmss = (t) => new Date(t).toLocaleTimeString(loc(), { hour12: false });
const hhmm = (t) => new Date(t).toLocaleTimeString(loc(), { hour12: false, hour: '2-digit', minute: '2-digit' });
const inWin = (m, w = win) => !w || Date.now() - m.t <= w;

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
    $('#sumLbl').textContent = L().sumAlert;
    $('#sumMain').textContent = L().mentions(thrName(k), n);
    $('#sumSub').textContent = al.slice(1).map(([a, b]) => `${thrName(a)} ×${b}`).join(' · ') || L().operator;
  } else {
    const crit = recent.filter(m => m.cat === 'crit').sort((a, b) => b.t - a.t)[0];
    $('#sumLbl').textContent = L().sumNow;
    if (crit) { $('#sumMain').textContent = crit.text; $('#sumSub').textContent = `${hhmm(crit.t)} · ${L().lastCrit}`; }
    else if (recent.length) { el.classList.add('calm'); $('#sumMain').textContent = L().noCrit; $('#sumSub').textContent = L().in10(recent.length); }
    else { el.classList.add('calm'); $('#sumMain').textContent = L().silent; $('#sumSub').textContent = live ? L().hintLive : L().hint; }
  }
  const c = {}; for (const m of recent) c[m.cat] = (c[m.cat] || 0) + 1;
  $('#counts').innerHTML = recent.length ? Object.keys(CATS).map(k => `<span><i style="background:${CATS[k].color}"></i>${catName(k)} ${c[k] || 0}</span>`).join('') : '';
}

function renderFeed() {
  const list = msgs.filter(m => inWin(m)).sort((a, b) => b.t - a.t);
  const feed = $('#feed');
  if (!list.length) { feed.innerHTML = `<div class="empty"><b>${msgs.length ? L().quietT : L().emptyT}</b>${msgs.length ? L().quietD : L().emptyD}</div>`; return; }
  const cs = calls(), now = Date.now();
  feed.innerHTML = list.map(m => {
    const fresh = seen.has(m.id) ? '' : ' new'; seen.add(m.id);
    if (m.pending) return `<div class="msg pending${fresh}"><div class="h"><span>${hhmmss(m.t)}</span><span>${m.dur ? m.dur.toFixed(1) + ' ' + L().s : 'GOOGLE'}</span><span class="c">…</span></div><div class="t">${m.text ? m.text.replace(/[&<>]/g, '') : L().recog}</div></div>`;
    const hot = m.cat === 'crit' && now - m.t < 180000 ? ' hot' : '';   // критичне за останні 3 хв м'яко пульсує
    return `<button class="msg ${m.cat}${hot}${fresh}" data-id="${m.id}"><div class="h"><span>${hhmmss(m.t)}</span>${m.dur ? `<span>▶ ${m.dur.toFixed(1)} ${L().s}</span>` : `<span>${L().text}</span>`}<span class="c">${catName(m.cat)}</span></div><div class="t">${highlight(m.text, cs)}</div></button>`;
  }).join('');
}
const render = () => { renderSum(); renderFeed(); };

let toastT = 0;
function toast(s, ms = 5000) { const t = $('#toast'); t.textContent = s; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }

/* ---------- повідомлення ---------- */
const JUNK = /дякую за перегляд|спасибо за просмотр|субтитр|редактор|коректор|корректор|продовження буде|продолжение следует|підписуйтес|подписывайтес|до зустрічі|до новых встреч|amara\.org|thanks? for watching|subtitles by/i;
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
// Нативний рушій (whisper.cpp) у встановленому застосунку; у браузері — рушій на JavaScript
const CAP = window.Capacitor;
let useNative = NATIVE && !!(CAP && CAP.isPluginAvailable && CAP.isPluginAvailable('Whisper'));
const nat = (m, o) => (CAP.Plugins && CAP.Plugins.Whisper && CAP.Plugins.Whisper[m]) ? CAP.Plugins.Whisper[m](o) : CAP.nativePromise('Whisper', m, o);
const nativeModel = () => set.neng === 'whisper' ? 'whisper' : 'fast';
let natEngine = '';
const natSlow = () => useNative && (nativeModel() === 'whisper' || !/^(uk|en)$/.test(set.lang));
function pcmB64(f) {
  const b = new Uint8Array(f.length * 2), v = new DataView(b.buffer);
  for (let i = 0; i < f.length; i++) v.setInt16(i * 2, Math.max(-1, Math.min(1, f[i])) * 32767, true);
  let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
async function loadNative() {
  modelState = 'loading'; pill();
  $('#load').classList.add('on'); $('#loadTxt').textContent = L().loadNative; $('#loadBar').style.width = '60%';
  try {
    const r = await nat('load', { model: nativeModel(), lang: set.lang });
    natEngine = r.engine || '';
    log(`нативний рушій готовий: ${natEngine}, ${r.ms} мс, потоків ${r.threads}, копій ${r.copies || 1}` + (r.note ? ` · швидкий не запустився: ${r.note}` : ''));
    if (r.note && nativeModel() === 'fast') toast(L().fastFail + ' ' + String(r.note).slice(0, 160), 15000);
    modelState = 'ready'; device = 'native'; pill(); $('#load').classList.remove('on');
  } catch (e) {
    log('нативний рушій не запустився: ' + (e && e.message || e) + ' — перехід на резервний');
    useNative = false; modelState = 'none';
    throw e;
  }
}
const jobs = new Map();

function pill() {
  const p = $('#pModel');
  if (engine() === 'cloud') { p.className = 'pill bad'; p.textContent = L().cloudPill; }
  else p.className = 'pill ' + (modelState === 'ready' ? 'ok' : modelState === 'error' ? 'bad' : modelState === 'loading' ? 'warn' : '');
  if (engine() !== 'cloud') p.textContent = L().model + (modelState === 'ready' ? ` · ${device === 'webgpu' ? 'GPU' : device === 'native' ? (/^moonshine/.test(natEngine) ? L().fastPill : 'WHISPER') : 'CPU'}` : modelState === 'loading' ? ' ↓' : modelState === 'error' ? ' ✕' : ' —');
  const n = $('#pNet'); n.className = 'pill ' + (navigator.onLine ? '' : 'ok'); n.textContent = navigator.onLine ? L().net : L().off;
  const m = $('#pMic'); m.className = 'pill ' + (live ? 'ok' : ''); m.textContent = live ? L().micOn + (inputLabel ? ' · ' + inputLabel.replace(/\s*\(.*?\)\s*/g, ' ').trim().slice(0, 18) : '') : L().mic + ' —';
}

function ensureModel() {
  if (modelState === 'ready') return Promise.resolve();
  if (modelWait) return modelWait;
  if (useNative) { modelWait = loadNative().then(() => { modelWait = null; }, () => { modelWait = null; return ensureModel(); }); return modelWait; }
  modelState = 'loading'; pill();
  $('#load').classList.add('on'); $('#loadTxt').textContent = NATIVE ? L().loadNative : L().loadWeb; $('#loadBar').style.width = '0';
  modelWait = new Promise((res, rej) => {
    if (!worker) {
      worker = new Worker('asr-worker.js', { type: 'module' });
      worker.onerror = (e) => { log('worker: ' + (e.message || 'помилка запуску')); modelState = 'error'; pill(); $('#loadTxt').textContent = L().workerFail + (e.message || '?'); modelWait = null; rej(e); };
    }
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'log') log('модель: ' + m.text);
      else if (m.type === 'progress' && m.total) { const mb = (x) => (x / 1048576).toFixed(0); $('#loadBar').style.width = Math.min(100, 100 * m.loaded / m.total) + '%'; $('#loadTxt').textContent = L().loading(mb(m.loaded), mb(m.total)); }
      else if (m.type === 'ready') { log(`модель готова (${m.device})`); modelState = 'ready'; device = m.device; if (m.device !== 'webgpu' && /base|small/.test(set.model)) setTimeout(() => toast(L().slowHint, 9000), 1500); pill(); $('#load').classList.remove('on'); modelWait = null; res(); }
      else if (m.type === 'result') { const j = jobs.get(m.id); jobs.delete(m.id); if (j) j(m.text, m.ms); }
      else if (m.type === 'error') {
        log(`помилка (${m.stage}): ${m.message}`);
        if (m.stage === 'load') { modelState = 'error'; pill(); $('#loadTxt').textContent = L().loadFail(m.message); modelWait = null; rej(new Error(m.message)); }
        else { const j = jobs.get(m.id); jobs.delete(m.id); if (j) j('', 0); }
      }
    };
    worker.postMessage({ type: 'load', model: set.model, local: NATIVE });
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
      text = (text || '').trim(); if (text) text = text[0].toUpperCase() + text.slice(1);
      msgs = msgs.filter(x => x !== ph);
      const ok = text && !EMPTY.test(text) && !JUNK.test(text);
      const m = ok ? addText(text, t, dur, wav) : null;
      if (m) m.ms = ms; else render();
      res(m);
    });
    if (device === 'native') {
      const t0 = performance.now();
      nat('transcribe', { pcm: pcmB64(audio16k), lang: set.lang, model: nativeModel() }).then(
        (r) => { if (r.engine && r.engine !== natEngine) { natEngine = r.engine; log('рушій: ' + natEngine); pill(); } if (r.rescued) log('підозрілий текст швидкої моделі перевірено Whisper'); const j = jobs.get(ph.id); jobs.delete(ph.id); if (j) j(r.text || '', r.ms || Math.round(performance.now() - t0)); },
        (e) => { log('помилка розпізнавання: ' + (e && e.message || e)); const j = jobs.get(ph.id); jobs.delete(ph.id); if (j) j('', 0); });
      return;
    }
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

/* ---------- інтернет-режим: розпізнавання Google у браузері Chrome ---------- */
const SR = !NATIVE && (window.SpeechRecognition || window.webkitSpeechRecognition);
const engine = () => (SR && set.engine === 'cloud') ? 'cloud' : 'local';
let rec = null, interim = null;
function dropInterim() { if (interim) { msgs = msgs.filter(m => m !== interim); interim = null; } }
function startCloud() {
  rec = new SR();
  rec.lang = ({ uk: 'uk-UA', en: 'en-US', ru: 'ru-RU' })[set.lang] || 'uk-UA';
  rec.continuous = true; rec.interimResults = true;
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i], txt = r[0].transcript.trim();
      if (r.isFinal) { dropInterim(); if (txt) addText(txt.charAt(0).toUpperCase() + txt.slice(1)); else render(); }
      else if (txt) { if (!interim) { interim = { id: 'live' + Date.now(), t: Date.now(), dur: 0, pending: true }; msgs.push(interim); } interim.text = txt; renderFeed(); }
    }
  };
  rec.onspeechstart = () => level(0.06, true);
  rec.onspeechend = () => level(0, false);
  rec.onerror = (e) => {
    log('інтернет-режим: ' + e.error);
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    const fatal = e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'network' || e.error === 'language-not-supported';
    if (fatal) { stop(); if (e.error === 'not-allowed') toast(L().noMic, 9000); else { set.engine = 'local'; saveSet(); applyLang(); toast(L().cloudNet(e.error), 15000); } }
  };
  rec.onend = () => { if (live && rec) { try { rec.start(); } catch (e) { log('інтернет-режим: перезапуск не вдався'); stop(); } } };   // Chrome сам зупиняється після паузи
  rec.start();
  log('інтернет-режим: слухаю, мова ' + rec.lang);
}

/* ---------- мікрофон / лінійний вхід ---------- */
let inputLabel = '';
let live = false, ctx = null, stream = null, node = null, lock = null;
const vuBars = [...document.querySelectorAll('#vu i')];
function level(rms, sp) {
  const v = Math.min(1, Math.sqrt(rms) * 2.2);
  $('#vu').classList.toggle('sp', sp);
  vuBars.forEach((b, i) => { b.style.height = (4 + 20 * Math.max(0, Math.min(1, v * 6 - i * 0.55))) + 'px'; });
}

async function start() {
  const go = $('#bGo'); go.disabled = true; $('#bGoT').textContent = L().prep;
  if (engine() === 'cloud') {
    try { startCloud(); live = true; go.classList.add('live'); $('#bGoT').textContent = L().stop; }
    catch (e) { log('інтернет-режим не стартував: ' + e.message); rec = null; toast(L().startFail + e.message, 8000); $('#bGoT').textContent = L().listen; }
    go.disabled = false; pill(); render(); return;
  }
  try {
    log('запит мікрофона');
    const line = set.mode === 'line';
    const au = { channelCount: 1, echoCancellation: false, noiseSuppression: !line, autoGainControl: !line };
    if (set.input) au.deviceId = { exact: set.input };
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: au }); }
    catch (e) { if (!set.input || e.name === 'NotAllowedError') throw e; log('вибраний вхід недоступний, беру системний'); delete au.deviceId; stream = await navigator.mediaDevices.getUserMedia({ audio: au }); }
    inputLabel = (stream.getAudioTracks()[0] && stream.getAudioTracks()[0].label) || '';
    log('мікрофон дозволено: ' + (stream.getAudioTracks()[0] && stream.getAudioTracks()[0].label || 'без назви'));
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    await Promise.race([ctx.resume(), new Promise(r => setTimeout(r, 1500))]);
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
    log(`слухаю, ${ctx.sampleRate} Гц, стан звуку: ${ctx.state}`);
    live = true; go.classList.add('live'); $('#bGoT').textContent = L().stop;
  } catch (e) {
    log('старт не вдався: ' + (e && (e.name + ': ' + e.message) || e));
    stop();
    toast(e && e.name === 'NotAllowedError' ? L().noMic : L().startFail + (e && e.message || e), 8000);
  }
  go.disabled = false; pill(); render();
}
function stop() {
  if (rec) { const r = rec; rec = null; r.onend = null; try { r.stop(); } catch (e) {} dropInterim(); }
  if (node) { try { node._seg.end(); node._src.disconnect(); node.disconnect(); } catch (e) {} node = null; }
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if (lock) { try { lock.release(); } catch (e) {} lock = null; }
  live = false; $('#bGo').classList.remove('live'); $('#bGoT').textContent = L().listen; level(0, false); pill(); render();
}
$('#bGo').onclick = () => live ? stop() : start();

/* ---------- тест: файл і демо ---------- */
async function runFile(buf, label) {
  try {
    toast(L().fPrep(label), 60000);
    await ensureModel();
    const ac = ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)());
    const ab = await ac.decodeAudioData(buf);
    const ch = ab.getChannelData(0), segs = [];
    const seg = new Segmenter(ab.sampleRate, (a) => segs.push(a));
    for (let i = 0; i < ch.length; i += 4096) seg.push(ch.subarray(i, Math.min(ch.length, i + 4096)));
    seg.end();
    if (!segs.length) return toast(L().fNone(label));
    toast(L().fRun(label, segs.length), 60000);
    const t0 = Date.now() - segs.length * 1000;
    const t1 = performance.now(); let audioSec = 0;
    segs.forEach(a => { audioSec += a.length / 16000; });
    // у застосунку два повідомлення розпізнаються одночасно
    let next = 0;
    const lane = async () => { while (next < segs.length) { const i = next++; await transcribe(segs[i], t0 + i * 1000); } };
    await Promise.all((window.__lanes || (useNative ? 2 : 1)) > 1 ? [lane(), lane()] : [lane()]);
    window.__runSec = +((performance.now() - t1) / 1000).toFixed(1);
    toast(L().fDone(label, audioSec.toFixed(0), ((performance.now() - t1) / 1000).toFixed(1)), 9000);
  } catch (e) { toast(`${label}: ` + (e && e.message || e), 9000); }
}
$('#bDemo').onclick = async () => { closeSheets(); try { const r = await fetch('demo/demo.mp3'); await runFile(await r.arrayBuffer(), L().demoL); } catch (e) { toast(L().demoFail + e.message); } };
$('#bFile').onclick = () => $('#file').click();
$('#file').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) { closeSheets(); await runFile(await f.arrayBuffer(), L().fileL); } };
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
  const c = {}; const th = {};
  for (const m of list) { c[m.cat] = (c[m.cat] || 0) + 1; for (const k of m.threats || []) th[k] = (th[k] || 0) + 1; }
  const span = list.length > 1 ? Math.max(1, (list[list.length - 1].t - list[0].t) / 60000) : 1;
  const rate = list.length / span;
  const lines = (cat, n = 8) => list.filter(m => m.cat === cat).slice(-n).map(m => `  ${hhmm(m.t)}  ${m.text}`).join('\n') || '  —';
  const al = alerts(), CAS = 'Втрати / евакуація';
  const thr = Object.entries(th).filter(([k]) => k !== CAS).map(([k, n]) => `${thrName(k)} ×${n}`).join(', ') || '—';
  const head = `SITREP · ${new Date().toLocaleDateString(loc())} ${hhmm(Date.now())}`;
  const n = list.length;
  if (EN()) return [
    `${head} · period: ${L().periods[win]}`, '',
    `1. NET: ${n} message${n === 1 ? '' : 's'}, traffic ${rate >= 4 ? 'heavy' : rate >= 1.5 ? 'moderate' : 'light'}.`,
    `   Threat ${c.crit || 0} · tactical ${c.tact || 0} · logistics ${c.log || 0} · coords ${c.coord || 0} · noise ${c.noise || 0}`, '',
    '2. CRITICAL EVENTS:', lines('crit'), '',
    '3. THREATS (mentions): ' + thr,
    al.length ? '   ATTENTION: ' + al.map(([k, x]) => `${thrName(k)} — ${x} in 15 min`).join('; ') : null, '',
    `4. OWN UNIT: casualty/evacuation mentions — ${th[CAS] || 0}.`, '   Logistics and needs:', lines('log', 5), '',
    '5. SITUATION / MOVEMENT:', lines('tact', 5), '',
    '6. COORDINATES / LANDMARKS:', lines('coord', 5), '',
    'Generated automatically from a trigger dictionary. Must be verified by the operator.'
  ].filter(x => x !== null).join('\n');
  return [
    `${head} · період: ${L().periods[win]}`, '',
    `1. ЕФІР: ${n} ${pl(n, 'повідомлення', 'повідомлення', 'повідомлень')}, інтенсивність ${rate >= 4 ? 'висока' : rate >= 1.5 ? 'помірна' : 'низька'}.`,
    `   Загроза ${c.crit || 0} · тактика ${c.tact || 0} · логістика ${c.log || 0} · координати ${c.coord || 0} · фон ${c.noise || 0}`, '',
    '2. КРИТИЧНІ ПОДІЇ:', lines('crit'), '',
    '3. ЗАГРОЗИ (кількість згадок): ' + thr,
    al.length ? '   УВАГА: ' + al.map(([k, x]) => `${k} — ${x} за 15 хв`).join('; ') : null, '',
    `4. СВІЙ ПІДРОЗДІЛ: згадок втрат/евакуації — ${th[CAS] || 0}.`, '   Логістика і потреби:', lines('log', 5), '',
    '5. ОБСТАНОВКА / ПЕРЕМІЩЕННЯ:', lines('tact', 5), '',
    '6. КООРДИНАТИ / ОРІЄНТИРИ:', lines('coord', 5), '',
    'Сформовано автоматично за словником тригерів. Потребує перевірки оператором.'
  ].filter(x => x !== null).join('\n');
}
/* ---------- аналітика за 24 години: статистика журналу, без LLM ---------- */
function analytics() {
  const now = Date.now(), DAY = 24 * 3600000, en = EN();
  const list = msgs.filter(m => !m.pending && now - m.t <= DAY).sort((a, b) => a.t - b.t);
  const hours = Array.from({ length: 24 }, () => ({ n: 0, crit: 0 }));
  for (const m of list) { const i = Math.min(23, Math.max(0, 23 - Math.floor((now - m.t) / 3600000))); hours[i].n++; if (m.cat === 'crit') hours[i].crit++; }
  const c = {}; for (const m of list) c[m.cat] = (c[m.cat] || 0) + 1;
  // події загроз: згадки одного типу ближче ніж 2 хв рахуємо як одну подію
  const ev = {};
  for (const m of list) for (const k of m.threats || []) { const a = ev[k] || (ev[k] = []); if (!a.length || m.t - a[a.length - 1] > 120000) a.push(m.t); }
  const keys = Object.keys(ev);
  const trend = keys.map(k => { const last = ev[k].filter(t => now - t <= 3600000).length, before = ev[k].length - last, span = Math.max(1, Math.min(23, (now - ev[k][0]) / 3600000 - 1)); const avg = before / span; return [k, ev[k].length, last, last > avg * 1.5 && last >= 2 ? 1 : last < avg * 0.5 ? -1 : 0]; }).sort((a, b) => b[1] - a[1]);
  // закономірності «після A протягом 15 хв було B»
  const pairs = [];
  for (const a of keys) for (const b of keys) { if (a === b) continue; let hit = 0; const d = []; for (const t of ev[a]) { const nx = ev[b].find(x => x > t && x - t <= 900000); if (nx) { hit++; d.push((nx - t) / 60000); } } if (ev[a].length >= 2 && hit / ev[a].length >= 0.5) { d.sort((x, y) => x - y); pairs.push({ a, b, hit, tot: ev[a].length, med: Math.round(d[Math.floor(d.length / 2)]) }); } }
  pairs.sort((x, y) => y.hit / y.tot - x.hit / x.tot || y.tot - x.tot);
  // можливий розвиток: остання подія + відома закономірність, яка ще не справдилась
  let outlook = null;
  const recent = keys.map(k => [k, ev[k][ev[k].length - 1]]).filter(([, t]) => now - t <= 900000).sort((x, y) => y[1] - x[1]);
  for (const [k, t] of recent) { const p = pairs.find(p => p.a === k && !ev[p.b].some(x => x > t)); if (p) { outlook = { p, t }; break; } }
  const peak = hours.reduce((bi, h, i) => h.n > hours[bi].n ? i : bi, 0);
  const peakT = new Date(now - (23 - peak) * 3600000); const peakS = String(peakT.getHours()).padStart(2, '0') + ':00';
  const cs = calls().map(n => [n, list.filter(m => m.text.toLowerCase().includes(n.toLowerCase())).length]).filter(x => x[1]).sort((a, b) => b[1] - a[1]);
  const logs = list.filter(m => m.cat === 'log').slice(-5).map(m => `  ${hhmm(m.t)}  ${m.text}`).join('\n') || '  —';
  const tr = (v) => en ? (v > 0 ? 'rising' : v < 0 ? 'falling' : 'steady') : (v > 0 ? 'зростає' : v < 0 ? 'спадає' : 'стабільно');
  const L1 = en ? [
    `24 h ANALYTICS · ${new Date().toLocaleDateString(loc())} ${hhmm(now)}`, '',
    `1. VOLUME: ${list.length} messages. Threat ${c.crit || 0} · tactical ${c.tact || 0} · logistics ${c.log || 0} · coords ${c.coord || 0} · noise ${c.noise || 0}.`,
    list.length ? `   Busiest hour: ${peakS} (${hours[peak].n}).` : null, '',
    '2. THREATS (events / last hour / trend):', trend.map(([k, n, l, v]) => `  ${thrName(k)}: ${n} / ${l} / ${tr(v)}`).join('\n') || '  —', '',
    '3. PATTERNS IN THIS LOG:', pairs.slice(0, 5).map(p => `  After ${thrName(p.a)}, ${thrName(p.b)} followed within 15 min in ${p.hit} of ${p.tot} cases (typically ~${p.med} min).`).join('\n') || '  Not enough repeated events to see a pattern.', '',
    '4. POSSIBLE DEVELOPMENT:', outlook ? `  Latest: ${thrName(outlook.p.a)} at ${hhmm(outlook.t)}. In this log it was followed by ${thrName(outlook.p.b)} in ${outlook.p.hit} of ${outlook.p.tot} cases, typically after ~${outlook.p.med} min.` : '  No active pattern right now.', '',
    '5. LOGISTICS (latest requests):', logs, '',
    '6. MOST ACTIVE CALLSIGNS: ' + (cs.slice(0, 5).map(([n, x]) => `${n} ×${x}`).join(', ') || '—'), '',
    'Statistics of this device’s log, not a forecast. The operator decides.'
  ] : [
    `АНАЛІТИКА ЗА 24 ГОД · ${new Date().toLocaleDateString(loc())} ${hhmm(now)}`, '',
    `1. ОБСЯГ: ${list.length} ${pl(list.length, 'повідомлення', 'повідомлення', 'повідомлень')}. Загроза ${c.crit || 0} · тактика ${c.tact || 0} · логістика ${c.log || 0} · координати ${c.coord || 0} · фон ${c.noise || 0}.`,
    list.length ? `   Найактивніша година: ${peakS} (${hours[peak].n}).` : null, '',
    '2. ЗАГРОЗИ (подій / за останню годину / тенденція):', trend.map(([k, n, l, v]) => `  ${k}: ${n} / ${l} / ${tr(v)}`).join('\n') || '  —', '',
    '3. ЗАКОНОМІРНОСТІ ЦЬОГО ЖУРНАЛУ:', pairs.slice(0, 5).map(p => `  Після «${p.a}» протягом 15 хв було «${p.b}»: ${p.hit} з ${p.tot} випадків (зазвичай через ~${p.med} хв).`).join('\n') || '  Замало повторюваних подій, щоб побачити закономірність.', '',
    '4. МОЖЛИВИЙ РОЗВИТОК:', outlook ? `  Останнє: «${outlook.p.a}» о ${hhmm(outlook.t)}. У цьому журналі після цього було «${outlook.p.b}» у ${outlook.p.hit} з ${outlook.p.tot} випадків, зазвичай через ~${outlook.p.med} хв.` : '  Зараз активної закономірності немає.', '',
    '5. ЛОГІСТИКА (останні запити):', logs, '',
    '6. НАЙАКТИВНІШІ ПОЗИВНІ: ' + (cs.slice(0, 5).map(([n, x]) => `${n} ×${x}`).join(', ') || '—'), '',
    'Це статистика журналу цього пристрою, а не прогноз. Рішення — за оператором.'
  ];
  return { hours, text: L1.filter(x => x !== null).join('\n') };
}
const exportJson = () => JSON.stringify({ app: 'Ефір-ШІ / SITREP-AI', exported: new Date().toISOString(), messages: msgs.filter(m => !m.pending).sort((a, b) => a.t - b.t).map(m => ({ time: new Date(m.t).toISOString(), text: m.text, category: m.cat, threats: m.threats, duration_s: m.dur || null })) }, null, 2);
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); }

const closeSheets = () => document.querySelectorAll('.sheet').forEach(s => s.classList.remove('on'));
document.querySelectorAll('.sheet').forEach(s => s.addEventListener('click', (e) => { if (e.target === s || e.target.closest('[data-close]')) closeSheets(); }));
let repTab = 'sit';
function showRep() {
  document.querySelectorAll('#repTabs .chip').forEach(c => c.classList.toggle('on', c.dataset.t === repTab));
  $('#anBox').hidden = repTab !== 'an';
  if (repTab === 'sit') { $('#repTxt').textContent = sitrep(); return; }
  const a = analytics();
  const mx = Math.max(1, ...a.hours.map(h => h.n));
  $('#anBars').innerHTML = a.hours.map(h => `<div><i class="r" style="height:${100 * h.crit / mx}%"></i><i style="height:${100 * (h.n - h.crit) / mx}%"></i></div>`).join('');
  $('#anFrom').textContent = hhmm(Date.now() - 24 * 3600000); $('#anTo').textContent = hhmm(Date.now());
  $('#repTxt').textContent = a.text;
}
$('#repTabs').onclick = (e) => { const b = e.target.closest('.chip'); if (b) { repTab = b.dataset.t; showRep(); } };
$('#bRep').onclick = () => { showRep(); $('#shRep').classList.add('on'); };
$('#bCopy').onclick = async () => { try { await navigator.clipboard.writeText($('#repTxt').textContent); toast(L().copied, 2000); } catch (e) { toast(L().copyFail); } };
$('#bShare').onclick = async () => { const text = $('#repTxt').textContent; if (navigator.share) { try { await navigator.share({ text }); } catch (e) {} } else $('#bCopy').click(); };
$('#bJson').onclick = $('#bExport').onclick = () => download(`sitrep-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`, exportJson(), 'application/json');

/* ---------- налаштування ---------- */
$('#bLang').onclick = () => { set.ui = EN() ? 'uk' : 'en'; saveSet(); applyLang(); };
async function fillInputs() {
  const sel = $('#sInput'); let list = [];
  try { list = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications'); } catch (e) {}
  sel.innerHTML = `<option value="">${L().inAuto}</option>` + list.map((d, i) => `<option value="${d.deviceId}">${(d.label || 'Вхід ' + (i + 1)).replace(/[<>&"]/g, '')}</option>`).join('');
  sel.value = list.some(d => d.deviceId === set.input) ? set.input : '';
  $('#sMode').value = set.mode;
  $('#inNote').textContent = live && inputLabel ? L().inNow + inputLabel : L().inIdle;
}
const restart = () => { if (live) { stop(); start(); } };
function warm() {
  if (!useNative) return;
  if (natSlow() && nativeModel() === 'fast') toast(L().autoSlow, 7000);
  if (modelState !== 'ready') return;
  nat('load', { model: nativeModel(), lang: set.lang }).then((r) => { natEngine = r.engine || natEngine; log(`рушій: ${natEngine}, ${r.ms} мс`); pill(); }, (e) => log('рушій не перемкнувся: ' + (e && e.message || e)));
}
$('#sInput').onchange = (e) => { set.input = e.target.value; saveSet(); restart(); };
$('#sMode').onchange = (e) => { set.mode = e.target.value; saveSet(); restart(); };
if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', () => { log('змінився набір аудіопристроїв'); if ($('#shSet').classList.contains('on')) fillInputs(); });
$('#bSet').onclick = () => { fillInputs(); $('#sModel').value = NATIVE ? nativeModel() : set.model; $('#sLang').value = set.lang; $('#sCalls').value = set.calls; $('#sKeep').value = String(set.keep); wipeArm = false; $('#bWipe').textContent = L().wipe; $('#bWipe').classList.remove('arm'); $('#shSet').classList.add('on'); };
$('#sModel').onchange = (e) => { if (NATIVE) { set.neng = e.target.value; saveSet(); warm(); return; } set.model = e.target.value; saveSet(); modelState = 'none'; modelWait = null; pill(); toast(L().newModel, 5000); };
$('#sLang').onchange = (e) => { set.lang = e.target.value; saveSet(); applyLang(); warm(); };
$('#eng').onclick = (e) => { const b = e.target.closest('.chip'); if (!b || b.dataset.e === set.engine) return; const was = live; if (was) stop(); set.engine = b.dataset.e; saveSet(); applyLang(); if (set.engine === 'cloud') toast(L().cloudWarn, 9000); if (was) start(); };
$('#spk').onclick = (e) => { const b = e.target.closest('.chip'); if (!b || b.dataset.l === set.lang) return; set.lang = b.dataset.l; saveSet(); applyLang(); warm(); };
$('#sCalls').onchange = (e) => { set.calls = e.target.value; saveSet(); render(); };
$('#sKeep').onchange = (e) => { set.keep = +e.target.value; saveSet(); prune(); };
let wipeArm = false;
$('#bWipe').onclick = async () => {
  if (!wipeArm) { wipeArm = true; $('#bWipe').textContent = L().wipe2; $('#bWipe').classList.add('arm'); setTimeout(() => { if (wipeArm) { wipeArm = false; $('#bWipe').textContent = L().wipe; $('#bWipe').classList.remove('arm'); } }, 5000); return; }
  if (live) stop();
  msgs = []; seen.clear(); diag.length = 0; await dbClear(); wipeArm = false; $('#bWipe').classList.remove('arm'); closeSheets(); render(); toast(L().wiped, 3000);
};
$('#chips').onclick = (e) => { const b = e.target.closest('.chip'); if (!b) return; document.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b)); win = +b.dataset.w; renderFeed(); };

function prune() { const lim = Date.now() - set.keep * 3600000; const old = msgs.filter(m => m.t < lim); if (old.length) { old.forEach(m => dbDel(m.id)); msgs = msgs.filter(m => m.t >= lim); render(); } }

/* ---------- запуск ---------- */
(async () => {
  db = await openDB();
  msgs = await dbAll();
  msgs.forEach(m => seen.add(m.id));
  if (NATIVE) $('#sModel').innerHTML = '<option value="fast" data-i="mFast"></option><option value="whisper" data-i="mWhisper"></option>';
  prune(); applyLang();
  setInterval(() => { prune(); if (!player || player.paused) render(); else renderSum(); }, 30000);
  addEventListener('online', pill); addEventListener('offline', pill);
  document.addEventListener('visibilitychange', async () => { if (live && document.visibilityState === 'visible' && !lock) try { lock = await navigator.wakeLock.request('screen'); } catch (e) {} });
  if (!NATIVE && 'serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  log(`запуск · ${NATIVE ? 'застосунок' : 'браузер'} · ${navigator.userAgent.replace(/^.*?(Android [^;)]+).*?(Chrome\/[\d.]+).*$/, '$1 · $2')} · GPU ${'gpu' in navigator ? 'є' : 'немає'} · рушій ${useNative ? 'нативний (Moonshine + whisper.cpp)' : 'JavaScript'}`);
  // самоперевірка для автоматичного тесту збірки
  fetch('autotest.json').then(r => r.ok ? r.json() : null).then(async (cfg) => {
    if (!cfg) return;
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); console.log('EFIR_MIC ok ' + (s.getAudioTracks()[0].label || '')); s.getTracks().forEach(t => t.stop()); } catch (e) { console.log('EFIR_MIC fail ' + e.name + ': ' + e.message); }
    try {
      const buf = await (await fetch('demo/demo.mp3')).arrayBuffer();
      const pass = async (eng) => {
        set.neng = eng; msgs = []; modelState = 'none'; modelWait = null;
        const t0 = performance.now(); await runFile(buf.slice(0), 'autotest');
        const out = msgs.filter(m => !m.pending).sort((a, b) => a.t - b.t).map(m => m.text);
        const done = msgs.filter(m => !m.pending && m.ms);
        const audio = done.reduce((a, m) => a + (m.dur || 0), 0), work = done.reduce((a, m) => a + m.ms, 0) / 1000;
        return { engine: natEngine || device, n: out.length, runSec: window.__runSec, sec: Math.round((performance.now() - t0) / 1000), audioSec: Math.round(audio), workSec: +work.toFixed(1), avgMsPerMsg: done.length ? Math.round(work * 1000 / done.length) : 0, cats: msgs.filter(m => !m.pending).map(m => m.cat).join(','), text: out };
      };
      window.__lanes = 1; const one = await pass('fast'); delete one.text;
      console.log('EFIR_ONE ' + JSON.stringify(one));
      window.__lanes = 2; const fast = await pass('fast');
      console.log('EFIR_RESULT ' + JSON.stringify(fast));
      if (useNative) { const old = await pass('whisper'); console.log('EFIR_OLD ' + JSON.stringify(old)); }
    }
    catch (e) { console.log('EFIR_RESULT fail ' + e.message); }
    console.log('EFIR_DIAG ' + diag.join(' || '));
  }).catch(() => {});
  window.__efir = { Segmenter, addText, engine, sitrep, analytics, msgs: () => msgs, state: () => ({ modelState, device, live }), runFile };
})();
