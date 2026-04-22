// ============================================================
// Hikari Chatbot — app.js
// Khung cơ bản và cấu hình (Task 1.3)
// ============================================================

// === Trạng thái toàn cục ===
let bot = null;                // Instance RiveScript hiện tại
let currentLang = 'vi';        // Ngôn ngữ hiện tại
const USERNAME = 'local-user'; // Username cố định cho RiveScript
var _adapterPath = [];         // Tracking adapter chain cho mỗi lượt phản hồi

// === Hằng số cấu hình ===
const FALLBACK_API_URL = 'https://your-api-server.com/chat'; // URL có thể cấu hình
const FALLBACK_API_TIMEOUT = 5000; // 5 giây

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

/**
 * Thêm tin nhắn vào DOM với class phân biệt user/bot, kèm confidence, adapter path và thời gian xử lý nếu là bot.
 * @param {string} text - Nội dung tin nhắn
 * @param {"user"|"bot"} sender - Người gửi
 * @param {number} [confidence] - Tỉ lệ khớp (chỉ dùng cho bot)
 * @param {string[]} [adapterPath] - Danh sách adapter đã xử lý (chỉ dùng cho bot)
 * @param {number} [responseTime] - Thời gian xử lý (ms, chỉ dùng cho bot)
 */
function appendMessage(text, sender, confidence, adapterPath, responseTime) {
    const display = document.getElementById('message-display');
    if (!display) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + sender;

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
    await initBot(lang);

    // Xóa lịch sử hội thoại
    var display = document.getElementById('message-display');
    if (display) {
        display.innerHTML = '';
    }

    // Hiển thị lời chào mới bằng ngôn ngữ được chọn
    if (bot) {
        try {
            var greeting = await bot.reply(USERNAME, GREETING_TRIGGERS[lang] || 'hello');
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

    // Kiểm tra tin nhắn hợp lệ
    if (!validateMessage(text)) {
        return;
    }

    // Hiển thị tin nhắn người dùng
    appendMessage(text, 'user');

    // Xóa input
    input.value = '';

    // Kiểm tra bot đã khởi tạo chưa
    if (!bot) {
        showError('Chatbot chưa sẵn sàng. Vui lòng tải lại trang.');
        return;
    }

    try {
        var startTime = Date.now();

        // Web Search: detect "google ...", "tra cuu ...", "search ...", "web search ..." trước khi gửi cho RiveScript
        // Xử lý trực tiếp vì web search là async và RiveScript subroutine không hỗ trợ Promise
        var webSearchQuery = extractWebSearchQuery(text);
        if (webSearchQuery && typeof webSearchAdapter === 'function') {
            var loadingEl = showLoadingIndicator();
            try {
                _adapterPath = [];
                var searchResult = await webSearchAdapter(null, webSearchQuery.split(/\s+/));
                hideLoadingIndicator(loadingEl);
                var elapsed = Date.now() - startTime;
                var searchPath = _adapterPath.length > 0 ? _adapterPath.slice() : ['web_search'];
                appendMessage(searchResult, 'bot', null, searchPath, elapsed);
            } catch (searchErr) {
                hideLoadingIndicator(loadingEl);
                showError('Tìm kiếm thất bại. Vui lòng thử lại.');
            }
            scrollToBottom();
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
            _adapterPath = [];
            var localFallback = bestMatchAdapter(bot, text.toLowerCase().split(/\s+/));
            var localPath = _adapterPath.slice();

            if (currentLang === 'vi') {
                _adapterPath = [];
                var normFallback = bestMatchAdapter(bot, normalizeInput(text).toLowerCase().split(/\s+/));
                var normPath = _adapterPath.slice();
                if (isValidAdapterResult(normFallback) && !isValidAdapterResult(localFallback)) {
                    localFallback = normFallback;
                    localPath = normPath;
                }
            }

            if (isValidAdapterResult(localFallback)) {
                var elapsed2 = Date.now() - startTime;
                appendMessage(localFallback, 'bot', confidence, localPath, elapsed2);
            } else {
                var loadingEl = showLoadingIndicator();

                try {
                    var apiResult = await callFallbackAPI(text);
                    hideLoadingIndicator(loadingEl);
                    var elapsed3 = Date.now() - startTime;

                    if (apiResult) {
                        var apiPath = adapterPath.concat(['fallback_api']);
                        appendMessage(apiResult, 'bot', confidence, apiPath, elapsed3);
                    } else {
                        appendMessage(reply + '\n(Dịch vụ bổ sung không khả dụng)', 'bot', confidence, adapterPath, elapsed3);
                    }
                } catch (apiErr) {
                    hideLoadingIndicator(loadingEl);
                    var elapsed4 = Date.now() - startTime;
                    appendMessage(reply + '\n(Dịch vụ bổ sung không khả dụng)', 'bot', confidence, adapterPath, elapsed4);
                }
            }
        }
    } catch (err) {
        console.error('Lỗi xử lý tin nhắn:', err);
        showError('Xin lỗi, mình gặp sự cố. Bạn thử gửi lại nhé!');
    }

    scrollToBottom();
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

    var activeLabel = lang === 'en' ? 'Active' : lang === 'ja' ? '有効' : 'Hoạt động';

    var keys = Object.keys(ADAPTER_REGISTRY);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var adapter = ADAPTER_REGISTRY[key];

        var li = document.createElement('li');
        li.className = 'macro-item';

        // Header row: name + badge
        var header = document.createElement('div');
        header.className = 'macro-item-header';

        var strong = document.createElement('strong');
        strong.textContent = adapter.name[lang] || adapter.name['vi'];
        header.appendChild(strong);

        if (adapter.active) {
            var badge = document.createElement('span');
            badge.className = 'macro-item-badge';
            badge.textContent = activeLabel;
            header.appendChild(badge);
        }

        li.appendChild(header);

        var p = document.createElement('p');
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

    // Load preprocessed similarity data (chỉ trong trình duyệt)
    if (typeof loadPreprocessedData === 'function') {
        await loadPreprocessedData();
    }

    // Khởi tạo bot với tiếng Việt (ngôn ngữ mặc định)
    await initBot('vi');

    // Hiển thị lời chào khởi tạo
    if (bot) {
        var greeting = await bot.reply(USERNAME, GREETING_TRIGGERS['vi']);
        appendMessage(greeting, 'bot');
        updateRulesList('vi');
        updateMacrosList('vi');
    }

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

    // Nút help: click → openHelpDialog
    var helpBtn = document.getElementById('help-button');
    if (helpBtn) {
        helpBtn.addEventListener('click', openHelpDialog);
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
        toggleMacrosPanel: toggleMacrosPanel,
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
        FALLBACK_API_TIMEOUT: FALLBACK_API_TIMEOUT
    };
}
