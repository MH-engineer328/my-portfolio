/**
 * Gemini API (gemini-1.5-flash) を利用した OCR/構造化抽出サービス
 * - BYOK: ユーザー入力の API キーを LocalStorage（smart_receipt_auth_v1）で管理
 * - フロントエンド完結型のため、直接 API を呼び出す
 * - デモモード: キー未設定または明示的にデモ指定された場合はダミー結果を返却
 */

class GeminiService {
    constructor(storage) {
        this.storage = storage;
        this.model = 'gemini-1.5-flash';
        this.endpointBase = 'https://generativelanguage.googleapis.com/v1beta/models';
        this.openRouterEndpoint = 'https://openrouter.ai/api/v1/chat/completions';
    }

    getConfig() {
        const cfg = (typeof window !== 'undefined' && window.SMART_RECEIPT_CONFIG)
            ? window.SMART_RECEIPT_CONFIG
            : {};
        return cfg && typeof cfg === 'object' ? cfg : {};
    }

    /**
    * 画像を Gemini に送信し、JSON テキストを取得
    * @param {File} file
    * @returns {Promise<{ text: string, isDemo: boolean }>}
    */
    async analyzeReceipt(file) {
        const cfg = this.getConfig();
        const provider = (cfg.OCR_PROVIDER || 'gemini').toLowerCase();
        const auth = this.storage?.getAuthConfig ? this.storage.getAuthConfig() : { apiKey: '', useDemoMode: false };

        // config.js のキーを優先（ローカル開発用）
        const configKey = provider === 'openrouter' ? (cfg.OPENROUTER_API_KEY || '') : '';
        const apiKey = configKey || auth.apiKey || '';
        const forcedDemo = !!cfg.FORCE_DEMO_MODE;

        // config.js でキーが指定されている場合は、明示的な FORCE_DEMO_MODE が true でない限りデモモードを無効化する
        const useDemoMode = forcedDemo || (configKey ? false : (auth.useDemoMode || !apiKey));

        if (useDemoMode) {
            return {
                text: JSON.stringify(this.buildDemoResult()),
                isDemo: true
            };
        }

        const base64Image = await this.encodeImageToBase64(file);
        const prompt = this.buildPrompt();

        const mimeType = file?.type || 'image/jpeg';
        const responseText = provider === 'openrouter'
            ? await this.callOpenRouterApi({
                apiKey,
                base64Image,
                mimeType,
                prompt
            })
            : await this.callGeminiApi({
                apiKey,
                base64Image,
                mimeType,
                prompt
            });

        return { text: responseText, isDemo: false, provider };
    }

    /**
     * LocalStorage に保存したキーを使うため、API キーが未設定ならデモ結果を返す
     * config.js (window.SMART_RECEIPT_CONFIG) にデモデータ設定があればそれを利用する
     */
    buildDemoResult() {
        const cfg = this.getConfig();
        const today = new Date().toISOString().split('T')[0];

        return {
            date: { value: cfg.DEMO_DATE || today, confidence: 'low' },
            merchant: { name: cfg.DEMO_MERCHANT || 'デモストア', confidence: 'low' },
            amount: { value: cfg.DEMO_AMOUNT || 1234, confidence: 'low' },
            rawText: cfg.DEMO_RAW_TEXT || 'デモモード: ダミーのレシートデータです。'
        };
    }

