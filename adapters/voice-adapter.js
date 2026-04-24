// ============================================================
// Voice Adapter — STT (Whisper ONNX via Transformers.js) + TTS (MMS-TTS via Transformers.js)
// STT: chạy offline trong browser, không cần server
// TTS: MMS-TTS (Xenova) - hỗ trợ en, vi; fallback Web Speech API cho ja
// ============================================================

// TTS Model IDs (Xenova ONNX versions)
var TTS_MODELS = {
    en: 'Xenova/mms-tts-eng',
    vi: 'Xenova/mms-tts-vie',
    ja: null   // Use Web Speech API for Japanese
};

// === Trạng thái nội bộ ===
var _isListening = false;      // Đang thu âm
var _sttSupported = false;     // Browser hỗ trợ STT (MediaRecorder + Transformers.js)
var _ttsSupported = false;     // Browser hỗ trợ TTS
var _mediaRecorder = null;     // MediaRecorder instance
var _audioChunks = [];         // Chunks audio thu được
var _whisperPipeline = null;   // Transformers.js pipeline (lazy load)
var _whisperLoading = false;   // Đang load model
var _ttsPipelines = {};        // Cache pipelines per language
var _ttsModelLoading = {};     // Track loading state per language
var _isSpeaking = false;
var _audioContext = null;

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
        (typeof AudioContext !== 'undefined' || typeof window.webkitAudioContext !== 'undefined')
    );
    return { sttSupported: _sttSupported, ttsSupported: _ttsSupported };
}

// ============================================================
// TTS — Text to Speech (MMS-TTS via Transformers.js + Web Speech API fallback)
// ============================================================

/**
 * Lazy-load TTS pipeline cho ngôn ngữ.
 * @param {string} lang - Language code (en, vi, ja)
 * @param {function} onStatus - Callback(message) để hiển thị trạng thái loading
 * @returns {Promise<object>} Transformers.js pipeline hoặc null nếu fallback
 */
async function _getTTSPipeline(lang, onStatus) {
    var langCode = getLLMLang(lang);
    var modelId = TTS_MODELS[langCode];
    
    // Fallback to Web Speech API cho tiếng Nhật
    if (!modelId) {
        console.log('[TTS] No model for', langCode, '- using Web Speech API fallback');
        return null;
    }
    
    if (_ttsPipelines[langCode]) return _ttsPipelines[langCode];
    if (_ttsModelLoading[langCode]) {
        // Chờ cho đến khi load xong
        return new Promise(function (resolve, reject) {
            var interval = setInterval(function () {
                if (_ttsPipelines[langCode]) {
                    clearInterval(interval);
                    resolve(_ttsPipelines[langCode]);
                } else if (!_ttsModelLoading[langCode]) {
                    clearInterval(interval);
                    reject(new Error('TTS model load failed'));
                }
            }, 200);
        });
    }

    _ttsModelLoading[langCode] = true;
    if (onStatus) onStatus('⏳ Đang tải TTS model lần đầu (~100MB)...');
    console.log('[TTS] Loading model:', modelId);

    try {
        var transformers = await import(
            'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/dist/transformers.min.js'
        );

        var pipeline = await transformers.pipeline(
            'text-to-speech',
            modelId,
            {
                dtype: 'fp32',
                device: 'wasm',
            }
        );

        _ttsPipelines[langCode] = pipeline;
        _ttsModelLoading[langCode] = false;
        if (onStatus) onStatus('✅ TTS model đã sẵn sàng');
        console.log('[TTS] Model loaded successfully');
        return pipeline;
    } catch (err) {
        _ttsModelLoading[langCode] = false;
        console.error('[TTS] Load error:', err);
        throw err;
    }
}

/**
 * Phát âm thanh từ audio data.
 * @param {Float32Array} audioData - Audio samples
 * @param {number} sampleRate - Sample rate (thường 22050 hoặc 24000)
 */
