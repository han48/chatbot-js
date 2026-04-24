// ============================================================
// Language Selector — Ánh xạ ngôn ngữ tập trung
// Tái sử dụng cho Voice, LLM, và các adapter khác
// ============================================================

/**
 * Ánh xạ ngôn ngữ app → locale (BCP 47 format).
 * Dùng cho Web Speech API, TTS, STT.
 */
var SPEECH_LOCALE_MAP = {
    vi: 'vi-VN',
    en: 'en-US',
    ja: 'ja-JP'
};

/**
 * Ánh xạ ngôn ngữ app → Whisper language code (ISO 639-1).
 * Dùng cho STT (Whisper ONNX).
 */
var WHISPER_LANG_MAP = {
    vi: 'vietnamese',
    en: 'english',
    ja: 'japanese'
};

/**
 * Ánh xạ ngôn ngữ app → LLM language code.
 * Dùng cho LLM adapter (Ollama, Hugging Face, v.v.).
 */
var LLM_LANG_MAP = {
    vi: 'vi',
    en: 'en',
    ja: 'ja'
};

/**
 * Danh sách ngôn ngữ được hỗ trợ.
 */
var SUPPORTED_LANGUAGES = ['vi', 'en', 'ja'];

/**
 * Lấy locale từ language code.
 * @param {string} lang - Language code (vi, en, ja)
 * @returns {string} Locale (vi-VN, en-US, ja-JP)
 */
function getLocale(lang) {
    return SPEECH_LOCALE_MAP[lang] || lang;
}

/**
 * Lấy Whisper language code từ language code.
 * @param {string} lang - Language code (vi, en, ja)
 * @returns {string} Whisper language code (vietnamese, english, japanese)
 */
function getWhisperLang(lang) {
    return WHISPER_LANG_MAP[lang] || 'vietnamese';
}

/**
 * Lấy LLM language code từ language code.
 * @param {string} lang - Language code (vi, en, ja)
 * @returns {string} LLM language code (vi, en, ja)
 */
function getLLMLang(lang) {
    return LLM_LANG_MAP[lang] || 'vi';
}

/**
 * Kiểm tra ngôn ngữ có được hỗ trợ không.
 * @param {string} lang - Language code
 * @returns {boolean}
 */
function isLanguageSupported(lang) {
    return SUPPORTED_LANGUAGES.includes(lang);
}

/**
 * Lấy ngôn ngữ mặc định.
 * @returns {string} Language code (vi)
 */
function getDefaultLanguage() {
    return 'vi';
}

/**
 * Lấy danh sách ngôn ngữ được hỗ trợ.
 * @returns {array} Danh sách language codes
 */
function getSupportedLanguages() {
    return SUPPORTED_LANGUAGES.slice();
}

/**
 * Lưu ngôn ngữ vào localStorage.
 * @param {string} lang - Language code
 */
function saveLanguageToStorage(lang) {
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            window.localStorage.setItem('selectedLanguage', lang);
            console.log('[LanguageSelector] Saved language to localStorage:', lang);
        } catch (err) {
            console.error('[LanguageSelector] Error saving to localStorage:', err);
        }
    }
}

/**
 * Lấy ngôn ngữ từ localStorage.
 * @returns {string|null} Language code hoặc null nếu không có
 */
function getLanguageFromStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            var lang = window.localStorage.getItem('selectedLanguage');
            return lang || null;
        } catch (err) {
            console.error('[LanguageSelector] Error reading from localStorage:', err);
            return null;
        }
    }
    return null;
}

/**
 * Callback khi ngôn ngữ thay đổi.
 * Lưu vào localStorage và có thể được override bởi các adapter để reload state.
 * @param {string} lang - Language code mới
 */
function onLanguageChange(lang) {
    console.log('[LanguageSelector] Language changed to:', lang);
    saveLanguageToStorage(lang);
    // Các adapter có thể override hàm này để reload state
}

// ============================================================
// Export cho Node/test
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    globalThis.SPEECH_LOCALE_MAP = SPEECH_LOCALE_MAP;
    globalThis.WHISPER_LANG_MAP = WHISPER_LANG_MAP;
    globalThis.LLM_LANG_MAP = LLM_LANG_MAP;
    globalThis.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
    globalThis.getLocale = getLocale;
    globalThis.getWhisperLang = getWhisperLang;
    globalThis.getLLMLang = getLLMLang;
    globalThis.isLanguageSupported = isLanguageSupported;
    globalThis.getDefaultLanguage = getDefaultLanguage;
    globalThis.getSupportedLanguages = getSupportedLanguages;
    globalThis.saveLanguageToStorage = saveLanguageToStorage;
    globalThis.getLanguageFromStorage = getLanguageFromStorage;
    globalThis.onLanguageChange = onLanguageChange;
}