    /**
     * Gemini へのプロンプト
     */
    buildPrompt() {
        // ユーザー提供の仕様（detailed: receipts配列 + error）を優先
        // ※ アプリ側は parser.js で既存の {date, merchant, amount, rawText} に正規化して利用する
        return [
            'あなたは高度な画像認識能力を持つレシート解析AIです。',
            'ユーザーから提供された画像（1枚）を分析し、以下の仕様に従ってJSONデータを出力してください。',
            '思考プロセスやMarkdownの装飾、挨拶は一切不要です。純粋なJSON文字列のみを返してください。',
            '',
            '# 1. 画像解析と処理モードの決定',
            '提供された画像全体を見て、以下のどのケースか判断し処理してください。',
            '- ケースA（通常）: 1つのレシートが写っている → 1つのデータとして抽出。',
            '- ケースB（複数レシート）: 異なるレシートが複数写っている → それぞれ別のデータとしてリストに追加。',
            '- ケースD（無効）: レシートではない画像 → error オブジェクトを出力。',
            '',
            '# 2. カテゴリリスト（注入データ）',
            '商品分類には必ず以下のリストを使用し、最も近いものを選択してください。リスト外の語句は使用不可です。',
            '[食費, 日用品, 被服費, 美容・健康, 交際費, 交通費, 教育・教養, 水道光熱費, 住まい, その他]',
            '',
            '# 2.5 合計金額（total_amount）の厳密ルール（最重要）',
            '- total_amount は「今回の支払金額（請求額）」です。小計(subtotal)や税額のみを誤って入れないでください。',
            '- レシート上で優先すべきキーワード例: 「合計」「総合計」「お支払金額」「お会計」「請求額」「TOTAL」。',
            '- 次の数値は total_amount にしない: 「お預り」「預り」「釣り」「お釣り」「ポイント」「残高」「内税/消費税(税額のみ)」「軽減税率対象額」など。',
            '- 複数の“合計らしき金額”がある場合、支払金額に該当する1つを選び、他は summary/subtotal/tax/discount に振り分けてください。',
            '- 検算: 可能なら items の合計（row_total の合算 - discount 合計）と summary.subtotal が一致するように調整してください。',
            '- 検算: 可能なら summary.total_amount = summary.subtotal + summary.total_tax_amount - summary.total_discount を満たしてください。',
            '- どうしても確信できない場合は、total_amount は 0 や推測値にせず null にしてください（他の情報は可能な範囲で埋める）。',
            '',
            '# 3. 出力JSON構造',
            'ルート要素は必ず receipts 配列と error オブジェクトを持つ構造にしてください。',
            'receipts は0件以上。正常時は error は null。',
            '',
            '{',
            '  "receipts": [',
            '    {',
            '      "store_info": { "name": "店舗名", "branch": "支店名", "tel": "電話番号" },',
            '      "transaction": { "date": "YYYY/MM/DD HH:mm (不明な場合はnull)", "payment_method": "現金/クレカ/電子マネー等" },',
            '      "items": [',
            '        {',
            '          "name": "商品名",',
            '          "count": 1,',
            '          "unit_price": 100,',
            '          "row_total": 100,',
            '          "category": "カテゴリリストから選択",',
            '          "discount": 0,',
            '          "tax_rate": 0.10,',
            '          "is_reduced_tax": false',
            '        }',
            '      ],',
            '      "summary": { "subtotal": 0, "total_tax_amount": 0, "total_amount": 0, "total_discount": 0 },',
            '      "tax_analysis": {',
            '        "rate_8_percent": { "taxable_amount": 0, "tax_amount": 0 },',
            '        "rate_10_percent": { "taxable_amount": 0, "tax_amount": 0 }',
            '      }',
            '    }',
            '  ],',
            '  "error": null',
            '}',
            '',
            '# 4. エラー時の挙動',
            '画像がレシートとして認識できない場合、または文字が読み取れないほど不鮮明な場合は receipts を空配列にし、error に詳細を入れてください。',
            'code は INVALID_IMAGE（レシート以外）または UNREADABLE（不鮮明）を使用。',
            '',
            '# 5. 特記事項',
            '- 数値型: 金額や個数は必ず数値型(Number)にしてください。',
            '- null処理: 読み取れない項目は null を設定してください。',
            '',
            '重要: 出力は必ずJSONのみ。'
        ].join('\n');
    }

    /**
     * 画像ファイルを Base64 に変換（dataURL プレフィックスは除去）
     */
    encodeImageToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result || '';
                const base64 = result.toString().replace(/^data:.*;base64,/, '');
                resolve(base64);
            };
            reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Gemini API 呼び出し
     */
    async callGeminiApi({ apiKey, base64Image, mimeType, prompt }) {
        const endpoint = `${this.endpointBase}/${this.model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const payload = {
            contents: [
                {
                    parts: [
                        { text: prompt },
                        { inlineData: { data: base64Image, mimeType } }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json'
            }
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const body = await response.json();
        if (!response.ok) {
            const message = body?.error?.message || 'Gemini API 呼び出しに失敗しました。APIキーと請求設定を確認してください。';
            throw new Error(message);
        }

        const text = body?.candidates?.[0]?.content?.parts
            ?.map(part => part?.text || '')
            .join('')
            .trim();

        if (!text) {
            throw new Error('Gemini API から有効な応答が得られませんでした。');
        }

        return text;
    }

    /**
     * OpenRouter API 呼び出し（フロントエンド直呼び）
     * 注意: 公開環境ではキーが露出し得るため、サーバー経由を推奨
     */
    async callOpenRouterApi({ apiKey, base64Image, mimeType, prompt }) {
        const cfg = this.getConfig();
        const siteUrl = cfg.OPENROUTER_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
        const appTitle = cfg.OPENROUTER_APP_TITLE || 'Smart Receipt';
        const model = cfg.OPENROUTER_MODEL || 'google/gemini-flash-1.5';

        const imageUrl = `data:${mimeType};base64,${base64Image}`;
        const payload = {
            model,
            temperature: 0.1,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: imageUrl } }
                    ]
                }
            ]
        };

        const response = await fetch(this.openRouterEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
                // OpenRouter推奨/必須ヘッダー
                'HTTP-Referer': siteUrl,
                'X-Title': appTitle
            },
            body: JSON.stringify(payload)
        });

        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            const message = body?.error?.message || body?.message || `OpenRouter API 呼び出しに失敗しました（HTTP ${response.status}）。`;
            throw new Error(message);
        }

        const text = body?.choices?.[0]?.message?.content;
        if (!text || typeof text !== 'string') {
            throw new Error('OpenRouter API から有効な応答が得られませんでした。');
        }
        return text.trim();
    }
}

// グローバルにエクスポート
window.GeminiService = GeminiService;


