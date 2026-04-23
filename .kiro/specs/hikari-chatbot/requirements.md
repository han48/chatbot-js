# Tài liệu Yêu cầu

## Giới thiệu

Hikari là một chatbot tĩnh đơn giản được xây dựng trên nền tảng web tĩnh (static web), sử dụng thư viện RiveScript để xử lý hội thoại. Chatbot hỗ trợ giao tiếp bằng ba ngôn ngữ: tiếng Việt, tiếng Anh và tiếng Nhật. Ứng dụng chỉ sử dụng HTML, CSS, JavaScript thuần (vanilla) và tải thư viện RiveScript qua CDN, không cần công cụ build hay quản lý gói.

Dữ liệu hội thoại (Brain Data) được lưu trong các tệp `.rive` riêng biệt, và các dữ liệu cấu hình (specific responses, Q&A dataset, adapter registry, help content) được lưu trong các tệp JSON riêng biệt. Ứng dụng hỗ trợ xử lý tiếng Việt có dấu (diacritics), hiển thị chuỗi adapter đã xử lý (adapter path breadcrumb), popup hướng dẫn sử dụng (help dialog), và cơ chế smart fallback cục bộ trước khi gọi API bên ngoài.

Ứng dụng còn tích hợp tìm kiếm web (Web Search Adapter) qua DuckDuckGo Instant Answer API, hệ thống tiền xử lý dữ liệu (Preprocessed Data Pipeline) để tối ưu hóa so khớp văn bản, thuật toán tương đồng nâng cao (Cosine Similarity + Synset Similarity), hiển thị thời gian xử lý (Response Time), và chuyển đổi URL thành liên kết nhấp được (URL Linkification).

Phiên bản hiện tại bổ sung thêm: cơ chế giới hạn lưu trữ lịch sử chat trong IndexedDB (Retention Policy — giới hạn theo số lượng hoặc thời gian), và khả năng bật/tắt từng adapter trong Object Macros Panel với danh sách adapter được đọc động từ `data/adapter-registry.json`.

## Thuật ngữ

- **Hikari_Chatbot**: Ứng dụng chatbot tĩnh trên web, sử dụng RiveScript làm engine xử lý hội thoại
- **RiveScript_Engine**: Thư viện RiveScript được tải qua CDN, chịu trách nhiệm phân tích và phản hồi tin nhắn của người dùng
- **Chat_Interface**: Giao diện người dùng hiển thị cuộc hội thoại giữa người dùng và Hikari_Chatbot
- **Brain_Data**: Tập dữ liệu hội thoại mẫu được viết theo cú pháp RiveScript, chứa các mẫu câu hỏi và câu trả lời
- **Language_Selector**: Thành phần giao diện cho phép người dùng chọn ngôn ngữ giao tiếp
- **Message_Input**: Ô nhập liệu nơi người dùng gõ tin nhắn gửi đến Hikari_Chatbot
- **Message_Display**: Khu vực hiển thị lịch sử tin nhắn giữa người dùng và Hikari_Chatbot
- **CDN**: Content Delivery Network, mạng phân phối nội dung dùng để tải thư viện bên ngoài mà không cần cài đặt cục bộ
- **Match_Confidence**: Tỉ lệ khớp (confidence score) của câu trả lời từ RiveScript_Engine, thể hiện mức độ chính xác của phản hồi so với tin nhắn người dùng
- **Fallback_API**: Dịch vụ API bên ngoài được gọi khi Match_Confidence thấp, cung cấp câu trả lời thay thế cho Hikari_Chatbot
- **Object_Macro**: Hàm JavaScript (subroutine) được đăng ký vào RiveScript_Engine thông qua `bot.setSubroutine()`, có thể được gọi từ trigger RiveScript bằng thẻ `<call>`. Object_Macro cho phép thực hiện logic xử lý phức tạp như gọi API, tính toán, phân tích văn bản
- **Object_Macro_List**: Danh sách các Object_Macro đã đăng ký trong RiveScript_Engine, hiển thị cho người dùng biết các subroutine nâng cao mà chatbot hỗ trợ
- **Logic_Adapter_System**: Hệ thống các Object_Macro triển khai logic tương tự các Logic Adapter của thư viện ChatterBot (Python), được đăng ký vào RiveScript_Engine thông qua `bot.setSubroutine()` và gọi từ trigger bằng thẻ `<call>`
- **Best_Match_Adapter**: Object_Macro so khớp độ tương đồng văn bản (text similarity matching) để tìm câu trả lời phù hợp nhất từ tập dữ liệu Q&A, sử dụng thuật toán tương đồng chuỗi (ví dụ: Levenshtein distance, Jaccard similarity). Tương tự ChatterBot's BestMatch adapter
- **Logic_Adapter_Dispatcher**: Object_Macro đóng vai trò base adapter/dispatcher, quản lý và điều phối các adapter khác, chọn phản hồi tốt nhất từ kết quả của nhiều adapter. Tương tự ChatterBot's LogicAdapter base class
- **Mathematical_Evaluation_Adapter**: Object_Macro đánh giá và tính toán biểu thức toán học từ tin nhắn người dùng (ví dụ: "2 + 3", "tính 15 * 4"). Tương tự ChatterBot's MathematicalEvaluation adapter
- **Specific_Response_Adapter**: Object_Macro trả về phản hồi cụ thể cho các câu hỏi được cấu hình trước (exact match). Tương tự ChatterBot's SpecificResponseAdapter
- **Time_Adapter**: Object_Macro trả lời các câu hỏi về thời gian hiện tại, ngày, giờ (ví dụ: "mấy giờ rồi", "hôm nay ngày mấy", "what time is it"). Tương tự ChatterBot's TimeLogicAdapter
- **Unit_Conversion_Adapter**: Object_Macro chuyển đổi đơn vị đo lường (ví dụ: "5 km sang m", "100 fahrenheit to celsius", "3 kg to pounds"). Tương tự ChatterBot's UnitConversion adapter
- **Adapter_Registry**: Cấu trúc dữ liệu (object/map) lưu trữ thông tin metadata của tất cả các adapter đã đăng ký, bao gồm tên, mô tả, và trạng thái hoạt động
- **Brain_Loader**: Module (`brain.js`) chịu trách nhiệm tải nội dung các tệp `.rive` từ thư mục `brain/` qua `fetch()` và gán vào biến `BRAIN_DATA`
- **Data_Loader**: Module (`data-loader.js`) chịu trách nhiệm tải các tệp JSON dữ liệu từ thư mục `data/` qua `fetch()` và gán vào các biến toàn cục (`SPECIFIC_RESPONSES`, `QA_DATASET`, `ADAPTER_REGISTRY`, `HELP_CONTENT`)
- **Help_Dialog**: Popup modal hiển thị hướng dẫn sử dụng chatbot, hỗ trợ đa ngôn ngữ, với nội dung được tải từ `data/help-content.json`
- **Help_Content**: Dữ liệu nội dung hướng dẫn sử dụng cho 3 ngôn ngữ, lưu trong tệp JSON riêng biệt
- **Vietnamese_Diacritics_Map**: Bảng ánh xạ ký tự tiếng Việt có dấu sang không dấu (ASCII), dùng để normalize input trước khi gửi cho RiveScript_Engine
- **Adapter_Path**: Mảng toàn cục theo dõi chuỗi các adapter đã xử lý mỗi lượt phản hồi, hiển thị dưới dạng breadcrumb
- **Adapter_Display_Names**: Bảng ánh xạ key adapter sang tên hiển thị theo ngôn ngữ, dùng cho breadcrumb adapter path
- **Wildcard_Variant_Trigger**: Trigger RiveScript có chứa wildcard (`*`) ở đầu hoặc cuối, cho phép khớp linh hoạt hơn (ví dụ: `+ xin chao *`, `+ * la ai`)
- **Web_Search_Adapter**: Object_Macro tìm kiếm web qua DuckDuckGo Instant Answer API (miễn phí, không cần API key), với fallback sang link tìm kiếm trực tiếp (Google + DuckDuckGo + Bing). Tùy chọn hỗ trợ Google Custom Search API (cần GOOGLE_API_KEY + GOOGLE_CX)
- **Modal_Particles**: Danh sách các từ đệm (filler words) theo ngôn ngữ, được loại bỏ ở cuối câu khi normalize input (vi: rồi, vậy, nhỉ, nhé, ạ, nha... | en: please, ok... | ja: ね, よ, か...)
- **Preprocessed_Data**: Dữ liệu tiền xử lý (`data/preprocessed.json`) chứa tokens, TF vectors, TF-IDF vectors, IDF, synonym group indices, magnitudes — được tạo bởi build script `scripts/preprocess.js`
- **Cosine_Similarity**: Thuật toán tương đồng dựa trên TF vector, so sánh góc giữa hai vector từ vựng
- **Synset_Similarity**: Thuật toán tương đồng dựa trên nhóm từ đồng nghĩa (SYNONYM_GROUPS), nhận diện từ có nghĩa tương tự qua 3 ngôn ngữ
- **Response_Time_Display**: Hiển thị thời gian xử lý (ms) cho mỗi phản hồi của bot, dưới dạng "⏱ Xms"
- **URL_Linkification**: Chuyển đổi URL trong tin nhắn bot thành thẻ `<a>` nhấp được, với HTML escape và newline conversion
- **Retention_Policy**: Cơ chế giới hạn lưu trữ lịch sử chat trong IndexedDB, gồm 2 chế độ: giới hạn số lượng tin nhắn (count) hoặc giới hạn thời gian lưu trữ (days)
- **Adapter_Prefix_Command**: Cú pháp lệnh đặc biệt dạng `/[key_adapter] [nội dung]` cho phép người dùng chỉ định trực tiếp adapter nào sẽ xử lý tin nhắn, bỏ qua toàn bộ fallback chain thông thường. Ví dụ: `/best_match xin chào`, `/mathematical_evaluation 2 + 3`
- **Retention_Mode**: Chế độ retention đang áp dụng — `"count"` (giới hạn số lượng N hội thoại) hoặc `"days"` (giới hạn M ngày lưu trữ)

## Yêu cầu

### Yêu cầu 1: Tải thư viện RiveScript qua CDN

**User Story:** Là một nhà phát triển, tôi muốn tải thư viện RiveScript qua CDN, để không cần sử dụng npm hoặc công cụ build nào.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL tải thư viện RiveScript từ một CDN công khai thông qua thẻ `<script>` trong tệp HTML
2. WHEN trang web được mở trong trình duyệt, THE RiveScript_Engine SHALL sẵn sàng sử dụng mà không yêu cầu bước cài đặt bổ sung nào
3. IF thư viện RiveScript không tải được từ CDN, THEN THE Chat_Interface SHALL hiển thị thông báo lỗi cho người dùng biết rằng chatbot không khả dụng

