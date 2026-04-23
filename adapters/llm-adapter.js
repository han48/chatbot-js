// ============================================================
// LLM Adapter — Chạy LLM trực tiếp trên trình duyệt qua WebGPU
// Tham khảo: webml-community/Qwen3.5-WebGPU (HuggingFace Spaces)
// Sử dụng @huggingface/transformers để load model và generate text
// Phụ thuộc: currentLang, _adapterPath
// ============================================================

/**
 * Trạng thái LLM — singleton, load model 1 lần duy nhất.
 */
var _llmProcessor = null;
var _llmModel = null;
var _llmLoading = false;
var _llmReady = false;
var _llmLoadError = null;
var _llmTransformers = null; // Lưu ref module transformers để dùng RawImage
var _llmLastError = null;    // Lỗi cuối cùng từ LLM (để hiển thị cho user debug)
var _llmStoppingCriteria = null; // InterruptableStoppingCriteria để cancel generate
var _llmGenerating = false;  // Đang generate hay không
var _llmThinkingEnabled = false; // Mặc định tắt thinking

/**
 * Callback để thông báo trạng thái loading lên UI.
 * Được set từ app.js qua setLLMStatusCallback().
 * @type {function(string, string)|null}
 *   - action: 'loading_start' | 'loading_progress' | 'loading_done' | 'loading_error'
 *   - message: Mô tả trạng thái
 */
var _llmStatusCallback = null;

/**
 * Đăng ký callback nhận thông báo trạng thái loading.
 * @param {function(string, string)} callback - fn(action, message)
 */
function setLLMStatusCallback(callback) {
    _llmStatusCallback = typeof callback === 'function' ? callback : null;
}

function _notifyStatus(action, message) {
    if (typeof _llmStatusCallback === 'function') {
        try { _llmStatusCallback(action, message); } catch (e) { /* ignore */ }
    }
}

/**
 * Model ID mặc định — Qwen3.5 0.6B (nhỏ nhất, phù hợp chạy trên browser).
 * Có thể thay đổi bằng cách gọi setLLMModelId() trước khi load.
 */
var LLM_MODEL_ID = 'onnx-community/Qwen3.5-0.8B-ONNX-OPT';

/**
 * Max tokens cho mỗi lần generate.
 */
var LLM_MAX_NEW_TOKENS = 256;

/**
 * Thay đổi model ID (phải gọi trước loadLLMModel).
 * @param {string} modelId - HuggingFace model ID
 */
function setLLMModelId(modelId) {
    if (typeof modelId === 'string' && modelId.trim()) {
        LLM_MODEL_ID = modelId.trim();
    }
}

/**
 * Bật/tắt thinking mode.
 * @param {boolean} enabled
 */
function setLLMThinkingEnabled(enabled) {
    _llmThinkingEnabled = !!enabled;
    try { localStorage.setItem('hikari_llm_thinking', _llmThinkingEnabled ? '1' : '0'); } catch (e) {}
}

/**
 * Kiểm tra thinking mode có đang bật không.
 * @returns {boolean}
 */
function isLLMThinkingEnabled() {
    return _llmThinkingEnabled;
}

/**
 * Build prompt string từ history + message hiện tại.
 * History được truyền từ app.js, đã trim sẵn.
 * @param {string} userMessage
 * @param {boolean} hasImage
 * @param {Array<{role: string, content: string}>} [history] - Lịch sử hội thoại đã trim
 * @returns {string}
 */
function _buildPromptWithHistory(userMessage, hasImage, history) {
    var prompt = '';

    // Thêm history nếu có
    if (history && history.length > 0) {
        for (var i = 0; i < history.length; i++) {
            var msg = history[i];
            prompt += '<|im_start|>' + msg.role + '\n' + msg.content + '<|im_end|>\n';
        }
    }

    // Thêm message hiện tại
    prompt += '<|im_start|>user\n';
    if (hasImage) {
        prompt += '<|vision_start|><|image_pad|><|vision_end|>';
    }
    prompt += userMessage + '<|im_end|>\n';

    // Assistant prefix
    prompt += '<|im_start|>assistant\n';
    if (_llmThinkingEnabled) {
        prompt += '<think>\n';
    }

    return prompt;
}

