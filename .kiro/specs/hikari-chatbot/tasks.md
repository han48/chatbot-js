# Kế hoạch Triển khai: Hikari Chatbot

## Tổng quan

Triển khai chatbot tĩnh Hikari sử dụng HTML + CSS + JavaScript thuần với RiveScript qua CDN. Ứng dụng hỗ trợ 3 ngôn ngữ (Việt, Anh, Nhật), hiển thị match confidence, API fallback với smart fallback cục bộ, danh sách Object Macros, 7 Logic Adapter (Object Macros) tương tự ChatterBot (bao gồm web_search), xử lý tiếng Việt có dấu (dual-reply), help dialog đa ngôn ngữ, adapter path breadcrumb, wildcard variant triggers, tìm kiếm web (DuckDuckGo + Google), thuật toán tương đồng nâng cao (4 thuật toán: Levenshtein + Jaccard + Cosine + Synset), preprocessed data pipeline (TF-IDF), input normalization nâng cao (modal particles), hiển thị thời gian xử lý, và URL linkification. Dữ liệu được tách ra các tệp `.rive` và JSON riêng biệt, adapter được tách thành tệp riêng trong `adapters/`. Kiểm thử bằng Vitest + fast-check.

Phiên bản hiện tại bổ sung thêm: LLM Adapter chạy mô hình ngôn ngữ lớn trực tiếp trên trình duyệt qua WebGPU (Transformers.js, Qwen3.5-0.8B), lưu trữ lịch sử hội thoại persistent vào IndexedDB (`data/chat-history-db.js`), đính kèm ảnh (multimodal), streaming tin nhắn realtime, nút Cancel generate, hiển thị trạng thái tải model, quản lý trạng thái nút gửi, Settings Panel (thinking/history toggles), History Dialog (2 tab + pagination), và fallback chain mở rộng (RiveScript → bestMatch → Fallback API → LLM Adapter → final fallback).

## Tasks

- [x] 1. Thiết lập cấu trúc dự án và tệp HTML cơ bản
  - [x] 1.1 Tạo `index.html` với cấu trúc đầy đủ
    - Tạo tệp HTML với meta charset UTF-8, viewport responsive
    - Thêm inline SVG favicon (emoji 🌟) để tránh lỗi 404
    - Thêm thẻ `<script>` tải RiveScript từ CDN (`https://unpkg.com/rivescript@latest/dist/rivescript.min.js`)
    - Thêm cấu trúc DOM: `.chat-container`, `.chat-header` (tiêu đề "Hikari"), `#language-selector` (3 ngôn ngữ), `#help-button` (❓), `#macros-button`, `#rules-button`
    - Thêm `#macros-panel`, `#rules-panel` (ẩn mặc định), `#message-display`, `.input-area` (input + nút gửi)
    - Thêm Help Dialog: `#help-overlay` (modal overlay), `.help-dialog`, `#help-dialog-title`, `#help-close-button`, `#help-dialog-body`
    - Liên kết `style.css`, `brain.js`, `data-loader.js`, `app.js`
    - _Yêu cầu: 1.1, 1.2, 2.1, 2.2, 2.3, 3.1, 9.1, 9.2, 9.3, 9.10, 13.1, 16.1_

  - [x] 1.2 Tạo `style.css` với giao diện responsive
    - Định dạng `.chat-container` (căn giữa, max-width cho desktop)
    - Định dạng `.message.user` (căn phải, màu nền riêng) và `.message.bot` (căn trái, màu nền riêng)
    - Định dạng `.confidence`, `.confidence-high` (xanh lá), `.confidence-low` (đỏ), font-size nhỏ hơn nội dung
    - Định dạng `.adapter-path` (font nhỏ, in nghiêng, màu xám) cho breadcrumb adapter path
    - Định dạng `.loading-indicator`, `.macros-panel`, `.macro-item`, `.macro-call-syntax`
    - Định dạng `.rules-panel`, `.input-area`, `.hidden`
    - Định dạng Help Dialog: `.help-overlay` (fade-in), `.help-dialog` (slide-up), `.help-dialog-header`, `.help-dialog-body`, `.help-section`, `.help-example`, `.help-dot`
    - Thêm `@media (max-width: 768px)` cho responsive (chiều rộng từ 320px trở lên)
    - Định dạng `.response-time` (font nhỏ, màu xám) cho hiển thị thời gian xử lý
    - Định dạng `.message.bot a` (link nhấp được, màu sắc phù hợp, hiệu ứng hover) cho URL linkification
    - _Yêu cầu: 2.7, 8.1, 8.2, 8.3, 11.4, 11.5, 12.9, 16.2, 17.7, 23.3, 24.5_

  - [x] 1.3 Tạo `app.js` với khung cơ bản và cấu hình
    - Khai báo biến trạng thái toàn cục: `bot`, `currentLang`, `USERNAME`, `_adapterPath`
    - Khai báo hằng số cấu hình: `FALLBACK_API_URL`, `FALLBACK_API_TIMEOUT` (5000ms)
    - Viết hàm `validateMessage(text)` — kiểm tra tin nhắn không trống/chỉ khoảng trắng
    - Viết hàm `scrollToBottom()` — cuộn message display xuống cuối
    - Viết hàm `appendMessage(text, sender, confidence, adapterPath, responseTime)` — thêm tin nhắn vào DOM với class phân biệt user/bot, kèm confidence, adapter breadcrumb, và response time nếu là bot
    - Viết hàm `linkifyText(text)` — chuyển đổi URL thành thẻ `<a>` nhấp được, escape HTML, newline → `<br>`
    - Viết hàm `showError(message)` — hiển thị thông báo lỗi trong chat
    - Viết hàm `calculateConfidence(matchedTrigger)` — trả về 0–100 dựa trên loại trigger
    - Viết hàm `getConfidenceClass(confidence)` — trả về `"confidence-high"` (≥50) hoặc `"confidence-low"` (<50)
    - _Yêu cầu: 2.4, 2.5, 2.6, 2.7, 7.2, 7.3, 9.3, 11.1, 11.2, 11.3, 11.4, 11.5, 12.7, 12.8, 17.4, 17.7, 23.1, 23.2, 23.3, 24.1, 24.2, 24.3, 24.4_

- [x] 2. Thiết lập Vitest + fast-check và viết test cho các hàm tiện ích
  - [x] 2.1 Cấu hình Vitest với jsdom và fast-check
    - Khởi tạo `package.json` với Vitest, jsdom, fast-check
    - Tạo `vitest.config.js` với environment jsdom
    - Tạo cấu trúc thư mục `tests/`
    - _Yêu cầu: 9.3_

  - [ ]* 2.2 Viết property test cho `validateMessage`
    - **Property 2: Từ chối tin nhắn trống**
    - **Validates: Yêu cầu 7.2**

  - [ ]* 2.3 Viết property test cho `calculateConfidence`
    - **Property 5: Confidence luôn trong khoảng [0, 100] và phản ánh loại trigger**
    - **Validates: Yêu cầu 11.1, 11.2, 11.3**

  - [ ]* 2.4 Viết property test cho `getConfidenceClass`
    - **Property 6: Phân loại màu confidence theo ngưỡng 50%**
    - **Validates: Yêu cầu 11.4**

- [x] 3. Checkpoint — Đảm bảo tất cả test pass
  - Đảm bảo tất cả test pass, hỏi người dùng nếu có thắc mắc.