### Yêu cầu 2: Giao diện chat

**User Story:** Là một người dùng, tôi muốn có giao diện chat trực quan và dễ sử dụng, để tôi có thể trò chuyện với Hikari một cách thoải mái.

#### Tiêu chí chấp nhận

1. THE Chat_Interface SHALL hiển thị tên "Hikari" làm tiêu đề của chatbot
2. THE Chat_Interface SHALL bao gồm một Message_Display để hiển thị lịch sử hội thoại
3. THE Chat_Interface SHALL bao gồm một Message_Input và nút gửi để người dùng nhập và gửi tin nhắn
4. WHEN người dùng nhập tin nhắn và nhấn nút gửi hoặc phím Enter, THE Chat_Interface SHALL hiển thị tin nhắn của người dùng trong Message_Display
5. WHEN người dùng gửi tin nhắn, THE Chat_Interface SHALL hiển thị phản hồi từ Hikari_Chatbot trong Message_Display
6. THE Message_Display SHALL tự động cuộn xuống tin nhắn mới nhất khi có tin nhắn mới
7. THE Chat_Interface SHALL phân biệt trực quan giữa tin nhắn của người dùng và tin nhắn của Hikari_Chatbot bằng màu sắc hoặc vị trí khác nhau

### Yêu cầu 3: Hỗ trợ đa ngôn ngữ

**User Story:** Là một người dùng, tôi muốn chọn ngôn ngữ giao tiếp với Hikari, để tôi có thể trò chuyện bằng tiếng Việt, tiếng Anh hoặc tiếng Nhật.

#### Tiêu chí chấp nhận

1. THE Chat_Interface SHALL bao gồm một Language_Selector cho phép người dùng chọn giữa ba ngôn ngữ: tiếng Việt, tiếng Anh và tiếng Nhật
2. WHEN người dùng chọn một ngôn ngữ từ Language_Selector, THE RiveScript_Engine SHALL tải Brain_Data tương ứng với ngôn ngữ được chọn
3. WHEN ngôn ngữ được thay đổi, THE Chat_Interface SHALL xóa lịch sử hội thoại hiện tại và hiển thị lời chào mới bằng ngôn ngữ được chọn
4. THE Hikari_Chatbot SHALL mặc định sử dụng tiếng Việt khi trang web được tải lần đầu

### Yêu cầu 4: Dữ liệu hội thoại mẫu tiếng Việt

**User Story:** Là một người dùng Việt Nam, tôi muốn Hikari có thể trả lời các câu hỏi cơ bản bằng tiếng Việt, để tôi có thể trải nghiệm chatbot bằng ngôn ngữ mẹ đẻ.

#### Tiêu chí chấp nhận

1. THE Brain_Data tiếng Việt SHALL chứa mẫu chào hỏi (ví dụ: "xin chào", "chào bạn") với phản hồi phù hợp
2. THE Brain_Data tiếng Việt SHALL chứa mẫu hỏi tên (ví dụ: "bạn tên gì", "tên bạn là gì") với phản hồi xác định tên là "Hikari"
3. THE Brain_Data tiếng Việt SHALL chứa mẫu hỏi về khả năng (ví dụ: "bạn có thể làm gì") với phản hồi mô tả chức năng của chatbot
4. THE Brain_Data tiếng Việt SHALL chứa mẫu tạm biệt (ví dụ: "tạm biệt", "bye") với phản hồi phù hợp
5. THE Brain_Data tiếng Việt SHALL chứa phản hồi mặc định khi không nhận diện được câu hỏi của người dùng
6. THE Brain_Data tiếng Việt SHALL chứa các Wildcard_Variant_Trigger cho mẫu chào hỏi (ví dụ: `+ xin chao *`, `+ chao *`, `+ chao ban *`), tạm biệt (`+ tam biet *`, `+ bye *`), cảm ơn (`+ cam on *`, `+ * cam on *`), và các mẫu linh hoạt khác (`+ * la ai`, `+ * khoe khong`, `+ * bao nhieu tuoi`, `+ * giup minh *`)
7. THE Brain_Data tiếng Việt SHALL chứa trigger `+ * la gi` gọi `<call>best_match <star> là gì</call>` để xử lý câu hỏi kiến thức linh hoạt

### Yêu cầu 5: Dữ liệu hội thoại mẫu tiếng Anh

**User Story:** Là một người dùng nói tiếng Anh, tôi muốn Hikari có thể trả lời các câu hỏi cơ bản bằng tiếng Anh, để tôi có thể giao tiếp với chatbot.

#### Tiêu chí chấp nhận

1. THE Brain_Data tiếng Anh SHALL chứa mẫu chào hỏi (ví dụ: "hello", "hi") với phản hồi phù hợp
2. THE Brain_Data tiếng Anh SHALL chứa mẫu hỏi tên (ví dụ: "what is your name") với phản hồi xác định tên là "Hikari"
3. THE Brain_Data tiếng Anh SHALL chứa mẫu hỏi về khả năng (ví dụ: "what can you do") với phản hồi mô tả chức năng của chatbot
4. THE Brain_Data tiếng Anh SHALL chứa mẫu tạm biệt (ví dụ: "goodbye", "bye") với phản hồi phù hợp
5. THE Brain_Data tiếng Anh SHALL chứa phản hồi mặc định khi không nhận diện được câu hỏi của người dùng
6. THE Brain_Data tiếng Anh SHALL chứa các Wildcard_Variant_Trigger cho mẫu chào hỏi (`+ hello *`, `+ hi *`, `+ hey *`), tạm biệt (`+ goodbye *`, `+ bye *`, `+ see you later *`, `+ take care *`), cảm ơn (`+ thank you *`, `+ thanks *`, `+ * thanks *`), trợ giúp (`+ help *`, `+ * help *`, `+ how to use *`), và các mẫu linh hoạt khác (`+ * old are you`, `+ what do you like *`, `+ where are you from *`)
7. THE Brain_Data tiếng Anh SHALL chứa trigger `+ what is *` gọi `<call>best_match what is <star></call>` để xử lý câu hỏi kiến thức linh hoạt

### Yêu cầu 6: Dữ liệu hội thoại mẫu tiếng Nhật

**User Story:** Là một người dùng nói tiếng Nhật, tôi muốn Hikari có thể trả lời các câu hỏi cơ bản bằng tiếng Nhật, để tôi có thể giao tiếp với chatbot.

#### Tiêu chí chấp nhận

1. THE Brain_Data tiếng Nhật SHALL chứa mẫu chào hỏi (ví dụ: "こんにちは", "おはよう") với phản hồi phù hợp
2. THE Brain_Data tiếng Nhật SHALL chứa mẫu hỏi tên (ví dụ: "名前は何ですか") với phản hồi xác định tên là "Hikari" (ひかり)
3. THE Brain_Data tiếng Nhật SHALL chứa mẫu hỏi về khả năng (ví dụ: "何ができますか") với phản hồi mô tả chức năng của chatbot
4. THE Brain_Data tiếng Nhật SHALL chứa mẫu tạm biệt (ví dụ: "さようなら", "バイバイ") với phản hồi phù hợp
5. THE Brain_Data tiếng Nhật SHALL chứa phản hồi mặc định khi không nhận diện được câu hỏi của người dùng


### Yêu cầu 7: Xử lý tin nhắn với RiveScript

**User Story:** Là một người dùng, tôi muốn Hikari phản hồi tin nhắn của tôi một cách chính xác, để cuộc hội thoại có ý nghĩa.

#### Tiêu chí chấp nhận

1. WHEN người dùng gửi tin nhắn, THE RiveScript_Engine SHALL phân tích tin nhắn và trả về phản hồi phù hợp dựa trên Brain_Data đã tải
2. WHEN người dùng gửi tin nhắn trống, THE Chat_Interface SHALL không gửi tin nhắn đó đến RiveScript_Engine
3. IF RiveScript_Engine gặp lỗi khi xử lý tin nhắn, THEN THE Chat_Interface SHALL hiển thị thông báo lỗi thân thiện cho người dùng

### Yêu cầu 8: Thiết kế giao diện responsive

**User Story:** Là một người dùng, tôi muốn giao diện chatbot hiển thị tốt trên cả máy tính và thiết bị di động, để tôi có thể sử dụng chatbot ở bất kỳ đâu.

#### Tiêu chí chấp nhận

1. THE Chat_Interface SHALL hiển thị đúng trên màn hình có chiều rộng từ 320px trở lên
2. THE Chat_Interface SHALL sử dụng CSS thuần (không framework CSS) để định dạng giao diện
3. THE Chat_Interface SHALL điều chỉnh kích thước và bố cục phù hợp khi kích thước màn hình thay đổi

### Yêu cầu 9: Cấu trúc dự án tĩnh

**User Story:** Là một nhà phát triển, tôi muốn dự án có cấu trúc đơn giản chỉ gồm các tệp tĩnh, để tôi có thể triển khai dễ dàng trên bất kỳ máy chủ web tĩnh nào.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL bao gồm một tệp HTML duy nhất (`index.html`) làm điểm vào của ứng dụng, tải `brain.js`, `data-loader.js`, và `app.js`
2. THE Hikari_Chatbot SHALL bao gồm một tệp CSS riêng biệt (`style.css`) để định dạng giao diện
3. THE Hikari_Chatbot SHALL bao gồm tệp `app.js` chứa logic ứng dụng chính (không chứa dữ liệu inline)
4. THE Brain_Data SHALL được lưu trữ trong các tệp `.rive` riêng biệt theo ngôn ngữ (`brain/vi.rive`, `brain/en.rive`, `brain/ja.rive`)
5. THE Hikari_Chatbot SHALL bao gồm tệp `brain.js` (Brain_Loader) để tải các tệp `.rive` qua `fetch()` và gán vào biến `BRAIN_DATA`
6. THE Hikari_Chatbot SHALL lưu trữ dữ liệu cấu hình trong các tệp JSON riêng biệt: `data/specific-responses.json`, `data/qa-dataset.json`, `data/adapter-registry.json`, `data/help-content.json`, `data/preprocessed.json`
7. THE Hikari_Chatbot SHALL bao gồm tệp `data-loader.js` (Data_Loader) để tải tất cả tệp JSON dữ liệu qua `fetch()` và gán vào các biến toàn cục
8. WHEN chạy trong môi trường Node/test, THE Data_Loader và Brain_Loader SHALL tải dữ liệu qua `fs.readFileSync` bên trong IIFE sử dụng `globalThis` để tránh vấn đề `var` hoisting trong trình duyệt
9. THE Hikari_Chatbot SHALL hoạt động khi phục vụ qua máy chủ web tĩnh
10. THE Hikari_Chatbot SHALL bao gồm inline SVG favicon (emoji 🌟) để tránh lỗi 404 favicon

