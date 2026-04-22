#!/usr/bin/env node
// ============================================================
// scripts/preprocess.js — Tiền xử lý dữ liệu cho text similarity
//
// Chạy: node scripts/preprocess.js
// Output: data/preprocessed.json
//
// Script này đọc QA dataset + specific responses + brain .rive files, thực hiện:
// 1. Tokenize (tách từ)
// 2. Normalize (lowercase, bỏ dấu tiếng Việt, bỏ punctuation)
// 3. Tính TF vector cho mỗi câu hỏi
// 4. Tính synonym group indices cho mỗi từ
// 5. Tạo IDF (inverse document frequency) cho toàn bộ corpus
// 6. Tính TF-IDF vector cho mỗi câu hỏi
// 7. Lưu tất cả vào data/preprocessed.json
//
// Khi dữ liệu thay đổi (qa-dataset.json, specific-responses.json, brain/*.rive),
// chạy lại script này để tạo preprocessed.json mới.
// ============================================================

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var QA_DATASET = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'qa-dataset.json'), 'utf8'));
var SPECIFIC_RESPONSES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'specific-responses.json'), 'utf8'));

// --- Parse brain .rive files to extract trigger-response pairs ---
var BRAIN_DIR = path.join(ROOT, 'brain');

/**
 * Parse file .rive và trích xuất các cặp trigger-response.
 * Bỏ qua: trigger wildcard mặc định (*), trigger chứa <call>, trigger chỉ có wildcard.
 */
function parseBrainFile(filePath) {
    var content = fs.readFileSync(filePath, 'utf8');
    var lines = content.split('\n');
    var pairs = [];
    var currentTrigger = null;

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();

        // Skip comments and empty lines
        if (line.indexOf('//') === 0 || line.length === 0) continue;
        // Skip directives (! version, ! var)
        if (line.indexOf('!') === 0) continue;

        if (line.indexOf('+ ') === 0) {
            currentTrigger = line.substring(2).trim();
        } else if (line.indexOf('- ') === 0 && currentTrigger) {
            var response = line.substring(2).trim();

            // Bỏ qua trigger wildcard mặc định
            if (currentTrigger === '*') { currentTrigger = null; continue; }
            // Bỏ qua response chứa <call> (adapter calls, không phải text response)
            if (response.indexOf('<call>') !== -1) { currentTrigger = null; continue; }
            // Bỏ qua trigger chỉ chứa wildcard (ví dụ: "* la ai")
            var nonWild = currentTrigger.replace(/\*/g, '').trim();
            if (nonWild.length < 2) { currentTrigger = null; continue; }

            pairs.push({ trigger: currentTrigger, response: response });
            currentTrigger = null;
        }
    }
    return pairs;
}

// --- Vietnamese diacritics removal (copy from app.js) ---
var VIETNAMESE_DIACRITICS_MAP = {
    'à':'a','á':'a','ả':'a','ã':'a','ạ':'a',
    'ă':'a','ằ':'a','ắ':'a','ẳ':'a','ẵ':'a','ặ':'a',
    'â':'a','ầ':'a','ấ':'a','ẩ':'a','ẫ':'a','ậ':'a',
    'đ':'d',
    'è':'e','é':'e','ẻ':'e','ẽ':'e','ẹ':'e',
    'ê':'e','ề':'e','ế':'e','ể':'e','ễ':'e','ệ':'e',
    'ì':'i','í':'i','ỉ':'i','ĩ':'i','ị':'i',
    'ò':'o','ó':'o','ỏ':'o','õ':'o','ọ':'o',
    'ô':'o','ồ':'o','ố':'o','ổ':'o','ỗ':'o','ộ':'o',
    'ơ':'o','ờ':'o','ớ':'o','ở':'o','ỡ':'o','ợ':'o',
    'ù':'u','ú':'u','ủ':'u','ũ':'u','ụ':'u',
    'ư':'u','ừ':'u','ứ':'u','ử':'u','ữ':'u','ự':'u',
    'ỳ':'y','ý':'y','ỷ':'y','ỹ':'y','ỵ':'y'
};

function removeDiacritics(str) {
    var result = '';
    for (var i = 0; i < str.length; i++) {
        var ch = str[i];
        result += VIETNAMESE_DIACRITICS_MAP[ch] || ch;
    }
    return result;
}

// --- Synonym groups (copy from text-similarity.js) ---
var SYNONYM_GROUPS = [
    ['xin chao','chao','hi','hello','hey','yo'],
    ['tam biet','bye','goodbye','hen gap lai','tot lanh'],
    ['cam on','thanks','thank','thank you'],
    ['ten','name','ai','who','la ai'],
    ['lam gi','lam duoc','co the','giup','help','what can'],
    ['may gio','gio','time','clock','bao gio'],
    ['ngay','hom nay','date','today','ngay may'],
    ['thu','thu may','day','what day'],
    ['tinh','calculate','math','cong','tru','nhan','chia','plus','minus'],
    ['doi','convert','sang','to','chuyen doi'],
    ['chatbot','bot','ai','robot','may','machine'],
    ['la gi','what is','what','gi','mean'],
    ['khoe','vui','happy','fine','good','ok'],
    ['tuoi','age','old','bao nhieu tuoi'],
    ['o dau','where','dau','location'],
    ['thich','like','love','yeu'],
    ['huong dan','cach','how','guide','help','su dung','use']
];

