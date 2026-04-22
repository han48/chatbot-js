// ============================================================
// Text Similarity — Thuật toán so khớp chuỗi
// Gồm 4 thuật toán: Levenshtein, Jaccard, Cosine, Synset
// + Preprocessed data support (TF-IDF, pre-tokenized)
// ============================================================

// --- Preprocessed data cache ---
// Loaded from data/preprocessed.json (build-time) hoặc localStorage (client)
var _preprocessedData = null;
var _PREPROCESSED_STORAGE_KEY = 'hikari_preprocessed';

/**
 * Load preprocessed data.
 * - Browser: thử localStorage trước, nếu không có hoặc outdated thì fetch từ server
 * - Node/test: load trực tiếp từ file
 * @returns {Promise<void>}
 */
async function loadPreprocessedData() {
    // Node/test environment
    if (typeof module !== 'undefined' && module.exports) {
        try {
            var fs = require('fs');
            var path = require('path');
            var filePath = path.join(__dirname, '..', 'data', 'preprocessed.json');
            _preprocessedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            _preprocessedData = null;
        }
        return;
    }

    // Browser: thử localStorage
    try {
        var cached = localStorage.getItem(_PREPROCESSED_STORAGE_KEY);
        if (cached) {
            var parsed = JSON.parse(cached);
            // Fetch version từ server để check outdated
            var resp = await fetch('data/preprocessed.json', { method: 'HEAD' });
            // Dùng Last-Modified hoặc so sánh version
            if (parsed && parsed.version) {
                _preprocessedData = parsed;
                // Background check: fetch full file và so sánh version
                fetch('data/preprocessed.json').then(function(r) { return r.json(); }).then(function(fresh) {
                    if (fresh.version !== parsed.version) {
                        _preprocessedData = fresh;
                        localStorage.setItem(_PREPROCESSED_STORAGE_KEY, JSON.stringify(fresh));
                    }
                }).catch(function() {});
                return;
            }
        }
    } catch (e) { /* localStorage not available */ }

    // Browser: fetch từ server
    try {
        var response = await fetch('data/preprocessed.json');
        if (response.ok) {
            _preprocessedData = await response.json();
            try {
                localStorage.setItem(_PREPROCESSED_STORAGE_KEY, JSON.stringify(_preprocessedData));
            } catch (e) { /* quota exceeded */ }
        }
    } catch (e) {
        _preprocessedData = null;
    }
}

/**
 * Lấy preprocessed data cho ngôn ngữ hiện tại.
 * @param {string} lang
 * @returns {object|null} { idf, statements } hoặc null
 */
function getPreprocessedLang(lang) {
    if (!_preprocessedData || !_preprocessedData.langs) return null;
    return _preprocessedData.langs[lang] || null;
}

// ---- Tokenize (dùng cho input mới) ----

/**
 * Tokenize input text: lowercase, bỏ dấu (vi), bỏ punctuation, tách từ.
 * Dùng cùng logic với scripts/preprocess.js để đảm bảo consistency.
 * @param {string} text
 * @param {string} lang
 * @returns {string[]}
 */
