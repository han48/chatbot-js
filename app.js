// ============================================================
// Hikari Chatbot — app.js
// Khung cơ bản và cấu hình (Task 1.3)
// ============================================================

// === Trạng thái toàn cục ===
let bot = null;                // Instance RiveScript hiện tại
let currentLang = 'vi';        // Ngôn ngữ hiện tại
const USERNAME = 'local-user'; // Username cố định cho RiveScript
var _adapterPath = [];         // Tracking adapter chain cho mỗi lượt phản hồi
var _attachedImage = null;     // Ảnh đính kèm hiện tại: { dataURL: string, name: string, file: File } | null

// === Chat History ===
var _chatHistory = [];           // Mảng {role: 'user'|'assistant', content: string}
var _chatHistoryEnabled = false; // Mặc định không lưu history
var _chatHistoryMaxTurns = 5;    // Giới hạn số turn gửi cho LLM (0 = không giới hạn)
var _skipHistoryOnce = false;    // Flag skip lưu history cho message tiếp theo

// === Hằng số cấu hình ===
const FALLBACK_API_URL = 'https://your-api-server.com/chat'; // URL có thể cấu hình
const FALLBACK_API_TIMEOUT = 5000; // 5 giây
const LLM_MODEL_ID_CONFIG = 'onnx-community/Qwen3.5-0.8B-ONNX-OPT'; // Model ID cho LLM Adapter (WebGPU)

// ============================================================
// Hàm tiện ích
// ============================================================

/**
 * Bảng ánh xạ ký tự tiếng Việt có dấu → không dấu.
 * Dùng để normalize input trước khi gửi cho RiveScript (triggers viết không dấu).
 */
var VIETNAMESE_DIACRITICS_MAP = {
    'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
    'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
    'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
    'đ': 'd',
    'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
    'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
    'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
    'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
    'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
    'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
    'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
    'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
    'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y'
};

/**
 * Loại bỏ dấu tiếng Việt khỏi chuỗi.
 * "Xin chào bạn" → "Xin chao ban"
 * @param {string} str - Chuỗi đầu vào
 * @returns {string} Chuỗi đã bỏ dấu
 */
function removeVietnameseDiacritics(str) {
    if (typeof str !== 'string') return '';
    var result = '';
    for (var i = 0; i < str.length; i++) {
        var ch = str[i];
        var lower = ch.toLowerCase();
        if (VIETNAMESE_DIACRITICS_MAP[lower] !== undefined) {
            // Giữ nguyên case (hoa/thường) của ký tự gốc
            var mapped = VIETNAMESE_DIACRITICS_MAP[lower];
            result += (ch === lower) ? mapped : mapped.toUpperCase();
        } else {
            result += ch;
        }
    }
    return result;
}

/**
 * Danh sách modal particles / filler words theo ngôn ngữ.
 * Các từ này thường xuất hiện cuối câu và không mang nghĩa chính,
 * gây nhiễu khi match trigger RiveScript.
 */
var MODAL_PARTICLES = {
    vi: ['roi', 'vay', 'nhi', 'nhe', 'a', 'nha', 'di', 'the', 'ha', 'hen', 'ne', 'luon', 'chua', 'khong', 'duoc', 'day', 'do', 'ta', 'chu'],
    en: ['please', 'pls', 'right', 'huh', 'eh', 'ok', 'okay', 'well', 'so', 'then', 'anyway'],
    ja: ['ね', 'よ', 'な', 'か', 'さ', 'ぞ', 'わ', 'の', 'けど', 'でしょ']
};

/**
 * Normalize input cho RiveScript:
 * 1. Lowercase
 * 2. Bỏ dấu tiếng Việt (chỉ khi ngôn ngữ = vi)
 * 3. Bỏ dấu câu (punctuation)
 * 4. Bỏ modal particles / filler words cuối câu
 * 5. Trim khoảng trắng thừa
 *
 * @param {string} text - Input người dùng
 * @returns {string} Input đã normalize
 */
