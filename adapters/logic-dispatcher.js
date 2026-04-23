// ============================================================
// Logic Adapter Dispatcher — Điều phối các adapter con theo ưu tiên
// Phụ thuộc: currentLang, _adapterPath, specificResponseAdapter, timeAdapter,
//            mathematicalEvaluationAdapter, unitConversionAdapter, bestMatchAdapter
// ============================================================

var INVALID_RESPONSE_PHRASES = [
    'không có phản hồi cụ thể', 'không hiểu', 'không thể', 'không tìm thấy',
    'không tìm được', 'cú pháp không hợp lệ',
    'no specific response', "don't understand", 'cannot', 'not found',
    'invalid syntax', 'could not find',
    '特定の応答はありません', '理解できません', 'できません', '見つかりません',
    '構文が無効', '見つかりませんでした'
];

function isValidAdapterResult(result) {
    if (typeof result !== 'string' || result.trim().length === 0) return false;
    var lower = result.toLowerCase();
    for (var i = 0; i < INVALID_RESPONSE_PHRASES.length; i++) {
        if (lower.indexOf(INVALID_RESPONSE_PHRASES[i].toLowerCase()) !== -1) return false;
    }
    return true;
}

function logicAdapterDispatcher(rs, args) {
    _adapterPath.push('logic_adapter');
    var adapters = [
        specificResponseAdapter,
        timeAdapter,
        mathematicalEvaluationAdapter,
        unitConversionAdapter,
        bestMatchAdapter
    ];

    var pathLenBefore = _adapterPath.length;

    for (var i = 0; i < adapters.length; i++) {
        try {
            _adapterPath.length = pathLenBefore;
            var result = adapters[i](rs, args);
            // bestMatchAdapter trả {answer, score}, các adapter khác trả string
            if (result && typeof result === 'object' && result.answer) {
                if (isValidAdapterResult(result.answer)) return result.answer;
            } else if (isValidAdapterResult(result)) {
                return result;
            }
        } catch (err) {
            continue;
        }
    }

    _adapterPath.length = pathLenBefore;
    var lang = currentLang || 'vi';
    if (lang === 'en') return 'Sorry, I cannot process your request at this time.';
    if (lang === 'ja') return '申し訳ありませんが、現在リクエストを処理できません。';
    return 'Xin lỗi, mình không thể xử lý yêu cầu của bạn lúc này.';
}

// Node/test: export to globalThis
if (typeof module !== 'undefined' && module.exports) {
    globalThis.INVALID_RESPONSE_PHRASES = INVALID_RESPONSE_PHRASES;
    globalThis.isValidAdapterResult = isValidAdapterResult;
    globalThis.logicAdapterDispatcher = logicAdapterDispatcher;
}
