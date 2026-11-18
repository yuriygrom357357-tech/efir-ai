// Розпізнавання мови у фоновому потоці. Модель завантажується один раз і далі працює з кешу без мережі.
import { pipeline, env } from './vendor/transformers.min.js';

const base = new URL('./vendor/', import.meta.url).href;
const hasGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
const sfx = hasGPU || !/^((?!chrome|android).)*safari/i.test(navigator.userAgent) ? '.asyncify' : '';
env.backends.onnx.wasm.wasmPaths = { mjs: `${base}ort-wasm-simd-threaded${sfx}.mjs`, wasm: `${base}ort-wasm-simd-threaded${sfx}.wasm` };
env.allowLocalModels = false;

let asr = null, device = null;

async function load(model) {
  const files = {};
  const progress_callback = (p) => {
    if (p.status === 'progress' && p.file) {
      files[p.file] = [p.loaded || 0, p.total || 0];
      let l = 0, t = 0; for (const [a, b] of Object.values(files)) { l += a; t += b; }
      postMessage({ type: 'progress', loaded: l, total: t });
    }
  };
  const tryDev = async (dev) => {
    const dtype = dev === 'webgpu' ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8';
    const p = await pipeline('automatic-speech-recognition', model, { device: dev, dtype, progress_callback });
    await p(new Float32Array(16000), { language: 'uk', task: 'transcribe' }); // прогрів
    return p;
  };
  // WebGPU беремо лише тоді, коли пристрій справді віддає графічний адаптер
  let gpuOk = false;
  if (hasGPU) { try { gpuOk = !!(await navigator.gpu.requestAdapter()); } catch (e) { gpuOk = false; } }
  const errs = [];
  for (const dev of gpuOk ? ['webgpu', 'wasm'] : ['wasm']) {
    postMessage({ type: 'log', text: `спроба ${dev}` });
    try { asr = await tryDev(dev); device = dev; break; } catch (e) { errs.push(`${dev}: ${String(e && e.message || e).slice(0, 300)}`); asr = null; }
  }
  if (!asr) throw new Error(errs.join(' | '));
  postMessage({ type: 'ready', device, model });
}

onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'load') {
      asr = null;
      if (m.local) { env.allowLocalModels = true; env.localModelPath = new URL('./models/', import.meta.url).href; }
      try { await load(m.model); }
      catch (e1) { if (!m.local) throw e1; postMessage({ type: 'log', text: 'вбудована модель не запустилась: ' + String(e1 && e1.message || e1).slice(0, 400) }); env.allowLocalModels = false; await load(m.model); }   // вбудованої моделі немає — пробуємо мережу
    }
    else if (m.type === 'run') {
      const t0 = performance.now();
      const opt = { task: 'transcribe', chunk_length_s: 30 };
      if (m.lang && m.lang !== 'auto') opt.language = m.lang;
      const out = await asr(m.audio, opt);
      postMessage({ type: 'result', id: m.id, text: (out.text || '').trim(), ms: Math.round(performance.now() - t0) });
    }
  } catch (err) {
    postMessage({ type: 'error', id: m.id, stage: m.type, message: String(err && err.message || err) });
  }
};