/**
 * Kiểm tra trình duyệt có hỗ trợ WebGPU không.
 * @returns {boolean}
 */
function isWebGPUSupported() {
    return typeof navigator !== 'undefined' && !!navigator.gpu;
}

/**
 * Load model và processor (lazy — chỉ load khi cần lần đầu).
 * Tham khảo cách Qwen3.5-WebGPU load model với dtype q4 và device webgpu.
 * @returns {Promise<boolean>} true nếu load thành công
 */
async function loadLLMModel() {
    if (_llmReady) return true;
    if (_llmLoadError) return false;
    if (_llmLoading) {
        // Đợi nếu đang load
        return new Promise(function (resolve) {
            var check = setInterval(function () {
                if (!_llmLoading) {
                    clearInterval(check);
                    resolve(_llmReady);
                }
            }, 200);
        });
    }

    _llmLoading = true;

    try {
        // Dynamic import — @huggingface/transformers từ CDN
        var transformers;
        if (typeof module !== 'undefined' && module.exports) {
            // Node/test: skip — WebGPU không khả dụng
            _llmLoadError = 'WebGPU not available in Node.js';
            _llmLoading = false;
            return false;
        }

        // Browser: import từ CDN (giống Qwen3.5-WebGPU)
        transformers = await import(
            'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0'
        );
        _llmTransformers = transformers;

        // Khởi tạo stopping criteria để hỗ trợ cancel
        _llmStoppingCriteria = new transformers.InterruptableStoppingCriteria();

        if (!isWebGPUSupported()) {
            _llmLoadError = 'WebGPU not supported';
            _llmLoading = false;
            return false;
        }

        console.log('[LLM Adapter] Loading processor:', LLM_MODEL_ID);
        _notifyStatus('loading_start', 'Loading processor...');
        _llmProcessor = await transformers.AutoProcessor.from_pretrained(LLM_MODEL_ID);

        console.log('[LLM Adapter] Loading model:', LLM_MODEL_ID);
        _notifyStatus('loading_progress', 'Loading model weights...');
        _llmModel = await transformers.Qwen3_5ForConditionalGeneration.from_pretrained(
            LLM_MODEL_ID,
            {
                dtype: {
                    embed_tokens: 'q4',
                    vision_encoder: 'fp16',
                    decoder_model_merged: 'q4'
                },
                device: 'webgpu'
            }
        );

        _llmReady = true;
        _llmLoading = false;
        console.log('[LLM Adapter] Model loaded successfully');
        _notifyStatus('loading_done', 'Model loaded successfully');
        return true;
    } catch (err) {
        console.error('[LLM Adapter] Failed to load model:', err);
        _llmLoadError = err.message || 'Unknown error';
        _llmLoading = false;
        _notifyStatus('loading_error', 'Failed to load model: ' + _llmLoadError);
        return false;
    }
}

/**
 * Helper: dispose past_key_values để giải phóng bộ nhớ GPU.
 */
function _disposePastKeyValues(pastKeyValues) {
    if (!pastKeyValues) return;
    try {
        for (var key of Object.keys(pastKeyValues)) {
            if (pastKeyValues[key] && typeof pastKeyValues[key].dispose === 'function') {
                pastKeyValues[key].dispose();
            }
        }
    } catch (e) { /* ignore */ }
}

/**
 * Generate text từ LLM cho một prompt.
 * Sử dụng TextStreamer để thu thập response token-by-token.
 * @param {string} userMessage - Tin nhắn người dùng
 * @param {function} [onToken] - Callback nhận text tích lũy mỗi khi có token mới: fn(accumulatedText)
 * @param {Array} [history] - Lịch sử hội thoại đã trim
 * @returns {Promise<string|null>} Phản hồi từ LLM hoặc null nếu lỗi
 */
