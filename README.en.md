# 🌟 Hikari Chatbot

🌐 **English** | [日本語](README.ja.md) | [Tiếng Việt](README.md)

A multilingual static chatbot running entirely in the browser, powered by [RiveScript](https://www.rivescript.com/). No backend, no build tools required.

**Demo:** Open `index.html` via any static server.

Online demo: [huggingface](https://huggingface.co/spaces/mr4/chatbot-js)

## Features

- 💬 3-language conversation: Vietnamese, English, Japanese
- 🇻🇳 Vietnamese diacritics handling (dual-reply strategy)
- 🔍 Web search (DuckDuckGo, no API key needed)
- 🧮 Math evaluation (`calculate 2 + 3`)
- 🔄 Unit conversion (`convert 5 km to m`)
- 🕐 Time & date queries (`what time is it?`)
- 📊 Confidence display, adapter path breadcrumb, response time
- 📖 Multilingual help dialog
- ⚡ Preprocessed TF-IDF data for fast matching
- 📱 Responsive (mobile + desktop)

## Quick Start

```bash
git clone <repo-url>
cd hikari-chatbot
npm install
npx http-server -p 8080
# Open http://localhost:8080
```

## Usage Examples

| Input | Adapter | Example |
|-------|---------|---------|
| Greeting | RiveScript | `hello`, `hi there`, `hey` |
| Ask name | RiveScript | `who are you`, `what is your name` |
| Math | Math Evaluation | `calculate 2 + 3`, `15 times 4` |
| Unit conversion | Unit Conversion | `convert 5 km to m`, `100 fahrenheit to celsius` |
| Time | Time Adapter | `what time is it`, `what date is it` |
| Web search | Web Search | `google javascript`, `search RiveScript` |
| Knowledge | Best Match | `what is AI`, `what is a chatbot` |
| Combined | Logic Dispatcher | `process 2 + 3` |

## Adapter System

7 adapters registered via `bot.setSubroutine()`:

| Adapter | Description | Priority |
|---------|-------------|----------|
| `specific_response` | Exact match Q&A | 1 (highest) |
| `time_adapter` | Time / date / day of week | 2 |
| `mathematical_evaluation` | Safe math (no eval) | 3 |
| `unit_conversion` | Length, mass, temperature | 4 |
| `best_match` | Fuzzy match (4 algorithms) | 5 (lowest) |
| `logic_adapter` | Priority-based dispatcher | — |
| `web_search` | DuckDuckGo / Google | — |

## Text Similarity

Combines 4 algorithms (25% each):

- **Levenshtein** — character-level edit distance
- **Jaccard** — word-set overlap
- **Cosine** — TF vector angle
- **Synset** — synonym-aware matching (17 synonym groups across 3 languages)

Supports preprocessed TF-IDF data for faster runtime matching.

## Web Search

Uses DuckDuckGo Instant Answer API by default (free, no key). Returns Wikipedia summaries for major topics, search links for others.

Optional Google Custom Search API — configure in `adapters/web-search.js`:

```js
var GOOGLE_API_KEY = 'your-key';
var GOOGLE_CX = 'your-search-engine-id';
```

## Testing

```bash
npm test           # 32 tests (Vitest + jsdom)
npm run preprocess # Rebuild preprocessed data
```

## Customization

- **Add Q&A:** Edit `data/qa-dataset.json` or `data/specific-responses.json`, then `npm run preprocess`
- **Add triggers:** Edit `brain/en.rive`, then `npm run preprocess`
- **Add adapter:** Create `adapters/my-adapter.js`, register in `adapter-registry.js`, add trigger in `.rive` files
- **Fallback API:** Set `FALLBACK_API_URL` in `app.js` (can point to LLM API)

## Rule-based Chatbot vs AI Agent (LLM)

| Criteria | Rule-based (Hikari) | AI Agent (LLM) |
|----------|-------------------|-----------------|
| How it works | Pattern matching (trigger → response) | Neural network generates text |
| Understanding | Only defined patterns | Deep context & semantics |
| Cost per request | $0 | $0.01–$0.06/1K tokens |
| Latency | < 10ms | 500ms–3s |
| Hallucination | Never (deterministic) | Possible |
| Privacy | Data stays local | Sent to 3rd party API |
| Offline | Yes (except web search) | No |
| Scalability | Add rules manually | Cost scales with requests |
| Context memory | None (stateless) | Multi-turn conversation |
| Multilingual | Manual per language | 100+ languages natively |

**When to use what:**

| Scenario | Recommendation |
|----------|---------------|
| FAQ bot, simple guides | Rule-based |
| Low budget, no API costs | Rule-based |
| Regulated industry (audit trail) | Rule-based |
| Complex customer support | AI Agent |
| Open-ended questions | AI Agent |
| **Best of both** | Rule-based + LLM fallback |

Hikari supports a hybrid approach: point `FALLBACK_API_URL` to an LLM API — rule-based handles known questions instantly, LLM handles the rest.

## Tech Stack

- **Frontend:** HTML + CSS + vanilla JavaScript
- **Chat Engine:** [RiveScript](https://www.rivescript.com/) (CDN)
- **Testing:** [Vitest](https://vitest.dev/) + jsdom + fast-check
- **Web Search:** DuckDuckGo Instant Answer API

## Docs

- [Spec](/.kiro/specs/hikari-chatbot/)

## License

MIT
