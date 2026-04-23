// ============================================================
// Voice Adapter — STT (Whisper ONNX via Transformers.js) + TTS (Web Speech API)
// STT: chạy offline trong browser, không cần server
// TTS: Web Speech API native
// ============================================================

/**
 * Ánh xạ ngôn ngữ app → locale / Whisper language code.
 */
var SPEECH_LOCALE_MAP = {
    vi: 'vi-VN',
    en: 'en-US',
    ja: 'ja-JP'
};

// Whisper language codes (ISO 639-1)
var WHISPER_LANG_MAP = {
    vi: 'vietnamese',
    en: 'english',
    ja: 'japanese'
};

// === Trạng thái nội bộ ===
var _isListening = false;      // Đang thu âm
var _sttSupported = false;     // Browser hỗ trợ STT (MediaRecorder + Transformers.js)
var _ttsSupported = false;     // Browser hỗ trợ TTS
var _mediaRecorder = null;     // MediaRecorder instance
var _audioChunks = [];         // Chunks audio thu được
var _whisperPipeline = null;   // Transformers.js pipeline (lazy load)
var _whisperLoading = false;   // Đang load model

// Whisper model — nhỏ, đa ngôn ngữ, chạy được trên browser
var WHISPER_MODEL_ID = 'onnx-community/whisper-base';

/**
 * Khởi tạo Voice Adapter — kiểm tra browser support.
 * STT dùng Whisper (cần MediaRecorder + WebAssembly/WebGPU).
 * @returns {{ sttSupported: boolean, ttsSupported: boolean }}
 */
function initVoiceAdapter() {
    _sttSupported = !!(
        typeof window !== 'undefined' &&
        typeof navigator !== 'undefined' &&
        navigator.mediaDevices &&
        typeof MediaRecorder !== 'undefined'
    );
    _ttsSupported = !!(
        typeof window !== 'undefined' &&
        window.speechSynthesis
    );
    return { sttSupported: _sttSupported, ttsSupported: _ttsSupported };
}

// ============================================================
// TTS — Text to Speech (Web Speech API, giữ nguyên)
// ============================================================

function getVoicesForLang(lang) {
    if (!_ttsSupported) return [];
    var locale = SPEECH_LOCALE_MAP[lang] || lang;
    var prefix = locale.split('-')[0].toLowerCase();
    var all = window.speechSynthesis.getVoices();
    var filtered = all.filter(function (v) {
        var vLang = (v.lang || '').toLowerCase();
        return vLang === locale.toLowerCase() || vLang.startsWith(prefix + '-') || vLang.startsWith(prefix + '_');
    });
    filtered.sort(function (a, b) {
        if (a.localService && !b.localService) return -1;
        if (!a.localService && b.localService) return 1;
        return 0;
    });
    return filtered;
}

function getDefaultVoice(lang) {
    var voices = getVoicesForLang(lang);
    return voices.length > 0 ? voices[0] : null;
}

function speakText(text, lang, voiceName) {
    if (!_ttsSupported || !text || !text.trim()) return;
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_LOCALE_MAP[lang] || lang;
    var voices = getVoicesForLang(lang);
    var selectedVoice = null;
    if (voiceName) {
        selectedVoice = voices.find(function (v) { return v.name === voiceName; }) || null;
    }
    if (!selectedVoice) selectedVoice = getDefaultVoice(lang);
    if (selectedVoice) utterance.voice = selectedVoice;
    window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
    if (_ttsSupported) window.speechSynthesis.cancel();
}

function isSpeaking() {
    return _ttsSupported && window.speechSynthesis.speaking;
}

// ============================================================
// STT — Whisper ONNX via Transformers.js
// ============================================================

/**
 * Lazy-load Whisper pipeline lần đầu tiên.
 * Dùng dynamic import() từ CDN — giống llm-adapter.js, không cần script tag trong index.html.
 * @param {function} onStatus - Callback(message) để hiển thị trạng thái loading
 * @returns {Promise<object>} Transformers.js pipeline
 */