### Yêu cầu 10: Lời chào khởi tạo

**User Story:** Là một người dùng, tôi muốn Hikari chào đón tôi khi tôi mở trang web, để tôi biết chatbot đã sẵn sàng và tôi có thể bắt đầu trò chuyện.

#### Tiêu chí chấp nhận

1. WHEN trang web được tải xong và RiveScript_Engine đã sẵn sàng, THE Chat_Interface SHALL hiển thị lời chào từ Hikari_Chatbot bằng ngôn ngữ mặc định (tiếng Việt)
2. THE lời chào khởi tạo SHALL giới thiệu tên Hikari và hướng dẫn người dùng cách bắt đầu trò chuyện

### Yêu cầu 11: Hiển thị tỉ lệ khớp (Match Confidence Display)

**User Story:** Là một người dùng, tôi muốn xem tỉ lệ khớp của câu trả lời từ chatbot, để tôi biết mức độ chính xác của phản hồi đối với câu hỏi của mình.

#### Tiêu chí chấp nhận

1. WHEN Hikari_Chatbot phản hồi tin nhắn của người dùng, THE Chat_Interface SHALL hiển thị Match_Confidence dưới dạng phần trăm (0%–100%) kèm theo mỗi phản hồi trong Message_Display
2. WHEN phản hồi khớp chính xác với một trigger trong Brain_Data, THE Match_Confidence SHALL có giá trị 100%
3. WHEN phản hồi sử dụng trigger mặc định (wildcard `+ *`), THE Match_Confidence SHALL có giá trị 0%
4. THE Chat_Interface SHALL hiển thị Match_Confidence với màu sắc phân biệt: xanh lá cho tỉ lệ từ 50% trở lên, đỏ cho tỉ lệ dưới 50%
5. THE Match_Confidence SHALL được hiển thị ở kích thước nhỏ hơn nội dung phản hồi để không gây phân tán sự chú ý của người dùng

### Yêu cầu 12: API Fallback khi tỉ lệ khớp thấp

**User Story:** Là một người dùng, tôi muốn nhận được câu trả lời từ một API server khi chatbot không tìm được phản hồi phù hợp, để tôi vẫn nhận được câu trả lời hữu ích.

#### Tiêu chí chấp nhận

1. WHEN Match_Confidence dưới 50%, THE Hikari_Chatbot SHALL thử Best_Match_Adapter làm fallback cục bộ trước khi gọi Fallback_API
2. WHEN Best_Match_Adapter trả về kết quả hợp lệ (vượt ngưỡng similarity), THE Chat_Interface SHALL hiển thị kết quả đó mà không gọi Fallback_API
3. WHEN Best_Match_Adapter không tìm được kết quả hợp lệ, THE Hikari_Chatbot SHALL gửi yêu cầu đến Fallback_API để lấy câu trả lời thay thế
4. THE Hikari_Chatbot SHALL gửi đến Fallback_API một yêu cầu HTTP POST với nội dung là văn bản tin nhắn của người dùng
5. WHEN Fallback_API trả về phản hồi thành công, THE Chat_Interface SHALL hiển thị câu trả lời từ Fallback_API thay cho phản hồi mặc định của RiveScript_Engine
6. IF Fallback_API không phản hồi hoặc trả về lỗi, THEN THE Chat_Interface SHALL hiển thị phản hồi mặc định từ RiveScript_Engine kèm thông báo rằng dịch vụ bổ sung không khả dụng
7. THE Hikari_Chatbot SHALL cho phép cấu hình URL của Fallback_API thông qua một biến JavaScript (configurable URL)
8. THE Hikari_Chatbot SHALL đặt thời gian chờ tối đa 5 giây cho mỗi yêu cầu gửi đến Fallback_API
9. WHILE Hikari_Chatbot đang chờ phản hồi từ Fallback_API, THE Chat_Interface SHALL hiển thị chỉ báo đang tải (loading indicator) cho người dùng
10. WHILE thử Best_Match_Adapter làm fallback cục bộ cho tiếng Việt, THE Hikari_Chatbot SHALL thử cả input gốc và input đã bỏ dấu, chọn kết quả hợp lệ

### Yêu cầu 13: Liệt kê các Object Macro (Subroutine) hiện có

**User Story:** Là một người dùng, tôi muốn xem danh sách các Object Macro (subroutine) đã đăng ký trong chatbot, để tôi biết những chức năng xử lý nâng cao mà Hikari hỗ trợ.

#### Tiêu chí chấp nhận

1. THE Chat_Interface SHALL bao gồm một nút hoặc liên kết cho phép người dùng xem Object_Macro_List
2. WHEN người dùng nhấn nút xem Object_Macro_List, THE Chat_Interface SHALL hiển thị danh sách tất cả các Object_Macro đã đăng ký trong RiveScript_Engine
3. THE Object_Macro_List SHALL hiển thị tên và mô tả ngắn gọn của mỗi Object_Macro đã đăng ký
4. WHEN ngôn ngữ được thay đổi qua Language_Selector, THE Object_Macro_List SHALL cập nhật mô tả hiển thị tương ứng với ngôn ngữ mới
5. THE Object_Macro_List SHALL hiển thị ở định dạng dễ đọc cho người dùng, bao gồm tên subroutine và cách gọi từ trigger (cú pháp `<call>`)

### Yêu cầu 14: Hệ thống Logic Adapter tương tự ChatterBot (Object Macros)

**User Story:** Là một nhà phát triển, tôi muốn có một hệ thống các Object Macro triển khai logic tương tự các Logic Adapter của ChatterBot (Python), để chatbot có khả năng xử lý nâng cao như tính toán, chuyển đổi đơn vị, trả lời thời gian, và so khớp thông minh — tất cả được đăng ký qua `bot.setSubroutine()` và gọi từ RiveScript trigger bằng `<call>`.

#### Tiêu chí chấp nhận chung

1. THE Hikari_Chatbot SHALL đăng ký tất cả 7 adapter (best_match, logic_adapter, mathematical_evaluation, specific_response, time_adapter, unit_conversion, web_search) thông qua `bot.setSubroutine()` khi khởi tạo RiveScript_Engine
2. THE Brain_Data của mỗi ngôn ngữ SHALL chứa các trigger mẫu sử dụng thẻ `<call>adapter_name args</call>` để gọi từng adapter tương ứng
3. THE Logic_Adapter_System SHALL bao gồm chú thích (comment) trong mã nguồn JavaScript giải thích cấu trúc, thuật toán, và cách tùy chỉnh logic xử lý của mỗi adapter
4. THE Adapter_Registry SHALL lưu trữ metadata (tên, mô tả, trạng thái) của tất cả các adapter đã đăng ký để Object_Macro_List có thể hiển thị

### Yêu cầu 14.1: Best Match Adapter

**User Story:** Là một người dùng, tôi muốn chatbot có thể tìm câu trả lời phù hợp nhất từ tập dữ liệu Q&A bằng thuật toán tương đồng chuỗi, để tôi nhận được phản hồi chính xác ngay cả khi câu hỏi không khớp hoàn toàn với trigger.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL đăng ký Best_Match_Adapter thông qua `bot.setSubroutine("best_match", ...)` 
2. THE Best_Match_Adapter SHALL nhận đầu vào là chuỗi văn bản từ người dùng thông qua tham số `args` khi được gọi bằng `<call>best_match <star></call>`
3. THE Best_Match_Adapter SHALL triển khai thuật toán tương đồng chuỗi (ví dụ: Levenshtein distance, Jaccard similarity, hoặc cosine similarity đơn giản) để so khớp đầu vào với tập dữ liệu Q&A
4. THE Best_Match_Adapter SHALL duy trì một tập dữ liệu Q&A mẫu (ít nhất 10 cặp câu hỏi-trả lời) cho mỗi ngôn ngữ được hỗ trợ
5. WHEN điểm tương đồng cao nhất vượt ngưỡng cấu hình (mặc định 0.3), THE Best_Match_Adapter SHALL trả về câu trả lời tương ứng
6. WHEN không có câu hỏi nào trong tập dữ liệu đạt ngưỡng tương đồng, THE Best_Match_Adapter SHALL trả về thông báo rằng không tìm được câu trả lời phù hợp
7. THE Best_Match_Adapter SHALL trả về chuỗi phản hồi không rỗng cho mọi đầu vào hợp lệ

### Yêu cầu 14.2: Logic Adapter Dispatcher

**User Story:** Là một nhà phát triển, tôi muốn có một adapter trung tâm điều phối các adapter khác và chọn phản hồi tốt nhất, để hệ thống adapter hoạt động phối hợp và trả về kết quả tối ưu.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL đăng ký Logic_Adapter_Dispatcher thông qua `bot.setSubroutine("logic_adapter", ...)`
2. THE Logic_Adapter_Dispatcher SHALL nhận đầu vào là chuỗi văn bản từ người dùng thông qua `<call>logic_adapter <star></call>`
3. WHEN được gọi, THE Logic_Adapter_Dispatcher SHALL lần lượt gọi các adapter con (best_match, mathematical_evaluation, specific_response, time_adapter, unit_conversion) và thu thập kết quả
4. THE Logic_Adapter_Dispatcher SHALL chọn phản hồi tốt nhất dựa trên độ ưu tiên: specific_response (cao nhất) → time_adapter → mathematical_evaluation → unit_conversion → best_match (thấp nhất)
5. WHEN một adapter con trả về kết quả hợp lệ (không phải thông báo lỗi hoặc "không tìm thấy"), THE Logic_Adapter_Dispatcher SHALL sử dụng kết quả đó theo thứ tự ưu tiên
6. WHEN không adapter con nào trả về kết quả hợp lệ, THE Logic_Adapter_Dispatcher SHALL trả về thông báo mặc định rằng không thể xử lý yêu cầu
7. THE Logic_Adapter_Dispatcher SHALL trả về chuỗi phản hồi không rỗng cho mọi đầu vào hợp lệ

### Yêu cầu 14.3: Mathematical Evaluation Adapter