var synonymLookup = {};
for (var g = 0; g < SYNONYM_GROUPS.length; g++) {
    for (var w = 0; w < SYNONYM_GROUPS[g].length; w++) {
        var word = SYNONYM_GROUPS[g][w].toLowerCase();
        if (!synonymLookup[word]) synonymLookup[word] = [];
        synonymLookup[word].push(g);
    }
}

// --- Preprocessing functions ---

function tokenize(text, lang) {
    var s = text.toLowerCase();
    if (lang === 'vi') s = removeDiacritics(s);
    s = s.replace(/[?!.,;:"""''`~()[\]{}\\|@#$%^&]/g, ' ');
    return s.split(/\s+/).filter(function(w) { return w.length > 0; });
}

function buildTF(tokens) {
    var tf = {};
    for (var i = 0; i < tokens.length; i++) {
        tf[tokens[i]] = (tf[tokens[i]] || 0) + 1;
    }
    return tf;
}

function getSynonymGroupIndices(tokens) {
    var indices = {};
    for (var i = 0; i < tokens.length; i++) {
        var groups = synonymLookup[tokens[i]];
        if (groups) {
            for (var j = 0; j < groups.length; j++) {
                indices[groups[j]] = true;
            }
        }
    }
    return Object.keys(indices).map(Number);
}

// --- Build IDF from entire corpus ---

function buildCorpusIDF(allDocs) {
    var docCount = allDocs.length;
    var df = {}; // document frequency: word → number of docs containing it
    for (var d = 0; d < allDocs.length; d++) {
        var seen = {};
        for (var t = 0; t < allDocs[d].length; t++) {
            var word = allDocs[d][t];
            if (!seen[word]) {
                df[word] = (df[word] || 0) + 1;
                seen[word] = true;
            }
        }
    }
    // IDF = log(N / df) + 1 (smoothed)
    var idf = {};
    for (var w in df) {
        idf[w] = Math.log(docCount / df[w]) + 1;
    }
    return idf;
}

function buildTFIDF(tf, idf) {
    var tfidf = {};
    for (var word in tf) {
        tfidf[word] = tf[word] * (idf[word] || 1);
    }
    return tfidf;
}

function vectorMagnitude(vec) {
    var sum = 0;
    for (var k in vec) sum += vec[k] * vec[k];
    return Math.sqrt(sum);
}

// --- Main preprocessing ---

console.log('Preprocessing data...');

var output = { version: Date.now(), langs: {} };

var LANGS = ['vi', 'en', 'ja'];

for (var li = 0; li < LANGS.length; li++) {
    var lang = LANGS[li];
    console.log('  Processing language:', lang);

    // Collect all statements (QA questions + specific response keys + brain triggers)
    var statements = [];

    // From QA dataset
    var qaData = QA_DATASET[lang] || [];
    for (var qi = 0; qi < qaData.length; qi++) {
        statements.push({ source: 'qa', index: qi, text: qaData[qi].q, answer: qaData[qi].a });
    }

    // From specific responses
    var specData = SPECIFIC_RESPONSES[lang] || {};
    var specKeys = Object.keys(specData);
    for (var si = 0; si < specKeys.length; si++) {
        statements.push({ source: 'specific', index: si, text: specKeys[si], answer: specData[specKeys[si]] });
    }

    // From brain .rive files (trigger-response pairs)
    var brainFile = path.join(BRAIN_DIR, lang + '.rive');
    if (fs.existsSync(brainFile)) {
        var brainPairs = parseBrainFile(brainFile);
        var seenTriggers = {};
        for (var bi = 0; bi < brainPairs.length; bi++) {
            var trigger = brainPairs[bi].trigger;
            // Bỏ wildcard suffix/prefix để lấy phần text chính (ví dụ: "xin chao *" → "xin chao")
            var cleanTrigger = trigger.replace(/\*/g, '').trim();
            if (cleanTrigger.length < 2) continue;
            // Dedup: chỉ giữ trigger đầu tiên nếu trùng text
            if (seenTriggers[cleanTrigger]) continue;
            seenTriggers[cleanTrigger] = true;
            statements.push({ source: 'brain', index: bi, text: cleanTrigger, answer: brainPairs[bi].response });
        }
        console.log('    Brain triggers:', Object.keys(seenTriggers).length);
    }

    // Tokenize all statements
    var allTokens = [];
    var processed = [];
    for (var i = 0; i < statements.length; i++) {
        var stmt = statements[i];
        var tokens = tokenize(stmt.text, lang);
        var tf = buildTF(tokens);
        var synGroups = getSynonymGroupIndices(tokens);

        allTokens.push(tokens);
        processed.push({
            source: stmt.source,
            originalText: stmt.text,
            answer: stmt.answer,
            tokens: tokens,
            tf: tf,
            synGroups: synGroups
            // tfidf and magnitude will be added after IDF is computed
        });
    }

    // Build IDF from all documents in this language
    var idf = buildCorpusIDF(allTokens);

    // Compute TF-IDF vectors and magnitudes
    for (var j = 0; j < processed.length; j++) {
        processed[j].tfidf = buildTFIDF(processed[j].tf, idf);
        processed[j].magnitude = vectorMagnitude(processed[j].tfidf);
    }

    output.langs[lang] = {
        idf: idf,
        statements: processed
    };

    console.log('    Statements:', processed.length, '| Vocab size:', Object.keys(idf).length);
}

// Write output
var outputPath = path.join(ROOT, 'data', 'preprocessed.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
console.log('Done! Output:', outputPath);
console.log('Version:', output.version);