async function _getWhisperPipeline(onStatus) {
    if (_whisperPipeline) return _whisperPipeline;
    if (_whisperLoading) {
        // Chờ cho đến khi load xong
        return new Promise(function (resolve, reject) {
            var interval = setInterval(function () {
                if (_whisperPipeline) {
                    clearInterval(interval);
                    resolve(_whisperPipeline);
                } else if (!_whisperLoading) {
                    clearInterval(interval);
                    reject(new Error('Whisper load failed'));
                }
            }, 200);
        });
    }

    _whisperLoading = true;
    if (onStatus) onStatus('⏳ Đang tải Whisper model lần đầu (~150MB)...');
    console.log('[Whisper] Loading model:', WHISPER_MODEL_ID);

    try {
        // Dynamic import từ CDN — giống llm-adapter.js, không cần script tag trong index.html
        var transformers = await import(
            'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/dist/transformers.min.js'
        );

        var pipeline = await transformers.pipeline(
            'automatic-speech-recognition',
            WHISPER_MODEL_ID,
            {
                dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
                device: 'webgpu',
            }
        );

        _whisperPipeline = pipeline;
        _whisperLoading = false;
        if (onStatus) onStatus('✅ Whisper model đã sẵn sàng');
        console.log('[Whisper] Model loaded successfully');
        return _whisperPipeline;
    } catch (err) {
        _whisperLoading = false;
        console.error('[Whisper] Load error:', err);
        throw err;
    }
}

/**
 * Chuyển AudioBuffer → Float32Array (mono, 16kHz) để Whisper xử lý.
 * @param {AudioBuffer} audioBuffer
 * @returns {Float32Array}
 */
function _audioBufferToFloat32(audioBuffer) {
    // Whisper cần 16kHz mono
    var targetSampleRate = 16000;
    var sourceSampleRate = audioBuffer.sampleRate;
    var sourceData = audioBuffer.getChannelData(0); // mono

    if (sourceSampleRate === targetSampleRate) {
        return sourceData;
    }

    // Resample đơn giản bằng linear interpolation
    var ratio = sourceSampleRate / targetSampleRate;
    var outputLength = Math.round(sourceData.length / ratio);
    var output = new Float32Array(outputLength);
    for (var i = 0; i < outputLength; i++) {
        var srcIdx = i * ratio;
        var srcIdxFloor = Math.floor(srcIdx);
        var srcIdxCeil = Math.min(srcIdxFloor + 1, sourceData.length - 1);
        var frac = srcIdx - srcIdxFloor;
        output[i] = sourceData[srcIdxFloor] * (1 - frac) + sourceData[srcIdxCeil] * frac;
    }
    return output;
}

/**
 * Decode audio blob thành Float32Array 16kHz mono.
 * @param {Blob} audioBlob
 * @returns {Promise<Float32Array>}
 */
async function _decodeAudioBlob(audioBlob) {
    var arrayBuffer = await audioBlob.arrayBuffer();
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    try {
        var audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        return _audioBufferToFloat32(audioBuffer);
    } finally {
        audioCtx.close();
    }
}

/**
 * Bắt đầu thu âm bằng MediaRecorder, sau đó transcribe bằng Whisper.
 * @param {string} lang
 * @param {function} onInterim - Callback(text) khi đang thu âm (hiển thị indicator)
 * @param {function} onFinal - Callback(text) khi transcribe xong
 * @param {function} [onError] - Callback(errorMessage) khi lỗi
 */
