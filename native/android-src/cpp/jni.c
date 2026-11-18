// JNI-місток між застосунком і whisper.cpp
#include <jni.h>
#include <stdlib.h>
#include <string.h>
#include <android/log.h>
#include "whisper.h"

#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, "EfirWhisper", __VA_ARGS__)

JNIEXPORT jlong JNICALL
Java_ua_efirai_app_WhisperBridge_init(JNIEnv *env, jclass cls, jstring jpath) {
    (void) cls;
    const char *path = (*env)->GetStringUTFChars(env, jpath, NULL);
    struct whisper_context_params cp = whisper_context_default_params();
    cp.use_gpu = false;
    struct whisper_context *ctx = whisper_init_from_file_with_params(path, cp);
    (*env)->ReleaseStringUTFChars(env, jpath, path);
    return (jlong) ctx;
}

JNIEXPORT void JNICALL
Java_ua_efirai_app_WhisperBridge_release(JNIEnv *env, jclass cls, jlong ptr) {
    (void) env; (void) cls;
    if (ptr) whisper_free((struct whisper_context *) ptr);
}

JNIEXPORT jstring JNICALL
Java_ua_efirai_app_WhisperBridge_sysinfo(JNIEnv *env, jclass cls) {
    (void) cls;
    return (*env)->NewStringUTF(env, whisper_print_system_info());
}

// Повертає текст або NULL у разі помилки. Аудіо: 16 кГц, моно, float.
JNIEXPORT jstring JNICALL
Java_ua_efirai_app_WhisperBridge_transcribe(JNIEnv *env, jclass cls, jlong ptr, jfloatArray jaudio, jstring jlang, jint threads) {
    (void) cls;
    struct whisper_context *ctx = (struct whisper_context *) ptr;
    if (!ctx) return NULL;

    const jsize n = (*env)->GetArrayLength(env, jaudio);
    // whisper не приймає фрагменти коротші за ~1 с: доповнюємо тишею до 1,2 с
    const int min_n = 16000 * 12 / 10;
    const int total = n < min_n ? min_n : n;
    float *pcm = (float *) calloc((size_t) total, sizeof(float));
    if (!pcm) return NULL;
    (*env)->GetFloatArrayRegion(env, jaudio, 0, n, pcm);

    const char *lang = (*env)->GetStringUTFChars(env, jlang, NULL);

    struct whisper_full_params p = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    p.print_realtime = false;
    p.print_progress = false;
    p.print_timestamps = false;
    p.print_special = false;
    p.translate = false;
    p.no_context = true;
    p.no_timestamps = true;
    p.single_segment = true;
    p.suppress_nst = true;
    p.n_threads = threads;
    p.greedy.best_of = 1;
    p.language = lang;                       // "auto" вмикає визначення мови
    // Короткі повідомлення: не обробляти всі 30 с контексту. 50 кадрів на секунду + запас.
    int actx = (int) ((double) total / 16000.0 * 50.0) + 128;
    if (actx < 384) actx = 384;
    if (actx < 1500) p.audio_ctx = actx;

    jstring out = NULL;
    if (whisper_full(ctx, p, pcm, total) == 0) {
        const int segs = whisper_full_n_segments(ctx);
        size_t len = 1;
        for (int i = 0; i < segs; i++) len += strlen(whisper_full_get_segment_text(ctx, i));
        char *buf = (char *) calloc(len, 1);
        if (buf) {
            for (int i = 0; i < segs; i++) strcat(buf, whisper_full_get_segment_text(ctx, i));
            out = (*env)->NewStringUTF(env, buf);
            free(buf);
        }
    } else {
        LOGI("whisper_full failed");
    }
    (*env)->ReleaseStringUTFChars(env, jlang, lang);
    free(pcm);
    return out;
}