- [x] 4. Tách dữ liệu ra tệp riêng (Data Externalization)
  - [x] 4.1 Tạo các tệp `.rive` cho Brain Data
    - Tạo `brain/vi.rive` — trigger chào hỏi, hỏi tên, khả năng, tạm biệt, mặc định (`+ *`), custom rules, trigger gọi `<call>` cho các adapter, wildcard variant triggers, fallback triggers cho web search prefixes (`+ google *`, `+ tra cuu *`) gọi `<call>best_match</call>`
    - Tạo `brain/en.rive` — tương tự tiếng Anh, bao gồm wildcard variant triggers (`+ hello *`, `+ what is *`, etc.) và fallback triggers cho web search
    - Tạo `brain/ja.rive` — tương tự tiếng Nhật, bao gồm fallback triggers cho web search (`+ グーグル *`, `+ ウェブ検索 *`) gọi `<call>best_match</call>`
    - _Yêu cầu: 4.1–4.7, 5.1–5.7, 6.1–6.5, 9.4, 14.2, 19.6_

  - [x] 4.2 Tạo `brain.js` — Brain Loader
    - Viết `loadBrainFile(lang)` — tải nội dung tệp `.rive` qua `fetch()`
    - Viết `loadAllBrains()` — tải tất cả brain files cho 3 ngôn ngữ
    - Khai báo biến toàn cục `BRAIN_DATA` và `BRAIN_FILES`
    - _Yêu cầu: 9.5_

  - [x] 4.3 Tạo các tệp JSON dữ liệu
    - Tạo `data/specific-responses.json` — bảng ánh xạ câu hỏi-trả lời cho 3 ngôn ngữ
    - Tạo `data/qa-dataset.json` — tập dữ liệu Q&A cho Best Match Adapter (≥10 cặp/ngôn ngữ)
    - Tạo `data/adapter-registry.json` — metadata adapter (tên, mô tả, callSyntax, active) bao gồm web_search
    - Tạo `data/help-content.json` — nội dung help dialog cho 3 ngôn ngữ
    - _Yêu cầu: 9.6, 14.1.4, 14.4.3, 16.6_

  - [x] 4.4 Tạo `data-loader.js` — Data Loader
    - Viết `loadAllData()` — tải tất cả tệp JSON qua `fetch()` và gán vào biến toàn cục
    - Khai báo biến toàn cục: `SPECIFIC_RESPONSES`, `QA_DATASET`, `ADAPTER_REGISTRY`, `HELP_CONTENT`
    - _Yêu cầu: 9.7_

  - [x] 4.5 Hỗ trợ Node/test environment
    - Trong `app.js`, sử dụng IIFE với `globalThis` và `fs.readFileSync` để tải dữ liệu khi chạy trong Node/Vitest
    - Tránh vấn đề `var` hoisting trong trình duyệt
    - _Yêu cầu: 9.8_

- [x] 5. Triển khai RiveScript Engine và luồng gửi tin nhắn
  - [x] 5.1 Triển khai `initBot(lang)` và `changeLanguage(lang)`
    - `initBot(lang)`: tạo instance RiveScript mới (`utf8: true`), `bot.stream(BRAIN_DATA[lang])`, `bot.sortReplies()`, kiểm tra CDN, đăng ký adapter
    - `changeLanguage(lang)`: gọi `initBot(lang)`, xóa message display, hiển thị lời chào mới, cập nhật rules list và macros list
    - Xử lý lỗi: try-catch cho `stream()`/`sortReplies()`, hiển thị thông báo lỗi thân thiện
    - _Yêu cầu: 1.2, 1.3, 3.2, 3.3, 3.4, 7.3, 10.1, 10.2, 14.1_

  - [x] 5.2 Triển khai `sendMessage()` với dual-reply, smart fallback, và web search detection
    - Lấy nội dung từ `#message-input`, gọi `validateMessage()`, hiển thị tin nhắn user
    - Kiểm tra web search prefix qua `extractWebSearchQuery()` — nếu match, gọi `webSearchAdapter` trực tiếp
    - Đo thời gian xử lý (start → result) để hiển thị response time
    - Áp dụng dual-reply strategy cho tiếng Việt: gửi cả input gốc và input bỏ dấu, chọn confidence cao hơn
    - Nếu confidence ≥ 50%: hiển thị phản hồi + confidence + adapter breadcrumb
    - Nếu confidence < 50%: thử bestMatchAdapter làm fallback cục bộ (cả raw và normalized cho tiếng Việt)
    - Nếu bestMatch thất bại: hiển thị loading, gọi Fallback API, hiển thị kết quả
    - Gắn event listener cho nút gửi (click) và input (Enter)
    - _Yêu cầu: 2.4, 2.5, 2.6, 7.1, 7.2, 11.1, 11.4, 12.1, 12.2, 12.3, 12.10, 15.4, 15.5, 15.6, 19.5, 23.4_

  - [x] 5.3 Triển khai `getBotReply(inputText)`
    - Reset `_adapterPath`, gọi `bot.reply()`, lấy `lastMatch()`, tính confidence
    - Trả về `{reply, confidence, adapterPath}`
    - Nếu không có adapter nào xử lý, adapterPath = `['rivescript']`
    - _Yêu cầu: 17.1, 17.6_

  - [x] 5.4 Triển khai `callFallbackAPI(userMessage)`
    - Gửi HTTP POST với `fetch()` và `AbortController` (timeout 5s)
    - Body: `{ message: userMessage }`
    - Xử lý thành công: trả về câu trả lời từ API
    - Xử lý lỗi/timeout: trả về `null`
    - Viết `showLoadingIndicator()` và `hideLoadingIndicator(element)`
    - _Yêu cầu: 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9_

  - [ ]* 5.5 Viết property test cho engine luôn phản hồi
    - **Property 3: Engine luôn phản hồi**
    - **Validates: Yêu cầu 7.1, 2.5**

  - [ ]* 5.6 Viết property test cho phản hồi mặc định đa ngôn ngữ
    - **Property 4: Phản hồi mặc định đa ngôn ngữ**
    - **Validates: Yêu cầu 4.5, 5.5, 6.5**

  - [ ]* 5.7 Viết property test cho tin nhắn hiển thị đúng phân loại
    - **Property 1: Tin nhắn hiển thị với phân loại đúng**
    - **Validates: Yêu cầu 2.4, 2.7**

  - [ ]* 5.8 Viết property test cho quyết định fallback
    - **Property 7: Quyết định fallback dựa trên confidence**
    - **Validates: Yêu cầu 12.1**

- [x] 6. Checkpoint — Đảm bảo tất cả test pass
  - Đảm bảo tất cả test pass, hỏi người dùng nếu có thắc mắc.

- [x] 7. Triển khai xử lý tiếng Việt có dấu (Vietnamese Diacritics Handling)
  - [x] 7.1 Triển khai Vietnamese Diacritics Map, hàm normalize, và Modal Particles
    - Tạo `VIETNAMESE_DIACRITICS_MAP` — bảng ánh xạ đầy đủ ký tự có dấu → không dấu
    - Viết `removeVietnameseDiacritics(str)` — loại bỏ dấu tiếng Việt
    - Tạo `MODAL_PARTICLES` — danh sách từ đệm theo ngôn ngữ (vi/en/ja)
    - Viết `normalizeInput(text)` — full preprocessing: lowercase → bỏ dấu (vi) → bỏ dấu câu (giữ +-*/) → chuẩn hóa khoảng trắng → bỏ modal particles cuối câu
    - _Yêu cầu: 15.1, 15.2, 15.3, 20.1, 20.2, 20.3, 20.4_

  - [ ]* 7.2 Viết property test cho Vietnamese diacritics removal idempotent
    - **Property 21: Vietnamese diacritics removal idempotent**
    - **Validates: Yêu cầu 15.1, 15.2**

  - [ ]* 7.3 Viết property test cho dual-reply chọn confidence cao hơn
    - **Property 22: Dual-reply chọn confidence cao hơn**
    - **Validates: Yêu cầu 15.4, 15.5**

