// ============================================================
// Specific Response Adapter — Phản hồi exact match từ bảng ánh xạ
// Phụ thuộc: currentLang, _adapterPath, removeVietnameseDiacritics, SPECIFIC_RESPONSES
// ============================================================

/**
 * Specific Response Adapter — Object Macro trả về phản hồi exact match.
 * So khớp case-insensitive, hỗ trợ diacritics-stripped match cho tiếng Việt.
 *
 * @param {object} rs - RiveScript instance
 * @param {string[]} args - Mảng các từ từ thẻ <call>
 * @returns {string} Câu trả lời tương ứng hoặc thông báo "không có phản hồi cụ thể"
 */
function specificResponseAdapter(rs, args) {
    _adapterPath.push('specific_response');
    var input = (args || []).join(' ').trim().toLowerCase();

    if (input.length === 0) {
        return currentLang === 'en'
            ? 'No specific response for this question.'
            : currentLang === 'ja'
                ? 'この質問に対する特定の応答はありません。'
                : 'Không có phản hồi cụ thể cho câu hỏi này.';
    }

    var responses = SPECIFIC_RESPONSES[currentLang] || SPECIFIC_RESPONSES['vi'];

    // Thử exact match trước
    var keys = Object.keys(responses);
    for (var i = 0; i < keys.length; i++) {
        if (keys[i].toLowerCase() === input) {
            return responses[keys[i]];
        }
    }
    // Thử match sau khi bỏ dấu (chỉ tiếng Việt)
    if (currentLang === 'vi') {
        var inputNoDiacritics = removeVietnameseDiacritics(input);
        for (var j = 0; j < keys.length; j++) {
            if (removeVietnameseDiacritics(keys[j].toLowerCase()) === inputNoDiacritics) {
                return responses[keys[j]];
            }
        }
    }

    if (currentLang === 'en') return 'No specific response for this question.';
    if (currentLang === 'ja') return 'この質問に対する特定の応答はありません。';
    return 'Không có phản hồi cụ thể cho câu hỏi này.';
}

// Node/test: export to globalThis
if (typeof module !== 'undefined' && module.exports) {
    globalThis.specificResponseAdapter = specificResponseAdapter;
}
