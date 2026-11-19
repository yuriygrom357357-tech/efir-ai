package ua.efirai.app;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.k2fsa.sherpa.onnx.OfflineModelConfig;
import com.k2fsa.sherpa.onnx.OfflineMoonshineModelConfig;
import com.k2fsa.sherpa.onnx.OfflineRecognizer;
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig;
import com.k2fsa.sherpa.onnx.OfflineStream;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.ShortBuffer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Місток для вебчастини: завантажити вбудовану модель і розпізнати фрагмент звуку.
 * Два рушії: швидкий Moonshine (sherpa-onnx) для української та англійської
 * і Whisper (whisper.cpp) для решти мов, автовизначення та як запасний.
 */
@CapacitorPlugin(name = "Whisper")
public class WhisperPlugin extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    /** Два потоки для швидкої моделі: два повідомлення розпізнаються одночасно. */
    private final ExecutorService fast = Executors.newFixedThreadPool(2);
    private final Object wlock = new Object();
    private long ctx = 0;
    private String loaded = "";
    private final Map<String, ArrayBlockingQueue<OfflineRecognizer>> moon = new HashMap<>();
    private boolean moonBroken = false;
    private String moonError = "";

    /** Скільки копій швидкої моделі тримати: дві, якщо ядер вистачає. */
    private int copies() {
        return Runtime.getRuntime().availableProcessors() >= 4 ? 2 : 1;
    }

    private int threads() {
        int n = Runtime.getRuntime().availableProcessors();
        return Math.max(2, Math.min(4, n - 2));
    }

    private File copyAsset(String asset, String name) throws Exception {
        File out = new File(getContext().getFilesDir(), name);
        long want;
        try (InputStream probe = getContext().getAssets().open(asset)) { want = probe.available(); }
        if (!out.exists() || out.length() < 1000 || (want > 0 && want < Integer.MAX_VALUE - 1 && out.length() != want)) {
            File tmp = new File(getContext().getFilesDir(), name + ".part");
            try (InputStream in = getContext().getAssets().open(asset); FileOutputStream os = new FileOutputStream(tmp)) {
                byte[] buf = new byte[1 << 16];
                int r;
                while ((r = in.read(buf)) > 0) os.write(buf, 0, r);
            }
            if (out.exists()) out.delete();
            if (!tmp.renameTo(out)) throw new Exception("cannot store " + name);
        }
        return out;
    }

    private boolean hasMoon(String lang) {
        try (InputStream in = getContext().getAssets().open("moon/" + lang + "/tokens.txt")) { return true; } catch (Exception e) { return false; }
    }

    /** Який рушій обслуговує цю мову за цих налаштувань. */
    private String pick(String model, String lang) {
        if (!"whisper".equals(model) && !moonBroken && ("uk".equals(lang) || "en".equals(lang)) && hasMoon(lang)) return "moonshine-" + lang;
        return "whisper-base";
    }

    private synchronized void ensureWhisper() throws Exception {
        if (ctx != 0) return;
        File out = copyAsset("ggml/ggml-base.bin", "ggml-base.bin");
        ctx = WhisperBridge.init(out.getAbsolutePath());
        if (ctx == 0) throw new Exception("whisper init failed");
        loaded = "base";
    }

    private synchronized ArrayBlockingQueue<OfflineRecognizer> ensureMoon(String lang) throws Exception {
        ArrayBlockingQueue<OfflineRecognizer> q = moon.get(lang);
        if (q != null) return q;
        File enc = copyAsset("moon/" + lang + "/encoder_model.ort", "moon-" + lang + "-encoder.ort");
        File dec = copyAsset("moon/" + lang + "/decoder_model_merged.ort", "moon-" + lang + "-decoder.ort");
        File tok = copyAsset("moon/" + lang + "/tokens.txt", "moon-" + lang + "-tokens.txt");
        OfflineMoonshineModelConfig m = OfflineMoonshineModelConfig.builder()
                .setEncoder(enc.getAbsolutePath()).setMergedDecoder(dec.getAbsolutePath()).build();
        OfflineModelConfig mc = OfflineModelConfig.builder()
                .setMoonshine(m).setTokens(tok.getAbsolutePath()).setNumThreads(copies() > 1 ? 2 : threads()).setDebug(false).setProvider("cpu").build();
        OfflineRecognizerConfig cfg = OfflineRecognizerConfig.builder()
                .setOfflineModelConfig(mc).setDecodingMethod("greedy_search").build();
        q = new ArrayBlockingQueue<>(copies());
        for (int i = 0; i < copies(); i++) q.add(new OfflineRecognizer(cfg));
        moon.put(lang, q);
        return q;
    }

    /** Підготувати рушій; якщо швидкий не запустився — перейти на Whisper і запам'ятати причину. */
    private synchronized String ensure(String model, String lang) throws Exception {
        String e = pick(model, lang);
        if (e.startsWith("moonshine-")) {
            try { ensureMoon(lang); return e; }
            catch (Throwable t) { moonBroken = true; moonError = String.valueOf(t); }
        }
        ensureWhisper();
        return "whisper-base";
    }

    @PluginMethod
    public void load(final PluginCall call) {
        final String model = call.getString("model", "fast");
        final String lang = call.getString("lang", "uk");
        worker.execute(() -> {
            try {
                long t0 = System.currentTimeMillis();
                String engine = ensure(model, lang);
                JSObject r = new JSObject();
                r.put("ms", System.currentTimeMillis() - t0);
                r.put("threads", threads());
                r.put("copies", engine.startsWith("moonshine-") ? copies() : 1);
                r.put("engine", engine);
                r.put("note", moonError);
                call.resolve(r);
            } catch (Throwable e) {
                call.reject("load: " + e);
            }
        });
    }

    /**
     * Обрізати тишу довкола мовлення: 150 мс перед початком і 50 мс після кінця.
     * Moonshine на довгій тиші в кінці фрагмента вигадує зайві слова; заміри на демо-записі це підтвердили.
     */
    static float[] tighten(float[] x) {
        final int fr = 160;
        int n = x.length / fr;
        if (n < 10) return x;
        float[] e = new float[n];
        float max = 0;
        for (int i = 0; i < n; i++) {
            double sum = 0;
            for (int j = i * fr; j < (i + 1) * fr; j++) sum += x[j] * x[j];
            e[i] = (float) Math.sqrt(sum / fr);
            if (e[i] > max) max = e[i];
        }
        float thr = Math.max(0.006f, max * 0.05f);
        int first = -1, last = -1;
        for (int i = 0; i < n; i++) if (e[i] > thr) { if (first < 0) first = i; last = i; }
        if (first < 0) return x;
        int a = first * fr - 150 * 16, b = (last + 1) * fr + 50 * 16;
        float[] y = new float[b - a];
        int from = Math.max(0, a), to = Math.min(x.length, b);
        System.arraycopy(x, from, y, from - a, to - from);
        return y;
    }

    /** Ознаки вигаданого тексту: час на кшталт 12:01:21, забагато слів на секунду, те саме слово чотири рази поспіль. */
    static boolean suspicious(String t, float sec) {
        if (t == null) return true;
        t = t.trim();
        if (t.isEmpty()) return false;
        if (t.matches(".*\\d{1,2}:\\d{2}.*")) return true;
        String[] w = t.toLowerCase().split("\\s+");
        if (w.length > sec * 5 + 4) return true;
        int run = 1;
        for (int i = 1; i < w.length; i++) { run = w[i].equals(w[i - 1]) ? run + 1 : 1; if (run >= 4) return true; }
        return false;
    }

    @PluginMethod
    public void transcribe(final PluginCall call) {
        final String b64 = call.getString("pcm", "");
        final String lang = call.getString("lang", "uk");
        final String model = call.getString("model", "fast");
        // швидка модель працює у двох потоках, Whisper — в одному
        (pick(model, lang).startsWith("moonshine-") ? fast : worker).execute(() -> {
            try {
                String engine = ensure(model, lang);
                byte[] raw = Base64.decode(b64, Base64.DEFAULT);
                ShortBuffer sb = ByteBuffer.wrap(raw).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer();
                float[] audio = new float[sb.remaining()];
                for (int i = 0; i < audio.length; i++) audio[i] = sb.get(i) / 32768f;
                long t0 = System.currentTimeMillis();
                String text;
                boolean rescued = false;
                if (engine.startsWith("moonshine-")) {
                    ArrayBlockingQueue<OfflineRecognizer> q = ensureMoon(lang);
                    OfflineRecognizer rec = q.take();
                    try {
                        OfflineStream st = rec.createStream();
                        try {
                            st.acceptWaveform(tighten(audio), 16000);
                            rec.decode(st);
                            text = rec.getResult(st).getText();
                        } finally { st.release(); }
                    } finally { q.put(rec); }
                    // підозрілий результат перевіряємо повільнішою моделлю
                    if (suspicious(text, audio.length / 16000f)) {
                        try {
                            ensureWhisper();
                            String w;
                            synchronized (wlock) { w = WhisperBridge.transcribe(ctx, audio, lang, threads()); }
                            if (w != null) { text = w; rescued = true; }
                        } catch (Throwable ignore) { }
                    }
                } else {
                    synchronized (wlock) { text = WhisperBridge.transcribe(ctx, audio, lang, threads()); }
                }
                if (text == null) { call.reject("transcribe failed"); return; }
                JSObject r = new JSObject();
                r.put("engine", engine);
                r.put("rescued", rescued);
                r.put("text", text.trim());
                r.put("ms", System.currentTimeMillis() - t0);
                call.resolve(r);
            } catch (Throwable e) {
                call.reject("transcribe: " + e);
            }
        });
    }

    /* ---------- інтернет-режим: системний розпізнавач Android (сервіс Google) ---------- */
    private final Handler ui = new Handler(Looper.getMainLooper());
    private SpeechRecognizer sr;
    private boolean cloudOn = false;
    private String cloudLang = "uk-UA";
    private int softErrors = 0;
    private long lastLevel = 0;

    @PluginMethod
    public void cloudAvailable(PluginCall call) {
        boolean ok = false;
        try { ok = SpeechRecognizer.isRecognitionAvailable(getContext()); } catch (Throwable ignore) { }
        JSObject r = new JSObject();
        r.put("ok", ok);
        call.resolve(r);
    }

    @PluginMethod
    public void cloudStart(final PluginCall call) {
        cloudLang = call.getString("lang", "uk-UA");
        ui.post(() -> {
            try {
                if (!SpeechRecognizer.isRecognitionAvailable(getContext())) { call.reject("no recognition service"); return; }
                cloudOn = true;
                softErrors = 0;
                if (sr == null) {
                    sr = SpeechRecognizer.createSpeechRecognizer(getContext());
                    sr.setRecognitionListener(cloudListener);
                }
                listen();
                call.resolve(new JSObject());
            } catch (Throwable e) {
                cloudOn = false;
                call.reject("cloud: " + e);
            }
        });
    }

    @PluginMethod
    public void cloudStop(final PluginCall call) {
        ui.post(() -> {
            killCloud();
            call.resolve(new JSObject());
        });
    }

    private void killCloud() {
        cloudOn = false;
        ui.removeCallbacks(relisten);
        if (sr != null) {
            try { sr.cancel(); sr.destroy(); } catch (Throwable ignore) { }
            sr = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        ui.post(this::killCloud);
    }

    private final Runnable relisten = () -> { if (cloudOn && sr != null) { try { listen(); } catch (Throwable e) { cloudError(-1, String.valueOf(e)); } } };

    private void listen() {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, cloudLang);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
        sr.startListening(i);
    }

    private void emit(String name, String key, String value) {
        JSObject o = new JSObject();
        o.put(key, value);
        notifyListeners(name, o);
    }

    private void cloudError(int code, String name) {
        killCloud();
        JSObject o = new JSObject();
        o.put("code", code);
        o.put("name", name);
        notifyListeners("cloudError", o);
    }

    private static String first(Bundle b) {
        if (b == null) return "";
        ArrayList<String> l = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return l == null || l.isEmpty() || l.get(0) == null ? "" : l.get(0);
    }

    private final RecognitionListener cloudListener = new RecognitionListener() {
        @Override public void onReadyForSpeech(Bundle params) { emit("cloudReady", "name", "ready"); }
        @Override public void onBeginningOfSpeech() { }
        @Override public void onBufferReceived(byte[] buffer) { }
        @Override public void onEndOfSpeech() { }
        @Override public void onEvent(int eventType, Bundle params) { }

        @Override public void onRmsChanged(float rmsdB) {
            long now = System.currentTimeMillis();
            if (now - lastLevel < 120) return;
            lastLevel = now;
            JSObject o = new JSObject();
            o.put("db", (double) rmsdB);
            notifyListeners("cloudLevel", o);
        }

        @Override public void onPartialResults(Bundle partialResults) {
            String t = first(partialResults);
            if (!t.isEmpty()) emit("cloudPartial", "text", t);
        }

        @Override public void onResults(Bundle results) {
            softErrors = 0;
            emit("cloudFinal", "text", first(results));
            if (cloudOn) ui.postDelayed(relisten, 60);   // сервіс слухає одну фразу — одразу запускаємо наступну
        }

        @Override public void onError(int error) {
            if (!cloudOn) return;
            // тиша або нерозбірливо — просто слухаємо далі
            if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) { ui.postDelayed(relisten, 80); return; }
            // сервіс зайнятий або збій клієнта — кілька спроб із паузою
            if ((error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY || error == SpeechRecognizer.ERROR_CLIENT) && ++softErrors <= 6) {
                try { sr.cancel(); } catch (Throwable ignore) { }
                ui.postDelayed(relisten, 450);
                return;
            }
            String name;
            switch (error) {
                case SpeechRecognizer.ERROR_NETWORK: case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: name = "network"; break;
                case SpeechRecognizer.ERROR_SERVER: name = "server"; break;
                case SpeechRecognizer.ERROR_AUDIO: name = "audio"; break;
                case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: name = "no-permission"; break;
                case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: name = "busy"; break;
                case SpeechRecognizer.ERROR_CLIENT: name = "client"; break;
                case 12: name = "language-not-supported"; break;
                case 13: name = "language-unavailable"; break;
                default: name = "error-" + error;
            }
            cloudError(error, name);
        }
    };
}
