package ua.efirai.app;

/** Нативний рушій розпізнавання (whisper.cpp). */
public final class WhisperBridge {
    static { System.loadLibrary("efirwhisper"); }
    private WhisperBridge() {}
    public static native long init(String modelPath);
    public static native void release(long ctx);
    public static native String sysinfo();
    public static native String transcribe(long ctx, float[] audio, String lang, int threads);
}