function tokenizeForSimilarity(text, lang) {
    var s = String(text).toLowerCase();
    if (lang === 'vi' && typeof removeVietnameseDiacritics === 'function') {
        s = removeVietnameseDiacritics(s);
    }
    s = s.replace(/[?!.,;:"""''`~()[\]{}\\|@#$%^&]/g, ' ');
    return s.split(/\s+/).filter(function(w) { return w.length > 0; });
}

// ---- 1. Levenshtein Distance ----

function levenshteinDistance(a, b) {
    var strA = String(a);
    var strB = String(b);
    var lenA = strA.length;
    var lenB = strB.length;

    if (lenA === 0) return lenB;
    if (lenB === 0) return lenA;

    var prev = [];
    var curr = [];
    var i, j;

    for (j = 0; j <= lenB; j++) prev[j] = j;

    for (i = 1; i <= lenA; i++) {
        curr[0] = i;
        for (j = 1; j <= lenB; j++) {
            if (strA[i - 1] === strB[j - 1]) {
                curr[j] = prev[j - 1];
            } else {
                curr[j] = 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
            }
        }
        var tmp = prev;
        prev = curr;
        curr = tmp;
    }
    return prev[lenB];
}

// ---- 2. Jaccard Similarity ----

function jaccardSimilarity(a, b) {
    var wordsA = String(a).toLowerCase().trim().split(/\s+/).filter(function(w) { return w.length > 0; });
    var wordsB = String(b).toLowerCase().trim().split(/\s+/).filter(function(w) { return w.length > 0; });

    if (wordsA.length === 0 && wordsB.length === 0) return 0;

    var setA = {}, setB = {}, i;
    for (i = 0; i < wordsA.length; i++) setA[wordsA[i]] = true;
    for (i = 0; i < wordsB.length; i++) setB[wordsB[i]] = true;

    var intersection = 0, union = {};
    for (var k1 in setA) { union[k1] = true; if (setB[k1]) intersection++; }
    for (var k2 in setB) { union[k2] = true; }

    var unionSize = Object.keys(union).length;
    return unionSize === 0 ? 0 : intersection / unionSize;
}

// ---- 3. Cosine Similarity ----

function cosineSimilarity(a, b) {
    var wordsA = String(a).toLowerCase().trim().split(/\s+/).filter(function(w) { return w.length > 0; });
    var wordsB = String(b).toLowerCase().trim().split(/\s+/).filter(function(w) { return w.length > 0; });

    if (wordsA.length === 0 || wordsB.length === 0) return 0;

    var tfA = {}, tfB = {}, i;
    for (i = 0; i < wordsA.length; i++) tfA[wordsA[i]] = (tfA[wordsA[i]] || 0) + 1;
    for (i = 0; i < wordsB.length; i++) tfB[wordsB[i]] = (tfB[wordsB[i]] || 0) + 1;

    var vocab = {};
    for (var ka in tfA) vocab[ka] = true;
    for (var kb in tfB) vocab[kb] = true;

    var dot = 0, magA = 0, magB = 0;
    var keys = Object.keys(vocab);
    for (i = 0; i < keys.length; i++) {
        var va = tfA[keys[i]] || 0;
        var vb = tfB[keys[i]] || 0;
        dot += va * vb;
        magA += va * va;
        magB += vb * vb;
    }

    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);
    return (magA === 0 || magB === 0) ? 0 : dot / (magA * magB);
}

/**
 * Cosine similarity sử dụng TF-IDF vectors (preprocessed).
 * Input vector được tính on-the-fly, corpus vector đã preprocessed.
 * @param {object} inputTFIDF - TF-IDF vector của input
 * @param {number} inputMag - Magnitude của input vector
 * @param {object} corpusTFIDF - TF-IDF vector đã preprocessed
 * @param {number} corpusMag - Magnitude đã preprocessed
 * @returns {number} [0, 1]
 */
function cosineSimilarityTFIDF(inputTFIDF, inputMag, corpusTFIDF, corpusMag) {
    if (inputMag === 0 || corpusMag === 0) return 0;

    var dot = 0;
    // Iterate over smaller vector for efficiency
    for (var word in inputTFIDF) {
        if (corpusTFIDF[word]) {
            dot += inputTFIDF[word] * corpusTFIDF[word];
        }
    }
    return dot / (inputMag * corpusMag);
}

// ---- 4. Synset Similarity ----

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

var _synonymLookup = null;
function _getSynonymLookup() {
    if (_synonymLookup) return _synonymLookup;
    _synonymLookup = {};
    for (var g = 0; g < SYNONYM_GROUPS.length; g++) {
        for (var w = 0; w < SYNONYM_GROUPS[g].length; w++) {
            var word = SYNONYM_GROUPS[g][w].toLowerCase();
            if (!_synonymLookup[word]) _synonymLookup[word] = [];
            _synonymLookup[word].push(g);
        }
    }
    return _synonymLookup;
}

function areSynonyms(wordA, wordB) {
    if (wordA === wordB) return true;
    var lookup = _getSynonymLookup();
    var groupsA = lookup[wordA];
    var groupsB = lookup[wordB];
    if (!groupsA || !groupsB) return false;
    for (var i = 0; i < groupsA.length; i++) {
        for (var j = 0; j < groupsB.length; j++) {
            if (groupsA[i] === groupsB[j]) return true;
        }
    }
    return false;
}

function synsetSimilarity(a, b) {
    var wordsA = String(a).toLowerCase().trim().split(/\s+/).filter(function(w) { return w.length > 0; });
    var wordsB = String(b).toLowerCase().trim().split(/\s+/).filter(function(w) { return w.length > 0; });

    if (wordsA.length === 0 || wordsB.length === 0) return 0;

    var matchAtoB = 0;
    for (var i = 0; i < wordsA.length; i++) {
        for (var j = 0; j < wordsB.length; j++) {
            if (areSynonyms(wordsA[i], wordsB[j])) { matchAtoB++; break; }
        }
    }
    var matchBtoA = 0;
    for (var m = 0; m < wordsB.length; m++) {
        for (var n = 0; n < wordsA.length; n++) {
            if (areSynonyms(wordsB[m], wordsA[n])) { matchBtoA++; break; }
        }
    }

    return ((matchAtoB / wordsA.length) + (matchBtoA / wordsB.length)) / 2;
}

/**
 * Synset similarity sử dụng preprocessed synonym group indices.
 * So sánh overlap giữa synGroups của input và corpus statement.
 * @param {number[]} inputGroups - Synonym group indices của input
 * @param {number[]} corpusGroups - Synonym group indices đã preprocessed
 * @returns {number} [0, 1]
 */
function synsetSimilarityPreprocessed(inputGroups, corpusGroups) {
    if (inputGroups.length === 0 && corpusGroups.length === 0) return 0;
    if (inputGroups.length === 0 || corpusGroups.length === 0) return 0;

    var setB = {};
    for (var j = 0; j < corpusGroups.length; j++) setB[corpusGroups[j]] = true;

    var overlap = 0;
    for (var i = 0; i < inputGroups.length; i++) {
        if (setB[inputGroups[i]]) overlap++;
    }

    var total = {};
    for (var a = 0; a < inputGroups.length; a++) total[inputGroups[a]] = true;
    for (var b = 0; b < corpusGroups.length; b++) total[corpusGroups[b]] = true;
    var unionSize = Object.keys(total).length;

    return unionSize === 0 ? 0 : overlap / unionSize;
}

// ---- Combined: textSimilarity (general purpose) ----

function textSimilarity(a, b) {
    var strA = String(a);
    var strB = String(b);

    if (strA === strB && strA.length > 0) return 1.0;
    if (strA.length === 0 && strB.length === 0) return 0;

    var maxLen = Math.max(strA.length, strB.length);
    var levSim = maxLen > 0 ? 1 - (levenshteinDistance(strA, strB) / maxLen) : 0;
    var jacSim = jaccardSimilarity(strA, strB);
    var cosSim = cosineSimilarity(strA, strB);
    var synSim = synsetSimilarity(strA, strB);

    return Math.max(0, Math.min(1, (levSim + jacSim + cosSim + synSim) / 4));
}

// ---- Optimized: findBestMatchPreprocessed ----

/**
 * Tìm câu trả lời phù hợp nhất từ preprocessed data.
 * Sử dụng TF-IDF cosine + synset preprocessed + Jaccard + Levenshtein.
 * Nhanh hơn textSimilarity() vì corpus đã được tiền xử lý.
 *
 * @param {string} input - Input người dùng (raw)
 * @param {string} lang - Ngôn ngữ hiện tại
 * @param {number} threshold - Ngưỡng similarity (mặc định 0.3)
 * @returns {{answer: string, score: number}|null} Kết quả hoặc null
 */
function findBestMatchPreprocessed(input, lang, threshold) {
    threshold = threshold || 0.3;
    var ppLang = getPreprocessedLang(lang);
    if (!ppLang) return null; // Fallback: caller sẽ dùng textSimilarity thường

    var idf = ppLang.idf;
    var statements = ppLang.statements;

    // Tokenize input
    var inputTokens = tokenizeForSimilarity(input, lang);
    if (inputTokens.length === 0) return null;

    // Build input TF
    var inputTF = {};
    for (var t = 0; t < inputTokens.length; t++) {
        inputTF[inputTokens[t]] = (inputTF[inputTokens[t]] || 0) + 1;
    }

    // Build input TF-IDF
    var inputTFIDF = {};
    for (var word in inputTF) {
        inputTFIDF[word] = inputTF[word] * (idf[word] || 1);
    }
    var inputMag = 0;
    for (var w in inputTFIDF) inputMag += inputTFIDF[w] * inputTFIDF[w];
    inputMag = Math.sqrt(inputMag);

    // Build input synonym groups
    var lookup = _getSynonymLookup();
    var inputSynGroups = [];
    var seenGroups = {};
    for (var s = 0; s < inputTokens.length; s++) {
        var groups = lookup[inputTokens[s]];
        if (groups) {
            for (var gi = 0; gi < groups.length; gi++) {
                if (!seenGroups[groups[gi]]) {
                    inputSynGroups.push(groups[gi]);
                    seenGroups[groups[gi]] = true;
                }
            }
        }
    }

    // Input normalized string (for Levenshtein/Jaccard)
    var inputNorm = inputTokens.join(' ');

    // Compare with all preprocessed statements
    var bestScore = -1;
    var bestAnswer = null;

    for (var i = 0; i < statements.length; i++) {
        var stmt = statements[i];
        var stmtNorm = stmt.tokens.join(' ');

        // 1. Levenshtein similarity
        var maxLen = Math.max(inputNorm.length, stmtNorm.length);
        var levSim = maxLen > 0 ? 1 - (levenshteinDistance(inputNorm, stmtNorm) / maxLen) : 0;

        // 2. Jaccard (on tokens)
        var jacSim = jaccardSimilarity(inputNorm, stmtNorm);

        // 3. TF-IDF Cosine (preprocessed)
        var cosSim = cosineSimilarityTFIDF(inputTFIDF, inputMag, stmt.tfidf, stmt.magnitude);

        // 4. Synset (preprocessed)
        var synSim = synsetSimilarityPreprocessed(inputSynGroups, stmt.synGroups);

        var score = (levSim + jacSim + cosSim + synSim) / 4;

        if (score > bestScore) {
            bestScore = score;
            bestAnswer = stmt.answer;
        }
    }

    if (bestScore >= threshold) {
        return { answer: bestAnswer, score: bestScore };
    }
    return null;
}

// Node/test: export to globalThis
if (typeof module !== 'undefined' && module.exports) {
    globalThis.levenshteinDistance = levenshteinDistance;
    globalThis.jaccardSimilarity = jaccardSimilarity;
    globalThis.cosineSimilarity = cosineSimilarity;
    globalThis.cosineSimilarityTFIDF = cosineSimilarityTFIDF;
    globalThis.synsetSimilarity = synsetSimilarity;
    globalThis.synsetSimilarityPreprocessed = synsetSimilarityPreprocessed;
    globalThis.areSynonyms = areSynonyms;
    globalThis.SYNONYM_GROUPS = SYNONYM_GROUPS;
    globalThis.textSimilarity = textSimilarity;
    globalThis.loadPreprocessedData = loadPreprocessedData;
    globalThis.getPreprocessedLang = getPreprocessedLang;
    globalThis.findBestMatchPreprocessed = findBestMatchPreprocessed;
    globalThis.tokenizeForSimilarity = tokenizeForSimilarity;
}
