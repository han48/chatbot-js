// ============================================================
// brain.js — Load RiveScript brain data từ file .rive
// ============================================================

/**
 * BRAIN_DATA — Dữ liệu hội thoại RiveScript cho 3 ngôn ngữ.
 * Được load từ các file .rive trong thư mục brain/.
 * Mỗi key (vi, en, ja) chứa nội dung RiveScript dạng chuỗi.
 */
var BRAIN_DATA = {
    vi: '',
    en: '',
    ja: ''
};

/**
 * Danh sách file .rive tương ứng với mỗi ngôn ngữ.
 */
var BRAIN_FILES = {
    vi: 'brain/vi.rive',
    en: 'brain/en.rive',
    ja: 'brain/ja.rive'
};

/**
 * Load nội dung file .rive cho một ngôn ngữ.
 * @param {string} lang - Mã ngôn ngữ ("vi", "en", "ja")
 * @returns {Promise<string>} Nội dung file .rive
 */
async function loadBrainFile(lang) {
    var filePath = BRAIN_FILES[lang];
    if (!filePath) {
        console.error('Không tìm thấy file brain cho ngôn ngữ:', lang);
        return '';
    }

    try {
        var response = await fetch(filePath);
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        return await response.text();
    } catch (err) {
        console.error('Lỗi load brain file [' + lang + ']:', err);
        return '';
    }
}

/**
 * Load tất cả brain files cho 3 ngôn ngữ.
 * Gọi hàm này trước khi khởi tạo bot.
 * @returns {Promise<void>}
 */
async function loadAllBrains() {
    var langs = Object.keys(BRAIN_FILES);
    var promises = langs.map(function (lang) {
        return loadBrainFile(lang).then(function (content) {
            BRAIN_DATA[lang] = content;
        });
    });
    await Promise.all(promises);
}