- [x] 8. Triển khai hệ thống Logic Adapter — Phần 1 (Tiện ích và Adapter đơn giản)
  - [x] 8.1 Triển khai hàm text similarity (4 thuật toán)
    - Viết `levenshteinDistance(a, b)` — khoảng cách Levenshtein
    - Viết `jaccardSimilarity(a, b)` — độ tương đồng Jaccard (dựa trên tập từ)
    - Viết `cosineSimilarity(a, b)` — Cosine Similarity dựa trên TF vector
    - Viết `cosineSimilarityTFIDF(inputTFIDF, inputMag, corpusTFIDF, corpusMag)` — Cosine similarity với TF-IDF vectors preprocessed
    - Tạo `SYNONYM_GROUPS` — 17 nhóm từ đồng nghĩa cho 3 ngôn ngữ
    - Viết `areSynonyms(wordA, wordB)` — kiểm tra hai từ thuộc cùng nhóm đồng nghĩa
    - Viết `synsetSimilarity(a, b)` — Synset Similarity dựa trên SYNONYM_GROUPS
    - Viết `synsetSimilarityPreprocessed(inputGroups, corpusGroups)` — Synset similarity với preprocessed indices
    - Viết `textSimilarity(a, b)` — kết hợp 4 thuật toán (25% mỗi thuật toán), trả về [0, 1]
    - Viết `tokenizeForSimilarity(text, lang)` — tokenize input cho similarity matching
    - Tách thành tệp riêng `adapters/text-similarity.js`
    - _Yêu cầu: 14.1.3, 21.1, 21.2, 21.3, 21.4, 21.5_

  - [ ]* 8.2 Viết property test cho text similarity
    - **Property 10: Text similarity nằm trong [0, 1] và chuỗi giống hệt trả về 1**
    - **Validates: Yêu cầu 14.1.3**

  - [x] 8.3 Triển khai `specificResponseAdapter`
    - So khớp exact match (case-insensitive) với `SPECIFIC_RESPONSES[currentLang]`
    - Hỗ trợ diacritics-stripped match cho tiếng Việt (thử bỏ dấu cả input và key)
    - Trả về câu trả lời tương ứng hoặc thông báo "không có phản hồi cụ thể"
    - Push `'specific_response'` vào `_adapterPath`
    - _Yêu cầu: 14.4.1–14.4.6, 15.1_

  - [ ]* 8.4 Viết property test cho specific response
    - **Property 15: Specific Response exact match (case-insensitive)**
    - **Validates: Yêu cầu 14.4.4, 14.4.5**

  - [x] 8.5 Triển khai `timeAdapter`
    - Nhận diện từ khóa thời gian/ngày tháng/thứ bằng 3 ngôn ngữ
    - Trả về giờ:phút, ngày/tháng/năm, hoặc thứ trong tuần theo locale
    - Định dạng theo ngôn ngữ: "14:30" (vi), "2:30 PM" (en), "14時30分" (ja)
    - Push `'time_adapter'` vào `_adapterPath`
    - _Yêu cầu: 14.5.1–14.5.7_

  - [ ]* 8.6 Viết property test cho time adapter format theo ngôn ngữ
    - **Property 16: Time Adapter định dạng theo ngôn ngữ**
    - **Validates: Yêu cầu 14.5.6**

  - [ ]* 8.7 Viết property test cho time adapter từ chối đầu vào không liên quan
    - **Property 17: Time Adapter từ chối đầu vào không liên quan**
    - **Validates: Yêu cầu 14.5.7**

- [x] 9. Triển khai hệ thống Logic Adapter — Phần 2 (Adapter phức tạp)
  - [x] 9.1 Triển khai `mathematicalEvaluationAdapter` và `parseMathExpression`
    - Viết `parseMathExpression(input, lang)` — trích xuất biểu thức toán học bằng regex + switch/case (không dùng `eval()`)
    - Hỗ trợ 4 phép tính: +, -, *, /
    - Hỗ trợ từ khóa đa ngôn ngữ
    - Xử lý chia cho 0 và biểu thức không hợp lệ
    - Push `'mathematical_evaluation'` vào `_adapterPath`
    - _Yêu cầu: 14.3.1–14.3.7_

  - [ ]* 9.2 Viết property test cho tính toán toán học chính xác
    - **Property 13: Tính toán biểu thức toán học chính xác**
    - **Validates: Yêu cầu 14.3.3, 14.3.4, 14.3.5**

  - [ ]* 9.3 Viết property test cho xử lý lỗi biểu thức toán học
    - **Property 14: Xử lý lỗi biểu thức toán học**
    - **Validates: Yêu cầu 14.3.6, 14.3.7**

  - [x] 9.4 Triển khai `unitConversionAdapter`, `parseConversionRequest`, `convertUnit`
    - Tạo `CONVERSION_FACTORS` — hệ số chuyển đổi cho chiều dài và khối lượng
    - Triển khai chuyển đổi nhiệt độ bằng công thức
    - Viết `parseConversionRequest(input, lang)` — nhận diện từ khóa đa ngôn ngữ
    - Viết `convertUnit(value, fromUnit, toUnit)` — thực hiện chuyển đổi
    - Push `'unit_conversion'` vào `_adapterPath`
    - _Yêu cầu: 14.6.1–14.6.7_

  - [ ]* 9.5 Viết property test cho chuyển đổi đơn vị round-trip
    - **Property 18: Chuyển đổi đơn vị chính xác (round-trip)**
    - **Validates: Yêu cầu 14.6.3, 14.6.5**

  - [ ]* 9.6 Viết property test cho đơn vị không hỗ trợ
    - **Property 19: Chuyển đổi đơn vị — đơn vị không hỗ trợ**
    - **Validates: Yêu cầu 14.6.6**

  - [ ]* 9.7 Viết property test cho cú pháp chuyển đổi không hợp lệ
    - **Property 20: Chuyển đổi đơn vị — cú pháp không hợp lệ**
    - **Validates: Yêu cầu 14.6.7**

- [x] 10. Checkpoint — Đảm bảo tất cả test pass
  - Đảm bảo tất cả test pass, hỏi người dùng nếu có thắc mắc.

- [x] 11. Triển khai Best Match Adapter, Dispatcher, và Adapter Registry
  - [x] 11.1 Triển khai `bestMatchAdapter` với preprocessed data support
    - Sử dụng `findBestMatchPreprocessed()` khi preprocessed data có sẵn (ưu tiên)
    - Fallback sang `textSimilarity()` thủ công khi preprocessed data không có
    - Ngưỡng similarity mặc định: 0.3
    - Trả về câu trả lời khi vượt ngưỡng, hoặc thông báo "không tìm thấy"
    - Push `'best_match'` vào `_adapterPath`
    - _Yêu cầu: 14.1.1–14.1.7_

  - [ ]* 11.2 Viết property test cho best match adapter
    - **Property 11: Best Match Adapter luôn trả về chuỗi không rỗng**
    - **Validates: Yêu cầu 14.1.5, 14.1.6, 14.1.7**

  - [x] 11.3 Triển khai `logicAdapterDispatcher`
    - Gọi lần lượt các adapter con theo thứ tự ưu tiên
    - Sử dụng `isValidAdapterResult()` để kiểm tra kết quả hợp lệ
    - Dọn dẹp `_adapterPath` — loại bỏ entry adapter thất bại, chỉ giữ chuỗi thành công
    - Trả về thông báo mặc định khi không adapter nào trả về kết quả hợp lệ
    - _Yêu cầu: 14.2.1–14.2.7, 17.3_

  - [ ]* 11.4 Viết property test cho dispatcher chọn theo ưu tiên
    - **Property 12: Logic Adapter Dispatcher chọn theo ưu tiên**
    - **Validates: Yêu cầu 14.2.4, 14.2.5, 14.2.6, 14.2.7**

  - [x] 11.5 Triển khai `registerAdapters(bot, lang)` và Adapter Display Names
    - Đăng ký tất cả 7 adapter qua `bot.setSubroutine()` (bao gồm web_search)
    - Tạo `ADAPTER_DISPLAY_NAMES` — ánh xạ key adapter → tên hiển thị đa ngôn ngữ (bao gồm web_search)
    - Viết `getAdapterDisplayName(adapterKey)` — lấy tên hiển thị theo ngôn ngữ hiện tại
    - Tách thành tệp riêng `adapters/adapter-registry.js`
    - _Yêu cầu: 14.1, 14.3, 14.4, 17.5, 25.1_

