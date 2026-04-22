// ============================================================
// Time Adapter — Trả lời câu hỏi thời gian/ngày tháng/thứ
// Phụ thuộc: currentLang, _adapterPath
// ============================================================

var TIME_KEYWORDS = {
    vi: { time: ['mấy giờ', 'giờ', 'thời gian'], date: ['ngày mấy', 'hôm nay', 'ngày tháng'], day: ['thứ mấy', 'thứ'] },
    en: { time: ['what time', 'time', 'clock'], date: ['what date', 'today', 'date'], day: ['what day', 'day'] },
    ja: { time: ['何時', '今何時', '時間'], date: ['今日', '何日', '日付'], day: ['何曜日', '曜日'] }
};

var DAY_NAMES = {
    vi: ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    ja: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日']
};

var MONTH_NAMES_EN = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function timeAdapter(rs, args) {
    _adapterPath.push('time_adapter');
    var input = (args || []).join(' ').trim().toLowerCase();
    var lang = currentLang || 'vi';
    var keywords = TIME_KEYWORDS[lang] || TIME_KEYWORDS['vi'];
    var now = new Date();

    for (var i = 0; i < keywords.time.length; i++) {
        if (input.indexOf(keywords.time[i].toLowerCase()) !== -1) return formatTime(now, lang);
    }
    for (var j = 0; j < keywords.date.length; j++) {
        if (input.indexOf(keywords.date[j].toLowerCase()) !== -1) return formatDate(now, lang);
    }
    for (var k = 0; k < keywords.day.length; k++) {
        if (input.indexOf(keywords.day[k].toLowerCase()) !== -1) return formatDay(now, lang);
    }

    if (lang === 'en') return "I don't understand your time request.";
    if (lang === 'ja') return '時間に関するリクエストが理解できませんでした。';
    return 'Mình không hiểu yêu cầu về thời gian của bạn.';
}

function formatTime(date, lang) {
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var mm = minutes < 10 ? '0' + minutes : String(minutes);

    if (lang === 'en') {
        var period = hours >= 12 ? 'PM' : 'AM';
        var h12 = hours % 12;
        if (h12 === 0) h12 = 12;
        return h12 + ':' + mm + ' ' + period;
    } else if (lang === 'ja') {
        return hours + '時' + mm + '分';
    }
    var hh = hours < 10 ? '0' + hours : String(hours);
    return hh + ':' + mm;
}

function formatDate(date, lang) {
    var day = date.getDate();
    var month = date.getMonth();
    var year = date.getFullYear();

    if (lang === 'en') return MONTH_NAMES_EN[month] + ' ' + day + ', ' + year;
    if (lang === 'ja') return year + '年' + (month + 1) + '月' + day + '日';
    var dd = day < 10 ? '0' + day : String(day);
    var mmStr = (month + 1) < 10 ? '0' + (month + 1) : String(month + 1);
    return dd + '/' + mmStr + '/' + year;
}

function formatDay(date, lang) {
    var dayIndex = date.getDay();
    var names = DAY_NAMES[lang] || DAY_NAMES['vi'];
    return names[dayIndex];
}

// Node/test: export to globalThis
if (typeof module !== 'undefined' && module.exports) {
    globalThis.TIME_KEYWORDS = TIME_KEYWORDS;
    globalThis.DAY_NAMES = DAY_NAMES;
    globalThis.MONTH_NAMES_EN = MONTH_NAMES_EN;
    globalThis.timeAdapter = timeAdapter;
    globalThis.formatTime = formatTime;
    globalThis.formatDate = formatDate;
    globalThis.formatDay = formatDay;
}
