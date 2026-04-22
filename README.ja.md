# 🌟 Hikari チャットボット

🌐 [English](README.en.md) | **日本語** | [Tiếng Việt](README.md)

ブラウザ上で完全に動作する多言語スタティックチャットボット。[RiveScript](https://www.rivescript.com/)を会話エンジンとして使用。バックエンド不要、ビルドツール不要。

**デモ:** 任意のスタティックサーバーで`index.html`を開いてください。

## 機能

- 💬 3言語対応: ベトナム語、英語、日本語
- 🇻🇳 ベトナム語のダイアクリティカルマーク処理（デュアルリプライ戦略）
- 🔍 ウェブ検索（DuckDuckGo、APIキー不要）
- 🧮 数式計算（`計算 2 + 3`）
- 🔄 単位変換（`変換 5 km を m`）
- 🕐 時間・日付の確認（`今何時`）
- 📊 信頼度表示、アダプターパス、応答時間
- 📖 多言語ヘルプダイアログ
- ⚡ 前処理済みTF-IDFデータによる高速マッチング
- 📱 レスポンシブ対応（モバイル＋デスクトップ）

## クイックスタート

```bash
git clone <repo-url>
cd hikari-chatbot
npm install
npx http-server -p 8080
# http://localhost:8080 を開く
```

## 使用例

| 入力 | アダプター | 例 |
|------|-----------|-----|
| 挨拶 | RiveScript | `こんにちは`、`おはよう`、`やあ` |
| 名前を聞く | RiveScript | `あなたは誰ですか`、`名前は何ですか` |
| 計算 | 数学計算 | `計算 2 + 3`、`15 掛ける 4` |
| 単位変換 | 単位変換 | `変換 5 km を m` |
| 時間 | 時間アダプター | `今何時`、`今日は何日` |
| ウェブ検索 | ウェブ検索 | `グーグル JavaScript` |
| 知識 | ベストマッチ | `チャットボットとは何ですか` |
| 総合処理 | ロジックディスパッチャー | `処理 2 + 3` |

## アダプターシステム

`bot.setSubroutine()`で登録された7つのアダプター:

| アダプター | 説明 | 優先度 |
|-----------|------|--------|
| `specific_response` | 完全一致Q&A | 1（最高） |
| `time_adapter` | 時間・日付・曜日 | 2 |
| `mathematical_evaluation` | 安全な数式計算（eval不使用） | 3 |
| `unit_conversion` | 長さ、質量、温度 | 4 |
| `best_match` | ファジーマッチ（4アルゴリズム） | 5（最低） |
| `logic_adapter` | 優先度ベースのディスパッチャー | — |
| `web_search` | DuckDuckGo / Google | — |

## テキスト類似度

4つのアルゴリズムを組み合わせ（各25%）:

- **レーベンシュタイン** — 文字レベルの編集距離
- **ジャッカード** — 単語セットの重複
- **コサイン** — TFベクトルの角度
- **シンセット** — 同義語対応マッチング（3言語17グループ）

ランタイムの高速マッチングのため、前処理済みTF-IDFデータをサポート。

## ウェブ検索

デフォルトでDuckDuckGo Instant Answer API（無料、キー不要）を使用。主要トピックにはWikipediaの要約を返し、その他には検索リンクを返します。

オプション: `adapters/web-search.js`でGoogle Custom Search APIを設定:

```js
var GOOGLE_API_KEY = 'your-key';
var GOOGLE_CX = 'your-search-engine-id';
```

## テスト

```bash
npm test           # 32テスト（Vitest + jsdom）
npm run preprocess # 前処理データの再構築
```

## カスタマイズ

- **Q&A追加:** `data/qa-dataset.json`を編集 → `npm run preprocess`
- **トリガー追加:** `brain/ja.rive`を編集 → `npm run preprocess`
- **アダプター追加:** `adapters/`にファイル作成、`adapter-registry.js`に登録、`.rive`にトリガー追加
- **フォールバックAPI:** `app.js`の`FALLBACK_API_URL`を設定（LLM APIに向けることも可能）

## ルールベースチャットボット vs AIエージェント（LLM）

| 基準 | ルールベース（Hikari） | AIエージェント（LLM） |
|------|---------------------|---------------------|
| 動作方式 | パターンマッチング | ニューラルネットワークがテキスト生成 |
| 理解力 | 定義済みパターンのみ | 深い文脈・意味理解 |
| リクエスト単価 | ¥0 | ¥1.5〜¥9/1Kトークン |
| レイテンシ | < 10ms | 500ms〜3s |
| ハルシネーション | なし（決定的） | 可能性あり |
| プライバシー | データはローカル | サードパーティAPIに送信 |
| オフライン | 可能（ウェブ検索除く） | 不可 |
| スケーラビリティ | ルールを手動追加 | リクエスト量に応じてコスト増 |
| コンテキスト記憶 | なし（ステートレス） | マルチターン会話 |
| 多言語 | 言語ごとに手動 | 100+言語をネイティブ対応 |

**使い分け:**

| シナリオ | 推奨 |
|---------|------|
| FAQボット、簡単なガイド | ルールベース |
| 低予算、API費用なし | ルールベース |
| 規制産業（監査証跡） | ルールベース |
| 複雑なカスタマーサポート | AIエージェント |
| オープンエンドの質問 | AIエージェント |
| **両方の長所** | ルールベース + LLMフォールバック |

Hikariはハイブリッドアプローチをサポート: `FALLBACK_API_URL`をLLM APIに向ければ、既知の質問はルールベースで即座に処理し、残りはLLMが処理します。

## 技術スタック

- **フロントエンド:** HTML + CSS + バニラJavaScript
- **チャットエンジン:** [RiveScript](https://www.rivescript.com/)（CDN）
- **テスト:** [Vitest](https://vitest.dev/) + jsdom + fast-check
- **ウェブ検索:** DuckDuckGo Instant Answer API

## ドキュメント

- [テクニカルデザイン](TECHNICAL_DESIGN.md)
- [仕様書](/.kiro/specs/hikari-chatbot/)

## ライセンス

MIT