- [x] 12. Triển khai panel Object Macro List, Rules List, và Help Dialog
  - [x] 12.1 Triển khai `toggleMacrosPanel()` và `updateMacrosList(lang)`
    - Toggle hiển thị `#macros-panel` khi click `#macros-button`
    - Render danh sách adapter từ `ADAPTER_REGISTRY`: tên, mô tả, cú pháp `<call>`
    - Cập nhật mô tả theo ngôn ngữ hiện tại khi chuyển ngôn ngữ
    - _Yêu cầu: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ]* 12.2 Viết property test cho Object Macro List đầy đủ thông tin
    - **Property 8: Object Macro List hiển thị đầy đủ thông tin**
    - **Validates: Yêu cầu 13.3, 13.5**

  - [ ]* 12.3 Viết property test cho Object Macro List cập nhật theo ngôn ngữ
    - **Property 9: Object Macro List cập nhật theo ngôn ngữ**
    - **Validates: Yêu cầu 13.4**

  - [x] 12.4 Triển khai `toggleRulesPanel()`, `updateRulesList(lang)`, `formatTrigger(trigger)`
    - Toggle hiển thị `#rules-panel` khi click `#rules-button`
    - Đọc danh sách triggers từ `bot._topics.random` internal data (thay vì `getUserTopicTriggers()`)
    - Deduplication và lọc bỏ trigger wildcard mặc định (`*`) và trigger wildcard ngắn
    - `formatTrigger()`: thay `*` → `...`, xóa thẻ `<call>`, `<star>`, etc.
    - _Yêu cầu: 13.1, 13.2, 18.1, 18.2, 18.3_

  - [x] 12.5 Triển khai Help Dialog
    - Viết `renderHelpContent()` — render nội dung help dialog từ `HELP_CONTENT[currentLang]`
    - Viết `openHelpDialog()` — render content + remove hidden class
    - Viết `closeHelpDialog()` — add hidden class
    - Gắn event listener: nút ❓ → open, nút X → close, click overlay → close, Escape → close
    - _Yêu cầu: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [ ]* 12.6 Viết property test cho help content đa ngôn ngữ
    - **Property 24: Help content đa ngôn ngữ**
    - **Validates: Yêu cầu 16.3, 16.4**

  - [ ]* 12.7 Viết property test cho adapter path tracking
    - **Property 23: Adapter path tracking**
    - **Validates: Yêu cầu 17.1, 17.6**

- [x] 13. Tích hợp và kết nối toàn bộ
  - [x] 13.1 Kết nối tất cả thành phần và khởi tạo ứng dụng
    - Viết hàm `initializeApp()`: kiểm tra CDN, gọi `loadAllBrains()`, gọi `loadAllData()`, gọi `loadPreprocessedData()`, gọi `initBot('vi')`, hiển thị lời chào tiếng Việt
    - Gắn event listener: Language Selector, nút gửi, input Enter, nút macros, nút rules, nút help, help close, help overlay click, Escape
    - Đảm bảo ngôn ngữ mặc định là tiếng Việt
    - Đảm bảo lời chào khởi tạo chứa tên "Hikari" và hướng dẫn sử dụng
    - _Yêu cầu: 1.2, 1.3, 2.3, 2.4, 3.4, 9.5, 9.7, 10.1, 10.2, 16.1_

  - [ ]* 13.2 Viết unit test tích hợp
    - Test luồng gửi tin nhắn end-to-end (gửi → hiển thị user → hiển thị bot + confidence + adapter breadcrumb)
    - Test chuyển ngôn ngữ (xóa chat + lời chào mới)
    - Test hiển thị lỗi CDN
    - Test brain data 3 ngôn ngữ (trigger-response cơ bản)
    - Test adapter registration (6 subroutine đã đăng ký sau initBot)
    - Test help dialog open/close
    - Test Vietnamese diacritics dual-reply
    - Test smart fallback (bestMatch trước Fallback API)
    - Test rules panel reads from internal data
    - _Yêu cầu: 1.3, 2.4, 2.5, 3.2, 3.3, 4.1–4.7, 5.1–5.4, 6.1–6.4, 7.1, 7.3, 14.1, 15.4, 16.2, 17.4, 18.1_

- [x] 14. Checkpoint cuối cùng — Đảm bảo tất cả test pass
  - Đảm bảo tất cả test pass, hỏi người dùng nếu có thắc mắc.

- [x] 15. Triển khai Web Search Adapter
  - [x] 15.1 Triển khai `adapters/web-search.js`
    - Viết `duckDuckGoSearch(query)` — gọi DuckDuckGo Instant Answer API (CORS-enabled, miễn phí)
    - Viết `googleSearch(query, numResults)` — gọi Google Custom Search API (tùy chọn, cần GOOGLE_API_KEY + GOOGLE_CX)
    - Viết `formatDDGResults(results, query, lang)` — format kết quả DDG thành chuỗi hiển thị đa ngôn ngữ
    - Viết `formatGoogleResults(results, query, lang)` — format kết quả Google
    - Viết `formatSearchLinks(query, lang)` — format link tìm kiếm fallback (Google + DDG + Bing)
    - Viết `webSearchAdapter(rs, args)` — Object Macro: ưu tiên Google (nếu có key) → DDG → link tìm kiếm
    - Khai báo `GOOGLE_API_KEY`, `GOOGLE_CX`, `WEB_SEARCH_TIMEOUT` (5000ms)
    - Push `'web_search'` vào `_adapterPath`
    - _Yêu cầu: 19.1, 19.2, 19.3, 19.4, 19.7, 19.8_

  - [x] 15.2 Triển khai `extractWebSearchQuery()` trong `app.js`
    - Viết `extractWebSearchQuery(text)` — detect web search prefix, trả về query hoặc null
    - Hỗ trợ prefixes: "google ", "tra cứu ", "tra cuu ", "search ", "web search ", "グーグル ", "ウェブ検索 ", "tìm trên web ", "tìm trên mạng "
    - Tích hợp vào `sendMessage()` — gọi trước khi xử lý RiveScript
    - _Yêu cầu: 19.5_

  - [ ]* 15.3 Viết property test cho web search detection
    - **Property 25: Web search detection chính xác**
    - **Validates: Yêu cầu 19.5**

  - [ ]* 15.4 Viết property test cho web search adapter
    - **Property 26: Web search adapter luôn trả về chuỗi không rỗng**
    - **Validates: Yêu cầu 19.7, 19.8**

- [x] 16. Triển khai Preprocessed Data Pipeline
  - [x] 16.1 Tạo `scripts/preprocess.js` — build script
    - Đọc QA dataset (`data/qa-dataset.json`), specific responses (`data/specific-responses.json`), brain .rive triggers
    - Tokenize, normalize (lowercase, bỏ dấu vi, bỏ punctuation)
    - Tính TF vector, IDF (inverse document frequency), TF-IDF vector cho mỗi câu hỏi
    - Tính synonym group indices cho mỗi từ
    - Tính magnitude cho mỗi TF-IDF vector
    - Output `data/preprocessed.json` với version-based key
    - Thêm script `"preprocess"` vào `package.json`
    - _Yêu cầu: 22.1, 22.2_

  - [x] 16.2 Triển khai `loadPreprocessedData()` và `findBestMatchPreprocessed()` trong `adapters/text-similarity.js`
    - Viết `loadPreprocessedData()` — browser: fetch + localStorage cache (version-based invalidation); Node: fs.readFileSync
    - Viết `getPreprocessedLang(lang)` — lấy preprocessed data cho ngôn ngữ
    - Viết `findBestMatchPreprocessed(input, lang, threshold)` — so khớp tối ưu: TF-IDF cosine + synset preprocessed + Jaccard + Levenshtein
    - Tích hợp vào `bestMatchAdapter` — ưu tiên preprocessed, fallback sang manual
    - _Yêu cầu: 22.3, 22.4, 22.5, 22.6_

  - [ ]* 16.3 Viết property test cho preprocessed data fallback
    - **Property 30: Preprocessed data fallback**
    - **Validates: Yêu cầu 22.3, 22.4**

