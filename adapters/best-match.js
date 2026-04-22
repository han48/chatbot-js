// ============================================================
// Best Match Adapter — So khớp tương đồng chuỗi với tập Q&A
// Phụ thuộc: currentLang, _adapterPath, textSimilarity, removeVietnameseDiacritics,
//            QA_DATASET, findBestMatchPreprocessed (optional)
// ============================================================

function bestMatchAdapter(rs, args) {
    _adapterPath.push('best_match');
    var input = (args || []).join(' ').trim();
    var lang = currentLang || 'vi';
    var threshold = 0.3;

    if (input.length === 0) {
        if (lang === 'en') return 'Please provide a question to search for.';
        if (lang === 'ja') return '検索する質問を入力してください。';
        return 'Vui lòng nhập câu hỏi để tìm kiếm.';
    }

    // Thử dùng preprocessed data trước (nhanh hơn)
    if (typeof findBestMatchPreprocessed === 'function') {
        var ppResult = findBestMatchPreprocessed(input, lang, threshold);
        if (ppResult) return ppResult.answer;
    }

    // Fallback: tính similarity thủ công từ QA_DATASET
    var dataset = QA_DATASET[lang] || QA_DATASET['vi'];
    var bestScore = -1;
    var bestAnswer = '';

    var inputLower = input.toLowerCase();
    var inputNorm = (lang === 'vi' && typeof removeVietnameseDiacritics === 'function')
        ? removeVietnameseDiacritics(inputLower) : null;

    for (var i = 0; i < dataset.length; i++) {
        var qLower = dataset[i].q.toLowerCase();
        var score = textSimilarity(inputLower, qLower);
        if (inputNorm) {
            var qNorm = removeVietnameseDiacritics(qLower);
            var scoreNorm = textSimilarity(inputNorm, qNorm);
            if (scoreNorm > score) score = scoreNorm;
        }
        if (score > bestScore) {
            bestScore = score;
            bestAnswer = dataset[i].a;
        }
    }

    if (bestScore >= threshold) return bestAnswer;

    if (lang === 'en') return 'Sorry, I could not find a suitable answer for your question.';
    if (lang === 'ja') return '申し訳ありませんが、ご質問に適した回答が見つかりませんでした。';
    return 'Xin lỗi, mình không tìm được câu trả lời phù hợp cho câu hỏi của bạn.';
}

// Node/test: export to globalThis
if (typeof module !== 'undefined' && module.exports) {
    globalThis.bestMatchAdapter = bestMatchAdapter;
}