async function llmGenerate(userMessage, onToken, history) {
    if (!_llmReady || !_llmModel || !_llmProcessor || !_llmTransformers) return null;

    _llmGenerating = true;
    try {
        var prompt = _buildPromptWithHistory(userMessage, false, history);

        var inputs = await _llmProcessor(prompt);

        var fullText = '';
        var streamer = new _llmTransformers.TextStreamer(_llmProcessor.tokenizer, {
            skip_prompt: true,
            skip_special_tokens: true,
            callback_function: function (token) {
                fullText += token;
                if (typeof onToken === 'function') {
                    onToken(fullText);
                }
            }
        });

        if (_llmStoppingCriteria) _llmStoppingCriteria.reset();

        var generateOpts = {
            ...inputs,
            max_new_tokens: LLM_MAX_NEW_TOKENS,
            do_sample: true,
            streamer: streamer,
            return_dict_in_generate: true
        };
        if (_llmStoppingCriteria) {
            generateOpts.stopping_criteria = _llmStoppingCriteria;
        }

        var result = await _llmModel.generate(generateOpts);

        _disposePastKeyValues(result.past_key_values);

        var trimmed = fullText.replace(/^\n+/, '').trim();
        _llmGenerating = false;
        return trimmed.length > 0 ? trimmed : null;
    } catch (err) {
        console.error('[LLM Adapter] Generate error:', err);
        _llmLastError = 'Generate error: ' + (err.message || err);
        _llmGenerating = false;
        return null;
    }
}

/**
 * Generate text từ LLM cho một prompt kèm image.
 * Sử dụng TextStreamer để thu thập response token-by-token.
 * @param {string} userMessage - Tin nhắn người dùng
 * @param {string} imageDataURL - Data URL hoặc blob URL của ảnh
 * @param {function} [onToken] - Callback nhận text tích lũy mỗi khi có token mới: fn(accumulatedText)
 * @param {Array} [history] - Lịch sử hội thoại đã trim
 * @returns {Promise<string|null>} Phản hồi từ LLM hoặc null nếu lỗi
 */
async function llmGenerateWithImage(userMessage, imageDataURL, onToken, history) {
    if (!_llmReady || !_llmModel || !_llmProcessor || !_llmTransformers) return null;

    _llmGenerating = true;
    try {
        var rawImage = await _llmTransformers.RawImage.read(imageDataURL);
        var resizedImage = await rawImage.resize(448, 448);

        var prompt = _buildPromptWithHistory(userMessage || '', true, history);

        var inputs = await _llmProcessor(prompt, resizedImage);

        var fullText = '';
        var streamer = new _llmTransformers.TextStreamer(_llmProcessor.tokenizer, {
            skip_prompt: true,
            skip_special_tokens: true,
            callback_function: function (token) {
                fullText += token;
                if (typeof onToken === 'function') {
                    onToken(fullText);
                }
            }
        });

        if (_llmStoppingCriteria) _llmStoppingCriteria.reset();

        var generateOpts = {
            ...inputs,
            max_new_tokens: LLM_MAX_NEW_TOKENS,
            do_sample: true,
            streamer: streamer,
            return_dict_in_generate: true
        };
        if (_llmStoppingCriteria) {
            generateOpts.stopping_criteria = _llmStoppingCriteria;
        }

        var result = await _llmModel.generate(generateOpts);

        _disposePastKeyValues(result.past_key_values);

        var trimmed = fullText.replace(/^\n+/, '').trim();
        _llmGenerating = false;

        return trimmed.length > 0 ? trimmed : null;
    } catch (err) {
        console.error('[LLM Adapter] Generate with image error:', err);
        _llmLastError = 'Generate with image error: ' + (err.message || err);
        _llmGenerating = false;
        return null;
    }
}

/**
 * LLM Adapter — Interface chính, tương thích với hệ thống adapter.
 * Có thể dùng như subroutine hoặc gọi trực tiếp.
 * @param {object} rs - RiveScript instance (có thể null)
 * @param {string[]} args - Mảng từ (input đã split)
 * @param {string} [imageDataURL] - Data URL của ảnh đính kèm (optional)
 * @param {function} [onToken] - Callback stream token realtime: fn(accumulatedText)
 * @param {Array} [history] - Lịch sử hội thoại đã trim từ app.js
 * @returns {Promise<string|null>} Phản hồi từ LLM hoặc null
 */