function _playAudio(audioData, sampleRate) {
    if (!_audioContext) {
        _audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    var audioBuffer = _audioContext.createBuffer(1, audioData.length, sampleRate);
    var channelData = audioBuffer.getChannelData(0);
    for (var i = 0; i < audioData.length; i++) {
        channelData[i] = audioData[i];
    }

    var source = _audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(_audioContext.destination);
    source.onended = function () {
        _isSpeaking = false;
    };
    source.start(0);
    _isSpeaking = true;
}

/**
 * Phát âm thanh bằng Web Speech API (fallback cho tiếng Nhật).
 * @param {string} text - Text to speak
 * @param {string} lang - Language code
 */
function _speakWithWebSpeechAPI(text, lang) {
    if (!text || !text.trim()) return;
    
    try {
        window.speechSynthesis.cancel();
        var utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = getLocale(lang);
        window.speechSynthesis.speak(utterance);
        _isSpeaking = true;
    } catch (err) {
        console.error('[TTS] Web Speech API error:', err);
    }
}

function getVoicesForLang(lang) {
    // MMS-TTS hỗ trợ: en, vi
    // Trả về danh sách "voices" (thực tế chỉ là language codes)
    var langCode = getLLMLang(lang);
    var supported = ['en', 'vi'];
    return supported.includes(langCode) ? [{ name: langCode, lang: lang }] : [];
}

function getDefaultVoice(lang) {
    var voices = getVoicesForLang(lang);
    return voices.length > 0 ? voices[0] : null;
}

async function speakText(text, lang, voiceName) {
    if (!_ttsSupported || !text || !text.trim()) return;

    var langCode = getLLMLang(lang);
    
    try {
        // Show TTS status
        if (typeof showTTSStatus === 'function') {
            showTTSStatus('⏳ Đang tải model TTS...');
        }
        
        // Thử dùng TTS model
        var pipeline = await _getTTSPipeline(lang, function (msg) {
            console.log('[TTS]', msg);
            if (typeof showTTSStatus === 'function') {
                showTTSStatus(msg);
            }
        });

        if (pipeline) {
            // TTS - MMS-TTS không cần speaker embeddings
            if (typeof showTTSStatus === 'function') {
                showTTSStatus('⏳ Đang tạo âm thanh...');
            }
            console.log('[TTS] Generating speech for:', text.substring(0, 50));
            
            var result = await pipeline(text);

            // result.audio là Float32Array, result.sampling_rate là sample rate
            if (result && result.audio) {
                if (typeof showTTSStatus === 'function') {
                    showTTSStatus('⏳ Đang phát âm thanh...');
                }
                _playAudio(result.audio, result.sampling_rate || 22050);
                
                // Hide status sau 1 giây
                setTimeout(function () {
                    if (typeof hideTTSStatus === 'function') {
                        hideTTSStatus();
                    }
                }, 1000);
            }
        } else {
            // Fallback to Web Speech API
            if (typeof showTTSStatus === 'function') {
                showTTSStatus('⏳ Đang phát âm thanh...');
            }
            _speakWithWebSpeechAPI(text, lang);
            
            // Hide status sau 1 giây
            setTimeout(function () {
                if (typeof hideTTSStatus === 'function') {
                    hideTTSStatus();
                }
            }, 1000);
        }
    } catch (err) {
        console.error('[TTS] Error:', err);
        if (typeof hideTTSStatus === 'function') {
            hideTTSStatus();
        }
        // Fallback to Web Speech API on error
        _speakWithWebSpeechAPI(text, lang);
    }
}

function stopSpeaking() {
    _isSpeaking = false;
    
    // Stop Web Speech API
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    
    // Stop Web Audio API
    if (_audioContext) {
        try {
            _audioContext.close();
        } catch (e) {}
        _audioContext = null;
    }
}

function isSpeaking() {
    return _isSpeaking || (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking);
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
                var whisperLang = getWhisperLang(lang);

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