async function startVoiceInput(lang, onInterim, onFinal, onError) {
    if (!_sttSupported) {
        if (onError) onError('not-supported');
        return;
    }
    if (_isListening) stopVoiceInput();

    try {
        var stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        _audioChunks = [];
        _isListening = true;

        // Hiển thị indicator đang thu âm
        if (onInterim) onInterim('🎤 Đang nghe...');

        // Chọn mime type được hỗ trợ
        var mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/ogg;codecs=opus';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // để browser tự chọn
        }

        var options = mimeType ? { mimeType: mimeType } : {};
        _mediaRecorder = new MediaRecorder(stream, options);

        _mediaRecorder.ondataavailable = function (e) {
            if (e.data && e.data.size > 0) {
                _audioChunks.push(e.data);
            }
        };

        _mediaRecorder.onstop = async function () {
            // Dừng tất cả tracks
            stream.getTracks().forEach(function (t) { t.stop(); });
            _isListening = false;

            if (_audioChunks.length === 0) {
                if (onError) onError('no-speech');
                return;
            }

            var audioBlob = new Blob(_audioChunks, { type: mimeType || 'audio/webm' });
            _audioChunks = [];

            // Hiển thị trạng thái đang xử lý
            if (onInterim) onInterim('⏳ Đang nhận dạng...');

            try {
                var pipeline = await _getWhisperPipeline(function (msg) {
                    if (onInterim) onInterim(msg);
                });

                var audioData = await _decodeAudioBlob(audioBlob);
                var whisperLang = WHISPER_LANG_MAP[lang] || 'vietnamese';

                var result = await pipeline(audioData, {
                    language: whisperLang,
                    task: 'transcribe',
                    chunk_length_s: 30,
                    return_timestamps: false,
                });

                var text = (result && result.text) ? result.text.trim() : '';
                console.log('[Whisper] Transcription:', text);

                if (text) {
                    if (onFinal) onFinal(text);
                } else {
                    if (onError) onError('no-speech');
                }
            } catch (transcribeErr) {
                console.error('[Whisper] Transcription error:', transcribeErr);
                if (onError) onError('transcribe-failed: ' + (transcribeErr.message || transcribeErr));
            }
        };

        // Thu âm, tự dừng sau 10 giây
        _mediaRecorder.start();
        setTimeout(function () {
            if (_mediaRecorder && _mediaRecorder.state === 'recording') {
                _mediaRecorder.stop();
            }
        }, 10000);

    } catch (err) {
        _isListening = false;
        console.error('[STT] Error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            if (onError) onError('not-allowed');
        } else {
            if (onError) onError(err.message || 'unknown');
        }
    }
}

/**
 * Dừng thu âm sớm (user bấm nút lần 2).
 */
function stopVoiceInput() {
    if (_mediaRecorder && _mediaRecorder.state === 'recording') {
        _mediaRecorder.stop(); // sẽ trigger onstop → transcribe
    }
    _isListening = false;
}

/**
 * Kiểm tra đang thu âm.
 * @returns {boolean}
 */
function isVoiceInputActive() {
    return _isListening;
}

// ============================================================
// Alias private — dùng bởi app.js để tránh đệ quy với wrapper cùng tên
// ============================================================
if (typeof window !== 'undefined') {
    window._voiceAdapterStartVoiceInput = startVoiceInput;
    window._voiceAdapterStopVoiceInput = stopVoiceInput;
}

// ============================================================
// Export cho Node/test (stub functions)
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    globalThis.SPEECH_LOCALE_MAP = SPEECH_LOCALE_MAP;
    globalThis.initVoiceAdapter = function () { return { sttSupported: false, ttsSupported: false }; };
    globalThis.getVoicesForLang = function () { return []; };
    globalThis.getDefaultVoice = function () { return null; };
    globalThis.speakText = function () {};
    globalThis.stopSpeaking = function () {};
    globalThis.isSpeaking = function () { return false; };
    globalThis.startVoiceInput = function (lang, onInterim, onFinal, onError) {
        if (onError) onError('not-supported');
    };
    globalThis.stopVoiceInput = function () {};
    globalThis.isVoiceInputActive = function () { return false; };
}
