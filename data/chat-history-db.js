// ============================================================
// Chat History DB — Lưu trữ lịch sử chat trong IndexedDB
// Tách riêng để giữ separation of concerns
// ============================================================

var CHAT_HISTORY_DB_NAME = 'HikariChatHistory';
var CHAT_HISTORY_DB_VERSION = 2; // Tăng lên 2 để thêm store attachments
var CHAT_HISTORY_STORE_NAME = 'messages';
var CHAT_ATTACHMENT_STORE_NAME = 'attachments';

/**
 * Mở (hoặc tạo) IndexedDB.
 * Migration v1→v2: thêm object store 'attachments'.
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
            // v1: messages store
            if (!db.objectStoreNames.contains(CHAT_HISTORY_STORE_NAME)) {
                var store = db.createObjectStore(CHAT_HISTORY_STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
            // v2: attachments store
            if (!db.objectStoreNames.contains(CHAT_ATTACHMENT_STORE_NAME)) {
                var attStore = db.createObjectStore(CHAT_ATTACHMENT_STORE_NAME, { keyPath: 'id', autoIncrement: true });
                attStore.createIndex('messageId', 'messageId', { unique: false });
                attStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
        request.onsuccess = function (e) { resolve(e.target.result); };
        request.onerror = function (e) { reject(e.target.error); };
    });
}

/**
 * Lưu một message vào IndexedDB.
 * Nếu có file đính kèm, tự động gọi saveAttachment() sau khi lưu message.
 * @param {string} role - 'user' hoặc 'assistant'
 * @param {string} content - Nội dung message
 * @param {string} [lang] - Ngôn ngữ hiện tại
 * @param {File} [file] - File đính kèm (tùy chọn)
 * @returns {Promise<{messageId: number, attachmentId: number|null}>}
 */
async function saveChatMessage(role, content, lang, file) {
    var db = await openChatHistoryDB();
    var messageId = await new Promise(function (resolve, reject) {
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

    var attachmentId = null;
    if (file) {
        attachmentId = await saveAttachment(messageId, file);
    }

    // Áp dụng retention policy sau khi lưu
    var retentionConfig = getRetentionConfig();
    await applyRetentionPolicy(retentionConfig.mode, retentionConfig.value);

    return { messageId: messageId, attachmentId: attachmentId };
}

/**
 * Lưu file đính kèm vào IndexedDB dưới dạng ArrayBuffer.
 * Dùng ArrayBuffer thay vì base64 để tiết kiệm ~33% dung lượng.
 * @param {number} messageId - ID của message liên kết
 * @param {File} file - File object từ input
 * @returns {Promise<number>} ID của attachment đã lưu
 */
async function saveAttachment(messageId, file) {
    var arrayBuffer = await new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function (e) { resolve(e.target.result); };
        reader.onerror = function () { reject(new Error('FileReader error')); };
        reader.readAsArrayBuffer(file);
    });

    var db = await openChatHistoryDB();
    return new Promise(function (resolve, reject) {
        var tx = db.transaction(CHAT_ATTACHMENT_STORE_NAME, 'readwrite');
        var store = tx.objectStore(CHAT_ATTACHMENT_STORE_NAME);
        var record = {
            messageId: messageId,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            data: arrayBuffer,
            timestamp: Date.now()
        };
        var request = store.add(record);
        request.onsuccess = function (e) { resolve(e.target.result); };
        request.onerror = function (e) { reject(e.target.error); };
    });
}

/**
 * Lấy attachment theo ID.
 * @param {number} attachmentId
 * @returns {Promise<object|null>} Record attachment với data (ArrayBuffer)
 */
async function getAttachment(attachmentId) {
    var db = await openChatHistoryDB();
    return new Promise(function (resolve, reject) {
        var tx = db.transaction(CHAT_ATTACHMENT_STORE_NAME, 'readonly');
        var store = tx.objectStore(CHAT_ATTACHMENT_STORE_NAME);
        var request = store.get(attachmentId);
        request.onsuccess = function (e) { resolve(e.target.result || null); };
        request.onerror = function (e) { reject(e.target.error); };
    });
}

/**
 * Lấy attachment theo messageId.
 * @param {number} messageId
 * @returns {Promise<object|null>} Record attachment đầu tiên tìm thấy
 */
async function getAttachmentByMessageId(messageId) {
    var db = await openChatHistoryDB();
    return new Promise(function (resolve, reject) {
        var tx = db.transaction(CHAT_ATTACHMENT_STORE_NAME, 'readonly');
        var store = tx.objectStore(CHAT_ATTACHMENT_STORE_NAME);
        var index = store.index('messageId');
        var request = index.get(messageId);
        request.onsuccess = function (e) { resolve(e.target.result || null); };
        request.onerror = function (e) { reject(e.target.error); };
    });
}

/**
 * Chuyển đổi attachment record thành data URL để render trong <img>.
 * ArrayBuffer → base64 data URL (chỉ dùng khi hiển thị, không lưu base64).
 * @param {object} attachment - Record từ IndexedDB
 * @returns {string} Data URL dạng "data:<fileType>;base64,..."
 */
