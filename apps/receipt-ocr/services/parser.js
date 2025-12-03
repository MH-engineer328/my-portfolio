/**
 * OCR解析ロジックモジュール
 * Tesseract.jsから出力されたテキストデータを解析し、意味のある情報を抽出する
 */

class ReceiptParser {
    constructor() {
        // 日付抽出用の正規表現パターン（優先順位順）
        this.datePatterns = [
            // 2024年3月20日, 2024年03月20日
            /20[2-9][0-9]年[01]?[0-9]月[0-3]?[0-9]日/,
            // 2024/3/20, 2024/03/20
            /20[2-9][0-9]\/[01]?[0-9]\/[0-3]?[0-9]/,
            // 2024-3-20
            /20[2-9][0-9]-[01]?[0-9]-[0-3]?[0-9]/,
            // R6.3.20 (令和対応)
            /R[1-9][0-9]?\.[01]?[0-9]\.[0-3]?[0-9]/
        ];

        // 金額抽出用のキーワード
        this.totalKeywords = ['合計', '小計', '合 計', 'お買上計', '支払い金額'];

        // 除外するキーワード（金額誤検知防止）
        this.excludeKeywords = ['電話', 'TEL', 'No', '会員', 'ポイント', '番号', '日時'];
    }

    /**
     * 解析のメイン処理
     * @param {string} text OCRで読み取った全文
     * @returns {Object} 解析結果 { date: {value, confidence}, merchant: {name, confidence}, amount: {value, confidence}, rawText }
     */
    parse(text) {
        // OCRテキストが空または極端に短い場合は失敗とみなす
        if (!text || text.trim().length < 10) {
            const today = new Date().toISOString().split('T')[0];
            return {
                date: { value: today, confidence: 'failed' },
                merchant: { name: '', confidence: 'failed' },
                amount: { value: null, confidence: 'failed' },
                rawText: text || ''
            };
        }

        const lines = text.split(/\r\n|\n/).map(line => line.trim()).filter(line => line.length > 0);

        return {
            date: this.extractDate(lines),
            merchant: this.extractMerchant(lines),
            amount: this.extractTotalAmount(lines),
            rawText: text
        };
    }

    /**
     * 日付の抽出
     * @returns {Object} { value: "YYYY-MM-DD", confidence: "high" | "low" | "failed" }
     */
    extractDate(lines) {
        for (const line of lines) {
            for (const pattern of this.datePatterns) {
                const match = line.match(pattern);
                if (match) {
                    // フォーマット統一処理（YYYY-MM-DD形式に変換）
                    const normalized = this.normalizeDate(match[0]);
                    return { value: normalized, confidence: 'high' };
                }
            }
        }

        // 見つからない場合は今日の日付をデフォルトに（信頼度: low）
        const today = new Date();
        return { value: today.toISOString().split('T')[0], confidence: 'low' };
    }

    /**
     * 日付文字列の正規化
     */
    normalizeDate(dateStr) {
        try {
            // 和暦変換などのロジックが必要ならここに追加
            // 簡易実装として、年/月/日を抽出して再構築
            let year, month, day;

            if (dateStr.includes('年')) {
                [year, month, day] = dateStr.replace(/日/g, '').split(/[年月]/);
            } else if (dateStr.includes('/')) {
                [year, month, day] = dateStr.split('/');
            } else if (dateStr.includes('-')) {
                [year, month, day] = dateStr.split('-');
            } else if (dateStr.startsWith('R')) {
                // 令和対応: R6 -> 2024
                const parts = dateStr.substring(1).split('.');
                year = parseInt(parts[0]) + 2018;
                month = parts[1];
                day = parts[2];
            }

            // ゼロ埋め
            const y = year;
            const m = month.toString().padStart(2, '0');
            const d = day.toString().padStart(2, '0');

            return `${y}-${m}-${d}`;
        } catch (e) {
            console.error('Date parse error:', e);
            return new Date().toISOString().split('T')[0];
        }
    }

