// ============================================================
// data-loader.js — Load dữ liệu JSON cho trình duyệt
// ============================================================

var SPECIFIC_RESPONSES = {};
var QA_DATASET = {};
var ADAPTER_REGISTRY = {};
var HELP_CONTENT = {};

/**
 * Load tất cả file JSON dữ liệu.
 * Gọi hàm này trước khi khởi tạo app.
 * @returns {Promise<void>}
 */
async function loadAllData() {
    var files = [
        { path: 'data/specific-responses.json', target: 'SPECIFIC_RESPONSES' },
        { path: 'data/qa-dataset.json', target: 'QA_DATASET' },
        { path: 'data/adapter-registry.json', target: 'ADAPTER_REGISTRY' },
        { path: 'data/help-content.json', target: 'HELP_CONTENT' }
    ];

    var promises = files.map(function (file) {
        return fetch(file.path)
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status + ' loading ' + file.path);
                return res.json();
            })
            .then(function (data) {
                if (file.target === 'SPECIFIC_RESPONSES') {
                    Object.assign(SPECIFIC_RESPONSES, data);
                } else if (file.target === 'QA_DATASET') {
                    Object.assign(QA_DATASET, data);
                } else if (file.target === 'ADAPTER_REGISTRY') {
                    Object.assign(ADAPTER_REGISTRY, data);
                } else if (file.target === 'HELP_CONTENT') {
                    Object.assign(HELP_CONTENT, data);
                }
            })
            .catch(function (err) {
                console.error('Lỗi load data [' + file.path + ']:', err);
            });
    });

    await Promise.all(promises);
}
