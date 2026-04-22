// ============================================================
// Unit Conversion Adapter — Chuyển đổi đơn vị đo lường
// Phụ thuộc: currentLang, _adapterPath
// ============================================================

var CONVERSION_FACTORS = {
    length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mile: 1609.344, yard: 0.9144, foot: 0.3048, inch: 0.0254 },
    mass: { kg: 1, g: 0.001, mg: 0.000001, pound: 0.453592, ounce: 0.0283495 }
};

var TEMPERATURE_UNITS = {
    celsius: 'celsius', c: 'celsius',
    fahrenheit: 'fahrenheit', f: 'fahrenheit',
    kelvin: 'kelvin', k: 'kelvin'
};

function convertTemperature(value, from, to) {
    if (from === to) return value;
    var celsius;
    if (from === 'celsius') celsius = value;
    else if (from === 'fahrenheit') celsius = (value - 32) * 5 / 9;
    else celsius = value - 273.15;

    if (to === 'celsius') return celsius;
    if (to === 'fahrenheit') return (celsius * 9 / 5) + 32;
    return celsius + 273.15;
}

function convertUnit(value, fromUnit, toUnit) {
    var from = String(fromUnit).toLowerCase().trim();
    var to = String(toUnit).toLowerCase().trim();
    if (from === to) return value;

    var fromTemp = TEMPERATURE_UNITS[from];
    var toTemp = TEMPERATURE_UNITS[to];
    if (fromTemp && toTemp) return convertTemperature(value, fromTemp, toTemp);
    if (fromTemp || toTemp) return null;

    var categories = Object.keys(CONVERSION_FACTORS);
    for (var i = 0; i < categories.length; i++) {
        var factors = CONVERSION_FACTORS[categories[i]];
        if (factors[from] !== undefined && factors[to] !== undefined) {
            return value * (factors[from] / factors[to]);
        }
    }
    return null;
}

function parseConversionRequest(input, lang) {
    if (typeof input !== 'string' || input.trim().length === 0) return null;
    var text = input.trim();

    var separators;
    if (lang === 'ja') separators = ['に変換', 'は何', 'を'];
    else if (lang === 'en') separators = ['convert', ' to ', ' in '];
    else separators = [' sang ', ' ra '];

    for (var i = 0; i < separators.length; i++) {
        var sep = separators[i];
        var idx = text.toLowerCase().indexOf(sep.toLowerCase());
        if (idx === -1) continue;

        var leftPart = text.substring(0, idx).trim();
        var rightPart = text.substring(idx + sep.length).trim();
        if (leftPart.length === 0 || rightPart.length === 0) continue;

        var leftMatch = leftPart.match(/(-?\d+(?:\.\d+)?)\s*(.+)/);
        if (!leftMatch) continue;

        var value = parseFloat(leftMatch[1]);
        var fromUnit = leftMatch[2].trim().toLowerCase();
        var toUnit = rightPart.trim().toLowerCase();
        if (isNaN(value)) continue;

        return { value: value, from: fromUnit, to: toUnit };
    }
    return null;
}

function getSupportedUnits() {
    var units = [];
    var categories = Object.keys(CONVERSION_FACTORS);
    for (var i = 0; i < categories.length; i++) {
        units = units.concat(Object.keys(CONVERSION_FACTORS[categories[i]]));
    }
    units = units.concat(['celsius', 'fahrenheit', 'kelvin', 'c', 'f', 'k']);
    return units.join(', ');
}

function unitConversionAdapter(rs, args) {
    _adapterPath.push('unit_conversion');
    var input = (args || []).join(' ').trim();
    var lang = currentLang || 'vi';

    if (input.length === 0) {
        if (lang === 'en') return 'Please provide a conversion request (e.g., "5 km to m").';
        if (lang === 'ja') return '変換リクエストを入力してください（例: 「5 km を m」）。';
        return 'Vui lòng nhập yêu cầu chuyển đổi (ví dụ: "5 km sang m").';
    }

    var parsed = parseConversionRequest(input, lang);
    if (!parsed) {
        if (lang === 'en') return 'Invalid syntax. Example: "5 km to m", "100 fahrenheit to celsius".';
        if (lang === 'ja') return '構文が無効です。例: 「5 km を m」、「100 fahrenheit を celsius」。';
        return 'Cú pháp không hợp lệ. Ví dụ: "5 km sang m", "100 fahrenheit sang celsius".';
    }

    var allUnits = {};
    var categories = Object.keys(CONVERSION_FACTORS);
    for (var i = 0; i < categories.length; i++) {
        var catUnits = Object.keys(CONVERSION_FACTORS[categories[i]]);
        for (var j = 0; j < catUnits.length; j++) allUnits[catUnits[j]] = true;
    }
    var tempKeys = Object.keys(TEMPERATURE_UNITS);
    for (var t = 0; t < tempKeys.length; t++) allUnits[tempKeys[t]] = true;

    if (!allUnits[parsed.from.toLowerCase()] || !allUnits[parsed.to.toLowerCase()]) {
        var supported = getSupportedUnits();
        if (lang === 'en') return 'Unsupported unit. Supported units: ' + supported;
        if (lang === 'ja') return 'サポートされていない単位です。対応単位: ' + supported;
        return 'Đơn vị không được hỗ trợ. Các đơn vị hỗ trợ: ' + supported;
    }

    var result = convertUnit(parsed.value, parsed.from.toLowerCase(), parsed.to.toLowerCase());
    if (result === null) {
        var supported2 = getSupportedUnits();
        if (lang === 'en') return 'Cannot convert between incompatible units. Supported units: ' + supported2;
        if (lang === 'ja') return '互換性のない単位間の変換はできません。対応単位: ' + supported2;
        return 'Không thể chuyển đổi giữa các đơn vị không tương thích. Các đơn vị hỗ trợ: ' + supported2;
    }

    var resultStr = Number.isInteger(result) ? String(result) : result.toFixed(4).replace(/\.?0+$/, '');
    return parsed.value + ' ' + parsed.from + ' = ' + resultStr + ' ' + parsed.to;
}

// Node/test: export to globalThis
if (typeof module !== 'undefined' && module.exports) {
    globalThis.CONVERSION_FACTORS = CONVERSION_FACTORS;
    globalThis.TEMPERATURE_UNITS = TEMPERATURE_UNITS;
    globalThis.convertTemperature = convertTemperature;
    globalThis.convertUnit = convertUnit;
    globalThis.parseConversionRequest = parseConversionRequest;
    globalThis.getSupportedUnits = getSupportedUnits;
    globalThis.unitConversionAdapter = unitConversionAdapter;
}
