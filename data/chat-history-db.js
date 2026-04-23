// ============================================================
// Chat History DB — Lưu trữ lịch sử chat trong IndexedDB
// Tách riêng để giữ separation of concerns
// ============================================================

var CHAT_HISTORY_DB_NAME = 'HikariChatHistory';
var CHAT_HISTORY_DB_VERSION = 1;
var CHAT_HISTORY_STORE_NAME = 'messages';

/**
 * Mở (hoặc tạo) IndexedDB.
 * @returns {Promise<IDBDatabase>}
 */
function openChatHistoryDB() {
    return new Promise(function (resolve, reject) {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB not available'));
            return;
        }
        var request = indexedDB.open(CHAT_HISTORY_DB_NAME, CHAT_HISTORY_DB_VERSION);
        request.onupgradeneeded = function (e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(CHAT_HISTORY_STORE_NAME)) {
                var store = db.createObjectStore(CHAT_HISTORY_STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
        request.onsuccess = function (e) { resolve(e.target.result); };
        request.onerror = function (e) { reject(e.target.error); };
    });
}

/**
 * Lưu một message vào IndexedDB.
 * @param {string} role - 'user' hoặc 'assistant'
 * @param {string} content - Nội dung message
 * @param {string} [lang] - Ngôn ngữ hiện tại
 * @returns {Promise<number>} ID của record đã lưu
 */
async function saveChatMessage(role, content, lang) {
    var db = await openChatHistoryDB();
    return new Promise(function (resolve, reject) {
        var tx = db.transaction(CHAT_HISTORY_STORE_NAME, 'readwrite');
        var store = tx.objectStore(CHAT_HISTORY_STORE_NAME);
        var record = {
            role: role,
            content: content || '',
            lang: lang || 'vi',
            timestamp: Date.now()
        };
        var request = store.add(record);
        request.onsuccess = function (e) { resolve(e.target.result); };
        request.onerror = function (e) { reject(e.target.error); };
    });
}

/**
 * Lấy N message gần nhất từ IndexedDB.
 * @param {number} count - Số lượng message cần lấy
 * @returns {Promise<Array>} Mảng records sắp xếp theo timestamp tăng dần
 */
async function getRecentMessages(count) {
    var db = await openChatHistoryDB();
    return new Promise(function (resolve, reject) {
        var tx = db.transaction(CHAT_HISTORY_STORE_NAME, 'readonly');
        var store = tx.objectStore(CHAT_HISTORY_STORE_NAME);
        var index = store.index('timestamp');
        var results = [];
        var request = index.openCursor(null, 'prev'); // Mới nhất trước
        request.onsuccess = function (e) {
            var cursor = e.target.result;
            if (cursor && results.length < count) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                resolve(results.reverse()); // Đảo lại: cũ → mới
            }
        };
        request.onerror = function (e) { reject(e.target.error); };
    });
}

/**
 * Lấy messages với paging.
 * @param {number} page - Trang (bắt đầu từ 1)
 * @param {number} pageSize - Số message mỗi trang
 * @returns {Promise<{messages: Array, total: number, page: number, totalPages: number}>}
 */
async function getMessagesPage(page, pageSize) {
    var db = await openChatHistoryDB();
    return new Promise(function (resolve, reject) {
        var tx = db.transaction(CHAT_HISTORY_STORE_NAME, 'readonly');
        var store = tx.objectStore(CHAT_HISTORY_STORE_NAME);

        // Đếm tổng
        var countReq = store.count();
        countReq.onsuccess = function () {
            var total = countReq.result;
            var totalPages = Math.max(1, Math.ceil(total / pageSize));
            var safePage = Math.min(Math.max(1, page), totalPages);

            // Lấy tất cả theo timestamp desc, rồi slice
            var index = store.index('timestamp');
            var all = [];
            var cursorReq = index.openCursor(null, 'prev');
            cursorReq.onsuccess = function (e) {
                var cursor = e.target.result;
                if (cursor) {
                    all.push(cursor.value);
                    cursor.continue();
                } else {
                    var start = (safePage - 1) * pageSize;
                    var slice = all.slice(start, start + pageSize);
                    resolve({
                        messages: slice, // Mới nhất trước
                        total: total,
                        page: safePage,
                        totalPages: totalPages
                    });
                }
            };
            cursorReq.onerror = function (e) { reject(e.target.error); };
        };
        countReq.onerror = function (e) { reject(e.target.error); };
    });
}

/**
 * Xóa toàn bộ messages trong IndexedDB.
 * @returns {Promise<void>}
 */
async function clearAllChatMessages() {
    var db = await openChatHistoryDB();
    return new Promise(function (resolve, reject) {
        var tx = db.transaction(CHAT_HISTORY_STORE_NAME, 'readwrite');
        var store = tx.objectStore(CHAT_HISTORY_STORE_NAME);
        var request = store.clear();
        request.onsuccess = function () { resolve(); };
        request.onerror = function (e) { reject(e.target.error); };
    });
}

/**
 * Đếm tổng số messages trong IndexedDB.
 * @returns {Promise<number>}
 */
async function countChatMessages() {
    var db = await openChatHistoryDB();
    return new Promise(function (resolve, reject) {
        var tx = db.transaction(CHAT_HISTORY_STORE_NAME, 'readonly');
        var store = tx.objectStore(CHAT_HISTORY_STORE_NAME);
        var request = store.count();
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function (e) { reject(e.target.error); };
    });
}

// Node/test: export to globalThis
if (typeof module !== 'undefined' && module.exports) {
    globalThis.saveChatMessage = saveChatMessage || function () { return Promise.resolve(0); };
    globalThis.getRecentMessages = getRecentMessages || function () { return Promise.resolve([]); };
    globalThis.getMessagesPage = getMessagesPage || function () { return Promise.resolve({ messages: [], total: 0, page: 1, totalPages: 1 }); };
    globalThis.clearAllChatMessages = clearAllChatMessages || function () { return Promise.resolve(); };
    globalThis.countChatMessages = countChatMessages || function () { return Promise.resolve(0); };
}
