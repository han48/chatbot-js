// ============================================================
// Web Search Adapter — Tìm kiếm web và trả kết quả
// Phụ thuộc: currentLang, _adapterPath
//
// Chiến lược (không cần API key, không cần CORS proxy):
// 1. DuckDuckGo Instant Answer API (có CORS headers, trả tóm tắt Wikipedia)
// 2. Fallback → link tìm kiếm clickable (Google + DuckDuckGo + Bing)
//
// Tùy chọn: Google Custom Search API (cần GOOGLE_API_KEY + GOOGLE_CX)
// ============================================================

var GOOGLE_API_KEY = '';
var GOOGLE_CX = '';
var WEB_SEARCH_TIMEOUT = 5000;

// ---- DuckDuckGo Instant Answer API ----

async function duckDuckGoSearch(query) {
    // DDG API hỗ trợ CORS — gọi trực tiếp từ browser
    var url = 'https://api.duckduckgo.com/?q=' + encodeURIComponent(query)
        + '&format=json&no_html=1&skip_disambig=1';

    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, WEB_SEARCH_TIMEOUT);

    try {
        var response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return null;
        var data = await response.json();

        var results = {
            abstract: data.Abstract || '',
            abstractSource: data.AbstractSource || '',
            abstractURL: data.AbstractURL || '',
            answer: data.Answer || '',
            definition: data.Definition || '',
            definitionSource: data.DefinitionSource || '',
            definitionURL: data.DefinitionURL || '',
            related: []
        };

        if (data.RelatedTopics) {
            for (var i = 0; i < Math.min(data.RelatedTopics.length, 5); i++) {
                var topic = data.RelatedTopics[i];
                if (topic && topic.Text) {
                    results.related.push({ text: topic.Text, url: topic.FirstURL || '' });
                }
            }
        }

        if (!results.abstract && !results.answer && !results.definition && results.related.length === 0) {
            return null;
        }
        return results;
    } catch (err) {
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

// ---- Google Custom Search API (cần key) ----

async function googleSearch(query, numResults) {
    if (!GOOGLE_API_KEY || !GOOGLE_CX) return null;
    numResults = numResults || 3;
    var url = 'https://www.googleapis.com/customsearch/v1'
        + '?key=' + encodeURIComponent(GOOGLE_API_KEY)
        + '&cx=' + encodeURIComponent(GOOGLE_CX)
        + '&q=' + encodeURIComponent(query)
        + '&num=' + numResults;

    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, WEB_SEARCH_TIMEOUT);

    try {
        var response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return null;
        var data = await response.json();
        if (!data.items || data.items.length === 0) return null;
        return data.items.map(function (item) {
            return { title: item.title || '', link: item.link || '', snippet: item.snippet || '' };
        });
    } catch (err) {
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

// ---- Format ----

function formatDDGResults(results, query, lang) {
    var lines = [];
    if (lang === 'en') lines.push('🔍 Search results for "' + query + '":');
    else if (lang === 'ja') lines.push('🔍 「' + query + '」の検索結果:');
    else lines.push('🔍 Kết quả tìm kiếm "' + query + '":');

    if (results.answer) lines.push('💡 ' + results.answer);

    if (results.abstract) {
        lines.push('\n' + results.abstract);
        if (results.abstractSource && results.abstractURL) {
            lines.push('📖 Nguồn: ' + results.abstractSource + ' — ' + results.abstractURL);
        }
    }

    if (results.definition) {
        lines.push('📝 ' + results.definition);
        if (results.definitionSource) lines.push('   — ' + results.definitionSource);
    }

    if (results.related.length > 0) {
        lines.push('');
        if (lang === 'en') lines.push('Related:');
        else if (lang === 'ja') lines.push('関連:');
        else lines.push('Liên quan:');
        for (var i = 0; i < results.related.length; i++) {
            var r = results.related[i];
            lines.push('• ' + r.text);
            if (r.url) lines.push('  🔗 ' + r.url);
        }
    }

    // Luôn thêm link tìm kiếm đầy đủ
    lines.push('');
    lines.push(_searchLinksOnly(query));

    return lines.join('\n');
}

function formatGoogleResults(results, query, lang) {
    var lines = [];
    if (lang === 'en') lines.push('🔍 Search results for "' + query + '":');
    else if (lang === 'ja') lines.push('🔍 「' + query + '」の検索結果:');
    else lines.push('🔍 Kết quả tìm kiếm "' + query + '":');

    for (var i = 0; i < results.length; i++) {
        lines.push((i + 1) + '. ' + results[i].title);
        if (results[i].snippet) lines.push('   ' + results[i].snippet);
        if (results[i].link) lines.push('   🔗 ' + results[i].link);
    }
    return lines.join('\n');
}

function formatSearchLinks(query, lang) {
    var lines = [];
    if (lang === 'en') lines.push('🔍 Here are search links for "' + query + '":');
    else if (lang === 'ja') lines.push('🔍 「' + query + '」の検索リンク:');
    else lines.push('🔍 Link tìm kiếm "' + query + '":');

    lines.push(_searchLinksOnly(query));
    return lines.join('\n');
}

function _searchLinksOnly(query) {
    var encoded = encodeURIComponent(query);
    return '🌐 Google: https://www.google.com/search?q=' + encoded
        + '\n🦆 DuckDuckGo: https://duckduckgo.com/?q=' + encoded
        + '\n🔵 Bing: https://www.bing.com/search?q=' + encoded;
}

// ---- Web Search Adapter ----

function webSearchAdapter(rs, args) {
    _adapterPath.push('web_search');
    var query = (args || []).join(' ').trim();
    var lang = currentLang || 'vi';

    if (query.length === 0) {
        if (lang === 'en') return Promise.resolve('Please provide a search query.');
        if (lang === 'ja') return Promise.resolve('検索キーワードを入力してください。');
        return Promise.resolve('Vui lòng nhập từ khóa tìm kiếm.');
    }

    // Ưu tiên Google nếu có key
    if (GOOGLE_API_KEY && GOOGLE_CX) {
        return googleSearch(query).then(function (results) {
            if (results) return formatGoogleResults(results, query, lang);
            return _ddgFallback(query, lang);
        }).catch(function () {
            return _ddgFallback(query, lang);
        });
    }

    return _ddgFallback(query, lang);
}

function _ddgFallback(query, lang) {
    return duckDuckGoSearch(query).then(function (results) {
        if (results) return formatDDGResults(results, query, lang);
        // DDG không có instant answer → trả link tìm kiếm
        return formatSearchLinks(query, lang);
    }).catch(function () {
        return formatSearchLinks(query, lang);
    });
}

// Node/test: export to globalThis
if (typeof module !== 'undefined' && module.exports) {
    globalThis.GOOGLE_API_KEY = GOOGLE_API_KEY;
    globalThis.GOOGLE_CX = GOOGLE_CX;
    globalThis.duckDuckGoSearch = duckDuckGoSearch;
    globalThis.googleSearch = googleSearch;
    globalThis.webSearchAdapter = webSearchAdapter;
    globalThis.formatSearchLinks = formatSearchLinks;
}
