# Kế hoạch Triển khai: Hikari Chatbot

## Tổng quan

Triển khai chatbot tĩnh Hikari sử dụng HTML + CSS + JavaScript thuần với RiveScript qua CDN. Ứng dụng hỗ trợ 3 ngôn ngữ (Việt, Anh, Nhật), hiển thị match confidence, API fallback với smart fallback cục bộ, danh sách Object Macros, 7 Logic Adapter (Object Macros) tương tự ChatterBot (bao gồm web_search), xử lý tiếng Việt có dấu (dual-reply), help dialog đa ngôn ngữ, adapter path breadcrumb, wildcard variant triggers, tìm kiếm web (DuckDuckGo + Google), thuật toán tương đồng nâng cao (4 thuật toán: Levenshtein + Jaccard + Cosine + Synset), preprocessed data pipeline (TF-IDF), input normalization nâng cao (modal particles), hiển thị thời gian xử lý, và URL linkification. Dữ liệu được tách ra các tệp `.rive` và JSON riêng biệt, adapter được tách thành tệp riêng trong `adapters/`. Kiểm thử bằng Vitest + fast-check.

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
  ├── adapter-registry.js   — Adapter metadata, display names, registration (includes web_search)
  └── web-search.js         — Web search via DuckDuckGo + Google
  scripts/
  └── preprocess.js         — Build script: generates data/preprocessed.json
  data/
  ├── preprocessed.json     — Pre-computed similarity data (TF-IDF, synGroups, magnitudes)
  ├── specific-responses.json
  ├── qa-dataset.json
  ├── adapter-registry.json — Includes web_search entry
  └── help-content.json
  ```
