package ua.efirai.app;

import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.ShortBuffer;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Місток для вебчастини: завантажити вбудовану модель і розпізнати фрагмент звуку. */
@CapacitorPlugin(name = "Whisper")
public class WhisperPlugin extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private long ctx = 0;
    private String loaded = "";

    private int threads() {
        int n = Runtime.getRuntime().availableProcessors();
        return Math.max(2, Math.min(4, n - 2));
    }

    @PluginMethod
    public void load(final PluginCall call) {
        final String model = call.getString("model", "base");
        worker.execute(() -> {
            try {
                long t0 = System.currentTimeMillis();
                if (ctx != 0 && model.equals(loaded)) { ok(call, t0); return; }
                String name = "ggml-" + model + ".bin";
                File out = new File(getContext().getFilesDir(), name);
                long want;
                try (InputStream probe = getContext().getAssets().open("ggml/" + name)) { want = probe.available(); }
                if (!out.exists() || out.length() < 1000000 || (want > 0 && want < Integer.MAX_VALUE - 1 && out.length() != want)) {
                    try (InputStream in = getContext().getAssets().open("ggml/" + name); FileOutputStream os = new FileOutputStream(out)) {
                        byte[] buf = new byte[1 << 16];
                        int r;
                        while ((r = in.read(buf)) > 0) os.write(buf, 0, r);
                    }
                }
                if (ctx != 0) { WhisperBridge.release(ctx); ctx = 0; loaded = ""; }
                ctx = WhisperBridge.init(out.getAbsolutePath());
                if (ctx == 0) { call.reject("whisper init failed for " + name); return; }
                loaded = model;
                ok(call, t0);
            } catch (Throwable e) {
                call.reject("load: " + e);
            }
        });
    }

    private void ok(PluginCall call, long t0) {
        JSObject r = new JSObject();
        r.put("ms", System.currentTimeMillis() - t0);
        r.put("threads", threads());
        r.put("info", WhisperBridge.sysinfo());
        call.resolve(r);
    }

    @PluginMethod
    public void transcribe(final PluginCall call) {
        final String b64 = call.getString("pcm", "");
        final String lang = call.getString("lang", "uk");
        worker.execute(() -> {
            try {
                if (ctx == 0) { call.reject("model not loaded"); return; }
                byte[] raw = Base64.decode(b64, Base64.DEFAULT);
                ShortBuffer sb = ByteBuffer.wrap(raw).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer();
                float[] audio = new float[sb.remaining()];
                for (int i = 0; i < audio.length; i++) audio[i] = sb.get(i) / 32768f;
                long t0 = System.currentTimeMillis();
                String text = WhisperBridge.transcribe(ctx, audio, lang, threads());
                if (text == null) { call.reject("transcribe failed"); return; }
                JSObject r = new JSObject();
                r.put("text", text.trim());
                r.put("ms", System.currentTimeMillis() - t0);
                call.resolve(r);
            } catch (Throwable e) {
                call.reject("transcribe: " + e);
            }
        });
    }
}
