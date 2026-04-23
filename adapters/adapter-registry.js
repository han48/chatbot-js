// ============================================================
// Adapter Registry — Metadata, display names, và đăng ký adapter
// Phụ thuộc: currentLang, ADAPTER_REGISTRY (từ data-loader.js / globalThis),
//            bestMatchAdapter, logicAdapterDispatcher, mathematicalEvaluationAdapter,
//            specificResponseAdapter, timeAdapter, unitConversionAdapter
// ============================================================

var ADAPTER_DISPLAY_NAMES = {
    specific_response: { vi: 'Phản hồi cụ thể', en: 'Specific Response', ja: '特定応答' },
    time_adapter: { vi: 'Thời gian', en: 'Time', ja: '時間' },
    mathematical_evaluation: { vi: 'Tính toán', en: 'Math', ja: '数学計算' },
    unit_conversion: { vi: 'Chuyển đổi đơn vị', en: 'Unit Conversion', ja: '単位変換' },
    best_match: { vi: 'Best Match', en: 'Best Match', ja: 'ベストマッチ' },
    logic_adapter: { vi: 'Logic Adapter', en: 'Logic Adapter', ja: 'ロジックアダプター' },
    rivescript: { vi: 'RiveScript', en: 'RiveScript', ja: 'RiveScript' },
    fallback_api: { vi: 'Fallback API', en: 'Fallback API', ja: 'Fallback API' },
    web_search: { vi: 'Tìm kiếm Web', en: 'Web Search', ja: 'ウェブ検索' },
    llm_adapter: { vi: 'LLM (WebGPU)', en: 'LLM (WebGPU)', ja: 'LLM（WebGPU）' }
};

function getAdapterDisplayName(adapterKey) {
    var lang = currentLang || 'vi';
    var names = ADAPTER_DISPLAY_NAMES[adapterKey];
    if (!names) return adapterKey;
    return names[lang] || names['vi'] || adapterKey;
}

function registerAdapters(bot, lang) {
    var ADAPTER_FUNCTIONS = {
        best_match: bestMatchAdapter,
        logic_adapter: logicAdapterDispatcher,
        mathematical_evaluation: mathematicalEvaluationAdapter,
        specific_response: specificResponseAdapter,
        time_adapter: timeAdapter,
        unit_conversion: unitConversionAdapter,
        web_search: webSearchAdapter,
        llm_adapter: llmAdapter
    };

    var adapterNames = Object.keys(ADAPTER_REGISTRY);
    for (var i = 0; i < adapterNames.length; i++) {
        var name = adapterNames[i];
        var entry = ADAPTER_REGISTRY[name];
        var fn = ADAPTER_FUNCTIONS[name];

        if (typeof fn === 'function') {
            // Luôn đăng ký adapter, nhưng wrapper kiểm tra active flag
            (function (adapterKey, adapterFn) {
                bot.setSubroutine(adapterKey, function (rs, args) {
                    // Kiểm tra active flag trước khi gọi adapter
                    if (ADAPTER_REGISTRY[adapterKey] && ADAPTER_REGISTRY[adapterKey].active === false) {
                        // Adapter bị disabled, trả về thông báo
                        if (lang === 'en') return 'This adapter is currently disabled.';
                        if (lang === 'ja') return 'このアダプターは現在無効です。';
                        return 'Adapter này hiện đang bị vô hiệu hóa.';
                    }
                    return adapterFn(rs, args);
                });
            })(name, fn);
        }
    }
}

// Node/test: export to globalThis
if (typeof module !== 'undefined' && module.exports) {
    globalThis.ADAPTER_DISPLAY_NAMES = ADAPTER_DISPLAY_NAMES;
    globalThis.getAdapterDisplayName = getAdapterDisplayName;
    globalThis.registerAdapters = registerAdapters;
}