async function llmAdapter(rs, args, imageDataURL, onToken, history) {
    _adapterPath.push('llm_adapter');
    _llmLastError = null;
    var query = (args || []).join(' ').trim();
    var lang = currentLang || 'vi';

    // Cho phép gửi ảnh mà không cần text (mô tả ảnh)
    if (query.length === 0 && !imageDataURL) {
        if (lang === 'en') return 'Please provide a message.';
        if (lang === 'ja') return 'メッセージを入力してください。';
        return 'Vui lòng nhập tin nhắn.';
    }

    // Nếu chỉ có ảnh mà không có text, thêm prompt mặc định
    if (query.length === 0 && imageDataURL) {
        if (lang === 'en') query = 'Describe this image in detail.';
        else if (lang === 'ja') query = 'この画像を詳しく説明してください。';
        else query = 'Hãy mô tả chi tiết hình ảnh này.';
    }

    // Kiểm tra WebGPU
    if (!isWebGPUSupported()) {
        _llmLastError = 'WebGPU not supported in this browser';
        return null;
    }

    // Load model nếu chưa load
    var loaded = await loadLLMModel();
    if (!loaded) {
        _llmLastError = 'Model load failed: ' + (_llmLoadError || 'unknown');
        return null;
    }

    // Generate — không timeout, chờ LLM chạy hết
    var generateFn = imageDataURL
        ? llmGenerateWithImage(query, imageDataURL, onToken, history)
        : llmGenerate(query, onToken, history);

    var result = await generateFn;

    if (result) return result;

    if (!_llmLastError) {
        _llmLastError = 'Generate returned empty response';
    }
    return null;
}

/**
 * Hủy bỏ quá trình generate đang chạy.
 */
function cancelLLMGeneration() {
    if (_llmStoppingCriteria && _llmGenerating) {
        _llmStoppingCriteria.interrupt();
        console.log('[LLM Adapter] Generation cancelled by user');
    }
}

/**
 * Kiểm tra LLM đang generate hay không.
 * @returns {boolean}
 */
function isLLMGenerating() {
    return _llmGenerating;
}

/**
 * Lấy lỗi cuối cùng từ LLM adapter (để hiển thị debug info).
 * @returns {string|null}
 */
function getLLMLastError() {
    return _llmLastError;
}

/**
 * Kiểm tra LLM đã sẵn sàng chưa.
 * @returns {boolean}
 */
function isLLMReady() {
    return _llmReady;
}

/**
 * Lấy trạng thái LLM.
 * @returns {{ready: boolean, loading: boolean, error: string|null, modelId: string}}
 */
function getLLMStatus() {
    return {
        ready: _llmReady,
        loading: _llmLoading,
        error: _llmLoadError,
        modelId: LLM_MODEL_ID
    };
}

// Node/test: export to globalThis
if (typeof module !== 'undefined' && module.exports) {
    globalThis.llmAdapter = llmAdapter;
    globalThis.loadLLMModel = loadLLMModel;
    globalThis.llmGenerate = llmGenerate;
    globalThis.llmGenerateWithImage = llmGenerateWithImage;
    globalThis.isWebGPUSupported = isWebGPUSupported;
    globalThis.isLLMReady = isLLMReady;
    globalThis.getLLMStatus = getLLMStatus;
    globalThis.getLLMLastError = getLLMLastError;
    globalThis.cancelLLMGeneration = cancelLLMGeneration;
    globalThis.isLLMGenerating = isLLMGenerating;
    globalThis.setLLMModelId = setLLMModelId;
    globalThis.setLLMThinkingEnabled = setLLMThinkingEnabled;
    globalThis.isLLMThinkingEnabled = isLLMThinkingEnabled;
    globalThis.setLLMStatusCallback = setLLMStatusCallback;
    globalThis.LLM_MODEL_ID = LLM_MODEL_ID;
    globalThis.LLM_MAX_NEW_TOKENS = LLM_MAX_NEW_TOKENS;
}