- [x] 17. Triển khai Response Time Display và URL Linkification
  - [x] 17.1 Triển khai hiển thị thời gian xử lý
    - Cập nhật `appendMessage()` để chấp nhận tham số `responseTime`
    - Tạo element `.response-time` hiển thị "⏱ Xms"
    - Đo thời gian trong `sendMessage()` từ start đến result
    - _Yêu cầu: 23.1, 23.2, 23.3, 23.4_

  - [x] 17.2 Triển khai URL Linkification
    - Viết `linkifyText(text)` — escape HTML entities, detect URL bằng regex, chuyển thành thẻ `<a>`, newline → `<br>`
    - Tích hợp vào `appendMessage()` — sử dụng `innerHTML` thay vì `textContent` khi tin nhắn bot chứa URL
    - _Yêu cầu: 24.1, 24.2, 24.3, 24.4_

  - [ ]* 17.3 Viết property test cho linkifyText
    - **Property 31: linkifyText escape HTML**
    - **Validates: Yêu cầu 24.1, 24.2**

  - [ ]* 17.4 Viết property test cho normalizeInput idempotent
    - **Property 27: normalizeInput idempotent**
    - **Validates: Yêu cầu 20.2, 20.3, 20.4**

  - [ ]* 17.5 Viết property test cho areSynonyms
    - **Property 29: areSynonyms reflexive và symmetric**
    - **Validates: Yêu cầu 21.3, 21.4**

- [x] 18. Checkpoint cuối cùng — Đảm bảo tất cả test pass
  - Đảm bảo tất cả test pass, hỏi người dùng nếu có thắc mắc.

- [x] 19. Triển khai LLM Adapter (WebGPU)
  - [x] 19.1 Tạo `adapters/llm-adapter.js`
    - Khai báo biến trạng thái: `_llmModel`, `_llmTokenizer`, `_llmStatus`, `_llmLastError`, `_llmIsGenerating`, `_llmStoppingCriteria`
    - Viết `setLLMStatusCallback(fn)` — đăng ký callback nhận thông báo trạng thái
    - Viết `setLLMModelId(modelId)` — cấu hình model ID trước khi load
    - Viết `setLLMThinkingEnabled(bool)` và `isLLMThinkingEnabled()` — bật/tắt thinking mode
    - Viết `isWebGPUSupported()` — kiểm tra WebGPU có khả dụng không
    - Viết `loadLLMModel()` — lazy load model qua Transformers.js CDN, thông báo trạng thái qua callback
    - Viết `llmGenerate(userMessage, onToken, history)` — generate text với streaming, dispose past_key_values sau khi xong
    - Viết `llmGenerateWithImage(userMessage, imageDataURL, onToken, history)` — generate với ảnh (resize 448×448)
    - Viết `llmAdapter(rs, args, imageDataURL, onToken, history)` — Object Macro wrapper
    - Viết `cancelLLMGeneration()` — hủy generate qua `InterruptableStoppingCriteria.interrupt()`
    - Viết `isLLMReady()`, `isLLMGenerating()`, `getLLMStatus()`, `getLLMLastError()` — trạng thái
    - Export qua `globalThis` cho Node/test
    - _Yêu cầu: 26.1–26.10_

  - [x] 19.2 Tích hợp LLM Adapter vào `app.js`
    - Khai báo `LLM_MODEL_ID_CONFIG` — model ID mặc định
    - Trong `initBot()`: gọi `setLLMModelId()` và `setLLMStatusCallback(onLLMStatusChange)`
    - Viết `onLLMStatusChange(action, message)` — cập nhật UI theo trạng thái LLM
    - Viết `showLLMLoadingStatus(message)` và `hideLLMLoadingStatus()` — hiển thị/ẩn trạng thái loading
    - Cập nhật `ADAPTER_DISPLAY_NAMES` — thêm `llm_adapter` với tên đa ngôn ngữ
    - _Yêu cầu: 26.7, 31.1, 31.2, 31.3_

  - [x] 19.3 Cập nhật fallback chain trong `sendMessage()`
    - Sau khi Fallback API thất bại: thử `llmAdapter()` với streaming
    - Tạo streaming element qua `createStreamingBotMessage()`, truyền callback qua `createStreamingCallback()`
    - Hiển thị nút Cancel qua `showLLMCancelButton()`
    - Finalize hoặc remove streaming element tùy kết quả
    - Nếu LLM cũng thất bại: hiển thị `getFinalFallbackMessage()`
    - _Yêu cầu: 36.1–36.4_

- [x] 20. Triển khai Chat History
  - [x] 20.1 Tạo `data/chat-history-db.js` — IndexedDB module
    - Khai báo constants: `CHAT_HISTORY_DB_NAME`, `CHAT_HISTORY_DB_VERSION`, `CHAT_HISTORY_STORE_NAME`
    - Viết `openChatHistoryDB()` — mở/tạo IndexedDB với object store `messages` và index `timestamp`
    - Viết `saveChatMessage(role, content, lang)` — lưu tin nhắn với timestamp tự động
    - Viết `getRecentMessages(count)` — lấy N tin nhắn gần nhất, sắp xếp cũ → mới
    - Viết `getMessagesPage(page, pageSize)` — phân trang, trả về `{messages, total, page, totalPages}`
    - Viết `clearAllChatMessages()` — xóa toàn bộ IndexedDB
    - Viết `countChatMessages()` — đếm tổng số tin nhắn
    - Export qua `globalThis` cho Node/test (stub functions khi IndexedDB không khả dụng)
    - _Yêu cầu: 35.1–35.6_

  - [x] 20.2 Triển khai Chat History trong `app.js`
    - Khai báo biến: `_chatHistory`, `_chatHistoryEnabled`, `_chatHistoryMaxTurns`, `_skipHistoryOnce`
    - Viết `addChatHistory(role, content)` — thêm vào session + lưu IndexedDB, strip thinking tags
    - Viết `getChatHistoryForLLM()` — trả về history đã trim theo maxTurns
    - Viết `clearChatHistory()`, `setChatHistoryEnabled()`, `isChatHistoryEnabled()`
    - Viết `setChatHistoryMaxTurns()`, `getChatHistoryMaxTurns()`
    - Viết `loadRecentHistoryToChat()` — tải 10 tin nhắn gần nhất từ IndexedDB khi khởi động
    - Cập nhật `appendMessage()` — tự động gọi `addChatHistory()` cho tin nhắn bot
    - Cập nhật `changeLanguage()` — gọi `clearChatHistory()` khi đổi ngôn ngữ
    - _Yêu cầu: 27.1–27.7_

- [x] 21. Triển khai File Attachment
  - [x] 21.1 Thêm UI đính kèm ảnh vào `index.html`
    - Thêm `#attach-button` (nút đính kèm) vào input area
    - Thêm `#file-input` (input file ẩn, accept="image/*")
    - Thêm `#attachment-preview` (ẩn mặc định) với `#attachment-thumb`, `#attachment-name`, `#attachment-remove`
    - _Yêu cầu: 28.1, 28.2_

  - [x] 21.2 Triển khai File Attachment trong `app.js`
    - Khai báo biến `_attachedImage` — lưu `{dataURL, name}` hoặc null
    - Viết `handleFileAttachment(file)` — đọc file qua FileReader, lưu dataURL, hiển thị preview
    - Viết `clearAttachment()` — xóa ảnh và ẩn preview
    - Viết `consumeAttachment()` — lấy và xóa ảnh khi gửi
    - Cập nhật `sendMessage()` — nếu có ảnh, gửi thẳng qua `llmGenerateWithImage()` bỏ qua RiveScript
    - Cập nhật `appendMessage()` — thêm tham số `imageDataURL`, render `<img>` trong tin nhắn user
    - Gắn event listener: `#attach-button` → click `#file-input`, `#file-input` change → `handleFileAttachment`, `#attachment-remove` → `clearAttachment`
    - _Yêu cầu: 28.1–28.5, 37.1–37.3_

