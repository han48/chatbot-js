# 🌟 Hikari Chatbot

🌐 [English](README.en.md) | [日本語](README.ja.md) | **Tiếng Việt**

Chatbot tĩnh đa ngôn ngữ chạy hoàn toàn trên trình duyệt, sử dụng [RiveScript](https://www.rivescript.com/) làm engine hội thoại. Không cần backend, không cần build tool.

**Demo:** Mở `index.html` qua bất kỳ static server nào.

## Tính năng

- 💬 Hội thoại 3 ngôn ngữ: Tiếng Việt, English, 日本語
- 🇻🇳 Xử lý tiếng Việt có dấu (dual-reply strategy)
- 🔍 Tìm kiếm web (DuckDuckGo, không cần API key)
- 🧮 Tính toán biểu thức (`tính 2 + 3`)
- 🔄 Chuyển đổi đơn vị (`đổi 5 km sang m`)
- 🕐 Xem thời gian, ngày tháng (`mấy giờ rồi?`)
- 📊 Hiển thị confidence, adapter path, thời gian xử lý
- 📖 Help dialog đa ngôn ngữ
- ⚡ Preprocessed TF-IDF data cho matching nhanh
- 📱 Responsive (mobile + desktop)

## Bắt đầu nhanh

```bash
# Clone
git clone <repo-url>
cd hikari-chatbot

# Cài devDependencies (chỉ cần cho test)
npm install

# Chạy
npx http-server -p 8080
# Mở http://localhost:8080
```

Hoặc mở `index.html` trực tiếp qua bất kỳ static server nào (Live Server, nginx, Apache, GitHub Pages...).

## Cấu trúc dự án

```
├── index.html              # Entry point
├── style.css               # Giao diện
├── app.js                  # Logic chính
├── brain.js                # Loader cho .rive files
├── data-loader.js          # Loader cho JSON data
│
├── brain/                  # Dữ liệu hội thoại RiveScript
│   ├── vi.rive
│   ├── en.rive
│   └── ja.rive
│
├── data/                   # Dữ liệu JSON
│   ├── qa-dataset.json          # Q&A cho Best Match
│   ├── specific-responses.json  # Exact match Q&A
│   ├── adapter-registry.json    # Metadata adapters
│   ├── help-content.json        # Nội dung help dialog
│   └── preprocessed.json        # TF-IDF vectors (generated)
│
├── adapters/               # Logic adapters (9 files)
│   ├── text-similarity.js       # Levenshtein + Jaccard + Cosine + Synset
│   ├── specific-response.js     # Exact match
│   ├── time-adapter.js          # Thời gian / ngày / thứ
│   ├── math-adapter.js          # Tính toán
│   ├── unit-conversion.js       # Chuyển đổi đơn vị
│   ├── best-match.js            # Fuzzy match (dùng preprocessed data)
│   ├── logic-dispatcher.js      # Dispatcher theo priority
│   ├── web-search.js            # DuckDuckGo + Google
│   └── adapter-registry.js      # Đăng ký + display names
│
├── scripts/
│   └── preprocess.js       # Build preprocessed.json
│
└── tests/                  # Vitest + jsdom (32 tests)
```

## Cách sử dụng

| Nhập | Adapter | Ví dụ |
|------|---------|-------|
| Chào hỏi | RiveScript | `xin chào`, `hello`, `こんにちは` |
| Hỏi tên | RiveScript | `bạn là ai?`, `who are you` |
| Tính toán | Math | `tính 2 + 3`, `calculate 15 * 4` |
| Đổi đơn vị | Unit Conversion | `đổi 5 km sang m`, `convert 100 f to c` |
| Xem giờ | Time | `mấy giờ rồi?`, `what time is it` |
| Tìm kiếm web | Web Search | `google javascript`, `tra cứu RiveScript` |
| Hỏi kiến thức | Best Match | `chatbot là gì`, `what is AI` |
| Xử lý tổng hợp | Logic Dispatcher | `xử lý 2 + 3` |

## Adapter System

7 adapters được đăng ký qua `bot.setSubroutine()`:

| Adapter | Mô tả | Trigger mẫu |
|---------|-------|-------------|
| `specific_response` | Exact match Q&A | `hỏi phiên bản` |
| `time_adapter` | Thời gian / ngày / thứ | `mấy giờ`, `hôm nay ngày mấy` |
| `mathematical_evaluation` | Tính toán (không dùng eval) | `tính 2 + 3` |
| `unit_conversion` | Chuyển đổi đơn vị | `đổi 5 km sang m` |
| `best_match` | Fuzzy match (4 thuật toán) | `tìm kiếm hikari là gì` |
| `logic_adapter` | Dispatcher theo priority | `xử lý ...` |
| `web_search` | DuckDuckGo / Google | `google ...` |

## Text Similarity

Kết hợp 4 thuật toán (25% mỗi thuật toán):

- **Levenshtein** — edit distance (character-level)
- **Jaccard** — word-set overlap
- **Cosine** — TF vector angle
- **Synset** — synonym-aware matching (17 nhóm từ đồng nghĩa)

Hỗ trợ preprocessed TF-IDF data để matching nhanh hơn tại runtime.

## Xử lý tiếng Việt

- Bỏ dấu tự động: `"xin chào"` → `"xin chao"` → match trigger
- Dual-reply: gửi cả input gốc + input bỏ dấu, chọn confidence cao hơn
- Bỏ modal particles: `"mấy giờ rồi vậy?"` → `"may gio"`
- Bỏ dấu câu (giữ `+ - * /` cho toán)

## Tìm kiếm web

Mặc định dùng DuckDuckGo Instant Answer API (miễn phí, không cần key). Trả về tóm tắt Wikipedia cho topic lớn, link tìm kiếm cho topic nhỏ.

Tùy chọn: cấu hình Google Custom Search API trong `adapters/web-search.js`:

```js
var GOOGLE_API_KEY = 'your-key';
var GOOGLE_CX = 'your-search-engine-id';
```

## Preprocessed Data

Khi thay đổi dữ liệu (QA, specific responses, brain files):

```bash
npm run preprocess
```

Script đọc tất cả data sources, tính TF-IDF vectors + synonym groups, output `data/preprocessed.json`. Client cache trong localStorage.

## Testing

```bash
npm test          # Chạy 32 tests (Vitest + jsdom)
npm run preprocess # Rebuild preprocessed data
```

## Tùy chỉnh

### Thêm câu hỏi-trả lời

Sửa `data/qa-dataset.json` hoặc `data/specific-responses.json`, rồi chạy `npm run preprocess`.

### Thêm trigger RiveScript

Sửa `brain/vi.rive` (hoặc `en.rive`, `ja.rive`), rồi chạy `npm run preprocess`.

### Thêm adapter mới

1. Tạo file `adapters/my-adapter.js`
2. Thêm entry vào `data/adapter-registry.json`
3. Thêm vào `ADAPTER_DISPLAY_NAMES` trong `adapters/adapter-registry.js`
4. Thêm vào `ADAPTER_FUNCTIONS` trong `registerAdapters()`
5. Thêm trigger trong `brain/*.rive`: `+ my trigger *` → `- <call>my_adapter <star></call>`
6. Thêm `<script>` tag trong `index.html`

### Cấu hình Fallback API

Sửa trong `app.js`:

```js
const FALLBACK_API_URL = 'https://your-api.com/chat';
const FALLBACK_API_TIMEOUT = 5000;
```

## Tech Stack

- **Frontend:** HTML + CSS + JavaScript (vanilla, không framework)
- **Chat Engine:** [RiveScript](https://www.rivescript.com/) (CDN)
- **Testing:** [Vitest](https://vitest.dev/) + [jsdom](https://github.com/jsdom/jsdom) + [fast-check](https://github.com/dubzzz/fast-check)
- **Web Search:** DuckDuckGo Instant Answer API
- **Build:** Node.js (chỉ cho preprocessing + testing)

## Rule-based Chatbot vs AI Agent (LLM)

Hikari là rule-based chatbot. Dưới đây là so sánh với AI Agent dùng LLM (ChatGPT, Claude, Gemini...):

### Tổng quan

| Tiêu chí | Rule-based Chatbot (Hikari) | AI Agent (LLM) |
|-----------|---------------------------|-----------------|
| Cách hoạt động | Pattern matching (trigger → response) | Neural network sinh text |
| Dữ liệu training | Viết tay (`.rive` files, JSON) | Huấn luyện trên hàng tỷ token |
| Khả năng hiểu | Chỉ hiểu pattern đã định nghĩa | Hiểu ngữ cảnh, ngữ nghĩa sâu |
| Phản hồi | Cố định, có thể dự đoán | Sinh mới mỗi lần, sáng tạo |
| Độ chính xác | 100% cho pattern đã định nghĩa | Có thể "hallucinate" (bịa thông tin) |

### Ưu điểm Rule-based Chatbot

| Ưu điểm | Chi tiết |
|----------|---------|
| **Không cần server/API** | Chạy hoàn toàn trên browser, không tốn chi phí hosting AI |
| **Không tốn tiền per-request** | LLM API tính phí theo token ($0.01–$0.06/1K tokens). Rule-based = $0 |
| **Phản hồi tức thì** | < 10ms. LLM thường 500ms–3s |
| **Kiểm soát hoàn toàn** | Biết chính xác bot sẽ trả lời gì. Không có hallucination |
| **Bảo mật dữ liệu** | Không gửi dữ liệu người dùng ra bên ngoài |
| **Offline capable** | Hoạt động không cần internet (trừ web search) |
| **Dễ debug** | Trigger → response rõ ràng. Confidence + adapter path hiển thị |
| **Nhẹ** | Toàn bộ app < 500KB. LLM model = hàng GB |
| **Tuân thủ quy định** | Dễ audit, dễ chứng minh bot không nói sai (compliance, regulated industries) |

### Ưu điểm AI Agent (LLM)

| Ưu điểm | Chi tiết |
|----------|---------|
| **Hiểu ngôn ngữ tự nhiên** | Hiểu câu phức tạp, ngữ cảnh, ẩn ý. Rule-based chỉ match pattern |
| **Không cần viết rules** | Tự hiểu mà không cần định nghĩa từng trigger. Tiết kiệm thời gian phát triển |
| **Xử lý câu chưa gặp** | Trả lời được câu hỏi hoàn toàn mới. Rule-based → "Mình chưa hiểu" |
| **Đa nhiệm** | Tóm tắt, dịch, viết code, phân tích... trong cùng 1 conversation |
| **Ngữ cảnh hội thoại** | Nhớ context qua nhiều lượt chat. Rule-based mỗi lượt độc lập |
| **Đa ngôn ngữ tự nhiên** | Tự hiểu 100+ ngôn ngữ. Rule-based phải viết riêng cho từng ngôn ngữ |
| **Cải thiện liên tục** | Fine-tune, RAG, prompt engineering. Rule-based phải viết thêm rules |

### Nhược điểm mỗi loại

| Nhược điểm | Rule-based Chatbot | AI Agent (LLM) |
|------------|-------------------|-----------------|
| Giới hạn hiểu biết | Chỉ trả lời được câu đã có rule | Có thể bịa thông tin (hallucination) |
| Mở rộng | Thêm rule thủ công, tốn thời gian | Chi phí API tăng theo lượng request |
| Ngữ cảnh | Không nhớ context giữa các lượt | Token limit (context window) |
| Chi phí phát triển | Viết rules tốn thời gian ban đầu | Cần prompt engineering, fine-tuning |
| Latency | Tức thì | 500ms–3s (API call) |
| Chi phí vận hành | ~$0 (static hosting) | $50–$10,000+/tháng tùy lượng request |
| Privacy | Dữ liệu ở local | Gửi data đến API bên thứ 3 |
| Deterministic | Luôn cùng output cho cùng input | Output khác nhau mỗi lần |

### Khi nào dùng gì?

| Tình huống | Nên dùng |
|-----------|----------|
| FAQ bot, hướng dẫn sử dụng, menu bot | Rule-based |
| Budget thấp, không muốn tốn phí API | Rule-based |
| Cần kiểm soát 100% nội dung phản hồi | Rule-based |
| Regulated industry (y tế, tài chính, pháp lý) | Rule-based (dễ audit) |
| Chatbot nội bộ đơn giản | Rule-based |
| Customer support phức tạp | AI Agent |
| Cần hiểu ngữ cảnh, câu hỏi mở | AI Agent |
| Đa nhiệm (dịch, tóm tắt, phân tích) | AI Agent |
| Lượng câu hỏi đa dạng, không thể viết hết rules | AI Agent |
| **Kết hợp cả hai** | Rule-based xử lý FAQ + AI Agent fallback cho câu phức tạp |

### Hikari's Hybrid Approach

Hikari kết hợp cả hai: rule-based (RiveScript) cho câu hỏi đã biết + smart fallback chain cho câu chưa biết:

```
User input
  │
  ├─ RiveScript trigger match (confidence ≥ 50%) → Phản hồi tức thì
  │
  ├─ bestMatchAdapter (TF-IDF + Synset) → Fuzzy match từ Q&A dataset
  │
  ├─ Fallback API (configurable) → Có thể trỏ đến LLM API
  │
  └─ Web Search (DuckDuckGo) → Tìm kiếm thông tin
```

Bạn có thể biến Hikari thành hybrid bot bằng cách trỏ `FALLBACK_API_URL` đến một LLM API (OpenAI, Claude, Gemini...) — khi rule-based không match, LLM sẽ xử lý.

## Tài liệu

- [Spec](/.kiro/specs/hikari-chatbot/) — requirements, design, tasks

## License

MIT