function attachmentToDataURL(attachment) {
    if (!attachment || !attachment.data) return '';
    var bytes = new Uint8Array(attachment.data);
    var binary = '';
    for (var i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    var base64 = btoa(binary);
    return 'data:' + (attachment.fileType || 'image/png') + ';base64,' + base64;
}

/**
 * Xóa toàn bộ attachments trong IndexedDB.
 * @returns {Promise<void>}
 */
async function clearAllAttachments() {
    var db = await openChatHistoryDB();
    return new Promise(function (resolve, reject) {
        var tx = db.transaction(CHAT_ATTACHMENT_STORE_NAME, 'readwrite');
        var store = tx.objectStore(CHAT_ATTACHMENT_STORE_NAME);
        var request = store.clear();
        request.onsuccess = function () { resolve(); };
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

        var countReq = store.count();
        countReq.onsuccess = function () {
            var total = countReq.result;
            var totalPages = Math.max(1, Math.ceil(total / pageSize));
            var safePage = Math.min(Math.max(1, page), totalPages);

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
                        messages: slice,
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

/**
 * Đọc retention config từ localStorage.
 * @returns {{mode: string, value: number}}
 */
function getRetentionConfig() {
    try {
        var raw = localStorage.getItem('hikari_retention_config');
        if (raw) {
            var parsed = JSON.parse(raw);
            if (parsed && parsed.mode && typeof parsed.value === 'number') {
                return { mode: parsed.mode, value: parsed.value };
            }
        }
    } catch (e) { /* ignore */ }
    return { mode: 'count', value: 50 };
}

/**
 * Lưu retention config vào localStorage và áp dụng ngay.
 * @param {string} mode - 'count' hoặc 'days'
 * @param {number} value - Giá trị tương ứng
 * @returns {Promise<void>}
 */
async function setRetentionConfig(mode, value) {
    localStorage.setItem('hikari_retention_config', JSON.stringify({ mode: mode, value: value }));
    await applyRetentionPolicy(mode, value);
}

/**
 * Áp dụng retention policy để xóa messages cũ.
 * - mode="count": giữ lại tối đa `value` messages mới nhất, xóa các messages cũ hơn
 * - mode="days": xóa tất cả messages có timestamp < Date.now() - value * 86400000
 * @param {string} mode - 'count' hoặc 'days'
 * @param {number} value - Giá trị tương ứng
 * @returns {Promise<void>}
 */
async function applyRetentionPolicy(mode, value) {
    var db = await openChatHistoryDB();
    if (mode === 'count') {
        // Lấy tất cả IDs theo thứ tự timestamp tăng dần (cũ nhất trước)
        var allIds = await new Promise(function (resolve, reject) {
            var tx = db.transaction(CHAT_HISTORY_STORE_NAME, 'readonly');
            var store = tx.objectStore(CHAT_HISTORY_STORE_NAME);
            var index = store.index('timestamp');
            var ids = [];
            var request = index.openCursor(null, 'next'); // cũ nhất trước
            request.onsuccess = function (e) {
                var cursor = e.target.result;
                if (cursor) {
                    ids.push(cursor.primaryKey);
                    cursor.continue();
                } else {
                    resolve(ids);
                }
            };
            request.onerror = function (e) { reject(e.target.error); };
        });

        var deleteCount = allIds.length - value;
        if (deleteCount <= 0) return;

        var idsToDelete = allIds.slice(0, deleteCount);
        await new Promise(function (resolve, reject) {
            var tx = db.transaction(CHAT_HISTORY_STORE_NAME, 'readwrite');
            var store = tx.objectStore(CHAT_HISTORY_STORE_NAME);
            var pending = idsToDelete.length;
            if (pending === 0) { resolve(); return; }
            idsToDelete.forEach(function (id) {
                var req = store.delete(id);
                req.onsuccess = function () {
                    pending--;
                    if (pending === 0) resolve();
                };
                req.onerror = function (e) { reject(e.target.error); };
            });
        });
    } else if (mode === 'days') {
        var cutoff = Date.now() - value * 86400000;
        await new Promise(function (resolve, reject) {
            var tx = db.transaction(CHAT_HISTORY_STORE_NAME, 'readwrite');
            var store = tx.objectStore(CHAT_HISTORY_STORE_NAME);
            var index = store.index('timestamp');
            // IDBKeyRange: timestamp < cutoff
            var range = IDBKeyRange.upperBound(cutoff, true);
            var request = index.openCursor(range);
            request.onsuccess = function (e) {
                var cursor = e.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = function (e) { reject(e.target.error); };
        });
    }
}

// Node/test: export to globalThis (stub functions khi IndexedDB không khả dụng)
if (typeof module !== 'undefined' && module.exports) {
    globalThis.saveChatMessage = function () { return Promise.resolve({ messageId: 0, attachmentId: null }); };
    globalThis.saveAttachment = function () { return Promise.resolve(0); };
    globalThis.getAttachment = function () { return Promise.resolve(null); };
    globalThis.getAttachmentByMessageId = function () { return Promise.resolve(null); };
    globalThis.attachmentToDataURL = attachmentToDataURL;
    globalThis.clearAllAttachments = function () { return Promise.resolve(); };
    globalThis.getRecentMessages = function () { return Promise.resolve([]); };
    globalThis.getMessagesPage = function () { return Promise.resolve({ messages: [], total: 0, page: 1, totalPages: 1 }); };
    globalThis.clearAllChatMessages = function () { return Promise.resolve(); };
    globalThis.countChatMessages = function () { return Promise.resolve(0); };
    globalThis.getRetentionConfig = function () { return { mode: 'count', value: 50 }; };
    globalThis.setRetentionConfig = function () { return Promise.resolve(); };
    globalThis.applyRetentionPolicy = function () { return Promise.resolve(); };
}