    /**
     * 合計金額の抽出（優先順位付き）
     * @returns {Object} { value: number | null, confidence: "high" | "low" | "failed" }
     */
    extractTotalAmount(lines) {
        // 1. 最優先: キーワード検索（高信頼度）
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // 「合計」などのキーワードを含む行を探す
            if (this.totalKeywords.some(kw => line.includes(kw))) {
                // 同じ行から金額を探す
                let amount = this.findAmountInText(line);

                // 同じ行になければ次の行を見る
                if (!amount && i + 1 < lines.length) {
                    amount = this.findAmountInText(lines[i + 1]);
                }

                if (amount) {
                    return { value: amount, confidence: 'high' };
                }
            }
        }

        // 2. 次優先: レシートの下部20%の領域にある最大金額
        // 日本のレシートは下部に合計金額が集中する傾向を利用
        const bottomStartIndex = Math.floor(lines.length * 0.8);
        const bottomLines = lines.slice(bottomStartIndex);

        let bottomMaxAmount = 0;
        for (const line of bottomLines) {
            // 除外キーワードが含まれていない行のみ対象
            if (!this.excludeKeywords.some(kw => line.includes(kw))) {
                const amount = this.findAmountInText(line);
                if (amount > bottomMaxAmount && amount < 1000000) {
                    bottomMaxAmount = amount;
                }
            }
        }

        if (bottomMaxAmount > 0) {
            return { value: bottomMaxAmount, confidence: 'high' };
        }

        // 3. 推測: キーワードも下部にも見つからない場合、全体から最大値を探す（低信頼度）
        let maxAmount = 0;
        for (const line of lines) {
            // 除外キーワードが含まれていない行のみ対象
            if (!this.excludeKeywords.some(kw => line.includes(kw))) {
                const amount = this.findAmountInText(line);
                if (amount > maxAmount && amount < 1000000) { // 100万円以上のレシートは稀として除外
                    maxAmount = amount;
                }
            }
        }

        if (maxAmount > 0) {
            return { value: maxAmount, confidence: 'low' };
        }

        // 4. 失敗: 全く見つからない場合
        return { value: null, confidence: 'failed' };
    }

    /**
     * テキストから数値を抽出するヘルパー
     */
    findAmountInText(text) {
        // "¥1,200" "-100" などを考慮
        // カンマを除去し、円マークを除去
        const cleanText = text.replace(/[¥￥,円]/g, '');
        // 数字の塊を抽出
        const matches = cleanText.match(/\d+/g);

        if (matches) {
            // 最も長い数字列を採用（金額である可能性が高い）
            // ただし、電話番号のような長すぎるものは除外したいが、
            // ここでは単純に数値化して最大のもので検証
            const numbers = matches.map(Number);
            return Math.max(...numbers);
        }
        return null;
    }

    /**
     * 店舗名の抽出（難易度高）
     * 簡易ロジック: 最初の数行から電話番号ではない、かつ特定のキーワードを含まない行を取得
     * @returns {Object} { name: string, confidence: "high" | "low" | "failed" }
     */
    extractMerchant(lines) {
        // レシートの上部5行を探索対象とする
        const headerLines = lines.slice(0, 5);

        for (const line of headerLines) {
            // 明らかに日付や時刻の行はスキップ
            if (line.match(/20[2-9][0-9]|R[0-9]/)) continue;
            if (line.match(/[0-9]{1,2}:[0-9]{1,2}/)) continue;

            // 電話番号だけの行はスキップ
            if (line.match(/0\d{1,4}-\d{1,4}-\d{4}/)) continue;

            // 短すぎる、長すぎる行はスキップ
            if (line.length < 2 || line.length > 30) continue;

            // 「株式会社」「店」などのキーワードがあれば高信頼度
            const hasCompanyKeyword = line.includes('株式会社') || line.includes('店') || line.includes('有限会社');
            return {
                name: line,
                confidence: hasCompanyKeyword ? 'high' : 'low'
            };
        }

        // 見つからない場合
        return { name: '', confidence: 'failed' };
    }
}

// グローバルまたはモジュールとしてエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReceiptParser;
} else {
    window.ReceiptParser = ReceiptParser;
}

