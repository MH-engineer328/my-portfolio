/**
 * Gemini から返却された JSON 文字列をパースし、最低限のバリデーションを行うモジュール
 */

class ReceiptParser {
    /**
     * 解析のメイン処理
     * @param {string} jsonText Gemini の応答テキスト（JSON想定）
     * @returns {Object} 解析結果 { date: {value, confidence}, merchant: {name, confidence}, amount: {value, confidence}, rawText }
     */
    parse(jsonText) {
        const fallback = this.buildFallback(jsonText);
        if (!jsonText || typeof jsonText !== 'string') return fallback;

        const normalizedText = this.extractJsonString(jsonText);

        try {
            const parsed = JSON.parse(normalizedText);
            return this.normalizeResult(parsed, jsonText);
        } catch (error) {
            console.warn('JSON パースに失敗しました。', error);
            return fallback;
        }
    }

    buildFallback(rawText = '') {
        const today = new Date().toISOString().split('T')[0];
        return {
            date: { value: today, confidence: 'failed' },
            merchant: { name: '', confidence: 'failed' },
            amount: { value: null, confidence: 'failed' },
            rawText: rawText || ''
        };
    }

    /**
     * ```json ブロックなどを除去し、最初の JSON 部分だけを抽出
     */
    extractJsonString(text) {
        const trimmed = text.trim();
        const fenceMatch = trimmed.match(/```json([\s\S]*?)```/i);
        if (fenceMatch && fenceMatch[1]) {
            return fenceMatch[1].trim();
        }
        const firstBrace = trimmed.indexOf('{');
        const lastBrace = trimmed.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            return trimmed.slice(firstBrace, lastBrace + 1);
        }
        return trimmed;
    }

    normalizeResult(parsed, rawText = '') {
        const today = new Date().toISOString().split('T')[0];

        const normalizedDate = this.normalizeDateField(parsed?.date, today);
        const normalizedMerchant = this.normalizeMerchantField(parsed?.merchant);
        const normalizedAmount = this.normalizeAmountField(parsed?.amount);

        return {
            date: normalizedDate,
            merchant: normalizedMerchant,
            amount: normalizedAmount,
            rawText: parsed?.rawText || rawText || ''
        };
    }

    normalizeDateField(dateField, today) {
        const value = typeof dateField === 'string' ? dateField : dateField?.value;
        const confidence = dateField?.confidence || 'low';

        if (!value) {
            return { value: today, confidence: 'failed' };
        }

        const normalized = this.toIsoDate(value, today);
        const isValid = !!normalized;
        return {
            value: normalized || today,
            confidence: isValid ? confidence : 'failed'
        };
    }

    toIsoDate(input, fallback) {
        if (!input) return fallback;
        const normalized = input
            .replace(/[年月]/g, '-')
            .replace(/[日]/g, '')
            .replace(/\./g, '-')
            .replace(/\//g, '-');
        const candidate = normalized.split('T')[0];
        const date = new Date(candidate);
        if (Number.isNaN(date.getTime())) return null;
        const y = date.getFullYear();
        const m = `${date.getMonth() + 1}`.padStart(2, '0');
        const d = `${date.getDate()}`.padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    normalizeMerchantField(merchantField) {
        if (!merchantField) {
            return { name: '', confidence: 'failed' };
        }
        const name = typeof merchantField === 'string' ? merchantField : (merchantField.name || '');
        const confidence = merchantField.confidence || 'low';
        return {
            name,
            confidence: name ? confidence : 'failed'
        };
    }

    normalizeAmountField(amountField) {
        const valueRaw = typeof amountField === 'number'
            ? amountField
            : amountField?.value ?? amountField?.total ?? amountField?.amount;

        const confidence = amountField?.confidence || 'low';
        const parsed = Number(valueRaw);
        const isValid = Number.isFinite(parsed);

        return {
            value: isValid ? parsed : null,
            confidence: isValid ? confidence : 'failed'
        };
    }
}

// グローバルまたはモジュールとしてエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReceiptParser;
} else {
    window.ReceiptParser = ReceiptParser;
}


