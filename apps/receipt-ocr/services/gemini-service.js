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
    }

    /**
    * 画像を Gemini に送信し、JSON テキストを取得
    * @param {File} file
    * @returns {Promise<{ text: string, isDemo: boolean }>}
    */
    async analyzeReceipt(file) {
        const auth = this.storage?.getAuthConfig ? this.storage.getAuthConfig() : { apiKey: '', useDemoMode: false };
        const useDemoMode = auth.useDemoMode || !auth.apiKey;

        if (useDemoMode) {
            return {
                text: JSON.stringify(this.buildDemoResult()),
                isDemo: true
            };
        }

        const base64Image = await this.encodeImageToBase64(file);
        const prompt = this.buildPrompt();

        const responseText = await this.callGeminiApi({
            apiKey: auth.apiKey,
            base64Image,
            mimeType: file?.type || 'image/jpeg',
            prompt
        });

        return { text: responseText, isDemo: false };
    }

    /**
     * LocalStorage に保存したキーを使うため、API キーが未設定ならデモ結果を返す
     */
    buildDemoResult() {
        const today = new Date().toISOString().split('T')[0];
        return {
            date: { value: today, confidence: 'low' },
            merchant: { name: 'デモストア', confidence: 'low' },
            amount: { value: 1234, confidence: 'low' },
            rawText: 'デモモード: ダミーのレシートデータです。'
        };
    }

    /**
     * Gemini へのプロンプト
     */
    buildPrompt() {
        return [
            'あなたは日本語のレシート画像から主要項目を抽出するアシスタントです。',
            '出力は必ず次の JSON 1件のみを返してください。マークダウンや説明文は禁止です。',
            JSON.stringify({
                date: { value: 'YYYY-MM-DD', confidence: 'high|low|failed' },
                merchant: { name: '店舗名', confidence: 'high|low|failed' },
                amount: { value: 1234, confidence: 'high|low|failed' },
                rawText: 'OCRで得られた全文または要約'
            }),
            '要件:',
            '- 日付: 可能なら YYYY-MM-DD に正規化。抽出不可なら今日の日付を設定し confidence を "failed" にする。',
            '- 合計金額: 数字のみ。税込みの最終支払額を優先。見つからなければ value は null, confidence は "failed"。',
            '- 店舗名: 最も可能性の高い1件。見つからなければ空文字と "failed"。',
            '- rawText: モデルが読んだテキストを 200 文字以内で返す。',
            '出力は JSON のみ。'
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
     * 画像をリサイズ（LocalStorage用のサムネイル作成）
     */
    createThumbnail(file, maxWidth = 300) {
        return new Promise((resolve) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const img = new Image();

                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    const base64 = canvas.toDataURL('image/jpeg', 0.8);
                    resolve(base64);
                };

                img.src = e.target.result;
            };

            reader.readAsDataURL(file);
        });
    }
}

// グローバルにエクスポート
window.GeminiService = GeminiService;


