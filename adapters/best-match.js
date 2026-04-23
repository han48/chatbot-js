// ============================================================
// Best Match Adapter — So khớp tương đồng chuỗi với tập Q&A
// Phụ thuộc: currentLang, _adapterPath, textSimilarity, removeVietnameseDiacritics,
//            QA_DATASET, findBestMatchPreprocessed (optional)
// ============================================================

function bestMatchAdapter(rs, args) {
    _adapterPath.push('best_match');
    var input = (args || []).join(' ').trim();
    var lang = currentLang || 'vi';
    var threshold = 0.55;

    if (input.length === 0) {
        if (lang === 'en') return { answer: 'Please provide a question to search for.', score: 0 };
        if (lang === 'ja') return { answer: '検索する質問を入力してください。', score: 0 };
        return { answer: 'Vui lòng nhập câu hỏi để tìm kiếm.', score: 0 };
    }

    // Thử dùng preprocessed data trước (nhanh hơn)
    if (typeof findBestMatchPreprocessed === 'function') {
        var ppResult = findBestMatchPreprocessed(input, lang, threshold);
        if (ppResult) return { answer: ppResult.answer, score: ppResult.score || threshold };
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

    if (bestScore >= threshold) return { answer: bestAnswer, score: bestScore };

    if (lang === 'en') return { answer: 'Sorry, I could not find a suitable answer for your question.', score: bestScore };
    if (lang === 'ja') return { answer: '申し訳ありませんが、ご質問に適した回答が見つかりませんでした。', score: bestScore };
    return { answer: 'Xin lỗi, mình không tìm được câu trả lời phù hợp cho câu hỏi của bạn.', score: bestScore };
}

// Node/test: export to globalThis
if (typeof module !== 'undefined' && module.exports) {
    globalThis.bestMatchAdapter = bestMatchAdapter;
}