- [x] 22. Triển khai Streaming Messages và Cancel Button
  - [x] 22.1 Triển khai streaming UI trong `app.js`
    - Viết `createStreamingBotMessage()` — tạo element `.streaming` với thinking block (nếu thinking bật) và response block
    - Viết `_parseThinkingText(text)` — tách `<think>...</think>` thành thinking và response
    - Viết `_stripThinkTags(text)` — xóa thinking tags khi thinking tắt
    - Viết `createStreamingCallback(els)` — tạo callback cập nhật element realtime, tách thinking/response
    - Viết `finalizeStreamingMessage(els, finalText, confidence, adapterPath, responseTime)` — finalize: xóa `.streaming`, thêm metadata
    - Viết `removeStreamingMessage(els)` — xóa element khỏi DOM
    - _Yêu cầu: 29.1–29.6_

  - [x] 22.2 Triển khai Cancel Button
    - Viết `showLLMCancelButton()` — tạo và hiển thị nút Cancel với class `.llm-cancel-container`
    - Viết `hideLLMCancelButton()` — ẩn/xóa nút Cancel
    - Gắn event listener: click Cancel → `cancelLLMGeneration()` + `hideLLMCancelButton()`
    - _Yêu cầu: 30.1–30.4_

- [x] 23. Triển khai Send Button State Management
  - [x] 23.1 Triển khai trong `app.js`
    - Viết `setSendingDisabled(placeholder?)` — disable nút gửi + input, thêm class `.disabled`
    - Viết `setSendingEnabled()` — enable lại nút gửi + input, xóa class `.disabled`
    - Cập nhật `sendMessage()` — gọi `setSendingDisabled()` khi bắt đầu, `setSendingEnabled()` trong finally
    - _Yêu cầu: 32.1–32.3_

- [x] 24. Triển khai Settings Panel và History Dialog
  - [x] 24.1 Thêm Settings Panel vào `index.html`
    - Thêm `#settings-button` vào header controls
    - Thêm `#settings-panel` (ẩn mặc định) với: `#thinking-toggle` (checkbox), `#history-toggle` (checkbox), `#history-max-turns` (number input)
    - _Yêu cầu: 33.1–33.4_

  - [x] 24.2 Triển khai Settings Panel trong `app.js`
    - Viết `toggleSettingsPanel()` — toggle class `.hidden` trên `#settings-panel`
    - Gắn event listener: `#settings-button` → `toggleSettingsPanel`, `#thinking-toggle` → `setLLMThinkingEnabled`, `#history-toggle` → `setChatHistoryEnabled`, `#history-max-turns` → `setChatHistoryMaxTurns`
    - _Yêu cầu: 33.5_

  - [x] 24.3 Thêm History Dialog vào `index.html`
    - Thêm `#view-history-button` và `#clear-history-button` vào Settings Panel
    - Thêm `#history-overlay` (modal) với: `#history-tab-db`, `#history-tab-session`, `#history-list`, `#history-paging`, `#history-close-button`
    - _Yêu cầu: 34.1–34.5_

  - [x] 24.4 Triển khai History Dialog trong `app.js`
    - Viết `openHistoryDialog()` — mở dialog, load trang đầu tiên
    - Viết `closeHistoryDialog()` — đóng dialog
    - Viết `_loadHistoryPage()` — load dữ liệu từ IndexedDB hoặc session tùy tab, render với pagination
    - Viết `clearAllHistory()` — xóa IndexedDB + session, refresh dialog nếu đang mở
    - Gắn event listener: tab buttons, close button, overlay click, view/clear history buttons
    - _Yêu cầu: 34.1–34.6_

- [x] 25. Cập nhật `index.html` và `style.css` cho tính năng mới
  - [x] 25.1 Cập nhật `index.html`
    - Thêm thẻ `<script>` tải `adapters/llm-adapter.js` trước `app.js`
    - Thêm thẻ `<script>` tải `data/chat-history-db.js` trước `app.js`
    - Thêm Transformers.js CDN script (lazy load trong llm-adapter.js)
    - _Yêu cầu: 25.2, 26.1_

  - [x] 25.2 Cập nhật `style.css`
    - Thêm `.llm-loading-status` — trạng thái loading model
    - Thêm `.llm-cancel-container`, `.llm-cancel-button` — nút Cancel
    - Thêm `.streaming` — tin nhắn đang stream
    - Thêm `.llm-thinking-block`, `.llm-thinking-label`, `.llm-thinking-content` — thinking block
    - Thêm `.message-image` — ảnh đính kèm trong tin nhắn
    - Thêm `.disabled` — trạng thái vô hiệu hóa nút gửi
    - Thêm `#attachment-preview`, `#attachment-thumb`, `#attachment-name`, `#attachment-remove` — preview ảnh
    - Thêm `#settings-panel`, `#history-overlay`, `.history-item`, `.history-meta`, `.history-content` — settings và history
    - _Yêu cầu: 29.6, 30.4, 31.1, 32.3, 37.3_

- [x] 26. Checkpoint cuối — Đảm bảo tất cả test pass
  - Đảm bảo tất cả test pass sau khi tích hợp các tính năng mới.

- [x] 27. Mở rộng IndexedDB — Attachment Storage
  - [x] 27.1 Cập nhật `data/chat-history-db.js` — thêm object store `attachments`
    - Tăng `CHAT_HISTORY_DB_VERSION` lên 2, thêm migration trong `onupgradeneeded`
    - Tạo object store `attachments` (keyPath: `id`, autoIncrement) với index `messageId`
    - Viết `saveAttachment(messageId, file)` — đọc `File` thành `ArrayBuffer` qua `FileReader`, lưu vào store
    - Viết `getAttachment(attachmentId)` — lấy record attachment theo id
    - Viết `getAttachmentByMessageId(messageId)` — lấy attachment theo messageId
    - Viết `attachmentToDataURL(attachment)` — convert `ArrayBuffer` → base64 data URL để render `<img>`
    - Viết `clearAllAttachments()` — xóa toàn bộ store attachments
    - Cập nhật `saveChatMessage(role, content, lang, file?)` — nếu có `file`, gọi `saveAttachment()` sau khi lưu message
    - Cập nhật stub functions cho Node/test environment
    - _Yêu cầu: 38.1–38.8_

  - [x] 27.2 Tích hợp attachment storage vào `app.js`
    - Cập nhật `addChatHistory(role, content, file?)` — truyền `file` xuống `saveChatMessage()`
    - Cập nhật `sendMessage()` — khi có ảnh đính kèm, truyền `File` object vào `addChatHistory()`
    - Cập nhật `_loadHistoryPage()` trong History Dialog — với mỗi message có attachment, gọi `getAttachmentByMessageId()` và render thumbnail
    - _Yêu cầu: 38.7_

- [x] 28. Triển khai Voice Adapter
  - [x] 28.1 Tạo `adapters/voice-adapter.js`
    - Khai báo `SPEECH_LOCALE_MAP` — ánh xạ `vi → vi-VN`, `en → en-US`, `ja → ja-JP`
    - Viết `initVoiceAdapter()` — kiểm tra `SpeechRecognition` và `SpeechSynthesis` support, trả về `{sttSupported, ttsSupported}`
    - Viết `getVoicesForLang(lang)` — lấy `speechSynthesis.getVoices()`, filter theo locale prefix, sort ưu tiên `localService: true`
    - Viết `getDefaultVoice(lang)` — trả về voice tốt nhất (localService trước, rồi theo thứ tự danh sách)
    - Viết `startVoiceInput(lang, onInterim, onFinal)` — tạo `SpeechRecognition` với `lang`, `continuous: false`, `interimResults: true`; gọi `onInterim(text)` khi có interim result, `onFinal(text)` khi có final result
    - Viết `stopVoiceInput()` — gọi `recognition.stop()`
    - Viết `isVoiceInputActive()` — trả về trạng thái đang nghe
    - Viết `speakText(text, lang, voiceName?)` — tạo `SpeechSynthesisUtterance`, set voice theo `voiceName` hoặc `getDefaultVoice(lang)`, gọi `speechSynthesis.speak()`
    - Viết `stopSpeaking()` — gọi `speechSynthesis.cancel()`
    - Viết `isSpeaking()` — trả về `speechSynthesis.speaking`
    - Export qua `globalThis` cho Node/test (stub functions)
    - _Yêu cầu: 39.2, 39.4, 39.9, 40.1, 40.3, 40.4, 40.7, 40.8_

