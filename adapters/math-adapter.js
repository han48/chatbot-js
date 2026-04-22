// ============================================================
// Mathematical Evaluation Adapter — Tính toán biểu thức toán học
// Phụ thuộc: currentLang, _adapterPath
// ============================================================

/**
 * Trích xuất và tính toán biểu thức toán học từ chuỗi đầu vào.
 * Không sử dụng eval() — dùng regex + switch/case.
 */
function parseMathExpression(input, lang) {
    if (typeof input !== 'string' || input.trim().length === 0) {
        return { error: lang === 'en' ? 'Invalid expression.' : lang === 'ja' ? '無効な式です。' : 'Biểu thức không hợp lệ.' };
    }

    var expr = input.trim();
    if (lang !== 'ja') expr = expr.toLowerCase();

    if (lang === 'vi') {
        expr = expr.replace(/cộng/g, '+').replace(/trừ/g, '-').replace(/nhân/g, '*').replace(/chia/g, '/');
    } else if (lang === 'en') {
        expr = expr.replace(/divided\s+by/g, '/').replace(/plus/g, '+').replace(/minus/g, '-').replace(/times/g, '*');
    } else if (lang === 'ja') {
        expr = expr.replace(/足す/g, '+').replace(/引く/g, '-').replace(/掛ける/g, '*').replace(/割る/g, '/');
    }

    expr = expr.replace(/×/g, '*').replace(/÷/g, '/');

    var match = expr.match(/(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)/);
    if (!match) {
        return { error: lang === 'en' ? 'Cannot parse the mathematical expression.' : lang === 'ja' ? '数式を解析できませんでした。' : 'Không thể phân tích biểu thức toán học.' };
    }

    var a = parseFloat(match[1]);
    var operator = match[2];
    var b = parseFloat(match[3]);
    var result;

    switch (operator) {
        case '+': result = a + b; break;
        case '-': result = a - b; break;
        case '*': result = a * b; break;
        case '/':
            if (b === 0) return { error: lang === 'en' ? 'Cannot divide by zero.' : lang === 'ja' ? 'ゼロで割ることはできません。' : 'Không thể chia cho 0.' };
            result = a / b; break;
        default:
            return { error: lang === 'en' ? 'Unsupported operator.' : lang === 'ja' ? 'サポートされていない演算子です。' : 'Phép tính không được hỗ trợ.' };
    }

    return { result: result };
}

function mathematicalEvaluationAdapter(rs, args) {
    _adapterPath.push('mathematical_evaluation');
    var input = (args || []).join(' ').trim();
    var lang = currentLang || 'vi';

    if (input.length === 0) {
        return lang === 'en' ? 'Please provide a mathematical expression.'
            : lang === 'ja' ? '数式を入力してください。'
            : 'Vui lòng nhập biểu thức toán học.';
    }

    var parsed = parseMathExpression(input, lang);
    if (parsed.error) return parsed.error;

    var resultStr = Number.isInteger(parsed.result) ? String(parsed.result) : parsed.result.toFixed(2).replace(/\.?0+$/, '');

    if (lang === 'en') return 'Result: ' + resultStr;
    if (lang === 'ja') return '結果: ' + resultStr;
    return 'Kết quả: ' + resultStr;
}

// Node/test: export to globalThis
if (typeof module !== 'undefined' && module.exports) {
    globalThis.parseMathExpression = parseMathExpression;
    globalThis.mathematicalEvaluationAdapter = mathematicalEvaluationAdapter;
}