**User Story:** Là một người dùng, tôi muốn chatbot có thể tính toán các biểu thức toán học đơn giản, để tôi có thể hỏi "2 + 3" hoặc "tính 15 * 4" và nhận được kết quả.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL đăng ký Mathematical_Evaluation_Adapter thông qua `bot.setSubroutine("mathematical_evaluation", ...)`
2. THE Mathematical_Evaluation_Adapter SHALL nhận đầu vào là chuỗi văn bản chứa biểu thức toán học thông qua `<call>mathematical_evaluation <star></call>`
3. THE Mathematical_Evaluation_Adapter SHALL hỗ trợ các phép tính cơ bản: cộng (+), trừ (-), nhân (* hoặc ×), chia (/ hoặc ÷)
4. THE Mathematical_Evaluation_Adapter SHALL hỗ trợ các từ khóa toán học bằng tiếng Việt (ví dụ: "cộng", "trừ", "nhân", "chia", "tính"), tiếng Anh (ví dụ: "plus", "minus", "times", "divided by"), và tiếng Nhật (ví dụ: "足す", "引く", "掛ける", "割る")
5. THE Mathematical_Evaluation_Adapter SHALL trích xuất biểu thức toán học từ chuỗi đầu vào và tính toán kết quả một cách an toàn (không sử dụng `eval()`)
6. IF biểu thức toán học không hợp lệ hoặc không thể phân tích, THEN THE Mathematical_Evaluation_Adapter SHALL trả về thông báo rằng không thể tính toán biểu thức
7. IF phép chia cho 0 xảy ra, THEN THE Mathematical_Evaluation_Adapter SHALL trả về thông báo lỗi phù hợp thay vì kết quả Infinity hoặc NaN

### Yêu cầu 14.4: Specific Response Adapter

**User Story:** Là một nhà phát triển, tôi muốn có adapter trả về phản hồi cụ thể cho các câu hỏi được cấu hình trước (exact match), để chatbot có thể trả lời chính xác các câu hỏi thường gặp.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL đăng ký Specific_Response_Adapter thông qua `bot.setSubroutine("specific_response", ...)`
2. THE Specific_Response_Adapter SHALL nhận đầu vào là chuỗi văn bản từ người dùng thông qua `<call>specific_response <star></call>`
3. THE Specific_Response_Adapter SHALL duy trì một bảng ánh xạ (mapping) giữa câu hỏi cụ thể và câu trả lời tương ứng cho mỗi ngôn ngữ
4. WHEN đầu vào khớp chính xác (exact match, không phân biệt hoa thường) với một câu hỏi trong bảng ánh xạ, THE Specific_Response_Adapter SHALL trả về câu trả lời tương ứng
5. WHEN đầu vào không khớp exact match và ngôn ngữ hiện tại là tiếng Việt, THE Specific_Response_Adapter SHALL thử so khớp sau khi bỏ dấu cả đầu vào và key trong bảng ánh xạ
6. WHEN đầu vào không khớp với bất kỳ câu hỏi nào trong bảng ánh xạ (kể cả sau khi bỏ dấu), THE Specific_Response_Adapter SHALL trả về thông báo rằng không có phản hồi cụ thể cho câu hỏi này
6. THE Specific_Response_Adapter SHALL cho phép nhà phát triển dễ dàng thêm hoặc sửa đổi các cặp câu hỏi-trả lời trong bảng ánh xạ

### Yêu cầu 14.5: Time Adapter

**User Story:** Là một người dùng, tôi muốn hỏi chatbot về thời gian hiện tại, ngày tháng, để nhận được câu trả lời chính xác theo thời gian thực.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL đăng ký Time_Adapter thông qua `bot.setSubroutine("time_adapter", ...)`
2. THE Time_Adapter SHALL nhận đầu vào là chuỗi văn bản từ người dùng thông qua `<call>time_adapter <star></call>`
3. WHEN đầu vào chứa từ khóa liên quan đến thời gian (ví dụ: "mấy giờ", "giờ", "what time", "何時", "今何時"), THE Time_Adapter SHALL trả về giờ và phút hiện tại theo múi giờ của trình duyệt
4. WHEN đầu vào chứa từ khóa liên quan đến ngày tháng (ví dụ: "ngày mấy", "hôm nay", "what date", "today", "今日", "何日"), THE Time_Adapter SHALL trả về ngày, tháng, năm hiện tại
5. WHEN đầu vào chứa từ khóa liên quan đến thứ trong tuần (ví dụ: "thứ mấy", "what day", "何曜日"), THE Time_Adapter SHALL trả về thứ trong tuần hiện tại bằng ngôn ngữ đang sử dụng
6. THE Time_Adapter SHALL định dạng kết quả phù hợp với ngôn ngữ hiện tại (ví dụ: "14:30" cho tiếng Việt, "2:30 PM" cho tiếng Anh, "14時30分" cho tiếng Nhật)
7. WHEN đầu vào không chứa từ khóa thời gian nào được nhận diện, THE Time_Adapter SHALL trả về thông báo rằng không hiểu yêu cầu về thời gian

### Yêu cầu 14.6: Unit Conversion Adapter

**User Story:** Là một người dùng, tôi muốn chatbot có thể chuyển đổi đơn vị đo lường, để tôi có thể hỏi "5 km sang m" hoặc "100 fahrenheit to celsius" và nhận được kết quả chính xác.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL đăng ký Unit_Conversion_Adapter thông qua `bot.setSubroutine("unit_conversion", ...)`
2. THE Unit_Conversion_Adapter SHALL nhận đầu vào là chuỗi văn bản chứa yêu cầu chuyển đổi thông qua `<call>unit_conversion <star></call>`
3. THE Unit_Conversion_Adapter SHALL hỗ trợ chuyển đổi các nhóm đơn vị sau: chiều dài (km, m, cm, mm, mile, yard, foot, inch), khối lượng (kg, g, mg, pound, ounce), nhiệt độ (Celsius, Fahrenheit, Kelvin)
4. THE Unit_Conversion_Adapter SHALL nhận diện các từ khóa chuyển đổi bằng tiếng Việt ("sang", "ra", "bằng bao nhiêu"), tiếng Anh ("to", "in", "convert"), và tiếng Nhật ("を", "に変換", "は何")
5. WHEN đầu vào chứa giá trị số, đơn vị nguồn và đơn vị đích hợp lệ, THE Unit_Conversion_Adapter SHALL tính toán và trả về kết quả chuyển đổi chính xác
6. IF đơn vị nguồn hoặc đơn vị đích không được hỗ trợ, THEN THE Unit_Conversion_Adapter SHALL trả về thông báo liệt kê các đơn vị được hỗ trợ
7. IF giá trị số không hợp lệ hoặc không thể phân tích cú pháp chuyển đổi, THEN THE Unit_Conversion_Adapter SHALL trả về thông báo hướng dẫn cú pháp đúng (ví dụ: "5 km sang m")


### Yêu cầu 15: Xử lý tiếng Việt có dấu (Vietnamese Diacritics Handling)

**User Story:** Là một người dùng Việt Nam, tôi muốn chatbot hiểu tin nhắn tiếng Việt có dấu (ví dụ: "Xin chào bạn") mặc dù trigger RiveScript viết không dấu, để tôi có thể gõ tự nhiên mà vẫn nhận được phản hồi chính xác.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL duy trì Vietnamese_Diacritics_Map ánh xạ tất cả ký tự tiếng Việt có dấu (à, á, ả, ã, ạ, ă, â, đ, è, ê, ì, ò, ô, ơ, ù, ư, ỳ, ...) sang ký tự ASCII tương ứng
2. THE Hikari_Chatbot SHALL cung cấp hàm `removeVietnameseDiacritics(str)` loại bỏ dấu tiếng Việt khỏi chuỗi đầu vào
3. THE Hikari_Chatbot SHALL cung cấp hàm `normalizeInput(text)` thực hiện tiền xử lý đầy đủ: (1) lowercase, (2) bỏ dấu tiếng Việt (chỉ khi ngôn ngữ là vi), (3) loại bỏ dấu câu (giữ lại + - * / cho biểu thức toán học), (4) chuẩn hóa khoảng trắng, (5) loại bỏ Modal_Particles ở cuối câu
4. WHEN ngôn ngữ hiện tại là tiếng Việt và người dùng gửi tin nhắn có dấu, THE Hikari_Chatbot SHALL áp dụng chiến lược dual-reply: gửi cả input gốc (có dấu) và input đã bỏ dấu cho RiveScript_Engine, so sánh confidence của hai kết quả, và chọn kết quả có confidence cao hơn
5. WHEN hai kết quả dual-reply có confidence bằng nhau, THE Hikari_Chatbot SHALL ưu tiên kết quả từ input gốc (có dấu)
6. WHEN ngôn ngữ hiện tại không phải tiếng Việt, THE Hikari_Chatbot SHALL gửi input trực tiếp mà không normalize

### Yêu cầu 16: Help Dialog (Popup hướng dẫn sử dụng)

**User Story:** Là một người dùng mới, tôi muốn có popup hướng dẫn sử dụng chatbot, để tôi biết cách tương tác với Hikari và các chức năng đặc biệt.

#### Tiêu chí chấp nhận

1. THE Chat_Interface SHALL bao gồm nút ❓ trong header để mở Help_Dialog
2. WHEN người dùng nhấn nút ❓, THE Chat_Interface SHALL hiển thị Help_Dialog dưới dạng modal overlay với hiệu ứng fade-in và slide-up
3. THE Help_Dialog SHALL hiển thị nội dung đa ngôn ngữ (vi/en/ja) tương ứng với ngôn ngữ hiện tại, được tải từ Help_Content
4. THE Help_Dialog SHALL bao gồm các phần: cách chat, cách Hikari phản hồi (giải thích confidence), các lệnh đặc biệt, và mẹo sử dụng
5. WHEN người dùng nhấn nút X, click bên ngoài dialog, hoặc nhấn phím Escape, THE Help_Dialog SHALL đóng lại
6. THE Help_Content SHALL được lưu trữ trong tệp `data/help-content.json` riêng biệt

### Yêu cầu 17: Adapter Path Breadcrumb (Hiển thị chuỗi adapter đã xử lý)