- [x] 29. Triển khai Voice Input (STT) trong `app.js`
  - [x] 29.1 Thêm UI Voice Input vào `index.html`
    - Thêm `#voice-input-button` (nút microphone 🎤) vào input area, ẩn mặc định
    - Thêm CSS class `.voice-listening` (animation pulse) cho trạng thái đang nghe
    - _Yêu cầu: 39.1, 39.3_

  - [x] 29.2 Triển khai Voice Input logic trong `app.js`
    - Viết `startVoiceInput()` — gọi `voiceAdapter.startVoiceInput()`, cập nhật UI nút (thêm `.voice-listening`), điền interim results vào `#message-input`
    - Viết `stopVoiceInput()` — gọi `voiceAdapter.stopVoiceInput()`, xóa `.voice-listening`
    - Trong `onFinal` callback: điền text vào input, gọi `sendMessage()` tự động
    - Gắn event listener: `#voice-input-button` click → toggle `startVoiceInput()`/`stopVoiceInput()`
    - IF `sttSupported = false`: ẩn `#voice-input-button`
    - _Yêu cầu: 39.3, 39.5, 39.6, 39.7, 39.8, 39.9_

- [x] 30. Triển khai Voice Output (TTS) trong `app.js`
  - [x] 30.1 Thêm UI Voice Output vào Settings Panel
    - Thêm `#voice-output-toggle` (checkbox) vào Settings Panel
    - Thêm `#voice-input-toggle` (checkbox) vào Settings Panel
    - Thêm `#tts-voice-select` (dropdown) vào Settings Panel
    - IF `ttsSupported = false`: ẩn toàn bộ TTS controls
    - _Yêu cầu: 40.5, 40.10, 40.11, 40.12_

  - [x] 30.2 Triển khai TTS logic trong `app.js`
    - Viết `speakText(text, lang)` — gọi `voiceAdapter.speakText()` với voice từ `_selectedVoiceName`
    - Viết `stopSpeaking()` — gọi `voiceAdapter.stopSpeaking()`
    - Viết `updateVoiceSelector(lang)` — populate `#tts-voice-select` với `getVoicesForLang(lang)`, chọn `getDefaultVoice(lang)` mặc định
    - Viết `onBotReplyReady(text)` — gọi `speakText()` nếu `isVoiceOutputEnabled()`
    - Gắn event listener: `#tts-voice-select` change → cập nhật `_selectedVoiceName`; `speechSynthesis.onvoiceschanged` → `updateVoiceSelector(currentLang)`
    - Cập nhật `appendMessage()` và `finalizeStreamingMessage()` — gọi `onBotReplyReady(text)` sau khi hiển thị
    - _Yêu cầu: 40.2, 40.6, 40.7, 40.8, 40.9_

- [x] 31. Triển khai Interaction Mode (4 chế độ tương tác)
  - [x] 31.1 Thêm UI Interaction Mode vào Settings Panel
    - Thêm `#interaction-mode-select` (select dropdown hoặc radio group) với 4 options: `text-text`, `text-voice`, `voice-text`, `voice-voice`
    - Thêm `#interaction-mode-badge` (indicator nhỏ trong header) hiển thị badge chế độ hiện tại
    - Vô hiệu hóa các option cần API không được hỗ trợ
    - _Yêu cầu: 41.2, 41.8, 41.10_

  - [x] 31.2 Triển khai Interaction Mode logic trong `app.js`
    - Khai báo `_interactionMode = 'text-text'` và `_selectedVoiceName = null`
    - Viết `setInteractionMode(mode)` — cập nhật `_interactionMode`, toggle hiển thị `#voice-input-button`, bật/tắt TTS auto-speak, cập nhật badge
    - Viết `getInteractionMode()`, `isVoiceInputEnabled()`, `isVoiceOutputEnabled()`
    - Gắn event listener: `#interaction-mode-select` change → `setInteractionMode()`
    - Cập nhật `changeLanguage()` — gọi `updateVoiceSelector(lang)` khi đổi ngôn ngữ
    - Xử lý Voice → Voice feedback loop: trong `startVoiceInput()`, gọi `stopSpeaking()` trước
    - _Yêu cầu: 41.1–41.10_

- [x] 32. Cập nhật `index.html` và `style.css` cho Voice + Interaction Mode
  - [x] 32.1 Cập nhật `index.html`
    - Thêm thẻ `<script>` tải `adapters/voice-adapter.js` trước `app.js`
    - Thêm `#voice-input-button`, `#interaction-mode-select`, `#interaction-mode-badge`, `#voice-output-toggle`, `#voice-input-toggle`, `#tts-voice-select` vào đúng vị trí
    - _Yêu cầu: 39.1, 40.5, 41.2, 41.10_

  - [x] 32.2 Cập nhật `style.css`
    - Thêm `.voice-listening` — animation pulse cho nút microphone khi đang nghe
    - Thêm `#voice-input-button` — styling nút microphone
    - Thêm `#interaction-mode-badge` — badge nhỏ hiển thị chế độ hiện tại
    - Thêm `#tts-voice-select` — styling dropdown chọn voice
    - _Yêu cầu: 39.3, 41.10_

- [x] 34. Triển khai Chat History Retention Policy
  - [x] 34.1 Cập nhật `data/chat-history-db.js` — thêm `applyRetentionPolicy(mode, value)`
    - Viết `applyRetentionPolicy(mode, value)` — mode="count": xóa messages cũ nhất cho đến khi còn ≤ value; mode="days": xóa messages có timestamp < Date.now() - value*86400000
    - Cập nhật `saveChatMessage()` — gọi `applyRetentionPolicy()` sau khi lưu thành công, đọc config từ localStorage
    - Viết `getRetentionConfig()` — đọc config từ localStorage, trả về `{mode, value}` với default `{mode:"count", value:50}`
    - Viết `setRetentionConfig(mode, value)` — lưu config vào localStorage và gọi `applyRetentionPolicy()` ngay
    - Cập nhật stub functions cho Node/test environment
    - _Yêu cầu: 42.5, 42.6, 42.7, 42.8, 42.9_

  - [x] 34.2 Thêm UI Retention Settings vào Settings Panel trong `index.html`
    - Thêm `#retention-mode-select` (select với 2 options: "count" và "days")
    - Thêm `#retention-max-count` (number input, mặc định 50, hiển thị khi mode="count")
    - Thêm `#retention-max-days` (number input, mặc định 30, hiển thị khi mode="days")
    - _Yêu cầu: 42.2, 42.3, 42.4_

  - [x] 34.3 Triển khai Retention Settings trong `app.js`
    - Gắn event listener: `#retention-mode-select` change → `setRetentionConfig(mode, currentValue)`, toggle hiển thị input tương ứng
    - Gắn event listener: `#retention-max-count` change → `setRetentionConfig("count", value)`
    - Gắn event listener: `#retention-max-days` change → `setRetentionConfig("days", value)`
    - Trong `initializeApp()`: đọc config từ localStorage và populate UI
    - _Yêu cầu: 42.1, 42.9, 42.10_

  - [ ]* 34.4 Viết property test cho applyRetentionPolicy
    - **Property 41: applyRetentionPolicy count mode**
    - **Property 42: applyRetentionPolicy days mode**
    - **Validates: Yêu cầu 42.5, 42.6, 42.7**

