/**
 * Smart Receipt ローカル設定（例）
 *
 * 使い方:
 * - このファイルを `config.js` として同じ場所にコピーして編集してください。
 * - `config.js` は `.gitignore` 済みなので GitHub には上がりません（APIキー流出対策）。
 *
 * 注意:
 * - フロントエンド直呼びのため、`config.js` を使うと「ブラウザにAPIキーが存在する」状態になります。
 *   公開運用（第三者が触れる環境）では、Vercel Functions 等のサーバー側にキーを置く構成を推奨します。
 */

window.SMART_RECEIPT_CONFIG = {
  // 利用するプロバイダ: "openrouter" | "gemini"
  OCR_PROVIDER: "openrouter",

  // OpenRouter 設定
  OPENROUTER_API_KEY: "",
  // OpenRouterのモデルID（例: "google/gemini-flash-1.5" など）
  OPENROUTER_MODEL: "google/gemini-flash-1.5",
  // OpenRouter 必須ヘッダー用（未指定なら自動で window.location.origin / 固定タイトル）
  OPENROUTER_SITE_URL: "",
  OPENROUTER_APP_TITLE: "Smart Receipt (Local)",

  // 解析（OCR）を常にデモにする（開発用）
  FORCE_DEMO_MODE: false
};