function normalizeInput(text) {
    if (typeof text !== 'string') return '';
    var result = text.toLowerCase();

    // Bỏ dấu tiếng Việt
    if (currentLang === 'vi') {
        result = removeVietnameseDiacritics(result);
    }

    // Bỏ dấu câu: ? ! . , ; : " ' ` ~ ( ) [ ] { } \ | @ # $ % ^ &
    // Giữ lại + - * / cho biểu thức toán học
    result = result.replace(/[?!.,;:"""''`~()[\]{}\\|@#$%^&]/g, ' ');

    // Chuẩn hóa khoảng trắng
    result = result.replace(/\s+/g, ' ').trim();

    // Bỏ modal particles ở cuối câu (lặp để xử lý nhiều particle liên tiếp)
    var particles = MODAL_PARTICLES[currentLang] || [];
    if (particles.length > 0) {
        var changed = true;
        while (changed) {
            changed = false;
            for (var i = 0; i < particles.length; i++) {
                var p = particles[i];
                // Chỉ bỏ nếu particle là từ cuối cùng và câu còn ít nhất 1 từ khác
                var suffix = ' ' + p;
                if (result.length > suffix.length && result.slice(-suffix.length) === suffix) {
                    result = result.slice(0, -suffix.length).trim();
                    changed = true;
                    break;
                }
            }
        }
    }

    return result;
}

/**
 * Kiểm tra tin nhắn có hợp lệ (không trống, không chỉ khoảng trắng).
 * @param {string} text - Nội dung tin nhắn
 * @returns {boolean} true nếu hợp lệ
 */
function validateMessage(text) {
    return typeof text === 'string' && text.trim().length > 0;
}

/**
 * Chuyển URLs trong text thành thẻ <a> clickable.
 * Escape HTML trước, rồi replace URL patterns thành links.
 * @param {string} text
 * @returns {string} HTML string
 */
function linkifyText(text) {
    // Escape HTML entities trước
    var escaped = String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    // Replace newlines with <br>
    escaped = escaped.replace(/\n/g, '<br>');
    // Replace URLs with <a> tags
    return escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

/**
 * Cuộn message display xuống cuối.
 */
function scrollToBottom() {
    const display = document.getElementById('message-display');
    if (display) {
        display.scrollTop = display.scrollHeight;
    }
}

// ============================================================
// Send Button State Management
// ============================================================

/**
 * Disable nút gửi và input.
 * @param {string} [placeholder] - Placeholder text cho input khi disabled
 */
function setSendingDisabled(placeholder) {
    var btn = document.getElementById('send-button');
    var input = document.getElementById('message-input');
    if (btn) {
        btn.disabled = true;
        btn.classList.add('disabled');
    }
    if (input && placeholder) {
        input.dataset.prevPlaceholder = input.placeholder;
        input.placeholder = placeholder;
    }
}

/**
 * Enable nút gửi và input.
 */
function setSendingEnabled() {
    var btn = document.getElementById('send-button');
    var input = document.getElementById('message-input');
    if (btn) {
        btn.disabled = false;
        btn.classList.remove('disabled');
    }
    if (input && input.dataset.prevPlaceholder) {
        input.placeholder = input.dataset.prevPlaceholder;
        delete input.dataset.prevPlaceholder;
    }
}

// ============================================================
// LLM Loading Status — Hiển thị trạng thái loading model trên UI
// ============================================================

/** Phần tử hiển thị trạng thái loading LLM hiện tại (nếu có). */
var _llmLoadingStatusEl = null;

/**
 * Hiển thị hoặc cập nhật trạng thái loading LLM trên message display.
 * @param {string} message - Nội dung trạng thái
 */
function showLLMLoadingStatus(message) {
    var display = document.getElementById('message-display');
    if (!display) return;

    if (!_llmLoadingStatusEl) {
        _llmLoadingStatusEl = document.createElement('div');
        _llmLoadingStatusEl.className = 'message bot llm-loading-status';
        display.appendChild(_llmLoadingStatusEl);
    }
    _llmLoadingStatusEl.textContent = '🤖 ' + message;
    scrollToBottom();
}

/**
 * Xóa trạng thái loading LLM khỏi message display.
 */
function hideLLMLoadingStatus() {
    if (_llmLoadingStatusEl && _llmLoadingStatusEl.parentNode) {
        _llmLoadingStatusEl.parentNode.removeChild(_llmLoadingStatusEl);
    }
    _llmLoadingStatusEl = null;
}

/**
 * Callback xử lý thông báo trạng thái từ LLM Adapter.
 * Được đăng ký qua setLLMStatusCallback().
 * @param {string} action - 'loading_start' | 'loading_progress' | 'loading_done' | 'loading_error'
 * @param {string} message - Mô tả trạng thái
 */
function onLLMStatusChange(action, message) {
    if (action === 'loading_start' || action === 'loading_progress') {
        showLLMLoadingStatus(message);
        setSendingDisabled('Đang tải mô hình AI...');
    } else if (action === 'loading_done') {
        hideLLMLoadingStatus();
        showLLMLoadingStatus('✅ ' + message);
        // Tự động ẩn sau 2 giây
        setTimeout(function () {
            hideLLMLoadingStatus();
        }, 2000);
        setSendingEnabled();
    } else if (action === 'loading_error') {
        hideLLMLoadingStatus();
        showLLMLoadingStatus('❌ ' + message);
        setSendingEnabled();
    }
}

// ============================================================
// LLM Cancel Button — Nút hủy generate LLM
// ============================================================

/** Phần tử nút cancel hiện tại (nếu có). */
var _llmCancelEl = null;

/**
 * Hiển thị nút Cancel dưới message display khi LLM đang generate.
 * @returns {HTMLElement|null} Phần tử cancel button
 */
function showLLMCancelButton() {
    var display = document.getElementById('message-display');
    if (!display) return null;

    hideLLMCancelButton();

    _llmCancelEl = document.createElement('div');
    _llmCancelEl.className = 'llm-cancel-container';

    var btn = document.createElement('button');
    btn.className = 'llm-cancel-button';
    btn.textContent = '⏹ Cancel';
    btn.addEventListener('click', function () {
        if (typeof cancelLLMGeneration === 'function') {
            cancelLLMGeneration();
        }
        hideLLMCancelButton();
    });

    _llmCancelEl.appendChild(btn);
    display.appendChild(_llmCancelEl);
    scrollToBottom();
    return _llmCancelEl;
}

/**
 * Ẩn/xóa nút Cancel.
 */
function hideLLMCancelButton() {
    if (_llmCancelEl && _llmCancelEl.parentNode) {
        _llmCancelEl.parentNode.removeChild(_llmCancelEl);
    }
    _llmCancelEl = null;
}

// ============================================================
// LLM Streaming Message — Tạo message bot và cập nhật realtime
// ============================================================

/**
 * Tạo một message bot trống trong message display để stream text vào.
 * Bao gồm thinking block (ẩn mặc định) và response block.
 * @returns {{thinkEl: HTMLElement, textEl: HTMLElement, messageDiv: HTMLElement}}
 */
function createStreamingBotMessage() {
    var display = document.getElementById('message-display');
    if (!display) return null;

    var messageDiv = document.createElement('div');
    messageDiv.className = 'message bot streaming';

    var thinkDiv = null;
    var thinkContent = null;
    var thinkingOn = (typeof isLLMThinkingEnabled === 'function') && isLLMThinkingEnabled();

    // Thinking block — chỉ tạo khi thinking được bật
    if (thinkingOn) {
        thinkDiv = document.createElement('div');
        thinkDiv.className = 'llm-thinking-block hidden';
        var thinkLabel = document.createElement('span');
        thinkLabel.className = 'llm-thinking-label';
        thinkLabel.textContent = '🧠 Thinking...';
        thinkDiv.appendChild(thinkLabel);
        thinkContent = document.createElement('span');
        thinkContent.className = 'llm-thinking-content';
        thinkDiv.appendChild(thinkContent);
        messageDiv.appendChild(thinkDiv);
    }

    // Response block
    var textSpan = document.createElement('span');
    textSpan.className = 'message-text';
    textSpan.textContent = '...';
    messageDiv.appendChild(textSpan);

    display.appendChild(messageDiv);
    scrollToBottom();
    return { thinkEl: thinkContent, textEl: textSpan, messageDiv: messageDiv, thinkDiv: thinkDiv };
}

/**
 * Parse accumulated text thành thinking part và response part.
 * @param {string} text
 * @returns {{thinking: string, response: string, thinkingDone: boolean}}
 */
function _parseThinkingText(text) {
    if (!text) return { thinking: '', response: '', thinkingDone: false };
    var endIdx = text.indexOf('</think>');
    if (endIdx !== -1) {
        return {
            thinking: text.substring(0, endIdx).trim(),
            response: text.substring(endIdx + '</think>'.length).replace(/^\n+/, '').trim(),
            thinkingDone: true
        };
    }
    // Chưa có </think> → toàn bộ là thinking
    return { thinking: text.trim(), response: '', thinkingDone: false };
}

/**
 * Xóa tag <think>...</think> khỏi text (dùng khi thinking bị disable).
 * @param {string} text
 * @returns {string}
 */
function _stripThinkTags(text) {
    if (!text) return '';
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^\n+/, '').trim();
}

/**
 * Tạo callback onToken để cập nhật streaming message element realtime.
 * Tách thinking và response, hiển thị thinking trong block riêng.
 * @param {object} els - { thinkEl, textEl, thinkDiv }
 * @returns {function} Callback fn(accumulatedText)
 */
function createStreamingCallback(els) {
    return function (accumulatedText) {
        if (!els) return;

        // Không có thinking block → strip think tags và stream thẳng vào textEl
        if (!els.thinkDiv) {
            if (els.textEl) {
                els.textEl.textContent = _stripThinkTags(accumulatedText) || '...';
            }
            scrollToBottom();
            return;
        }

        // Có thinking block → parse và tách
        var parsed = _parseThinkingText(accumulatedText);

        if (parsed.thinking && els.thinkEl) {
            els.thinkDiv.classList.remove('hidden');
            els.thinkEl.textContent = parsed.thinking;
        }

        if (els.textEl) {
            if (parsed.thinkingDone) {
                els.textEl.textContent = parsed.response || '...';
            } else {
                els.textEl.textContent = '...';
            }
        }
        scrollToBottom();
    };
}

/**
 * Hoàn tất streaming message — render final text với thinking block, thêm metadata.
 * @param {object} els - { thinkEl, textEl, messageDiv, thinkDiv }
 * @param {string} finalText - Text cuối cùng (có thể chứa <think>...</think>)
 * @param {number} [confidence] - Confidence score
 * @param {string[]} [adapterPath] - Adapter path
 * @param {number} [responseTime] - Response time (ms)
 */
function finalizeStreamingMessage(els, finalText, confidence, adapterPath, responseTime) {
    if (!els || !els.messageDiv) return;
    var messageDiv = els.messageDiv;

    // Lưu bot response vào history
    if (finalText) {
        addChatHistory('assistant', finalText);
    }

    if (els.thinkDiv) {
        // Thinking mode — parse và tách
        var parsed = _parseThinkingText(finalText);

        if (parsed.thinking && els.thinkEl) {
            els.thinkDiv.classList.remove('hidden');
            els.thinkEl.textContent = parsed.thinking;
            var label = els.thinkDiv.querySelector('.llm-thinking-label');
            if (label) label.textContent = '🧠 Thought';
        } else {
            els.thinkDiv.classList.add('hidden');
        }

        if (els.textEl) {
            els.textEl.textContent = parsed.thinkingDone ? parsed.response : finalText.replace(/^\n+/, '').trim();
        }
    } else {
        // Non-thinking mode — strip think tags
        if (els.textEl) {
            els.textEl.textContent = _stripThinkTags(finalText);
        }
    }

    messageDiv.classList.remove('streaming');

    if (typeof confidence === 'number') {
        var confSpan = document.createElement('span');
        confSpan.className = 'confidence ' + getConfidenceClass(confidence);
        confSpan.textContent = 'Confidence: ' + confidence + '%';
        messageDiv.appendChild(confSpan);
    }

    if (adapterPath && adapterPath.length > 0) {
        var pathSpan = document.createElement('span');
        pathSpan.className = 'adapter-path';
        var breadcrumb = adapterPath.map(function (key) {
            return getAdapterDisplayName(key);
        }).join(' › ');
        pathSpan.textContent = breadcrumb;
        messageDiv.appendChild(pathSpan);
    }

    if (typeof responseTime === 'number') {
        var timeSpan = document.createElement('span');
        timeSpan.className = 'response-time';
        timeSpan.textContent = '⏱ ' + responseTime + 'ms';
        messageDiv.appendChild(timeSpan);
    }

    scrollToBottom();

    // TTS: đọc phản hồi sau khi streaming hoàn tất
    var finalReply = els.thinkDiv
        ? (els.textEl ? els.textEl.textContent : '')
        : (els.textEl ? els.textEl.textContent : '');
    if (finalReply) onBotReplyReady(finalReply);
}

/**
 * Xóa streaming message element (khi cần thay bằng fallback message).
 * @param {object} els - { messageDiv } hoặc HTMLElement (backward compat)
 */
function removeStreamingMessage(els) {
    var div = els && els.messageDiv ? els.messageDiv : (els && els.parentNode ? els.parentNode : null);
    if (div && div.parentNode) {
        div.parentNode.removeChild(div);
    }
}

// ============================================================
// File Attachment — Quản lý đính kèm ảnh
// ============================================================

/**
 * Xử lý khi người dùng chọn file ảnh.
 * Đọc file, tạo preview, lưu dataURL.
 * @param {File} file - File ảnh từ input
 */
function handleFileAttachment(file) {
    if (!file || !file.type.startsWith('image/')) return;

    var reader = new FileReader();
    reader.onload = function (e) {
        _attachedImage = { dataURL: e.target.result, name: file.name, file: file };

        var thumb = document.getElementById('attachment-thumb');
        var nameEl = document.getElementById('attachment-name');
        var preview = document.getElementById('attachment-preview');

        if (thumb) thumb.src = e.target.result;
        if (nameEl) nameEl.textContent = file.name;
        if (preview) preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

/**
 * Xóa ảnh đính kèm hiện tại.
 */
function clearAttachment() {
    _attachedImage = null;

    var thumb = document.getElementById('attachment-thumb');
    var nameEl = document.getElementById('attachment-name');
    var preview = document.getElementById('attachment-preview');
    var fileInput = document.getElementById('file-input');

    if (thumb) thumb.src = '';
    if (nameEl) nameEl.textContent = '';
    if (preview) preview.classList.add('hidden');
    if (fileInput) fileInput.value = '';
}

/**
 * Lấy ảnh đính kèm hiện tại (nếu có) và xóa sau khi lấy.
 * @returns {{ dataURL: string, name: string }|null}
 */
function consumeAttachment() {
    var img = _attachedImage;
    if (img) {
        clearAttachment();
    }
    return img;
}

// ============================================================
// Chat History — Lưu lịch sử hội thoại cho tất cả adapter
// ============================================================

/**
 * Lưu một message vào chat history.
 * @param {string} role - 'user' hoặc 'assistant'
 * @param {string} content - Nội dung message
 * @param {File} [file] - File đính kèm (tùy chọn, chỉ dùng cho role='user')
 */
function addChatHistory(role, content, file) {
    if (!content || !content.trim()) return;
    // Strip thinking tags khi lưu assistant response
    var clean = content;
    if (role === 'assistant') {
        var thinkEnd = clean.indexOf('</think>');
        if (thinkEnd !== -1) {
            clean = clean.substring(thinkEnd + '</think>'.length);
        }
        clean = clean.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^\n+/, '').trim();
    }
    if (!clean.trim()) return;
    _chatHistory.push({ role: role, content: clean.trim() });

    // Lưu vào IndexedDB (async, không block), kèm file nếu có
    if (typeof saveChatMessage === 'function') {
        saveChatMessage(role, clean.trim(), currentLang, file || null).catch(function (err) {
            console.error('Lỗi lưu history vào IndexedDB:', err);
        });
    }
}

/**
 * Lấy history đã trim theo maxTurns để gửi cho LLM.
 * Chỉ trả history khi _chatHistoryEnabled = true.
 * @returns {Array<{role: string, content: string}>}
 */
function getChatHistoryForLLM() {
    if (!_chatHistoryEnabled || _chatHistory.length === 0) return [];
    if (_chatHistoryMaxTurns > 0 && _chatHistory.length > _chatHistoryMaxTurns * 2) {
        return _chatHistory.slice(-_chatHistoryMaxTurns * 2);
    }
    return _chatHistory.slice();
}

/**
 * Xóa toàn bộ chat history.
 */
function clearChatHistory() {
    _chatHistory = [];
}

/**
 * Bật/tắt lưu history.
 * @param {boolean} enabled
 */
function setChatHistoryEnabled(enabled) {
    _chatHistoryEnabled = !!enabled;
    if (!_chatHistoryEnabled) {
        _chatHistory = [];
    }
    try { localStorage.setItem('hikari_chat_history_enabled', _chatHistoryEnabled ? '1' : '0'); } catch (e) {}
}

/**
 * @returns {boolean}
 */
function isChatHistoryEnabled() {
    return _chatHistoryEnabled;
}

/**
 * Đặt giới hạn số turn gửi cho LLM. 0 = không giới hạn.
 * @param {number} maxTurns
 */
function setChatHistoryMaxTurns(maxTurns) {
    _chatHistoryMaxTurns = Math.max(0, parseInt(maxTurns, 10) || 0);
    try { localStorage.setItem('hikari_chat_history_max_turns', String(_chatHistoryMaxTurns)); } catch (e) {}
}

/**
 * @returns {number}
 */
function getChatHistoryMaxTurns() {
    return _chatHistoryMaxTurns;
}

/**
 * Thêm tin nhắn vào DOM với class phân biệt user/bot, kèm confidence, adapter path và thời gian xử lý nếu là bot.
 * @param {string} text - Nội dung tin nhắn
 * @param {"user"|"bot"} sender - Người gửi
 * @param {number} [confidence] - Tỉ lệ khớp (chỉ dùng cho bot)
 * @param {string[]} [adapterPath] - Danh sách adapter đã xử lý (chỉ dùng cho bot)
 * @param {number} [responseTime] - Thời gian xử lý (ms, chỉ dùng cho bot)
 * @param {string} [imageDataURL] - Data URL ảnh đính kèm (chỉ dùng cho user)
 * @param {boolean} [skipHistory] - Nếu true, không lưu vào chat history (dùng khi load từ history)
 */
function appendMessage(text, sender, confidence, adapterPath, responseTime, imageDataURL, skipHistory) {
    const display = document.getElementById('message-display');
    if (!display) return;

    // Lưu bot response vào history (trừ khi đang skip hoặc skipHistory = true)
    if (sender === 'bot' && text && !_skipHistoryOnce && !skipHistory) {
        addChatHistory('assistant', text);
    }
    _skipHistoryOnce = false;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + sender;

    // Hiển thị ảnh đính kèm (nếu có)
    if (imageDataURL) {
        var imgEl = document.createElement('img');
        imgEl.className = 'message-image';
        imgEl.src = imageDataURL;
        imgEl.alt = 'Attached image';
        messageDiv.appendChild(imgEl);
    }

    const textSpan = document.createElement('span');
    textSpan.className = 'message-text';
    // Render URLs as clickable links for bot messages
    if (sender === 'bot' && text.indexOf('http') !== -1) {
        textSpan.innerHTML = linkifyText(text);
    } else {
        textSpan.textContent = text;
    }
    messageDiv.appendChild(textSpan);

    if (sender === 'bot' && typeof confidence === 'number') {
        const confSpan = document.createElement('span');
        confSpan.className = 'confidence ' + getConfidenceClass(confidence);
        confSpan.textContent = 'Confidence: ' + confidence + '%';
        messageDiv.appendChild(confSpan);
    }

    if (sender === 'bot' && adapterPath && adapterPath.length > 0) {
        const pathSpan = document.createElement('span');
        pathSpan.className = 'adapter-path';
        var breadcrumb = adapterPath.map(function (key) {
            return getAdapterDisplayName(key);
        }).join(' › ');
        pathSpan.textContent = breadcrumb;
        messageDiv.appendChild(pathSpan);
    }

    if (sender === 'bot' && typeof responseTime === 'number') {
        const timeSpan = document.createElement('span');
        timeSpan.className = 'response-time';
        timeSpan.textContent = '⏱ ' + responseTime + 'ms';
        messageDiv.appendChild(timeSpan);
    }

    display.appendChild(messageDiv);
    scrollToBottom();

    // TTS: đọc phản hồi bot nếu voice output đang bật
    if (sender === 'bot' && text) {
        onBotReplyReady(text);
    }
}

/**
 * Hiển thị thông báo lỗi trong chat.
 * @param {string} message - Nội dung lỗi
 */
function showError(message) {
    appendMessage(message, 'bot');
}

/**
 * Tính tỉ lệ khớp (confidence) dựa trên trigger đã match.
 * - Trigger chính xác (không chứa wildcard) → 100
 * - Trigger mặc định `*` → 0
 * - Trigger chứa wildcard một phần → giá trị trung gian
 * @param {string} matchedTrigger - Trigger đã khớp từ lastMatch()
 * @returns {number} Confidence 0–100
 */
function calculateConfidence(matchedTrigger) {
    if (typeof matchedTrigger !== 'string' || matchedTrigger.trim() === '') {
        return 0;
    }

    const trigger = matchedTrigger.trim();

    // Trigger mặc định wildcard `*` → confidence = 0
    if (trigger === '*') {
        return 0;
    }

    // Kiểm tra trigger có chứa wildcard không
    const wildcardPatterns = ['*', '#', '_'];
    const hasWildcard = wildcardPatterns.some(function (w) {
        return trigger.includes(w);
    });

    if (!hasWildcard) {
        // Trigger chính xác (không wildcard) → confidence = 100
        return 100;
    }

    // Trigger chứa wildcard một phần → tính giá trị trung gian
    // Dựa trên tỉ lệ phần không phải wildcard so với tổng chiều dài
    const parts = trigger.split(/[\s]+/);
    var nonWildcardParts = 0;
    for (var i = 0; i < parts.length; i++) {
        if (parts[i] !== '*' && parts[i] !== '#' && parts[i] !== '_') {
            nonWildcardParts++;
        }
    }
    var ratio = nonWildcardParts / parts.length;
    // Ánh xạ ratio vào khoảng [1, 99] để tránh trùng với 0 và 100
    return Math.max(1, Math.min(99, Math.round(ratio * 100)));
}

/**
 * Trả về CSS class cho màu sắc confidence.
 * @param {number} confidence - Tỉ lệ khớp (0–100)
 * @returns {string} "confidence-high" nếu ≥50, "confidence-low" nếu <50
 */
function getConfidenceClass(confidence) {
    return confidence >= 50 ? 'confidence-high' : 'confidence-low';
}

// ============================================================
// Brain Data — Dữ liệu hội thoại RiveScript cho 3 ngôn ngữ
// Được load từ file .rive riêng biệt trong thư mục brain/
// Xem: brain/vi.rive, brain/en.rive, brain/ja.rive
// Trong trình duyệt: BRAIN_DATA được load bởi brain.js (qua fetch)
// Trong Node/test: BRAIN_DATA được load bởi fs.readFileSync
// ============================================================

// Node/test: khai báo các biến dữ liệu ngoài (browser đã có từ brain.js & data-loader.js)
// Sử dụng IIFE để tránh var hoisting ghi đè biến global trong browser
(function () {
    if (typeof module === 'undefined' || !module.exports) return;
    var _fs = require('fs');
    var _path = require('path');
    globalThis.BRAIN_DATA = {
        vi: _fs.readFileSync(_path.join(__dirname, 'brain', 'vi.rive'), 'utf8'),
        en: _fs.readFileSync(_path.join(__dirname, 'brain', 'en.rive'), 'utf8'),
        ja: _fs.readFileSync(_path.join(__dirname, 'brain', 'ja.rive'), 'utf8')
    };
    globalThis.SPECIFIC_RESPONSES = JSON.parse(_fs.readFileSync(_path.join(__dirname, 'data', 'specific-responses.json'), 'utf8'));
    globalThis.QA_DATASET = JSON.parse(_fs.readFileSync(_path.join(__dirname, 'data', 'qa-dataset.json'), 'utf8'));
    globalThis.ADAPTER_REGISTRY = JSON.parse(_fs.readFileSync(_path.join(__dirname, 'data', 'adapter-registry.json'), 'utf8'));
    globalThis.HELP_CONTENT = JSON.parse(_fs.readFileSync(_path.join(__dirname, 'data', 'help-content.json'), 'utf8'));
})();

// ============================================================
// Lời chào mặc định cho mỗi ngôn ngữ (trigger gửi đến bot)
// ============================================================
const GREETING_TRIGGERS = {
    vi: 'xin chao',
    en: 'hello',
    ja: 'こんにちは'
};

// ============================================================
// Khởi tạo RiveScript Engine
// ============================================================

/**
 * Khởi tạo RiveScript engine với brain data của ngôn ngữ chỉ định.
 * Tạo instance mới, stream brain data, sort replies, đăng ký adapter.
 * @param {string} lang - Mã ngôn ngữ ("vi", "en", "ja")
 * @returns {Promise<void>}
 */
async function initBot(lang) {
    // Kiểm tra CDN RiveScript đã tải chưa
    if (typeof RiveScript === 'undefined') {
        showError('Chatbot hiện không khả dụng. Vui lòng kiểm tra kết nối mạng và tải lại trang.');
        return;
    }

    try {
        bot = new RiveScript({ utf8: true });
        bot.stream(BRAIN_DATA[lang]);
        bot.sortReplies();

        // Đăng ký adapter nếu hàm registerAdapters đã được định nghĩa (sẽ thêm ở task sau)
        if (typeof registerAdapters === 'function') {
            registerAdapters(bot, lang);
        }

        // Cấu hình LLM Model ID từ app.js
        if (typeof setLLMModelId === 'function') {
            setLLMModelId(LLM_MODEL_ID_CONFIG);
        }

        // Đăng ký callback nhận trạng thái loading LLM
        if (typeof setLLMStatusCallback === 'function') {
            setLLMStatusCallback(onLLMStatusChange);
        }
    } catch (err) {
        console.error('Lỗi khởi tạo RiveScript:', err);
        showError('Không thể khởi tạo chatbot. Vui lòng tải lại trang.');
        bot = null;
    }
}

/**
 * Đổi ngôn ngữ: tạo lại bot, xóa chat, hiển thị lời chào mới,
 * cập nhật rules list và macros list.
 * @param {string} lang - Mã ngôn ngữ ("vi", "en", "ja")
 * @returns {Promise<void>}
 */
async function changeLanguage(lang) {
    currentLang = lang;
    
    // Notify language selector
    if (typeof onLanguageChange === 'function') {
        onLanguageChange(lang);
    }
    
    await initBot(lang);

    // Xóa lịch sử hội thoại
    clearChatHistory();
    var display = document.getElementById('message-display');
    if (display) {
        display.innerHTML = '';
    }

    // Hiển thị lời chào mới bằng ngôn ngữ được chọn
    if (bot) {
        try {
            var greeting = await bot.reply(USERNAME, GREETING_TRIGGERS[lang] || 'hello');
            _skipHistoryOnce = true;
            appendMessage(greeting, 'bot');
        } catch (err) {
            console.error('Lỗi lấy lời chào:', err);
            showError('Không thể hiển thị lời chào.');
        }
    }

    // Cập nhật rules list nếu hàm đã được định nghĩa (sẽ thêm ở task sau)
    if (typeof updateRulesList === 'function') {
        updateRulesList(lang);
    }

    // Cập nhật macros list nếu hàm đã được định nghĩa (sẽ thêm ở task sau)
    if (typeof updateMacrosList === 'function') {
        updateMacrosList(lang);
    }

    // Cập nhật voice selector theo ngôn ngữ mới
    updateVoiceSelector(lang);
}

// ============================================================
// Gửi tin nhắn và xử lý phản hồi
// ============================================================

/**
 * Hiển thị chỉ báo đang tải (loading indicator) trong message display.
 * @returns {HTMLElement} Phần tử loading indicator đã thêm vào DOM
 */
function showLoadingIndicator() {
    var display = document.getElementById('message-display');
    if (!display) return null;

    var loadingDiv = document.createElement('div');
    loadingDiv.className = 'message bot loading-indicator';
    loadingDiv.textContent = '...';
    display.appendChild(loadingDiv);
    scrollToBottom();
    return loadingDiv;
}

/**
 * Ẩn/xóa chỉ báo đang tải.
 * @param {HTMLElement} element - Phần tử loading indicator cần xóa
 */
function hideLoadingIndicator(element) {
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
    }
}

/**
 * Gửi HTTP POST đến Fallback API với timeout 5s.
 * Sử dụng AbortController để hủy request khi vượt quá thời gian chờ.
 * @param {string} userMessage - Tin nhắn người dùng
 * @returns {Promise<string|null>} Phản hồi từ API hoặc null nếu lỗi/timeout
 */
async function callFallbackAPI(userMessage) {
    var controller = new AbortController();
    var timeoutId = setTimeout(function () {
        controller.abort();
    }, FALLBACK_API_TIMEOUT);

    try {
        var response = await fetch(FALLBACK_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMessage }),
            signal: controller.signal
        });

        var data = await response.json();
        return data.answer || data.reply || data.response || null;
    } catch (err) {
        // Timeout (AbortError) hoặc lỗi mạng → trả về null
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Parse Adapter Prefix Command: /[key] [content]
 * Trả về {adapterKey, content} nếu hợp lệ, null nếu không.
 * Key hợp lệ: có trong ADAPTER_REGISTRY, active:true, không phải voice-adapter.
 * @param {string} input
 * @returns {{adapterKey: string, content: string}|null}
 */
function parseAdapterPrefixCommand(input) {
    if (!input || input.charAt(0) !== '/') return null;
    var match = input.match(/^\/([a-z_]+)\s+(.+)$/);
    if (!match) return null;
    var key = match[1];
    var content = match[2].trim();
    if (!content) return null;
    // Kiểm tra key trong ADAPTER_REGISTRY
    if (typeof ADAPTER_REGISTRY === 'undefined' || !ADAPTER_REGISTRY[key]) return null;
    // Bỏ qua voice-adapter
    if (key === 'voice-adapter' || key === 'voice_adapter') return null;
    // Bỏ qua adapter disabled
    if (ADAPTER_REGISTRY[key].active === false) return null;
    return { adapterKey: key, content: content };
}

/**
 * Hiển thị badge adapter prefix phía trên input.
 * @param {string} adapterKey
 */
function showAdapterPrefixBadge(adapterKey) {
    var badge = document.getElementById('adapter-prefix-badge');
    if (!badge) return;
    var name = (typeof getAdapterDisplayName === 'function') ? getAdapterDisplayName(adapterKey) : adapterKey;
    badge.textContent = '🔧 ' + name;
    badge.classList.remove('hidden');
}

/**
 * Ẩn badge adapter prefix.
 */
function hideAdapterPrefixBadge() {
    var badge = document.getElementById('adapter-prefix-badge');
    if (badge) badge.classList.add('hidden');
}

/**
 * Detect nếu input là web search command.
 * Trả về query string nếu match, null nếu không.
 * @param {string} text - Input người dùng (raw)
 * @returns {string|null} Query string hoặc null
 */
function extractWebSearchQuery(text) {
    var lower = text.toLowerCase().trim();
    // Normalize tiếng Việt để match "tra cứu" → "tra cuu"
    var norm = (typeof normalizeInput === 'function') ? normalizeInput(text).toLowerCase().trim() : lower;

    var prefixes = [
        'google ', 'tra cuu ', 'tra cứu ',
        'search ', 'web search ',
        'ウェブ検索 ', 'グーグル ',
        'tìm trên web ', 'tìm trên mạng ', 'tim tren web ', 'tim tren mang '
    ];

    for (var i = 0; i < prefixes.length; i++) {
        if (lower.indexOf(prefixes[i]) === 0) {
            return text.substring(prefixes[i].length).trim();
        }
        if (norm.indexOf(prefixes[i]) === 0) {
            return text.substring(prefixes[i].length).trim();
        }
    }
    return null;
}

/**
 * Tạo message fallback cuối cùng khi tất cả adapter đều thất bại.
 * Kèm thông tin lỗi LLM (nếu có) để hỗ trợ debug.
 * @returns {string}
 */
function getFinalFallbackMessage() {
    var lang = currentLang || 'vi';
    var base;
    if (lang === 'en') base = 'Sorry, I couldn\'t find an answer for your question. Please try rephrasing or ask something else.';
    else if (lang === 'ja') base = '申し訳ありませんが、ご質問に対する回答が見つかりませんでした。別の言い方で試してみてください。';
    else base = 'Xin lỗi, mình không tìm được câu trả lời cho câu hỏi của bạn. Bạn thử hỏi cách khác nhé!';

    // Kèm thông tin lỗi LLM nếu có
    var llmError = (typeof getLLMLastError === 'function') ? getLLMLastError() : null;
    if (llmError) {
        base += '\n⚠️ LLM: ' + llmError;
    }

    return base;
}

/**
 * Lấy phản hồi từ bot cho một input, trả về reply + confidence + adapterPath.
 * @param {string} inputText - Input gửi cho bot
 * @returns {Promise<{reply: string, confidence: number, adapterPath: string[]}>}
 */
async function getBotReply(inputText) {
    _adapterPath = [];
    var reply = await bot.reply(USERNAME, inputText);
    var matchedTrigger = await bot.lastMatch(USERNAME);
    var confidence = calculateConfidence(matchedTrigger);
    var adapterPath = _adapterPath.length > 0 ? _adapterPath.slice() : ['rivescript'];
    return { reply: reply, confidence: confidence, adapterPath: adapterPath };
}

/**
 * Lấy tin nhắn từ input, gửi đến bot, tính confidence, xử lý fallback, hiển thị kết quả.
 *
 * Chiến lược dual-reply (chỉ áp dụng cho tiếng Việt):
 * - Gửi cả input gốc (có dấu) VÀ input đã bỏ dấu cho bot
 * - So sánh confidence của 2 kết quả, chọn kết quả có confidence cao hơn
 * - Nếu bằng nhau, ưu tiên kết quả từ input gốc (có dấu)
 *
 * @returns {Promise<void>}
 */
async function sendMessage() {
    var input = document.getElementById('message-input');
    if (!input) return;

    var text = input.value;
    var attachment = consumeAttachment();

    // Kiểm tra tin nhắn hợp lệ (cho phép gửi ảnh mà không cần text)
    if (!validateMessage(text) && !attachment) {
        return;
    }

    // Hiển thị tin nhắn người dùng (kèm ảnh nếu có)
    appendMessage(text || '', 'user', undefined, undefined, undefined, attachment ? attachment.dataURL : undefined);

    // Lưu user message vào history (nếu có ảnh mà không có text, ghi chú [image])
    var historyText = (text && text.trim()) ? text : (attachment ? '[image: ' + attachment.name + ']' : '');
    addChatHistory('user', historyText, attachment ? attachment.file : null);

    // Xóa input
    input.value = '';

    // Ẩn badge adapter prefix sau khi gửi
    hideAdapterPrefixBadge();

    // Kiểm tra bot đã khởi tạo chưa
    if (!bot) {
        showError('Chatbot chưa sẵn sàng. Vui lòng tải lại trang.');
        return;
    }

    // Disable nút gửi trong khi đang xử lý
    setSendingDisabled();

    var loadingEl = null;

    try {
        var startTime = Date.now();

        // Adapter Prefix Command: /[key] [content] — gọi trực tiếp adapter được chỉ định
        var prefixCmd = parseAdapterPrefixCommand(text);
        if (prefixCmd && !attachment) {
            var adapterKey = prefixCmd.adapterKey;
            var content = prefixCmd.content;

            // Kiểm tra content không rỗng
            if (!content || !content.trim()) {
                var lang = currentLang || 'vi';
                var emptyMsg = lang === 'en' ? 'Please provide content after the adapter prefix.'
                    : lang === 'ja' ? 'アダプタープレフィックスの後にコンテンツを入力してください。'
                    : 'Vui lòng nhập nội dung sau prefix adapter.';
                showError(emptyMsg);
                return;
            }

            // Gọi adapter trực tiếp
            _adapterPath = [];
            var adapterResult = null;
            var adapterError = null;

            try {
                // Gọi adapter tương ứng với key
                if (adapterKey === 'best_match' && typeof bestMatchAdapter === 'function') {
                    var bmRes = bestMatchAdapter(bot, content.split(/\s+/));
                    adapterResult = (bmRes && bmRes.answer) ? bmRes.answer : null;
                } else if (adapterKey === 'mathematical_evaluation' && typeof mathematicalEvaluationAdapter === 'function') {
                    adapterResult = mathematicalEvaluationAdapter(bot, content.split(/\s+/));
                } else if (adapterKey === 'specific_response' && typeof specificResponseAdapter === 'function') {
                    adapterResult = specificResponseAdapter(bot, content.split(/\s+/));
                } else if (adapterKey === 'time_adapter' && typeof timeAdapter === 'function') {
                    adapterResult = timeAdapter(bot, content.split(/\s+/));
                } else if (adapterKey === 'unit_conversion' && typeof unitConversionAdapter === 'function') {
                    adapterResult = unitConversionAdapter(bot, content.split(/\s+/));
                } else if (adapterKey === 'web_search' && typeof webSearchAdapter === 'function') {
                    loadingEl = showLoadingIndicator();
                    adapterResult = await webSearchAdapter(bot, content.split(/\s+/));
                    hideLoadingIndicator(loadingEl);
                    loadingEl = null;
                } else if (adapterKey === 'llm_adapter' && typeof llmAdapter === 'function') {
                    var streamEl = createStreamingBotMessage();
                    var streamCb = createStreamingCallback(streamEl);
                    showLLMCancelButton();
                    adapterResult = await llmAdapter(bot, content.split(/\s+/), null, streamCb, getChatHistoryForLLM());
                    hideLLMCancelButton();
                    var elapsed = Date.now() - startTime;
                    var llmPath = _adapterPath.length > 0 ? _adapterPath.slice() : ['llm_adapter'];
                    // Thêm "📌" prefix vào tên adapter đầu tiên trong breadcrumb
                    if (llmPath.length > 0) llmPath[0] = '📌' + llmPath[0];
                    if (isValidAdapterResult(adapterResult)) {
                        finalizeStreamingMessage(streamEl, adapterResult, null, llmPath, elapsed);
                    } else {
                        removeStreamingMessage(streamEl);
                        appendMessage(getFinalFallbackMessage(), 'bot', null, llmPath, elapsed);
                    }
                    return;
                } else if (adapterKey === 'logic_adapter' && typeof logicAdapterDispatcher === 'function') {
                    adapterResult = logicAdapterDispatcher(bot, content.split(/\s+/));
                } else {
                    adapterError = 'Adapter không được hỗ trợ: ' + adapterKey;
                }
            } catch (adapterErr) {
                console.error('Lỗi gọi adapter:', adapterErr);
                adapterError = 'Lỗi khi gọi adapter: ' + (adapterErr.message || adapterErr);
            }

            var elapsed = Date.now() - startTime;
            var adapterPath = _adapterPath.length > 0 ? _adapterPath.slice() : [adapterKey];
            // Thêm "📌" prefix vào tên adapter đầu tiên trong breadcrumb
            if (adapterPath.length > 0) adapterPath[0] = '📌' + adapterPath[0];

            if (adapterError) {
                showError(adapterError);
            } else if (isValidAdapterResult(adapterResult)) {
                appendMessage(adapterResult, 'bot', null, adapterPath, elapsed);
            } else {
                appendMessage(getFinalFallbackMessage(), 'bot', null, adapterPath, elapsed);
            }
            return;
        }

        // Nếu có ảnh đính kèm → gửi thẳng qua LLM Adapter (RiveScript không xử lý ảnh)
        if (attachment) {
            var streamEl = createStreamingBotMessage();
            var streamCb = createStreamingCallback(streamEl);
            showLLMCancelButton();
            try {
                _adapterPath = [];
                var imgResult = null;
                if (typeof llmAdapter === 'function') {
                    imgResult = await llmAdapter(null, (text || '').split(/\s+/), attachment.dataURL, streamCb, getChatHistoryForLLM());
                }
                hideLLMCancelButton();
                var elapsedImg = Date.now() - startTime;
                var imgPath = _adapterPath.length > 0 ? _adapterPath.slice() : ['llm_adapter'];

                if (isValidAdapterResult(imgResult)) {
                    finalizeStreamingMessage(streamEl, imgResult, null, imgPath, elapsedImg);
                } else {
                    removeStreamingMessage(streamEl);
                    appendMessage(getFinalFallbackMessage(), 'bot', null, imgPath, elapsedImg);
                }
            } catch (imgErr) {
                hideLLMCancelButton();
                removeStreamingMessage(streamEl);
                console.error('Lỗi xử lý ảnh:', imgErr);
                var imgErrMsg = 'Không thể xử lý ảnh.';
                var llmErr = (typeof getLLMLastError === 'function') ? getLLMLastError() : null;
                if (llmErr) imgErrMsg += '\n⚠️ LLM: ' + llmErr;
                else if (imgErr && imgErr.message) imgErrMsg += '\n⚠️ ' + imgErr.message;
                showError(imgErrMsg);
            }
            return;
        }

        // Web Search: detect "google ...", "tra cuu ...", "search ...", "web search ..." trước khi gửi cho RiveScript
        // Xử lý trực tiếp vì web search là async và RiveScript subroutine không hỗ trợ Promise
        var webSearchQuery = extractWebSearchQuery(text);
        if (webSearchQuery && typeof webSearchAdapter === 'function') {
            loadingEl = showLoadingIndicator();
            try {
                _adapterPath = [];
                var searchResult = await webSearchAdapter(null, webSearchQuery.split(/\s+/));
                hideLoadingIndicator(loadingEl);
                loadingEl = null;
                var elapsed = Date.now() - startTime;
                var searchPath = _adapterPath.length > 0 ? _adapterPath.slice() : ['web_search'];
                appendMessage(searchResult, 'bot', null, searchPath, elapsed);
            } catch (searchErr) {
                hideLoadingIndicator(loadingEl);
                loadingEl = null;
                console.error('Lỗi tìm kiếm web:', searchErr);
                showError('Tìm kiếm thất bại. Vui lòng thử lại.');
            }
            return;
        }

        var best;
        var normalizedText = normalizeInput(text);
        var isDifferent = normalizedText !== text;

        if (currentLang === 'vi' && isDifferent) {
            var rawResult = await getBotReply(text);
            var normResult = await getBotReply(normalizedText);
            best = (normResult.confidence > rawResult.confidence) ? normResult : rawResult;
        } else {
            best = await getBotReply(text);
        }

        var reply = best.reply;
        var confidence = best.confidence;
        var adapterPath = best.adapterPath;

        if (confidence >= 50) {
            var elapsed = Date.now() - startTime;
            appendMessage(reply, 'bot', confidence, adapterPath, elapsed);
        } else {
            // Thử best match adapter
            var localFallback = null;
            var localPath = [];
            var localConfidence = confidence;
            try {
                _adapterPath = [];
                var bmResult = bestMatchAdapter(bot, text.toLowerCase().split(/\s+/));
                localPath = _adapterPath.slice();

                if (currentLang === 'vi') {
                    _adapterPath = [];
                    var normBmResult = bestMatchAdapter(bot, normalizeInput(text).toLowerCase().split(/\s+/));
                    var normPath = _adapterPath.slice();
                    if (normBmResult && isValidAdapterResult(normBmResult.answer)
                        && (!bmResult || !isValidAdapterResult(bmResult.answer) || normBmResult.score > bmResult.score)) {
                        bmResult = normBmResult;
                        localPath = normPath;
                    }
                }

                if (bmResult && isValidAdapterResult(bmResult.answer)) {
                    localFallback = bmResult.answer;
                    localConfidence = Math.round(bmResult.score * 100);
                }
            } catch (matchErr) {
                console.error('Lỗi best match adapter:', matchErr);
                localFallback = null;
            }

            if (localFallback) {
                var elapsed2 = Date.now() - startTime;
                appendMessage(localFallback, 'bot', localConfidence, localPath, elapsed2);
            } else {
                // Thử Fallback API → LLM Adapter
                loadingEl = showLoadingIndicator();

                try {
                    var apiResult = await callFallbackAPI(text);

                    if (apiResult) {
                        hideLoadingIndicator(loadingEl);
                        loadingEl = null;
                        var elapsed3 = Date.now() - startTime;
                        var apiPath = adapterPath.concat(['fallback_api']);
                        appendMessage(apiResult, 'bot', confidence, apiPath, elapsed3);
                    } else {
                        // Fallback API trả null → thử LLM Adapter (WebGPU)
                        hideLoadingIndicator(loadingEl);
                        loadingEl = null;
                        var streamEl2 = createStreamingBotMessage();
                        var streamCb2 = createStreamingCallback(streamEl2);
                        showLLMCancelButton();
                        var llmResult = null;
                        if (typeof llmAdapter === 'function') {
                            try {
                                llmResult = await llmAdapter(null, text.split(/\s+/), null, streamCb2, getChatHistoryForLLM());
                            } catch (llmErr) {
                                console.error('Lỗi LLM adapter:', llmErr);
                                llmResult = null;
                            }
                        }
                        hideLLMCancelButton();
                        var elapsed3b = Date.now() - startTime;

                        if (isValidAdapterResult(llmResult)) {
                            var llmPath = adapterPath.concat(['llm_adapter']);
                            finalizeStreamingMessage(streamEl2, llmResult, confidence, llmPath, elapsed3b);
                        } else {
                            removeStreamingMessage(streamEl2);
                            appendMessage(getFinalFallbackMessage(), 'bot', confidence, adapterPath, elapsed3b);
                        }
                    }
                } catch (apiErr) {
                    // callFallbackAPI ném exception → thử LLM Adapter (WebGPU)
                    console.error('Lỗi fallback API:', apiErr);
                    hideLoadingIndicator(loadingEl);
                    loadingEl = null;
                    var streamEl3 = createStreamingBotMessage();
                    var streamCb3 = createStreamingCallback(streamEl3);
                    showLLMCancelButton();
                    var llmResult2 = null;
                    if (typeof llmAdapter === 'function') {
                        try {
                            llmResult2 = await llmAdapter(null, text.split(/\s+/), null, streamCb3, getChatHistoryForLLM());
                        } catch (llmErr2) {
                            console.error('Lỗi LLM adapter:', llmErr2);
                            llmResult2 = null;
                        }
                    }
                    hideLLMCancelButton();
                    var elapsed4 = Date.now() - startTime;

                    if (isValidAdapterResult(llmResult2)) {
                        var llmPath2 = adapterPath.concat(['llm_adapter']);
                        finalizeStreamingMessage(streamEl3, llmResult2, confidence, llmPath2, elapsed4);
                    } else {
                        removeStreamingMessage(streamEl3);
                        appendMessage(getFinalFallbackMessage(), 'bot', confidence, adapterPath, elapsed4);
                    }
                }
            }
        }
    } catch (err) {
        console.error('Lỗi xử lý tin nhắn:', err);
        showError('Xin lỗi, mình gặp sự cố. Bạn thử gửi lại nhé!');
    } finally {
        // Luôn dọn dẹp loading indicator, cancel button và enable lại nút gửi
        hideLLMCancelButton();
        if (loadingEl) {
            hideLoadingIndicator(loadingEl);
        }
        setSendingEnabled();
        scrollToBottom();
    }
}

// ============================================================
// Logic Adapters — Tách thành các file riêng trong thư mục adapters/
// Xem: adapters/text-similarity.js, adapters/specific-response.js,
//      adapters/time-adapter.js, adapters/math-adapter.js,
//      adapters/unit-conversion.js, adapters/best-match.js,
//      adapters/logic-dispatcher.js, adapters/adapter-registry.js
// Trong trình duyệt: được load bởi <script> tags trong index.html
// Trong Node/test: được load bởi IIFE bên dưới
// ============================================================

// Node/test: expose shared variables to globalThis for adapter files
(function () {
    if (typeof module === 'undefined' || !module.exports) return;
    // Adapter files access these as free variables — in Node they need to be on globalThis
    // Use Object.defineProperty for _adapterPath and currentLang to keep them in sync with app.js locals
    Object.defineProperty(globalThis, '_adapterPath', {
        get: function () { return _adapterPath; },
        set: function (val) { _adapterPath = val; },
        configurable: true
    });
    Object.defineProperty(globalThis, 'currentLang', {
        get: function () { return currentLang; },
        set: function (val) { currentLang = val; },
        configurable: true
    });
    globalThis.removeVietnameseDiacritics = removeVietnameseDiacritics;
})();

// Node/test: load adapter files
(function () {
    if (typeof module === 'undefined' || !module.exports) return;
    var _path = require('path');
    var _adDir = _path.join(__dirname, 'adapters');
    var files = [
        'text-similarity.js',
        'specific-response.js',
        'time-adapter.js',
        'math-adapter.js',
        'unit-conversion.js',
        'best-match.js',
        'logic-dispatcher.js',
        'web-search.js',
        'llm-adapter.js',
        'voice-adapter.js',
        'adapter-registry.js'
    ];
    for (var i = 0; i < files.length; i++) {
        require(_path.join(_adDir, files[i]));
    }
    // Load preprocessed data synchronously for Node/test
    if (typeof loadPreprocessedData === 'function') {
        loadPreprocessedData();
    }
})();

// ============================================================
// Object Macro List Panel — Toggle và cập nhật danh sách macros
// ============================================================

/**
 * Lấy trạng thái enable/disable của các adapter từ localStorage.
 * @returns {{[key: string]: boolean}}
 */
function getAdapterStates() {
    try {
        var raw = localStorage.getItem('hikari_adapter_states');
        if (raw) return JSON.parse(raw) || {};
    } catch (e) { /* ignore */ }
    return {};
}

/**
 * Lưu trạng thái active của tất cả adapter vào localStorage.
 */
function saveAdapterStates() {
    var states = {};
    var keys = Object.keys(ADAPTER_REGISTRY);
    for (var i = 0; i < keys.length; i++) {
        states[keys[i]] = ADAPTER_REGISTRY[keys[i]].active !== false;
    }
    try {
        localStorage.setItem('hikari_adapter_states', JSON.stringify(states));
    } catch (e) { /* ignore */ }
}

/**
 * Cập nhật trạng thái active của một adapter và lưu vào localStorage.
 * Thay đổi sẽ có hiệu lực ngay lập tức vì wrapper trong registerAdapters() kiểm tra flag mỗi lần gọi.
 * @param {string} adapterKey
 * @param {boolean} isActive
 */
function setAdapterActive(adapterKey, isActive) {
    if (!ADAPTER_REGISTRY[adapterKey]) return;
    // voice-adapter luôn enabled
    if (adapterKey === 'voice-adapter' || adapterKey === 'voice_adapter') return;
    ADAPTER_REGISTRY[adapterKey].active = isActive;
    saveAdapterStates();
}

/**
 * Toggle hiển thị panel danh sách Object Macros.
 * Thêm/xóa class 'hidden' trên phần tử #macros-panel.
 */
function toggleMacrosPanel() {
    var panel = document.getElementById('macros-panel');
    if (panel) {
        panel.classList.toggle('hidden');
    }
}

/**
 * Toggle hiển thị panel Settings.
 */
function toggleSettingsPanel() {
    var panel = document.getElementById('settings-panel');
    if (panel) {
        panel.classList.toggle('hidden');
    }
}

// ============================================================
// History Dialog — Xem lịch sử chat (IndexedDB + Session)
// ============================================================

var _historyCurrentTab = 'db'; // 'db' hoặc 'session'
var _historyCurrentPage = 1;
var _historyPageSize = 20;

function openHistoryDialog() {
    var overlay = document.getElementById('history-overlay');
    if (overlay) overlay.classList.remove('hidden');
    _historyCurrentTab = 'db';
    _historyCurrentPage = 1;
    _updateHistoryTabUI();
    _loadHistoryPage();
}

function closeHistoryDialog() {
    var overlay = document.getElementById('history-overlay');
    if (overlay) overlay.classList.add('hidden');
}

function _updateHistoryTabUI() {
    var tabDb = document.getElementById('history-tab-db');
    var tabSession = document.getElementById('history-tab-session');
    if (tabDb) tabDb.classList.toggle('active', _historyCurrentTab === 'db');
    if (tabSession) tabSession.classList.toggle('active', _historyCurrentTab === 'session');
}

function _formatTimestamp(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
        + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

async function _loadHistoryPage() {
    var listEl = document.getElementById('history-list');
    var pagingEl = document.getElementById('history-paging');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (_historyCurrentTab === 'db') {
        // IndexedDB history
        if (typeof getMessagesPage !== 'function') {
            listEl.innerHTML = '<p class="history-empty">IndexedDB không khả dụng.</p>';
            if (pagingEl) pagingEl.innerHTML = '';
            return;
        }
        try {
            var result = await getMessagesPage(_historyCurrentPage, _historyPageSize);
            if (result.messages.length === 0) {
                listEl.innerHTML = '<p class="history-empty">Chưa có lịch sử.</p>';
            } else {
                for (var i = 0; i < result.messages.length; i++) {
                    var msg = result.messages[i];
                    var div = document.createElement('div');
                    div.className = 'history-item history-item-' + msg.role;
                    var meta = document.createElement('span');
                    meta.className = 'history-meta';
                    meta.textContent = (msg.role === 'user' ? '👤' : '🤖') + ' ' + _formatTimestamp(msg.timestamp);
                    div.appendChild(meta);
                    var content = document.createElement('span');
                    content.className = 'history-content';
                    content.textContent = msg.content;
                    div.appendChild(content);
                    // Hiển thị thumbnail attachment nếu có
                    if (msg.role === 'user' && typeof getAttachmentByMessageId === 'function') {
                        (function (divEl, msgId) {
                            getAttachmentByMessageId(msgId).then(function (att) {
                                if (att && typeof attachmentToDataURL === 'function') {
                                    var thumb = document.createElement('img');
                                    thumb.className = 'history-attachment-thumb';
                                    thumb.src = attachmentToDataURL(att);
                                    thumb.alt = att.fileName || 'attachment';
                                    divEl.appendChild(thumb);
                                }
                            }).catch(function () {});
                        })(div, msg.id);
                    }
                    listEl.appendChild(div);
                }
            }
            // Paging
            if (pagingEl) {
                pagingEl.innerHTML = '';
                if (result.totalPages > 1) {
                    var info = document.createElement('span');
                    info.className = 'history-page-info';
                    info.textContent = 'Trang ' + result.page + '/' + result.totalPages + ' (' + result.total + ' messages)';
                    pagingEl.appendChild(info);

                    if (result.page > 1) {
                        var prevBtn = document.createElement('button');
                        prevBtn.className = 'history-page-btn';
                        prevBtn.textContent = '← Trước';
                        prevBtn.addEventListener('click', function () {
                            _historyCurrentPage--;
                            _loadHistoryPage();
                        });
                        pagingEl.appendChild(prevBtn);
                    }
                    if (result.page < result.totalPages) {
                        var nextBtn = document.createElement('button');
                        nextBtn.className = 'history-page-btn';
                        nextBtn.textContent = 'Sau →';
                        nextBtn.addEventListener('click', function () {
                            _historyCurrentPage++;
                            _loadHistoryPage();
                        });
                        pagingEl.appendChild(nextBtn);
                    }
                }
            }
        } catch (err) {
            listEl.innerHTML = '<p class="history-empty">Lỗi: ' + err.message + '</p>';
            if (pagingEl) pagingEl.innerHTML = '';
        }
    } else {
        // Session history (_chatHistory)
        if (pagingEl) pagingEl.innerHTML = '';
        if (_chatHistory.length === 0) {
            listEl.innerHTML = '<p class="history-empty">Session hiện tại chưa có lịch sử.</p>';
            return;
        }
        // Hiển thị mới nhất trước
        for (var j = _chatHistory.length - 1; j >= 0; j--) {
            var m = _chatHistory[j];
            var d = document.createElement('div');
            d.className = 'history-item history-item-' + m.role;
            var icon = document.createElement('span');
            icon.className = 'history-meta';
            icon.textContent = (m.role === 'user' ? '👤 User' : '🤖 Bot');
            d.appendChild(icon);
            var c = document.createElement('span');
            c.className = 'history-content';
            c.textContent = m.content;
            d.appendChild(c);
            listEl.appendChild(d);
        }
    }
}

async function clearAllHistory() {
    if (typeof clearAllChatMessages === 'function') {
        await clearAllChatMessages();
    }
    clearChatHistory();
    // Nếu dialog đang mở, refresh
    var overlay = document.getElementById('history-overlay');
    if (overlay && !overlay.classList.contains('hidden')) {
        _loadHistoryPage();
    }
}

/**
 * Load 10 messages gần nhất từ IndexedDB và hiển thị trong chat.
 */
async function loadRecentHistoryToChat() {
    if (typeof getRecentMessages !== 'function') return;
    try {
        var messages = await getRecentMessages(10);
        if (messages.length === 0) return;
        for (var i = 0; i < messages.length; i++) {
            var msg = messages[i];
            var sender = msg.role === 'user' ? 'user' : 'bot';
            
            // Load attachment nếu có (chỉ cho user messages)
            var imageDataURL = null;
            if (msg.role === 'user' && typeof getAttachmentByMessageId === 'function') {
                try {
                    var att = await getAttachmentByMessageId(msg.id);
                    if (att && typeof attachmentToDataURL === 'function') {
                        imageDataURL = attachmentToDataURL(att);
                    }
                } catch (attErr) {
                    console.warn('Không thể load attachment cho message', msg.id, attErr);
                }
            }
            
            // skipHistory = true để tránh lưu lại vào IndexedDB
            appendMessage(msg.content, sender, null, null, null, imageDataURL, true);
        }
    } catch (err) {
        console.error('Lỗi load history:', err);
    }
}

/**
 * Cập nhật danh sách Object Macros cho ngôn ngữ chỉ định.
 * Xóa nội dung cũ của #macros-list, duyệt qua ADAPTER_REGISTRY,
 * tạo <li> cho mỗi adapter với tên, mô tả, và cú pháp <call>.
 *
 * @param {string} lang - Mã ngôn ngữ ("vi", "en", "ja")
 */
function updateMacrosList(lang) {
    var list = document.getElementById('macros-list');
    if (!list) return;

    list.innerHTML = '';

    var keys = Object.keys(ADAPTER_REGISTRY);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var adapter = ADAPTER_REGISTRY[key];
        var isActive = adapter.active !== false;
        var isVoice = (key === 'voice-adapter' || key === 'voice_adapter');

        var li = document.createElement('li');
        li.className = 'macro-item' + (isActive ? '' : ' disabled');

        // Header row: name + toggle
        var header = document.createElement('div');
        header.className = 'macro-item-header';

        var strong = document.createElement('strong');
        strong.textContent = adapter.name[lang] || adapter.name['vi'];
        header.appendChild(strong);

        // Toggle checkbox (ẩn cho voice-adapter)
        if (!isVoice) {
            var toggleLabel = document.createElement('label');
            toggleLabel.className = 'macro-toggle-label';
            toggleLabel.title = isActive
                ? (lang === 'en' ? 'Disable adapter' : lang === 'ja' ? '無効にする' : 'Tắt adapter')
                : (lang === 'en' ? 'Enable adapter' : lang === 'ja' ? '有効にする' : 'Bật adapter');

            var toggleInput = document.createElement('input');
            toggleInput.type = 'checkbox';
            toggleInput.className = 'macro-toggle-input';
            toggleInput.checked = isActive;
            toggleInput.dataset.adapterKey = key;
            (function (adapterKey, liEl) {
                toggleInput.addEventListener('change', function (e) {
                    setAdapterActive(adapterKey, e.target.checked);
                    liEl.className = 'macro-item' + (e.target.checked ? '' : ' disabled');
                });
            })(key, li);

            toggleLabel.appendChild(toggleInput);
            header.appendChild(toggleLabel);
        }

        li.appendChild(header);

        var p = document.createElement('p');
        p.className = 'macro-item-desc';
        p.textContent = adapter.description[lang] || adapter.description['vi'];
        li.appendChild(p);

        var span = document.createElement('span');
        span.className = 'macro-call-syntax';
        span.textContent = adapter.callSyntax;
        li.appendChild(span);

        list.appendChild(li);
    }
}

// ============================================================
// Rules Panel — Hiển thị danh sách triggers dạng dễ đọc
// ============================================================

/**
 * Toggle hiển thị panel danh sách rules khi click nút #rules-button.
 * Thêm/xóa class 'hidden' trên #rules-panel.
 */
function toggleRulesPanel() {
    var panel = document.getElementById('rules-panel');
    if (panel) {
        panel.classList.toggle('hidden');
    }
}

/**
 * Cập nhật danh sách triggers cho ngôn ngữ chỉ định.
 * Lấy triggers từ bot.getUserTopicTriggers(), lọc bỏ wildcard mặc định '*',
 * format dạng dễ đọc và hiển thị trong #rules-list.
 * @param {string} lang - Mã ngôn ngữ ("vi", "en", "ja")
 */
function updateRulesList(lang) {
    var list = document.getElementById('rules-list');
    if (!list) return;

    // Xóa nội dung cũ
    list.innerHTML = '';

    // Nếu bot chưa khởi tạo, hiển thị thông báo
    if (!bot) {
        var emptyLi = document.createElement('li');
        emptyLi.textContent = lang === 'en'
            ? 'Bot is not initialized.'
            : lang === 'ja'
                ? 'ボットが初期化されていません。'
                : 'Bot chưa được khởi tạo.';
        list.appendChild(emptyLi);
        return;
    }

    try {
        // Lấy danh sách triggers từ internal data của RiveScript
        var triggers = [];
        var topicData = bot._topics && bot._topics.random;
        if (topicData) {
            var keys = Object.keys(topicData);
            for (var k = 0; k < keys.length; k++) {
                var entry = topicData[keys[k]];
                if (entry && entry.trigger) {
                    triggers.push(entry.trigger);
                }
            }
        }

        if (triggers.length === 0) {
            return;
        }

        // Dùng Set để loại bỏ trigger trùng lặp (wildcard variants cùng response)
        var seen = {};
        for (var i = 0; i < triggers.length; i++) {
            var trigger = triggers[i];

            // Lọc bỏ trigger wildcard mặc định '*' và trigger chỉ chứa wildcard
            if (trigger.trim() === '*') continue;
            // Lọc bỏ trigger dạng "* la ai" (chỉ wildcard + từ) — giữ trigger có nội dung rõ ràng
            if (/^\*\s/.test(trigger.trim()) && trigger.trim().split(/\s+/).length <= 3) continue;

            var formatted = formatTrigger(trigger);
            if (formatted.length === 0 || seen[formatted]) continue;
            seen[formatted] = true;

            var li = document.createElement('li');
            li.textContent = formatted;
            list.appendChild(li);
        }
    } catch (err) {
        console.error('Lỗi lấy danh sách triggers:', err);
    }
}

/**
 * Chuyển trigger RiveScript thành dạng dễ đọc cho người dùng.
 * - Thay '*' bằng '...'
 * - Xóa cú pháp RiveScript như <call>...</call>, <star>, <bot ...>
 * - Xóa ký tự thừa và trim khoảng trắng
 * @param {string} trigger - Chuỗi trigger RiveScript
 * @returns {string} Chuỗi đã format dễ đọc
 */
function formatTrigger(trigger) {
    if (typeof trigger !== 'string') return '';

    var result = trigger;

    // Xóa thẻ <call>...</call> và nội dung bên trong
    result = result.replace(/<call>[^<]*<\/call>/g, '');

    // Xóa các thẻ RiveScript khác: <star>, <bot ...>, <input>, <reply>, v.v.
    result = result.replace(/<[^>]+>/g, '');

    // Thay wildcard '*' bằng '...'
    result = result.replace(/\*/g, '...');

    // Thay '#' (number wildcard) bằng '[số]'
    result = result.replace(/#/g, '[số]');

    // Thay '_' (word wildcard) bằng '[từ]'
    result = result.replace(/_/g, '[từ]');

    // Xóa khoảng trắng thừa
    result = result.replace(/\s+/g, ' ').trim();

    return result;
}

// ============================================================
// Help Dialog — Popup hướng dẫn sử dụng đa ngôn ngữ
// ============================================================

/**
 * Nội dung hướng dẫn sử dụng — load từ data/help-content.json
 * Browser: HELP_CONTENT được khai báo bởi data-loader.js
 * Node/test: HELP_CONTENT được khai báo ở block đầu file
 */

/**
 * Render nội dung help dialog theo ngôn ngữ hiện tại.
 */
function renderHelpContent() {
    var body = document.getElementById('help-dialog-body');
    var titleEl = document.getElementById('help-dialog-title');
    if (!body) return;

    var lang = currentLang || 'vi';
    var content = HELP_CONTENT[lang] || HELP_CONTENT['vi'];

    if (titleEl) {
        titleEl.textContent = content.title;
    }

    var html = '';
    for (var i = 0; i < content.sections.length; i++) {
        var section = content.sections[i];
        html += '<div class="help-section">';
        html += '<h3>' + section.icon + ' ' + section.heading + '</h3>';
        html += '<ul>';
        for (var j = 0; j < section.items.length; j++) {
            html += '<li>' + section.items[j] + '</li>';
        }
        html += '</ul>';
        html += '</div>';
    }

    body.innerHTML = html;
}

/**
 * Mở help dialog.
 */
function openHelpDialog() {
    var overlay = document.getElementById('help-overlay');
    if (!overlay) return;
    renderHelpContent();
    overlay.classList.remove('hidden');
}

/**
 * Đóng help dialog.
 */
function closeHelpDialog() {
    var overlay = document.getElementById('help-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
}

// ============================================================
// Khởi tạo ứng dụng — Main Initialization
// ============================================================

/**
 * Hàm khởi tạo chính của ứng dụng Hikari Chatbot.
 * - Kiểm tra CDN RiveScript đã tải chưa
 * - Khởi tạo bot với ngôn ngữ mặc định (tiếng Việt)
 * - Hiển thị lời chào khởi tạo chứa tên "Hikari" và hướng dẫn sử dụng
 * - Gắn event listener cho Language Selector, nút gửi, input Enter, nút macros, nút rules
 * @returns {Promise<void>}
 */
async function initializeApp() {
    // Kiểm tra CDN RiveScript
    if (typeof RiveScript === 'undefined') {
        showError('Chatbot hiện không khả dụng. Vui lòng kiểm tra kết nối mạng và tải lại trang.');
        return;
    }

    // Load brain files từ .rive (chỉ trong trình duyệt)
    if (typeof loadAllBrains === 'function') {
        await loadAllBrains();
    }

    // Load dữ liệu JSON (chỉ trong trình duyệt)
    if (typeof loadAllData === 'function') {
        await loadAllData();
    }

    // Áp dụng adapter states từ localStorage vào ADAPTER_REGISTRY
    if (typeof getAdapterStates === 'function' && typeof ADAPTER_REGISTRY !== 'undefined') {
        var savedStates = getAdapterStates();
        var stateKeys = Object.keys(savedStates);
        for (var si = 0; si < stateKeys.length; si++) {
            var sk = stateKeys[si];
            if (ADAPTER_REGISTRY[sk] && sk !== 'voice-adapter' && sk !== 'voice_adapter') {
                ADAPTER_REGISTRY[sk].active = savedStates[sk];
            }
        }
    }

    // Load preprocessed similarity data (chỉ trong trình duyệt)
    if (typeof loadPreprocessedData === 'function') {
        await loadPreprocessedData();
    }

    // Lấy ngôn ngữ từ localStorage, nếu không có thì dùng mặc định
    var savedLang = (typeof getLanguageFromStorage === 'function') ? getLanguageFromStorage() : null;
    var initialLang = (savedLang && (typeof isLanguageSupported === 'function' ? isLanguageSupported(savedLang) : true)) ? savedLang : 'vi';
    currentLang = initialLang;

    // Cập nhật language selector UI
    var langSelector = document.getElementById('language-selector');
    if (langSelector) {
        langSelector.value = initialLang;
    }

    // Khởi tạo bot với ngôn ngữ đã lưu
    await initBot(initialLang);

    // Hiển thị lời chào khởi tạo
    if (bot) {
        var greeting = await bot.reply(USERNAME, GREETING_TRIGGERS[initialLang]);
        _skipHistoryOnce = true;
        appendMessage(greeting, 'bot');
        updateRulesList(initialLang);
        updateMacrosList(initialLang);
    }

    // Load 10 messages gần nhất từ IndexedDB
    await loadRecentHistoryToChat();

    // === Gắn Event Listeners ===

    // Language Selector: change → changeLanguage
    var langSelector = document.getElementById('language-selector');
    if (langSelector) {
        langSelector.addEventListener('change', function(e) {
            changeLanguage(e.target.value);
        });
    }

    // Nút gửi: click → sendMessage
    var sendBtn = document.getElementById('send-button');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    // Input: keypress Enter → sendMessage
    var msgInput = document.getElementById('message-input');
    if (msgInput) {
        msgInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        // Input: input event → parseAdapterPrefixCommand → show/hide badge
        msgInput.addEventListener('input', function(e) {
            var inputText = e.target.value;
            var parsed = parseAdapterPrefixCommand(inputText);
            if (parsed) {
                showAdapterPrefixBadge(parsed.adapterKey);
            } else {
                hideAdapterPrefixBadge();
            }
        });
    }

    // Nút macros: click → toggleMacrosPanel
    var macrosBtn = document.getElementById('macros-button');
    if (macrosBtn) {
        macrosBtn.addEventListener('click', toggleMacrosPanel);
    }

    // Nút rules: click → toggleRulesPanel
    var rulesBtn = document.getElementById('rules-button');
    if (rulesBtn) {
        rulesBtn.addEventListener('click', toggleRulesPanel);
    }

    // Interaction Mode Badge: click → cycle modes
    var modeBadge = document.getElementById('interaction-mode-badge');
    if (modeBadge) {
        modeBadge.addEventListener('click', function () {
            console.log('[Event] Interaction mode badge clicked');
            cycleInteractionMode();
        });
        console.log('[Init] Interaction mode badge click listener attached');
    }

    // Nút help: click → openHelpDialog
    var helpBtn = document.getElementById('help-button');
    if (helpBtn) {
        helpBtn.addEventListener('click', openHelpDialog);
    }

    // Thinking toggle: change → bật/tắt thinking mode
    var thinkingToggle = document.getElementById('thinking-toggle');
    if (thinkingToggle) {
        thinkingToggle.addEventListener('change', function (e) {
            if (typeof setLLMThinkingEnabled === 'function') {
                setLLMThinkingEnabled(e.target.checked);
            }
        });
    }

    // Nút settings
    var settingsBtn = document.getElementById('settings-button');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', toggleSettingsPanel);
    }

    // History toggle
    var historyToggle = document.getElementById('history-toggle');
    if (historyToggle) {
        historyToggle.addEventListener('change', function (e) {
            setChatHistoryEnabled(e.target.checked);
        });
    }

    // History max turns
    var historyMaxTurns = document.getElementById('history-max-turns');
    if (historyMaxTurns) {
        historyMaxTurns.addEventListener('change', function (e) {
            setChatHistoryMaxTurns(parseInt(e.target.value, 10) || 0);
        });
    }

    // View History button
    var viewHistoryBtn = document.getElementById('view-history-button');
    if (viewHistoryBtn) {
        viewHistoryBtn.addEventListener('click', openHistoryDialog);
    }

    // Clear History button
    var clearHistoryBtn = document.getElementById('clear-history-button');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', function () {
            if (confirm('Xóa toàn bộ lịch sử chat?')) {
                clearAllHistory();
            }
        });
    }

    // History dialog: close button
    var historyCloseBtn = document.getElementById('history-close-button');
    if (historyCloseBtn) {
        historyCloseBtn.addEventListener('click', closeHistoryDialog);
    }

    // History dialog: overlay click to close
    var historyOverlay = document.getElementById('history-overlay');
    if (historyOverlay) {
        historyOverlay.addEventListener('click', function (e) {
            if (e.target === historyOverlay) closeHistoryDialog();
        });
    }

    // History dialog: tab buttons
    var tabDb = document.getElementById('history-tab-db');
    if (tabDb) {
        tabDb.addEventListener('click', function () {
            _historyCurrentTab = 'db';
            _historyCurrentPage = 1;
            _updateHistoryTabUI();
            _loadHistoryPage();
        });
    }
    var tabSession = document.getElementById('history-tab-session');
    if (tabSession) {
        tabSession.addEventListener('click', function () {
            _historyCurrentTab = 'session';
            _updateHistoryTabUI();
            _loadHistoryPage();
        });
    }

    // Nút attach: click → mở file picker
    var attachBtn = document.getElementById('attach-button');
    if (attachBtn) {
        attachBtn.addEventListener('click', function () {
            var fileInput = document.getElementById('file-input');
            if (fileInput) fileInput.click();
        });
    }

    // File input: change → xử lý file đính kèm
    var fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', function (e) {
            var file = e.target.files && e.target.files[0];
            if (file) handleFileAttachment(file);
        });
    }

    // Nút xóa attachment
    var removeAttachBtn = document.getElementById('attachment-remove');
    if (removeAttachBtn) {
        removeAttachBtn.addEventListener('click', clearAttachment);
    }

    // Help dialog: đóng khi click nút X
    var helpCloseBtn = document.getElementById('help-close-button');
    if (helpCloseBtn) {
        helpCloseBtn.addEventListener('click', closeHelpDialog);
    }

    // Help dialog: đóng khi click overlay (bên ngoài dialog)
    var helpOverlay = document.getElementById('help-overlay');
    if (helpOverlay) {
        helpOverlay.addEventListener('click', function(e) {
            if (e.target === helpOverlay) {
                closeHelpDialog();
            }
        });
    }

    // Help dialog: đóng khi nhấn Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeHelpDialog();
        }
    });

    // === Voice Adapter: khởi tạo ===
    var voiceSupport = (typeof initVoiceAdapter === 'function') ? initVoiceAdapter() : { sttSupported: false, ttsSupported: false };

    // Ẩn nút microphone mặc định (chỉ hiện khi mode voice-*)
    var micBtn = document.getElementById('voice-input-button');
    if (micBtn) {
        if (!voiceSupport.sttSupported) {
            micBtn.classList.add('hidden');
            micBtn.title = currentLang === 'en' ? 'Speech recognition not supported' : currentLang === 'ja' ? '音声認識非対応' : 'Trình duyệt không hỗ trợ nhận diện giọng nói';
        } else {
            micBtn.classList.add('hidden'); // Ẩn cho đến khi mode voice được chọn
            micBtn.addEventListener('click', function () {
                if (typeof isVoiceInputActive === 'function' && isVoiceInputActive()) {
                    stopVoiceInput();
                } else {
                    startVoiceInput();
                }
            });
        }
    }

    // Interaction Mode selector
    var modeSelect = document.getElementById('interaction-mode-select');
    if (modeSelect) {
        console.log('[Init] Interaction mode select found, setting up listener');
        // Vô hiệu hóa các option cần API không hỗ trợ
        var opts = modeSelect.querySelectorAll('option');
        opts.forEach(function (opt) {
            var val = opt.value;
            var needsSTT = val.startsWith('voice-');
            var needsTTS = val.endsWith('-voice');
            if ((needsSTT && !voiceSupport.sttSupported) || (needsTTS && !voiceSupport.ttsSupported)) {
                opt.disabled = true;
                opt.title = 'Trình duyệt không hỗ trợ';
                console.log('[Init] Disabled option:', val, '(STT:', voiceSupport.sttSupported, 'TTS:', voiceSupport.ttsSupported, ')');
            }
        });
        modeSelect.addEventListener('change', function (e) {
            console.log('[Event] Interaction mode changed to:', e.target.value);
            setInteractionMode(e.target.value);
        });
        console.log('[Init] Interaction mode listener attached. Current value:', modeSelect.value);
    } else {
        console.warn('[Init] interaction-mode-select not found!');
    }

    // TTS voice selector
    var voiceSelect = document.getElementById('tts-voice-select');
    if (voiceSelect) {
        if (!voiceSupport.ttsSupported) {
            // Ẩn TTS controls
            var ttsSection = document.getElementById('tts-settings-section');
            if (ttsSection) ttsSection.classList.add('hidden');
        } else {
            // Populate voices (có thể cần chờ onvoiceschanged)
            updateVoiceSelector(currentLang);
            if (window.speechSynthesis) {
                window.speechSynthesis.onvoiceschanged = function () {
                    updateVoiceSelector(currentLang);
                };
            }
            voiceSelect.addEventListener('change', function (e) {
                _selectedVoiceName = e.target.value || null;
                try { localStorage.setItem('hikari_voice_name', _selectedVoiceName || ''); } catch (ex) {}
            });
        }
    }

    // Voice output toggle
    var voiceOutToggle = document.getElementById('voice-output-toggle');
    if (voiceOutToggle) {
        voiceOutToggle.addEventListener('change', function (e) {
            var cur = getInteractionMode();
            if (e.target.checked) {
                setInteractionMode(cur.startsWith('voice-') ? 'voice-voice' : 'text-voice');
            } else {
                setInteractionMode(cur.startsWith('voice-') ? 'voice-text' : 'text-text');
            }
        });
    }

    // Voice input toggle
    var voiceInToggle = document.getElementById('voice-input-toggle');
    if (voiceInToggle) {
        voiceInToggle.addEventListener('change', function (e) {
            var cur = getInteractionMode();
            if (e.target.checked) {
                setInteractionMode(cur.endsWith('-voice') ? 'voice-voice' : 'voice-text');
            } else {
                setInteractionMode(cur.endsWith('-voice') ? 'text-voice' : 'text-text');
            }
        });
    }

    // === Load settings từ localStorage ===
    (function () {
        try {
            // Interaction mode
            var savedMode = localStorage.getItem('hikari_interaction_mode');
            if (savedMode && ['text-text', 'text-voice', 'voice-text', 'voice-voice'].indexOf(savedMode) !== -1) {
                // Kiểm tra mode có được hỗ trợ không trước khi áp dụng
                var needsSTT = savedMode.startsWith('voice-');
                var needsTTS = savedMode.endsWith('-voice');
                if ((!needsSTT || voiceSupport.sttSupported) && (!needsTTS || voiceSupport.ttsSupported)) {
                    setInteractionMode(savedMode);
                } else {
                    setInteractionMode('text-text');
                }
            } else {
                setInteractionMode('text-text');
            }

            // Voice name
            var savedVoice = localStorage.getItem('hikari_voice_name');
            if (savedVoice) {
                _selectedVoiceName = savedVoice;
                if (voiceSelect) voiceSelect.value = savedVoice;
            }

            // Chat history enabled
            var savedHistEnabled = localStorage.getItem('hikari_chat_history_enabled');
            if (savedHistEnabled !== null) {
                var histEnabled = savedHistEnabled === '1';
                _chatHistoryEnabled = histEnabled;
                if (historyToggle) historyToggle.checked = histEnabled;
            }

            // Chat history max turns
            var savedMaxTurns = localStorage.getItem('hikari_chat_history_max_turns');
            if (savedMaxTurns !== null) {
                var maxTurns = Math.max(0, parseInt(savedMaxTurns, 10) || 0);
                _chatHistoryMaxTurns = maxTurns;
                if (historyMaxTurns) historyMaxTurns.value = maxTurns;
            }

            // LLM thinking
            var savedThinking = localStorage.getItem('hikari_llm_thinking');
            if (savedThinking !== null) {
                var thinkingOn = savedThinking === '1';
                if (typeof setLLMThinkingEnabled === 'function') setLLMThinkingEnabled(thinkingOn);
                if (thinkingToggle) thinkingToggle.checked = thinkingOn;
            }

            // Voice output toggle UI sync
            if (voiceOutToggle) voiceOutToggle.checked = isVoiceOutputEnabled();
            // Voice input toggle UI sync
            if (voiceInToggle) voiceInToggle.checked = isVoiceInputEnabled();

        } catch (e) {
            console.warn('[initializeApp] Lỗi load settings từ localStorage:', e);
            setInteractionMode('text-text');
        }
    })();

    // === Retention Policy Settings ===
    var retentionModeSelect = document.getElementById('retention-mode-select');
    var retentionCountSection = document.getElementById('retention-count-section');
    var retentionDaysSection = document.getElementById('retention-days-section');
    var retentionMaxCount = document.getElementById('retention-max-count');
    var retentionMaxDays = document.getElementById('retention-max-days');

    // Populate UI từ localStorage
    if (typeof getRetentionConfig === 'function') {
        var retCfg = getRetentionConfig();
        if (retentionModeSelect) retentionModeSelect.value = retCfg.mode;
        if (retCfg.mode === 'days') {
            if (retentionCountSection) retentionCountSection.classList.add('hidden');
            if (retentionDaysSection) retentionDaysSection.classList.remove('hidden');
            if (retentionMaxDays) retentionMaxDays.value = retCfg.value;
        } else {
            if (retentionCountSection) retentionCountSection.classList.remove('hidden');
            if (retentionDaysSection) retentionDaysSection.classList.add('hidden');
            if (retentionMaxCount) retentionMaxCount.value = retCfg.value;
        }
    }

    if (retentionModeSelect) {
        retentionModeSelect.addEventListener('change', function (e) {
            var mode = e.target.value;
            if (mode === 'days') {
                if (retentionCountSection) retentionCountSection.classList.add('hidden');
                if (retentionDaysSection) retentionDaysSection.classList.remove('hidden');
                var days = retentionMaxDays ? (parseInt(retentionMaxDays.value, 10) || 30) : 30;
                if (typeof setRetentionConfig === 'function') setRetentionConfig('days', days);
            } else {
                if (retentionCountSection) retentionCountSection.classList.remove('hidden');
                if (retentionDaysSection) retentionDaysSection.classList.add('hidden');
                var count = retentionMaxCount ? (parseInt(retentionMaxCount.value, 10) || 50) : 50;
                if (typeof setRetentionConfig === 'function') setRetentionConfig('count', count);
            }
        });
    }

    if (retentionMaxCount) {
        retentionMaxCount.addEventListener('change', function (e) {
            var val = parseInt(e.target.value, 10) || 50;
            if (typeof setRetentionConfig === 'function') setRetentionConfig('count', val);
        });
    }

    if (retentionMaxDays) {
        retentionMaxDays.addEventListener('change', function (e) {
            var val = parseInt(e.target.value, 10) || 30;
            if (typeof setRetentionConfig === 'function') setRetentionConfig('days', val);
        });
    }
}

// Tự động khởi tạo khi DOM sẵn sàng (chỉ trong trình duyệt, không chạy trong môi trường test)
if (typeof document !== 'undefined' && typeof module === 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp();
    }
}

// ============================================================
// Voice Input / Output + Interaction Mode
// ============================================================

/**
 * Trạng thái Interaction Mode.
 * 'text-text' | 'text-voice' | 'voice-text' | 'voice-voice'
 */
var _interactionMode = 'text-text';

/** Tên voice TTS đã chọn (null = dùng default). */
var _selectedVoiceName = null;

/**
 * Lấy chế độ tương tác hiện tại.
 * @returns {string}
 */
function getInteractionMode() {
    return _interactionMode;
}

/**
 * Cycle qua các interaction modes (text-text → text-voice → voice-text → voice-voice → text-text).
 * Bỏ qua các mode không được hỗ trợ (thiếu STT hoặc TTS).
 */
function cycleInteractionMode() {
    var modes = ['text-text', 'text-voice', 'voice-text', 'voice-voice'];
    var currentIndex = modes.indexOf(_interactionMode);
    
    // Kiểm tra voice support
    var voiceSupport = { sttSupported: false, ttsSupported: false };
    if (typeof initVoiceAdapter === 'function') {
        voiceSupport = initVoiceAdapter();
    }
    
    // Tìm mode tiếp theo được hỗ trợ
    var nextIndex = (currentIndex + 1) % modes.length;
    var attempts = 0;
    
    while (attempts < modes.length) {
        var nextMode = modes[nextIndex];
        var needsSTT = nextMode.startsWith('voice-');
        var needsTTS = nextMode.endsWith('-voice');
        
        // Kiểm tra xem mode này có được hỗ trợ không
        if ((!needsSTT || voiceSupport.sttSupported) && (!needsTTS || voiceSupport.ttsSupported)) {
            console.log('[cycleInteractionMode] Switching from', _interactionMode, 'to', nextMode);
            setInteractionMode(nextMode);
            return;
        }
        
        // Thử mode tiếp theo
        nextIndex = (nextIndex + 1) % modes.length;
        attempts++;
    }
    
    // Nếu không tìm được mode nào khác, giữ nguyên
    console.warn('[cycleInteractionMode] No other supported modes found, staying at', _interactionMode);
}

/**
 * Kiểm tra voice input có được bật không.
 * @returns {boolean}
 */
function isVoiceInputEnabled() {
    return _interactionMode.startsWith('voice-');
}

/**
 * Kiểm tra voice output có được bật không.
 * @returns {boolean}
 */
function isVoiceOutputEnabled() {
    return _interactionMode.endsWith('-voice');
}

/**
 * Đặt chế độ tương tác, cập nhật UI.
 * @param {string} mode - 'text-text' | 'text-voice' | 'voice-text' | 'voice-voice'
 */
function setInteractionMode(mode) {
    console.log('[setInteractionMode] Setting mode to:', mode);
    _interactionMode = mode;
    try { localStorage.setItem('hikari_interaction_mode', mode); } catch (e) {}

    // Hiện/ẩn nút microphone
    var micBtn = document.getElementById('voice-input-button');
    if (micBtn) {
        var shouldShow = isVoiceInputEnabled();
        console.log('[setInteractionMode] Voice input enabled:', shouldShow);
        micBtn.classList.toggle('hidden', !shouldShow);
    } else {
        console.warn('[setInteractionMode] voice-input-button not found');
    }

    // Cập nhật badge
    var badge = document.getElementById('interaction-mode-badge');
    if (badge) {
        var badges = {
            'text-text': '📝→📝',
            'text-voice': '📝→🔊',
            'voice-text': '🎤→📝',
            'voice-voice': '🎤→🔊'
        };
        badge.textContent = badges[mode] || '📝→📝';
        badge.title = mode;
        console.log('[setInteractionMode] Badge updated to:', badge.textContent);
    } else {
        console.warn('[setInteractionMode] interaction-mode-badge not found');
    }

    // Sync select nếu có
    var modeSelect = document.getElementById('interaction-mode-select');
    if (modeSelect && modeSelect.value !== mode) {
        modeSelect.value = mode;
        console.log('[setInteractionMode] Select synced to:', mode);
    }
    
    console.log('[setInteractionMode] Mode set successfully. Voice input enabled:', isVoiceInputEnabled(), 'Voice output enabled:', isVoiceOutputEnabled());
}

/**
 * Đọc text bằng TTS nếu voice output đang bật.
 * Gọi thẳng speakText từ voice-adapter.js (đã load qua script tag).
 * @param {string} text
 */
function onBotReplyReady(text) {
    if (!isVoiceOutputEnabled()) return;
    // speakText được định nghĩa trong voice-adapter.js — không wrap lại để tránh đệ quy
    if (typeof speakText === 'function') {
        speakText(text, currentLang, _selectedVoiceName);
    }
}

/**
 * Dừng TTS — delegate sang voice-adapter.js.
 */
function stopSpeaking() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
}

/**
 * Cập nhật dropdown chọn voice theo ngôn ngữ.
 * @param {string} lang
 */
function updateVoiceSelector(lang) {
    var select = document.getElementById('tts-voice-select');
    if (!select) return;

    var voices = (typeof getVoicesForLang === 'function') ? getVoicesForLang(lang) : [];
    select.innerHTML = '';

    if (voices.length === 0) {
        var opt = document.createElement('option');
        opt.value = '';
        opt.textContent = lang === 'en' ? '(No voices available)' : lang === 'ja' ? '(音声なし)' : '(Không có giọng)';
        select.appendChild(opt);
        return;
    }

    voices.forEach(function (v) {
        var opt = document.createElement('option');
        opt.value = v.name;
        opt.textContent = v.name + (v.localService ? ' ★' : '');
        select.appendChild(opt);
    });

    // Chọn default voice
    var defaultVoice = (typeof getDefaultVoice === 'function') ? getDefaultVoice(lang) : null;
    if (defaultVoice) {
        select.value = defaultVoice.name;
        _selectedVoiceName = defaultVoice.name;
    }
}

/**
 * Bắt đầu nhận diện giọng nói.
 * Dừng TTS trước để tránh feedback loop (voice→voice mode).
 */
function startVoiceInput() {
    // Dừng TTS trước (tránh feedback loop trong voice→voice)
    stopSpeaking();

    var micBtn = document.getElementById('voice-input-button');
    var msgInput = document.getElementById('message-input');
    var prevPlaceholder = msgInput ? msgInput.placeholder : '';

    if (micBtn) micBtn.classList.add('voice-listening');

    if (typeof window !== 'undefined' && typeof window._voiceAdapterStartVoiceInput === 'function') {
        window._voiceAdapterStartVoiceInput(
            currentLang,
            // onInterim: hiển thị trạng thái vào placeholder (không ghi đè text đang nhập)
            function (statusText) {
                if (msgInput) {
                    msgInput.placeholder = statusText;
                    msgInput.disabled = true;
                }
            },
            // onFinal: điền kết quả và gửi
            function (text) {
                if (micBtn) micBtn.classList.remove('voice-listening');
                if (msgInput) {
                    msgInput.disabled = false;
                    msgInput.placeholder = prevPlaceholder;
                    msgInput.value = text;
                }
                sendMessage();
            },
            // onError
            function (err) {
                if (micBtn) micBtn.classList.remove('voice-listening');
                if (msgInput) {
                    msgInput.disabled = false;
                    msgInput.placeholder = prevPlaceholder;
                }
                console.warn('STT error:', err);

                var lang = currentLang || 'vi';
                if (err === 'no-speech') return; // không cần thông báo

                var msg;
                if (err === 'not-allowed') {
                    msg = lang === 'en' ? '🎤 Microphone access denied. Please allow microphone in browser settings.'
                        : lang === 'ja' ? '🎤 マイクへのアクセスが拒否されました。'
                        : '🎤 Trình duyệt chặn microphone. Vui lòng cấp quyền microphone.';
                } else if (err && err.startsWith('transcribe-failed')) {
                    msg = lang === 'en' ? '🎤 Transcription failed. Try again.'
                        : lang === 'ja' ? '🎤 音声認識に失敗しました。'
                        : '🎤 Nhận dạng giọng nói thất bại. Thử lại nhé!';
                } else {
                    msg = lang === 'en' ? '🎤 Voice input error: ' + err
                        : lang === 'ja' ? '🎤 音声入力エラー: ' + err
                        : '🎤 Lỗi voice input: ' + err;
                }
                showError(msg);
            }
        );
    } else {
        if (micBtn) micBtn.classList.remove('voice-listening');
        if (msgInput) { msgInput.disabled = false; msgInput.placeholder = prevPlaceholder; }
        console.warn('[startVoiceInput] voice-adapter chưa được load');
    }
}

/**
 * Dừng nhận diện giọng nói.
 */
function stopVoiceInput() {
    var micBtn = document.getElementById('voice-input-button');
    if (micBtn) micBtn.classList.remove('voice-listening');
    if (typeof window !== 'undefined' && typeof window._voiceAdapterStopVoiceInput === 'function') {
        window._voiceAdapterStopVoiceInput();
    }
}

// ============================================================
// Export cho testing (module.exports nếu chạy trong Node/Vitest)
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateMessage: validateMessage,
        linkifyText: linkifyText,
        removeVietnameseDiacritics: removeVietnameseDiacritics,
        normalizeInput: normalizeInput,
        scrollToBottom: scrollToBottom,
        appendMessage: appendMessage,
        showError: showError,
        calculateConfidence: calculateConfidence,
        getConfidenceClass: getConfidenceClass,
        BRAIN_DATA: BRAIN_DATA,
        initBot: initBot,
        changeLanguage: changeLanguage,
        GREETING_TRIGGERS: GREETING_TRIGGERS,
        sendMessage: sendMessage,
        getBotReply: getBotReply,
        getFinalFallbackMessage: getFinalFallbackMessage,
        extractWebSearchQuery: extractWebSearchQuery,
        showLoadingIndicator: showLoadingIndicator,
        hideLoadingIndicator: hideLoadingIndicator,
        callFallbackAPI: callFallbackAPI,
        levenshteinDistance: levenshteinDistance,
        jaccardSimilarity: jaccardSimilarity,
        cosineSimilarity: cosineSimilarity,
        cosineSimilarityTFIDF: cosineSimilarityTFIDF,
        synsetSimilarity: synsetSimilarity,
        synsetSimilarityPreprocessed: synsetSimilarityPreprocessed,
        areSynonyms: areSynonyms,
        SYNONYM_GROUPS: SYNONYM_GROUPS,
        textSimilarity: textSimilarity,
        loadPreprocessedData: loadPreprocessedData,
        getPreprocessedLang: getPreprocessedLang,
        findBestMatchPreprocessed: findBestMatchPreprocessed,
        tokenizeForSimilarity: tokenizeForSimilarity,
        SPECIFIC_RESPONSES: SPECIFIC_RESPONSES,
        specificResponseAdapter: specificResponseAdapter,
        TIME_KEYWORDS: TIME_KEYWORDS,
        DAY_NAMES: DAY_NAMES,
        MONTH_NAMES_EN: MONTH_NAMES_EN,
        timeAdapter: timeAdapter,
        formatTime: formatTime,
        formatDate: formatDate,
        formatDay: formatDay,
        parseMathExpression: parseMathExpression,
        mathematicalEvaluationAdapter: mathematicalEvaluationAdapter,
        CONVERSION_FACTORS: CONVERSION_FACTORS,
        TEMPERATURE_UNITS: TEMPERATURE_UNITS,
        convertTemperature: convertTemperature,
        convertUnit: convertUnit,
        parseConversionRequest: parseConversionRequest,
        getSupportedUnits: getSupportedUnits,
        unitConversionAdapter: unitConversionAdapter,
        QA_DATASET: QA_DATASET,
        bestMatchAdapter: bestMatchAdapter,
        INVALID_RESPONSE_PHRASES: INVALID_RESPONSE_PHRASES,
        isValidAdapterResult: isValidAdapterResult,
        logicAdapterDispatcher: logicAdapterDispatcher,
        ADAPTER_REGISTRY: ADAPTER_REGISTRY,
        ADAPTER_DISPLAY_NAMES: ADAPTER_DISPLAY_NAMES,
        getAdapterDisplayName: getAdapterDisplayName,
        get _adapterPath() { return _adapterPath; },
        set _adapterPath(val) { _adapterPath = val; },
        registerAdapters: registerAdapters,
        webSearchAdapter: webSearchAdapter,
        googleSearch: googleSearch,
        duckDuckGoSearch: duckDuckGoSearch,
        llmAdapter: llmAdapter,
        loadLLMModel: loadLLMModel,
        llmGenerate: llmGenerate,
        llmGenerateWithImage: llmGenerateWithImage,
        isWebGPUSupported: isWebGPUSupported,
        isLLMReady: isLLMReady,
        getLLMStatus: getLLMStatus,
        getLLMLastError: getLLMLastError,
        cancelLLMGeneration: cancelLLMGeneration,
        isLLMGenerating: isLLMGenerating,
        showLLMCancelButton: showLLMCancelButton,
        hideLLMCancelButton: hideLLMCancelButton,
        createStreamingBotMessage: createStreamingBotMessage,
        createStreamingCallback: createStreamingCallback,
        finalizeStreamingMessage: finalizeStreamingMessage,
        removeStreamingMessage: removeStreamingMessage,
        setLLMModelId: setLLMModelId,
        setLLMThinkingEnabled: setLLMThinkingEnabled,
        isLLMThinkingEnabled: isLLMThinkingEnabled,
        setSendingDisabled: setSendingDisabled,
        setSendingEnabled: setSendingEnabled,
        showLLMLoadingStatus: showLLMLoadingStatus,
        hideLLMLoadingStatus: hideLLMLoadingStatus,
        onLLMStatusChange: onLLMStatusChange,
        setLLMStatusCallback: setLLMStatusCallback,
        handleFileAttachment: handleFileAttachment,
        clearAttachment: clearAttachment,
        consumeAttachment: consumeAttachment,
        get _attachedImage() { return _attachedImage; },
        set _attachedImage(val) { _attachedImage = val; },
        toggleMacrosPanel: toggleMacrosPanel,
        toggleSettingsPanel: toggleSettingsPanel,
        openHistoryDialog: openHistoryDialog,
        closeHistoryDialog: closeHistoryDialog,
        clearAllHistory: clearAllHistory,
        loadRecentHistoryToChat: loadRecentHistoryToChat,
        addChatHistory: addChatHistory,
        getChatHistoryForLLM: getChatHistoryForLLM,
        clearChatHistory: clearChatHistory,
        setChatHistoryEnabled: setChatHistoryEnabled,
        isChatHistoryEnabled: isChatHistoryEnabled,
        setChatHistoryMaxTurns: setChatHistoryMaxTurns,
        getChatHistoryMaxTurns: getChatHistoryMaxTurns,
        get _chatHistory() { return _chatHistory; },
        updateMacrosList: updateMacrosList,
        toggleRulesPanel: toggleRulesPanel,
        updateRulesList: updateRulesList,
        formatTrigger: formatTrigger,
        initializeApp: initializeApp,
        // Expose state for testing
        get bot() { return bot; },
        set bot(val) { bot = val; },
        get currentLang() { return currentLang; },
        set currentLang(val) { currentLang = val; },
        USERNAME: USERNAME,
        FALLBACK_API_URL: FALLBACK_API_URL,
        FALLBACK_API_TIMEOUT: FALLBACK_API_TIMEOUT,
        LLM_MODEL_ID_CONFIG: LLM_MODEL_ID_CONFIG,
        // Voice + Interaction Mode
        getInteractionMode: getInteractionMode,
        setInteractionMode: setInteractionMode,
        cycleInteractionMode: cycleInteractionMode,
        isVoiceInputEnabled: isVoiceInputEnabled,
        isVoiceOutputEnabled: isVoiceOutputEnabled,
        onBotReplyReady: onBotReplyReady,
        stopSpeaking: stopSpeaking,
        startVoiceInput: startVoiceInput,
        stopVoiceInput: stopVoiceInput,
        updateVoiceSelector: updateVoiceSelector,
        get _interactionMode() { return _interactionMode; },
        get _selectedVoiceName() { return _selectedVoiceName; }
    };
}