**User Story:** Là một người dùng, tôi muốn xem chuỗi adapter nào đã xử lý phản hồi của chatbot, để tôi hiểu rõ hơn cách Hikari tìm ra câu trả lời.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL duy trì biến toàn cục Adapter_Path (mảng) để theo dõi chuỗi adapter đã xử lý mỗi lượt phản hồi
2. WHEN một adapter được gọi, THE adapter đó SHALL push tên của mình vào Adapter_Path
3. THE Logic_Adapter_Dispatcher SHALL dọn dẹp các entry adapter thất bại trong Adapter_Path, chỉ giữ lại chuỗi adapter thành công
4. WHEN Hikari_Chatbot hiển thị phản hồi, THE Chat_Interface SHALL hiển thị breadcrumb adapter path bên dưới confidence, sử dụng Adapter_Display_Names để hiển thị tên adapter theo ngôn ngữ hiện tại
5. THE Adapter_Display_Names SHALL ánh xạ key adapter (specific_response, time_adapter, mathematical_evaluation, unit_conversion, best_match, logic_adapter, rivescript, fallback_api, web_search) sang tên hiển thị đa ngôn ngữ (vi/en/ja)
6. THE Chat_Interface SHALL cung cấp hàm `getBotReply(inputText)` trả về object `{reply, confidence, adapterPath}` để đóng gói logic lấy phản hồi và adapter path
7. THE breadcrumb adapter path SHALL được hiển thị với CSS class `.adapter-path` (font nhỏ, in nghiêng, màu xám)

### Yêu cầu 18: Sửa lỗi Rules Panel

**User Story:** Là một nhà phát triển, tôi muốn Rules Panel hiển thị đúng danh sách trigger, để người dùng có thể xem các câu hỏi mà Hikari có thể trả lời.

#### Tiêu chí chấp nhận

1. THE `updateRulesList()` SHALL đọc danh sách trigger từ `bot._topics.random` internal data, trích xuất `.trigger` từ mỗi entry, thay vì sử dụng `getUserTopicTriggers()` (trả về object không phải array)
2. THE `updateRulesList()` SHALL loại bỏ trigger trùng lặp (deduplication)
3. THE `updateRulesList()` SHALL lọc bỏ trigger wildcard mặc định (`*`) và trigger chỉ chứa wildcard ngắn (ví dụ: `* la ai` với ≤ 3 từ)

### Yêu cầu 19: Web Search Adapter (Tìm kiếm web)

**User Story:** Là một người dùng, tôi muốn chatbot có thể tìm kiếm thông tin trên web, để tôi có thể hỏi "google JavaScript là gì" hoặc "search RiveScript" và nhận được kết quả tìm kiếm.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL đăng ký Web_Search_Adapter thông qua `bot.setSubroutine("web_search", ...)`
2. THE Web_Search_Adapter SHALL sử dụng DuckDuckGo Instant Answer API (miễn phí, hỗ trợ CORS, không cần API key) làm nguồn tìm kiếm chính
3. WHEN DuckDuckGo Instant Answer API không trả về kết quả, THE Web_Search_Adapter SHALL fallback sang hiển thị link tìm kiếm trực tiếp (Google + DuckDuckGo + Bing)
4. WHERE GOOGLE_API_KEY và GOOGLE_CX được cấu hình, THE Web_Search_Adapter SHALL ưu tiên sử dụng Google Custom Search API trước DuckDuckGo
5. WHEN người dùng gửi tin nhắn bắt đầu bằng prefix tìm kiếm ("google ", "tra cứu ", "search ", "web search ", "グーグル ", "ウェブ検索 "), THE Hikari_Chatbot SHALL xử lý trực tiếp trong `sendMessage()` qua hàm `extractWebSearchQuery()` thay vì qua RiveScript `<call>` (vì RiveScript subroutine không hỗ trợ async/Promise)
6. THE Brain_Data của mỗi ngôn ngữ SHALL chứa trigger fallback cho các prefix tìm kiếm (ví dụ: `+ google *`, `+ tra cuu *`, `+ グーグル *`) gọi `<call>best_match</call>` trong trường hợp `sendMessage()` detection bỏ sót
7. IF query tìm kiếm rỗng, THEN THE Web_Search_Adapter SHALL trả về thông báo yêu cầu nhập từ khóa tìm kiếm bằng ngôn ngữ hiện tại
8. THE Web_Search_Adapter SHALL đặt thời gian chờ tối đa 5 giây cho mỗi yêu cầu tìm kiếm

### Yêu cầu 20: Nâng cao Input Normalization