- [x] 35. Triển khai Object Macros Panel — Enable/Disable Adapter
  - [x] 35.1 Cập nhật `updateMacrosList(lang)` trong `app.js` — đọc động từ ADAPTER_REGISTRY
    - Refactor `updateMacrosList()` để render từ `ADAPTER_REGISTRY` (biến toàn cục từ data-loader.js) thay vì hard-code
    - Render toggle (checkbox) bên cạnh mỗi adapter, phản ánh `active` state
    - Ẩn toggle cho `voice-adapter` (ngoại lệ bắt buộc)
    - Áp dụng CSS class `.macro-item.disabled` cho adapter có `active: false`
    - _Yêu cầu: 43.1, 43.2, 43.3, 43.6, 43.7_

  - [x] 35.2 Triển khai `setAdapterActive(adapterKey, isActive)` trong `app.js`
    - Viết `setAdapterActive(adapterKey, isActive)` — cập nhật `ADAPTER_REGISTRY[adapterKey].active`, lưu vào localStorage
    - Viết `getAdapterStates()` — đọc từ localStorage (key: `hikari_adapter_states`), trả về object `{[key]: boolean}`
    - Viết `saveAdapterStates()` — lưu `ADAPTER_REGISTRY` active states vào localStorage
    - Gắn event listener: toggle change → `setAdapterActive(key, checked)`
    - Trong `initializeApp()`: đọc adapter states từ localStorage và apply vào `ADAPTER_REGISTRY`
    - _Yêu cầu: 43.4, 43.8, 43.10_

  - [x] 35.3 Cập nhật `initBot(lang)` — chỉ đăng ký adapter active
    - Trong `registerAdapters(bot, lang)`: kiểm tra `ADAPTER_REGISTRY[key].active` trước khi gọi `bot.setSubroutine()`
    - Bỏ qua adapter có `active: false`
    - _Yêu cầu: 43.9_

  - [x] 35.4 Cập nhật `logicAdapterDispatcher` — bỏ qua adapter disabled
    - Trong dispatcher, trước khi gọi mỗi adapter con, kiểm tra `ADAPTER_REGISTRY[adapterKey]?.active !== false`
    - Nếu adapter disabled, bỏ qua và tiếp tục với adapter tiếp theo
    - _Yêu cầu: 43.5_

  - [x] 35.5 Cập nhật `style.css` — thêm style cho adapter disabled
    - Thêm `.macro-item.disabled` với `opacity: 0.5` và `pointer-events: none` cho nội dung (không phải toggle)
    - _Yêu cầu: 43.7_

- [x] 36. Triển khai Adapter Prefix Command
  - [x] 36.1 Triển khai `parseAdapterPrefixCommand(input)` trong `app.js`
    - Viết `parseAdapterPrefixCommand(input)` — dùng regex `/^\/([a-z_]+)\s+(.+)$/` để parse input
    - Kiểm tra key có trong `ADAPTER_REGISTRY` với `active: true` và không phải `voice-adapter`
    - Trả về `{adapterKey, content}` nếu hợp lệ, `null` nếu không
    - _Yêu cầu: 44.1, 44.4, 44.6, 44.9_

  - [x] 36.2 Triển khai visual feedback badge trong `app.js` và `index.html`
    - Thêm element `#adapter-prefix-badge` (ẩn mặc định) vào `index.html` phía trên `#message-input`
    - Viết `showAdapterPrefixBadge(adapterKey)` — hiển thị badge với tên adapter (từ ADAPTER_DISPLAY_NAMES) và icon 🔧
    - Viết `hideAdapterPrefixBadge()` — ẩn badge
    - Gắn event listener: `#message-input` input event → gọi `parseAdapterPrefixCommand()` → show/hide badge theo kết quả
    - Thêm CSS `.adapter-prefix-badge` vào `style.css`
    - _Yêu cầu: 44.2, 44.7, 44.8_

  - [x] 36.3 Tích hợp Adapter Prefix Command vào `sendMessage()`
    - Trong `sendMessage()`, trước khi xử lý web search và RiveScript: gọi `parseAdapterPrefixCommand(input)`
    - Nếu kết quả không null: gọi trực tiếp adapter tương ứng với `content`, bỏ qua toàn bộ fallback chain
    - Nếu không có content (chỉ có prefix): hiển thị thông báo yêu cầu nhập nội dung
    - Cập nhật adapter path breadcrumb: thêm "📌" prefix vào tên adapter khi dùng prefix command
    - Ẩn badge sau khi gửi
    - _Yêu cầu: 44.3, 44.5, 44.10_

  - [ ]* 36.4 Viết property test cho parseAdapterPrefixCommand
    - **Property 43: parseAdapterPrefixCommand nhận diện chính xác**
    - **Validates: Yêu cầu 44.1, 44.4, 44.9**

- [x] 33. Checkpoint — Đảm bảo tất cả test pass
  - Đảm bảo tất cả test pass sau khi tích hợp Voice + Interaction Mode.

## Ghi chú

- Các task đánh dấu `*` là tùy chọn và có thể bỏ qua để triển khai MVP nhanh hơn
- Mỗi task tham chiếu đến yêu cầu cụ thể để đảm bảo truy xuất nguồn gốc
- Checkpoint đảm bảo kiểm tra tăng dần sau mỗi giai đoạn
- Property test kiểm tra thuộc tính đúng đắn phổ quát, unit test kiểm tra ví dụ cụ thể và edge case
- Ứng dụng sử dụng JavaScript thuần (vanilla JS), không cần build tool
- Dữ liệu được tách ra tệp riêng (.rive và JSON) để dễ bảo trì
- Trong môi trường Node/test, dữ liệu được tải qua `fs.readFileSync` trong IIFE với `globalThis`
- Cấu trúc tệp dự án:
  ```
  index.html          — Entry point, loads brain.js + data-loader.js + adapters/*.js + app.js
  style.css           — Styles including help dialog, adapter-path breadcrumb, response-time, bot links
  app.js              — Main logic (no inline data, uses IIFE for Node data loading)
  brain.js            — Browser loader for .rive files
  data-loader.js      — Browser loader for JSON data files
  brain/vi.rive       — Vietnamese RiveScript brain data (with wildcard variants + web search fallback)
  brain/en.rive       — English RiveScript brain data (with wildcard variants + web search fallback)
  brain/ja.rive       — Japanese RiveScript brain data (with web search fallback)
  adapters/
  ├── text-similarity.js    — 4 algorithms (Levenshtein + Jaccard + Cosine + Synset) + preprocessed data support
  ├── specific-response.js  — Exact match Q&A adapter
  ├── time-adapter.js       — Time/date/day adapter
  ├── math-adapter.js       — Mathematical evaluation adapter
  ├── unit-conversion.js    — Unit conversion adapter
  ├── best-match.js         — Best match adapter (uses preprocessed data when available)
  ├── logic-dispatcher.js   — Logic adapter dispatcher
  ├── adapter-registry.js   — Adapter metadata, display names, registration (includes web_search, llm_adapter)
  ├── web-search.js         — Web search via DuckDuckGo + Google
  ├── llm-adapter.js        — LLM Adapter (WebGPU, Transformers.js, Qwen3.5-0.8B, streaming, multimodal)
  └── voice-adapter.js      — Voice Adapter (STT via SpeechRecognition, TTS via SpeechSynthesis)
  scripts/
  └── preprocess.js         — Build script: generates data/preprocessed.json
  data/
  ├── preprocessed.json     — Pre-computed similarity data (TF-IDF, synGroups, magnitudes)
  ├── specific-responses.json
  ├── qa-dataset.json
  ├── adapter-registry.json — Includes web_search and llm_adapter entries
  ├── help-content.json
  └── chat-history-db.js    — IndexedDB module (messages + attachments stores)
  ```
