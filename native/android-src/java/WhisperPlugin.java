package ua.efirai.app;

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
import java.util.HashMap;
import java.util.Map;
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
    private long ctx = 0;
    private String loaded = "";
    private final Map<String, OfflineRecognizer> moon = new HashMap<>();
    private boolean moonBroken = false;
    private String moonError = "";

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

    private void ensureWhisper() throws Exception {
        if (ctx != 0) return;
        File out = copyAsset("ggml/ggml-base.bin", "ggml-base.bin");
        ctx = WhisperBridge.init(out.getAbsolutePath());
        if (ctx == 0) throw new Exception("whisper init failed");
        loaded = "base";
    }

    private OfflineRecognizer ensureMoon(String lang) throws Exception {
        OfflineRecognizer r = moon.get(lang);
        if (r != null) return r;
        File enc = copyAsset("moon/" + lang + "/encoder_model.ort", "moon-" + lang + "-encoder.ort");
        File dec = copyAsset("moon/" + lang + "/decoder_model_merged.ort", "moon-" + lang + "-decoder.ort");
        File tok = copyAsset("moon/" + lang + "/tokens.txt", "moon-" + lang + "-tokens.txt");
        OfflineMoonshineModelConfig m = OfflineMoonshineModelConfig.builder()
                .setEncoder(enc.getAbsolutePath()).setMergedDecoder(dec.getAbsolutePath()).build();
        OfflineModelConfig mc = OfflineModelConfig.builder()
                .setMoonshine(m).setTokens(tok.getAbsolutePath()).setNumThreads(threads()).setDebug(false).setProvider("cpu").build();
        OfflineRecognizerConfig cfg = OfflineRecognizerConfig.builder()
                .setOfflineModelConfig(mc).setDecodingMethod("greedy_search").build();
        r = new OfflineRecognizer(cfg);
        moon.put(lang, r);
        return r;
    }

    /** Підготувати рушій; якщо швидкий не запустився — перейти на Whisper і запам'ятати причину. */
    private String ensure(String model, String lang) throws Exception {
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
                r.put("engine", engine);
                r.put("note", moonError);
                call.resolve(r);
            } catch (Throwable e) {
                call.reject("load: " + e);
            }
        });
    }

    @PluginMethod
    public void transcribe(final PluginCall call) {
        final String b64 = call.getString("pcm", "");
        final String lang = call.getString("lang", "uk");
        final String model = call.getString("model", "fast");
        worker.execute(() -> {
            try {
                String engine = ensure(model, lang);
                byte[] raw = Base64.decode(b64, Base64.DEFAULT);
                ShortBuffer sb = ByteBuffer.wrap(raw).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer();
                float[] audio = new float[sb.remaining()];
                for (int i = 0; i < audio.length; i++) audio[i] = sb.get(i) / 32768f;
                long t0 = System.currentTimeMillis();
                String text;
                if (engine.startsWith("moonshine-")) {
                    OfflineRecognizer rec = ensureMoon(lang);
                    OfflineStream st = rec.createStream();
                    try {
                        st.acceptWaveform(audio, 16000);
                        rec.decode(st);
                        text = rec.getResult(st).getText();
                    } finally { st.release(); }
                } else {
                    text = WhisperBridge.transcribe(ctx, audio, lang, threads());
                }
                if (text == null) { call.reject("transcribe failed"); return; }
                JSObject r = new JSObject();
                r.put("engine", engine);
                r.put("text", text.trim());
                r.put("ms", System.currentTimeMillis() - t0);
                call.resolve(r);
            } catch (Throwable e) {
                call.reject("transcribe: " + e);
            }
        });
    }
}