**User Story:** Là một người dùng, tôi muốn chatbot hiểu tin nhắn của tôi tốt hơn ngay cả khi tôi dùng dấu câu hoặc từ đệm, để cuộc hội thoại tự nhiên hơn.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL duy trì danh sách Modal_Particles cho mỗi ngôn ngữ (vi: rồi, vậy, nhỉ, nhé, ạ, nha, đi, thế... | en: please, ok, right... | ja: ね, よ, か...)
2. WHEN normalize input, THE `normalizeInput()` SHALL loại bỏ dấu câu (? ! . , ; : " ' ` ~ ( ) [ ] { } \ | @ # $ % ^ &) nhưng giữ lại + - * / cho biểu thức toán học
3. WHEN normalize input, THE `normalizeInput()` SHALL loại bỏ Modal_Particles ở cuối câu (lặp lại để xử lý nhiều particle liên tiếp), chỉ bỏ nếu câu còn ít nhất 1 từ khác
4. THE `normalizeInput()` SHALL chuẩn hóa khoảng trắng (nhiều khoảng trắng → 1 khoảng trắng, trim đầu cuối)

### Yêu cầu 21: Nâng cao Text Similarity

**User Story:** Là một nhà phát triển, tôi muốn thuật toán so khớp văn bản chính xác hơn, để Best_Match_Adapter tìm được câu trả lời phù hợp hơn cho người dùng.

#### Tiêu chí chấp nhận

1. THE `textSimilarity()` SHALL kết hợp 4 thuật toán với trọng số bằng nhau (25% mỗi thuật toán): Levenshtein, Jaccard, Cosine_Similarity, và Synset_Similarity
2. THE Cosine_Similarity SHALL tính toán dựa trên TF (Term Frequency) vector của hai chuỗi
3. THE Synset_Similarity SHALL sử dụng SYNONYM_GROUPS (ít nhất 17 nhóm từ đồng nghĩa cho 3 ngôn ngữ) để nhận diện từ có nghĩa tương tự
4. THE Hikari_Chatbot SHALL cung cấp hàm `areSynonyms(wordA, wordB)` kiểm tra hai từ có thuộc cùng nhóm đồng nghĩa
5. THE `textSimilarity()` SHALL trả về giá trị trong khoảng [0, 1], với 1.0 khi hai chuỗi giống hệt nhau (và không rỗng)

### Yêu cầu 22: Preprocessed Data Pipeline

**User Story:** Là một nhà phát triển, tôi muốn có hệ thống tiền xử lý dữ liệu để tối ưu hóa tốc độ so khớp văn bản, để chatbot phản hồi nhanh hơn.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL bao gồm build script `scripts/preprocess.js` (chạy qua `node scripts/preprocess.js` hoặc `npm run preprocess`) để tạo dữ liệu tiền xử lý
2. THE build script SHALL đọc QA dataset, specific responses, và brain .rive triggers, sau đó tạo `data/preprocessed.json` chứa: tokens, TF vectors, TF-IDF vectors, IDF, synonym group indices, magnitudes
3. WHEN Preprocessed_Data có sẵn, THE Best_Match_Adapter SHALL sử dụng hàm `findBestMatchPreprocessed()` với TF-IDF cosine + synset preprocessed để so khớp nhanh hơn
4. WHEN Preprocessed_Data không có sẵn, THE Best_Match_Adapter SHALL fallback sang tính toán thủ công bằng `textSimilarity()`
5. WHEN chạy trong trình duyệt, THE Hikari_Chatbot SHALL tải Preprocessed_Data qua `fetch()` và cache trong `localStorage` với version-based cache invalidation
6. WHEN chạy trong môi trường Node/test, THE Hikari_Chatbot SHALL tải Preprocessed_Data qua `fs.readFileSync`

### Yêu cầu 23: Hiển thị thời gian xử lý (Response Time Display)

**User Story:** Là một người dùng, tôi muốn xem thời gian chatbot xử lý phản hồi, để tôi biết tốc độ phản hồi của Hikari.

#### Tiêu chí chấp nhận

1. WHEN Hikari_Chatbot hiển thị phản hồi, THE Chat_Interface SHALL hiển thị thời gian xử lý dưới dạng "⏱ Xms" kèm theo mỗi tin nhắn bot
2. THE `appendMessage()` SHALL chấp nhận tham số tùy chọn `responseTime` (số nguyên, đơn vị millisecond)
3. THE Response_Time_Display SHALL được hiển thị với CSS class `.response-time` (font nhỏ, màu xám)
4. THE thời gian xử lý SHALL được đo từ thời điểm bắt đầu xử lý tin nhắn đến khi có kết quả phản hồi

### Yêu cầu 24: URL Linkification trong tin nhắn bot

**User Story:** Là một người dùng, tôi muốn các URL trong tin nhắn bot có thể nhấp được, để tôi có thể truy cập liên kết trực tiếp từ cuộc hội thoại.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL cung cấp hàm `linkifyText(text)` chuyển đổi URL trong tin nhắn bot thành thẻ `<a>` nhấp được
2. THE `linkifyText()` SHALL escape HTML entities trước khi xử lý URL để tránh XSS
3. THE `linkifyText()` SHALL chuyển đổi ký tự newline thành thẻ `<br>` để giữ định dạng
4. WHEN tin nhắn bot chứa URL (bắt đầu bằng "http"), THE `appendMessage()` SHALL sử dụng `linkifyText()` để render nội dung dưới dạng HTML thay vì text thuần
5. THE CSS SHALL định dạng `.message.bot a` với màu sắc phù hợp và hiệu ứng hover

### Yêu cầu 25: Cấu trúc tệp Adapter tách biệt

**User Story:** Là một nhà phát triển, tôi muốn mỗi adapter được tách thành tệp JavaScript riêng biệt trong thư mục `adapters/`, để dễ bảo trì và mở rộng.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL tổ chức các adapter thành các tệp riêng biệt trong thư mục `adapters/`: `text-similarity.js`, `specific-response.js`, `time-adapter.js`, `math-adapter.js`, `unit-conversion.js`, `best-match.js`, `logic-dispatcher.js`, `adapter-registry.js`, `web-search.js`
2. THE `index.html` SHALL tải tất cả các tệp adapter qua thẻ `<script>` trước `app.js`
3. WHEN chạy trong môi trường Node/test, THE các tệp adapter SHALL export hàm qua `globalThis` để `app.js` có thể sử dụng

### Yêu cầu 26: LLM Adapter (WebGPU — Chạy LLM trực tiếp trên trình duyệt)

**User Story:** Là một người dùng, tôi muốn chatbot có thể sử dụng mô hình ngôn ngữ lớn (LLM) chạy trực tiếp trên trình duyệt qua WebGPU, để tôi nhận được phản hồi thông minh hơn mà không cần server backend.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL tích hợp LLM_Adapter sử dụng thư viện `@huggingface/transformers` (tải qua CDN) để chạy mô hình LLM trực tiếp trên trình duyệt qua WebGPU
2. THE LLM_Adapter SHALL sử dụng model mặc định `onnx-community/Qwen3.5-0.8B-ONNX-OPT`, có thể thay đổi qua hàm `setLLMModelId()` trước khi load
3. WHEN LLM đang generate text, THE LLM_Adapter SHALL hỗ trợ streaming token-by-token qua callback `onToken(accumulatedText)`
4. WHERE thinking mode được bật, THE LLM_Adapter SHALL bao gồm block `<think>...</think>` trong prompt để hiển thị quá trình suy nghĩ của LLM
5. THE LLM_Adapter SHALL hỗ trợ xử lý ảnh (multimodal) qua hàm `llmGenerateWithImage(userMessage, imageDataURL, onToken, history)`, resize ảnh về 448×448 trước khi gửi cho model
6. THE LLM_Adapter SHALL hỗ trợ hủy bỏ quá trình generate đang chạy qua hàm `cancelLLMGeneration()` sử dụng `InterruptableStoppingCriteria`
7. THE LLM_Adapter SHALL thông báo trạng thái loading qua callback được đăng ký bởi `setLLMStatusCallback(fn)` với các action: `loading_start`, `loading_progress`, `loading_done`, `loading_error`
8. IF WebGPU không được hỗ trợ trong trình duyệt, THEN THE LLM_Adapter SHALL trả về `null` và ghi nhận lỗi vào `_llmLastError`
9. THE LLM_Adapter SHALL giải phóng bộ nhớ GPU sau mỗi lần generate bằng cách dispose `past_key_values`
10. THE Hikari_Chatbot SHALL cung cấp các hàm kiểm tra trạng thái: `isWebGPUSupported()`, `isLLMReady()`, `isLLMGenerating()`, `getLLMStatus()`, `getLLMLastError()`

### Yêu cầu 27: Chat History (Lịch sử hội thoại)

**User Story:** Là một người dùng, tôi muốn chatbot ghi nhớ lịch sử hội thoại trong phiên làm việc và lưu persistent vào IndexedDB, để LLM có thể trả lời dựa trên ngữ cảnh cuộc trò chuyện.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL lưu lịch sử hội thoại trong bộ nhớ session qua biến `_chatHistory` (mảng các object `{role, content}`)
2. WHEN chat history được bật, THE Hikari_Chatbot SHALL lưu persistent mỗi tin nhắn vào IndexedDB qua module `data/chat-history-db.js`
3. THE Hikari_Chatbot SHALL cung cấp hàm `setChatHistoryEnabled(bool)` và `isChatHistoryEnabled()` để bật/tắt tính năng lưu history
4. THE Hikari_Chatbot SHALL cung cấp hàm `setChatHistoryMaxTurns(n)` và `getChatHistoryMaxTurns()` để giới hạn số turn lịch sử gửi cho LLM
5. THE Hikari_Chatbot SHALL cung cấp hàm `getChatHistoryForLLM()` trả về mảng history đã trim theo `maxTurns` để gửi cho LLM
6. THE Hikari_Chatbot SHALL cung cấp hàm `clearChatHistory()` để xóa lịch sử session trong bộ nhớ
7. WHEN khởi động ứng dụng, THE Hikari_Chatbot SHALL tải 10 tin nhắn gần nhất từ IndexedDB và hiển thị vào chat qua `loadRecentHistoryToChat()`

### Yêu cầu 28: File Attachment — Đính kèm ảnh

**User Story:** Là một người dùng, tôi muốn đính kèm ảnh vào tin nhắn gửi cho chatbot, để LLM có thể phân tích và mô tả nội dung ảnh.

#### Tiêu chí chấp nhận

1. THE Chat_Interface SHALL bao gồm nút đính kèm (`#attach-button`) và input file ẩn (`#file-input`) để người dùng chọn ảnh
2. WHEN người dùng chọn ảnh, THE Chat_Interface SHALL hiển thị preview ảnh trong khu vực `#attachment-preview` với thumbnail (`#attachment-thumb`), tên file (`#attachment-name`), và nút xóa (`#attachment-remove`)
3. WHEN người dùng gửi tin nhắn kèm ảnh, THE Hikari_Chatbot SHALL gửi cả text và ảnh (dưới dạng data URL) đến LLM_Adapter qua `llmGenerateWithImage()`
4. WHEN tin nhắn user có ảnh đính kèm, THE `appendMessage()` SHALL hiển thị thumbnail ảnh trong tin nhắn với CSS class `.message-image`
5. THE Hikari_Chatbot SHALL cung cấp hàm `clearAttachment()` để xóa ảnh đính kèm hiện tại và `consumeAttachment()` để lấy và xóa ảnh khi gửi

### Yêu cầu 29: Streaming Messages (Hiển thị tin nhắn realtime)

**User Story:** Là một người dùng, tôi muốn thấy phản hồi của LLM xuất hiện dần dần theo từng token, để trải nghiệm tương tác tự nhiên hơn thay vì chờ đợi toàn bộ phản hồi.

#### Tiêu chí chấp nhận

1. WHEN LLM bắt đầu generate, THE Chat_Interface SHALL tạo một tin nhắn bot trống với CSS class `.streaming` qua hàm `createStreamingBotMessage()`
2. WHEN LLM generate từng token, THE Chat_Interface SHALL cập nhật nội dung tin nhắn streaming realtime qua callback được tạo bởi `createStreamingCallback(element)`
3. THE streaming callback SHALL tách nội dung thành thinking block (`.llm-thinking-block`) và response block dựa trên tag `<think>...</think>`
4. WHEN LLM hoàn thành generate, THE Chat_Interface SHALL finalize tin nhắn streaming qua `finalizeStreamingMessage(element, finalText, confidence, adapterPath, responseTime)`, xóa class `.streaming`
5. THE Chat_Interface SHALL cung cấp hàm `removeStreamingMessage(element)` để xóa tin nhắn streaming khi bị cancel
6. THE CSS SHALL định dạng `.llm-thinking-block`, `.llm-thinking-label`, `.llm-thinking-content` để hiển thị thinking block phân biệt với response

### Yêu cầu 30: LLM Cancel Button (Nút hủy generate)

**User Story:** Là một người dùng, tôi muốn có thể hủy bỏ quá trình LLM đang generate, để không phải chờ đợi khi tôi muốn gửi câu hỏi khác.

#### Tiêu chí chấp nhận

1. WHEN LLM bắt đầu generate, THE Chat_Interface SHALL hiển thị nút Cancel qua hàm `showLLMCancelButton()`
2. WHEN người dùng nhấn nút Cancel, THE Hikari_Chatbot SHALL gọi `cancelLLMGeneration()` để dừng quá trình generate
3. WHEN LLM hoàn thành hoặc bị cancel, THE Chat_Interface SHALL ẩn nút Cancel qua hàm `hideLLMCancelButton()`
4. THE CSS SHALL định dạng `.llm-cancel-container` và `.llm-cancel-button` cho nút Cancel

### Yêu cầu 31: LLM Loading Status (Hiển thị trạng thái tải model)

**User Story:** Là một người dùng, tôi muốn thấy trạng thái tải model LLM, để biết chatbot đang chuẩn bị và không bị nhầm lẫn với lỗi.

#### Tiêu chí chấp nhận

1. WHEN LLM model bắt đầu tải, THE Chat_Interface SHALL hiển thị trạng thái loading qua hàm `showLLMLoadingStatus(message)` với CSS class `.llm-loading-status`
2. WHEN trạng thái LLM thay đổi, THE `onLLMStatusChange(action, message)` SHALL cập nhật hiển thị tương ứng: `loading_start`/`loading_progress` → hiển thị status, `loading_done`/`loading_error` → ẩn status
3. WHEN LLM model tải xong hoặc gặp lỗi, THE Chat_Interface SHALL ẩn trạng thái loading qua hàm `hideLLMLoadingStatus()`

### Yêu cầu 32: Send Button State Management (Quản lý trạng thái nút gửi)

**User Story:** Là một người dùng, tôi muốn nút gửi bị vô hiệu hóa khi chatbot đang xử lý, để tránh gửi nhiều tin nhắn cùng lúc.

#### Tiêu chí chấp nhận

1. WHEN Hikari_Chatbot bắt đầu xử lý tin nhắn, THE Chat_Interface SHALL vô hiệu hóa nút gửi và input qua hàm `setSendingDisabled()`
2. WHEN Hikari_Chatbot hoàn thành xử lý, THE Chat_Interface SHALL kích hoạt lại nút gửi và input qua hàm `setSendingEnabled()`
3. THE CSS SHALL định dạng trạng thái vô hiệu hóa với class `.disabled`

### Yêu cầu 33: Settings Panel (Bảng cài đặt)

**User Story:** Là một người dùng, tôi muốn có bảng cài đặt để tùy chỉnh hành vi của chatbot, bao gồm thinking mode, lưu history, và số turn history.

#### Tiêu chí chấp nhận

1. THE Chat_Interface SHALL bao gồm nút cài đặt (`#settings-button`) để mở/đóng Settings Panel (`#settings-panel`)
2. THE Settings Panel SHALL bao gồm toggle bật/tắt thinking mode (`#thinking-toggle`) cho LLM
3. THE Settings Panel SHALL bao gồm toggle bật/tắt lưu chat history (`#history-toggle`)
4. THE Settings Panel SHALL bao gồm input số để cấu hình số turn history tối đa gửi cho LLM (`#history-max-turns`)
5. THE Hikari_Chatbot SHALL cung cấp hàm `toggleSettingsPanel()` để bật/tắt hiển thị Settings Panel

### Yêu cầu 34: History Dialog (Dialog xem lịch sử chat)

**User Story:** Là một người dùng, tôi muốn xem và quản lý lịch sử chat, bao gồm cả lịch sử trong session và lịch sử lưu trong IndexedDB.

#### Tiêu chí chấp nhận

1. THE Chat_Interface SHALL bao gồm nút xem lịch sử (`#view-history-button`) để mở History Dialog (`#history-overlay`)
2. THE History Dialog SHALL hiển thị 2 tab: tab IndexedDB (`#history-tab-db`) và tab Session (`#history-tab-session`)
3. THE History Dialog SHALL hỗ trợ phân trang (pagination) qua `#history-paging` để duyệt qua nhiều tin nhắn
4. THE History Dialog SHALL bao gồm nút xóa toàn bộ lịch sử (`#clear-history-button`) gọi hàm `clearAllHistory()`
5. THE History Dialog SHALL bao gồm nút đóng (`#history-close-button`) gọi hàm `closeHistoryDialog()`
6. THE Hikari_Chatbot SHALL cung cấp hàm `openHistoryDialog()` và `closeHistoryDialog()` để mở/đóng dialog

### Yêu cầu 35: IndexedDB Chat History (Lưu trữ persistent)

**User Story:** Là một nhà phát triển, tôi muốn lịch sử chat được lưu persistent vào IndexedDB, để người dùng không mất lịch sử khi tải lại trang.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL bao gồm module `data/chat-history-db.js` quản lý IndexedDB với database `HikariChatHistory`, object store `messages` (keyPath: `id`, autoIncrement), và index `timestamp`
2. THE module SHALL cung cấp hàm `saveChatMessage(role, content, lang)` để lưu một tin nhắn với timestamp tự động
3. THE module SHALL cung cấp hàm `getRecentMessages(count)` trả về N tin nhắn gần nhất sắp xếp theo timestamp tăng dần (cũ → mới)
4. THE module SHALL cung cấp hàm `getMessagesPage(page, pageSize)` trả về object `{messages, total, page, totalPages}` để hỗ trợ phân trang
5. THE module SHALL cung cấp hàm `clearAllChatMessages()` để xóa toàn bộ tin nhắn trong IndexedDB
6. IF IndexedDB không khả dụng (môi trường Node/test), THEN THE module SHALL gracefully degrade bằng cách export các hàm stub trả về Promise resolve

### Yêu cầu 36: Fallback Chain mở rộng (LLM Adapter)

**User Story:** Là một người dùng, tôi muốn chatbot thử LLM Adapter như một bước fallback cuối cùng trước khi hiển thị thông báo lỗi, để tôi luôn nhận được phản hồi hữu ích nhất có thể.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL áp dụng fallback chain mở rộng theo thứ tự: RiveScript → bestMatch → Fallback API → LLM_Adapter → final fallback message
2. WHEN Fallback API thất bại và LLM_Adapter sẵn sàng (WebGPU supported, model loaded), THE Hikari_Chatbot SHALL thử gọi LLM_Adapter với streaming
3. WHEN tất cả fallback đều thất bại, THE Hikari_Chatbot SHALL hiển thị final fallback message qua hàm `getFinalFallbackMessage()` kèm thông tin lỗi LLM nếu có
4. THE `getFinalFallbackMessage()` SHALL trả về thông báo đa ngôn ngữ (vi/en/ja) kèm thông tin debug từ `getLLMLastError()` nếu có lỗi LLM

### Yêu cầu 37: appendMessage mở rộng — Hiển thị ảnh đính kèm

**User Story:** Là một người dùng, tôi muốn thấy ảnh tôi đã đính kèm hiển thị trong tin nhắn của mình, để tôi biết ảnh đã được gửi thành công.

#### Tiêu chí chấp nhận

1. THE `appendMessage(text, sender, confidence, adapterPath, responseTime, imageDataURL)` SHALL chấp nhận tham số tùy chọn `imageDataURL` để hiển thị ảnh đính kèm trong tin nhắn user
2. WHEN `imageDataURL` được cung cấp và sender là "user", THE `appendMessage()` SHALL render thẻ `<img>` với src là imageDataURL trong tin nhắn
3. THE CSS SHALL định dạng `.message-image` với kích thước phù hợp (max-width, border-radius) để hiển thị ảnh trong tin nhắn

### Yêu cầu 38: IndexedDB Attachment Storage (Lưu trữ file đính kèm)

**User Story:** Là một người dùng, tôi muốn file đính kèm được lưu persistent cùng với lịch sử chat trong IndexedDB, để tôi có thể xem lại ảnh đã gửi khi mở lại lịch sử.

#### Tiêu chí chấp nhận

1. THE `data/chat-history-db.js` SHALL bao gồm object store riêng `attachments` (keyPath: `id`, autoIncrement) với các trường: `messageId` (FK tham chiếu `messages.id`), `fileName`, `fileType`, `fileSize`, `data` (ArrayBuffer), `timestamp`
2. THE module SHALL cung cấp hàm `saveAttachment(messageId, file)` nhận `File` object, đọc nội dung dưới dạng `ArrayBuffer` và lưu vào store `attachments`
3. THE module SHALL cung cấp hàm `getAttachment(attachmentId)` trả về record attachment kèm `data` (ArrayBuffer)
4. THE module SHALL cung cấp hàm `getAttachmentByMessageId(messageId)` trả về attachment tương ứng với một tin nhắn
5. WHEN hiển thị attachment từ IndexedDB, THE module SHALL cung cấp hàm `attachmentToDataURL(attachment)` chuyển đổi `ArrayBuffer` thành data URL (`data:<fileType>;base64,...`) để render trong `<img>`
6. THE module SHALL cung cấp hàm `clearAllAttachments()` để xóa toàn bộ attachments
7. THE `saveChatMessage()` SHALL được mở rộng thành `saveChatMessage(role, content, lang, file?)` — nếu có `file`, tự động gọi `saveAttachment()` sau khi lưu message và trả về `{messageId, attachmentId}`
8. IF `ArrayBuffer` không khả dụng (môi trường Node/test), THEN THE module SHALL gracefully degrade với stub functions

### Yêu cầu 39: Voice Input — Speech to Text (Nhập liệu bằng giọng nói)

**User Story:** Là một người dùng, tôi muốn có thể nhập tin nhắn bằng giọng nói thay vì gõ bàn phím, để tương tác với chatbot tự nhiên và tiện lợi hơn.

#### Tiêu chí chấp nhận

1. THE Chat_Interface SHALL bao gồm nút microphone (`#voice-input-button`) trong input area để bật/tắt chế độ nhận diện giọng nói
2. THE Hikari_Chatbot SHALL sử dụng Web Speech API (`SpeechRecognition` hoặc `webkitSpeechRecognition`) để nhận diện giọng nói trực tiếp trên trình duyệt, không cần server
3. WHEN người dùng nhấn nút microphone, THE Hikari_Chatbot SHALL bắt đầu lắng nghe và hiển thị trạng thái đang nghe (nút đổi màu/animation)
4. THE ngôn ngữ nhận diện giọng nói SHALL được đặt tự động theo `currentLang` của Language_Selector: `vi` → `vi-VN`, `en` → `en-US`, `ja` → `ja-JP`
5. WHEN nhận diện xong một câu, THE Hikari_Chatbot SHALL điền kết quả vào `#message-input` và tự động gửi tin nhắn
6. THE Hikari_Chatbot SHALL hỗ trợ chế độ `continuous: false` (nhận diện một câu rồi dừng) để tránh gửi nhiều tin nhắn liên tiếp không mong muốn
7. IF trình duyệt không hỗ trợ Web Speech API, THEN THE nút microphone SHALL bị ẩn hoặc vô hiệu hóa với tooltip giải thích
8. WHEN đang nhận diện giọng nói, THE Chat_Interface SHALL hiển thị interim results (kết quả tạm thời) trong input field để người dùng thấy đang nhận diện
9. THE Hikari_Chatbot SHALL cung cấp hàm `startVoiceInput()` và `stopVoiceInput()` để bắt đầu/dừng nhận diện
10. WHEN tính năng Voice Input bị tắt trong Settings, THE nút microphone SHALL bị ẩn

### Yêu cầu 40: Voice Output — Text to Speech (Chatbot trả lời bằng giọng nói)

**User Story:** Là một người dùng, tôi muốn chatbot đọc to phản hồi bằng giọng nói, để tôi có thể nghe câu trả lời mà không cần nhìn màn hình.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL sử dụng Web Speech API (`SpeechSynthesis`) để đọc phản hồi của bot bằng giọng nói, không cần server
2. WHEN tính năng Voice Output được bật và bot có phản hồi mới, THE Hikari_Chatbot SHALL tự động đọc nội dung phản hồi qua `speechSynthesis.speak()`
3. THE ngôn ngữ đọc SHALL khớp với `currentLang`: `vi` → `vi-VN`, `en` → `en-US`, `ja` → `ja-JP`
4. THE giọng đọc SHALL được chọn từ danh sách voices được lọc theo ngôn ngữ hiện tại, ưu tiên voice có `localService: true` (giọng tự nhiên cài sẵn trên thiết bị) trước voices online
5. THE Settings Panel SHALL bao gồm dropdown `#tts-voice-select` hiển thị danh sách voices phù hợp với ngôn ngữ hiện tại, cho phép người dùng chọn voice ưa thích
6. WHEN ngôn ngữ thay đổi qua Language_Selector, THE `#tts-voice-select` SHALL tự động cập nhật danh sách voices và chọn lại voice mặc định phù hợp
7. THE Hikari_Chatbot SHALL cung cấp hàm `speakText(text, lang)` để đọc một chuỗi văn bản với ngôn ngữ và voice đã chọn
8. THE Hikari_Chatbot SHALL cung cấp hàm `stopSpeaking()` để dừng đọc ngay lập tức
9. WHEN LLM đang streaming, THE Hikari_Chatbot SHALL chờ đến khi `finalizeStreamingMessage()` hoàn tất rồi mới đọc toàn bộ phản hồi (không đọc từng token)
10. IF trình duyệt không hỗ trợ `SpeechSynthesis`, THEN THE tính năng Voice Output SHALL bị vô hiệu hóa và ẩn khỏi Settings
11. THE Settings Panel SHALL bao gồm toggle `#voice-output-toggle` để bật/tắt tính năng Voice Output
12. THE Settings Panel SHALL bao gồm toggle `#voice-input-toggle` để bật/tắt tính năng Voice Input

### Yêu cầu 41: Interaction Mode — 4 chế độ tương tác

**User Story:** Là một người dùng, tôi muốn chọn chế độ tương tác phù hợp với nhu cầu của mình, bao gồm 4 kết hợp giữa text/voice cho input và output, để có trải nghiệm linh hoạt nhất.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL hỗ trợ 4 chế độ tương tác (Interaction_Mode):
   - **Text → Text** (mặc định): người dùng gõ text, bot trả lời text — không cần Web Speech API
   - **Text → Voice**: người dùng gõ text, bot trả lời bằng giọng nói (TTS) — cần SpeechSynthesis
   - **Voice → Text**: người dùng nói, bot trả lời text (STT) — cần SpeechRecognition
   - **Voice → Voice**: người dùng nói, bot trả lời bằng giọng nói (STT + TTS) — cần cả hai
2. THE Settings Panel SHALL bao gồm bộ chọn chế độ (`#interaction-mode-select` hoặc 4 radio buttons) để người dùng chọn một trong 4 Interaction_Mode
3. WHEN Interaction_Mode thay đổi, THE Chat_Interface SHALL cập nhật trạng thái hiển thị: ẩn/hiện nút microphone (`#voice-input-button`) và bật/tắt TTS tự động
4. WHEN Interaction_Mode là "Voice → Text" hoặc "Voice → Voice", THE nút microphone SHALL hiển thị và sẵn sàng nhận input
5. WHEN Interaction_Mode là "Text → Voice" hoặc "Voice → Voice", THE Hikari_Chatbot SHALL tự động gọi `speakText()` sau mỗi phản hồi bot
6. WHEN Interaction_Mode là "Text → Text" hoặc "Voice → Text", THE Hikari_Chatbot SHALL KHÔNG tự động gọi `speakText()`
7. THE Interaction_Mode mặc định SHALL là "Text → Text" khi trang web được tải lần đầu
8. IF một chế độ yêu cầu API không được hỗ trợ (SpeechRecognition hoặc SpeechSynthesis), THEN THE chế độ đó SHALL bị vô hiệu hóa trong bộ chọn với tooltip giải thích lý do
9. WHEN Interaction_Mode là "Voice → Voice", THE Hikari_Chatbot SHALL dừng TTS đang phát (`stopSpeaking()`) trước khi bắt đầu lắng nghe STT để tránh feedback loop
10. THE Chat_Interface SHALL hiển thị badge/indicator nhỏ cho biết chế độ hiện tại (ví dụ: 🎤→📝, 📝→🔊, 🎤→🔊, 📝→📝)

### Yêu cầu 42: Chat History Retention — Cơ chế giới hạn lưu trữ IndexedDB

**User Story:** Là một người dùng, tôi muốn có thể cấu hình giới hạn lưu trữ lịch sử chat trong IndexedDB, để tránh tích lũy dữ liệu vô hạn và kiểm soát dung lượng lưu trữ trên thiết bị của mình.

#### Tiêu chí chấp nhận

1. THE Hikari_Chatbot SHALL hỗ trợ 2 cơ chế retention cho IndexedDB, người dùng chọn một trong hai qua Settings Panel:
   - **Cơ chế 1 — Giới hạn số lượng hội thoại**: lưu tối đa N hội thoại (mặc định 50), xóa hội thoại cũ nhất khi vượt quá N (FIFO)
   - **Cơ chế 2 — Giới hạn thời gian lưu trữ**: lưu tối đa M ngày (mặc định 30 ngày), tự động xóa tin nhắn cũ hơn M ngày
2. THE Settings Panel SHALL bao gồm bộ chọn cơ chế retention (`#retention-mode-select`) với 2 tùy chọn: "Giới hạn số lượng" và "Giới hạn thời gian"
3. WHEN cơ chế 1 được chọn, THE Settings Panel SHALL hiển thị input số `#retention-max-count` (mặc định 50) để người dùng cấu hình số lượng hội thoại tối đa N
4. WHEN cơ chế 2 được chọn, THE Settings Panel SHALL hiển thị input số `#retention-max-days` (mặc định 30) để người dùng cấu hình số ngày tối đa M
5. WHEN cơ chế 1 đang áp dụng và số lượng tin nhắn trong IndexedDB vượt quá N, THE `data/chat-history-db.js` SHALL tự động xóa các tin nhắn cũ nhất (theo timestamp tăng dần) cho đến khi còn đúng N tin nhắn
6. WHEN cơ chế 2 đang áp dụng, THE `data/chat-history-db.js` SHALL tự động xóa tất cả tin nhắn có `timestamp` cũ hơn M ngày tính từ thời điểm hiện tại
7. THE `data/chat-history-db.js` SHALL cung cấp hàm `applyRetentionPolicy(mode, value)` để áp dụng cơ chế retention: `mode` là `"count"` hoặc `"days"`, `value` là N hoặc M tương ứng
8. THE `applyRetentionPolicy()` SHALL được gọi tự động sau mỗi lần `saveChatMessage()` thành công để đảm bảo giới hạn luôn được tuân thủ
9. THE Hikari_Chatbot SHALL lưu cấu hình retention (mode và value) vào `localStorage` để giữ nguyên sau khi tải lại trang
10. WHEN người dùng thay đổi cơ chế hoặc giá trị retention trong Settings Panel, THE Hikari_Chatbot SHALL áp dụng ngay lập tức bằng cách gọi `applyRetentionPolicy()` với cấu hình mới

### Yêu cầu 43: Object Macros Panel — Enable/Disable Adapter

**User Story:** Là một người dùng, tôi muốn có thể bật/tắt từng adapter trong Object Macros Panel, để kiểm soát những adapter nào được sử dụng trong quá trình xử lý tin nhắn.

#### Tiêu chí chấp nhận

1. THE Object_Macro_List SHALL đọc danh sách adapter động từ `data/adapter-registry.json` thay vì hard-code, để phản ánh đúng các adapter hiện có
2. WHEN hiển thị Object_Macro_List, THE Chat_Interface SHALL render một toggle (checkbox hoặc switch) bên cạnh mỗi adapter để người dùng bật/tắt
3. THE toggle SHALL phản ánh trạng thái `active` hiện tại của adapter từ `data/adapter-registry.json`
4. WHEN người dùng toggle một adapter, THE Hikari_Chatbot SHALL cập nhật field `active` tương ứng trong `ADAPTER_REGISTRY` (biến toàn cục trong bộ nhớ) và lưu thay đổi vào `data/adapter-registry.json` qua cơ chế lưu trữ phù hợp (localStorage fallback nếu không thể ghi file trực tiếp)
5. WHEN một adapter có `active: false`, THE Logic_Adapter_Dispatcher SHALL bỏ qua adapter đó trong quá trình điều phối, không gọi adapter đó khi xử lý tin nhắn
6. THE `voice-adapter` SHALL luôn được giữ ở trạng thái enabled và KHÔNG hiển thị toggle disable cho adapter này (ngoại lệ bắt buộc)
7. WHEN adapter bị disabled, THE Object_Macro_List SHALL hiển thị adapter đó với style mờ (opacity thấp hơn) để phân biệt trực quan với adapter đang enabled
8. THE Hikari_Chatbot SHALL cung cấp hàm `setAdapterActive(adapterKey, isActive)` để cập nhật trạng thái active của một adapter trong `ADAPTER_REGISTRY`
9. WHEN `initBot()` được gọi, THE Hikari_Chatbot SHALL chỉ đăng ký các adapter có `active: true` vào RiveScript_Engine qua `bot.setSubroutine()`, bỏ qua adapter có `active: false`
10. THE trạng thái enable/disable của các adapter SHALL được lưu persistent vào `localStorage` (key: `hikari_adapter_states`) để giữ nguyên sau khi tải lại trang

### Yêu cầu 44: Chỉ định Adapter bằng Prefix Command

**User Story:** Là một người dùng, tôi muốn có thể chỉ định trực tiếp adapter nào sẽ xử lý tin nhắn bằng cách gõ `/[key_adapter] [nội dung]` trong ô nhập liệu, để kiểm soát chính xác luồng xử lý mà không phụ thuộc vào fallback chain tự động.

#### Tiêu chí chấp nhận

1. WHEN người dùng gõ `/[key] [nội dung]` trong Message_Input và `key` khớp với một adapter có trong `ADAPTER_REGISTRY` với `active: true`, THE Hikari_Chatbot SHALL nhận diện đây là một Adapter_Prefix_Command hợp lệ
2. WHEN một Adapter_Prefix_Command hợp lệ được nhận diện trong Message_Input, THE Chat_Interface SHALL hiển thị visual feedback (badge hoặc chip phía trên Message_Input) thông báo adapter đã được chọn, ví dụ: "🔧 Best Match"
3. WHEN người dùng gửi một Adapter_Prefix_Command hợp lệ, THE Hikari_Chatbot SHALL gọi trực tiếp adapter được chỉ định với phần nội dung sau `/[key] ` (bỏ qua toàn bộ fallback chain: RiveScript, bestMatch, API, LLM)
4. WHEN người dùng gõ `/[key]` mà `key` không khớp với bất kỳ adapter nào trong `ADAPTER_REGISTRY` hoặc adapter đó có `active: false`, THE Chat_Interface SHALL KHÔNG hiển thị visual feedback và SHALL xử lý tin nhắn theo luồng thông thường
5. WHEN người dùng gửi Adapter_Prefix_Command mà không có nội dung sau prefix (ví dụ: chỉ gõ `/best_match` không có text tiếp theo), THE Hikari_Chatbot SHALL hiển thị thông báo yêu cầu nhập nội dung thay vì gọi adapter
6. THE Adapter_Prefix_Command SHALL chỉ áp dụng cho các adapter nhận text input trực tiếp; `voice-adapter` SHALL bị loại trừ khỏi danh sách key hợp lệ cho Adapter_Prefix_Command
7. WHEN người dùng đang gõ và phần đầu input khớp với `/[valid_key]`, THE Chat_Interface SHALL cập nhật visual feedback theo thời gian thực (real-time) mà không cần người dùng nhấn gửi
8. WHEN visual feedback Adapter_Prefix_Command đang hiển thị và người dùng xóa prefix khỏi input, THE Chat_Interface SHALL ẩn badge/chip và trở về trạng thái bình thường
9. THE Hikari_Chatbot SHALL cung cấp hàm `parseAdapterPrefixCommand(input)` trả về `{ adapterKey, content }` nếu input là Adapter_Prefix_Command hợp lệ, hoặc `null` nếu không hợp lệ
10. WHEN adapter được chỉ định qua Adapter_Prefix_Command trả về kết quả, THE Adapter_Path breadcrumb SHALL hiển thị tên adapter đó kèm ký hiệu chỉ định trực tiếp (ví dụ: "📌 Best Match") để phân biệt với luồng fallback thông thường
