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

        // OpenRouter + ユーザー指定プロンプト（receipts配列形式）の場合も受けられるように正規化
        // 既存UIは {date, merchant, amount, rawText} を前提にしているため、ここで吸収する
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.receipts)) {
            return this.normalizeFromReceiptsShape(parsed, rawText, today);
        }

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

    normalizeFromReceiptsShape(root, rawText, today) {
        // エラー応答
        if (root?.error) {
            return {
                date: { value: today, confidence: 'failed' },
                merchant: { name: '', confidence: 'failed' },
                amount: { value: null, confidence: 'failed' },
                rawText: rawText || JSON.stringify(root)
            };
        }

        const first = root.receipts?.[0] || null;
        if (!first || typeof first !== 'object') {
            return this.buildFallback(rawText || JSON.stringify(root));
        }

        const storeName = first?.store_info?.name ?? '';
        const branch = first?.store_info?.branch ?? '';
        const merchantName = [storeName, branch].filter(Boolean).join(' ') || '';

        // transaction.date: "YYYY/MM/DD HH:mm" or null
        const dateRaw = first?.transaction?.date ?? null;
        const dateValue = dateRaw ? this.toIsoDate(String(dateRaw), today) : today;
        const dateConfidence = dateRaw ? 'low' : 'failed';

        const amountInfo = this.normalizeAmountFromReceipts(first);

        return {
            date: { value: dateValue || today, confidence: dateValue ? dateConfidence : 'failed' },
            merchant: { name: merchantName, confidence: merchantName ? 'low' : 'failed' },
            amount: amountInfo,
            rawText: rawText || JSON.stringify(root)
        };
    }

    /**
     * receipts 形式の summary/items から合計金額をできるだけ安定して確定する
     * - summary.total_amount を第一候補としつつ、subtotal/tax/discount/items と整合性検算
     * - 明らかな不整合がある場合は、合算結果が一致する候補を優先
     * @param {Object} receiptOne root.receipts[0]
     * @returns {{value: number|null, confidence: 'high'|'low'|'failed'}}
     */
    normalizeAmountFromReceipts(receiptOne) {
        const summary = receiptOne?.summary || {};
        const items = Array.isArray(receiptOne?.items) ? receiptOne.items : [];

        const totalAmount = this.toFiniteNumber(summary?.total_amount);
        const subtotal = this.toFiniteNumber(summary?.subtotal);
        const totalTax = this.toFiniteNumber(summary?.total_tax_amount);
        const totalDiscount = this.toFiniteNumber(summary?.total_discount);

        const derivedFromSummary = (subtotal !== null && totalTax !== null)
            ? (subtotal + totalTax - (totalDiscount ?? 0))
            : null;

        const derivedFromItems = items.length > 0
            ? this.deriveTotalFromItems(items)
            : null;

        const candidates = [totalAmount, derivedFromSummary, derivedFromItems]
            .filter(v => v !== null)
            .map(v => this.roundYen(v));

        const picked = this.pickConsensusAmount({
            totalAmount: totalAmount !== null ? this.roundYen(totalAmount) : null,
            derivedFromSummary: derivedFromSummary !== null ? this.roundYen(derivedFromSummary) : null,
            derivedFromItems: derivedFromItems !== null ? this.roundYen(derivedFromItems) : null
        });

        if (picked === null) {
            return { value: null, confidence: 'failed' };
        }

        // confidence: 合意が取れていれば high、それ以外は low
        const agreementCount = candidates.filter(v => this.nearlyEqual(v, picked, 1)).length;
        const confidence = agreementCount >= 2 ? 'high' : 'low';

        return {
            value: picked,
            confidence: this.isReasonableAmount(picked) ? confidence : 'failed'
        };
    }

    deriveTotalFromItems(items) {
        let sum = 0;
        let hasAny = false;

        for (const it of items) {
            const rowTotal = this.toFiniteNumber(it?.row_total);
            const unitPrice = this.toFiniteNumber(it?.unit_price);
            const count = this.toFiniteNumber(it?.count);
            const discount = this.toFiniteNumber(it?.discount) ?? 0;

            if (rowTotal !== null) {
                sum += rowTotal - discount;
                hasAny = true;
                continue;
            }

            // row_total が無い場合は unit_price * count を候補にする（count不明は1扱いしない＝スキップ）
            if (unitPrice !== null && count !== null) {
                sum += (unitPrice * count) - discount;
                hasAny = true;
            }
        }

        return hasAny ? sum : null;
    }

    pickConsensusAmount({ totalAmount, derivedFromSummary, derivedFromItems }) {
        // まず total_amount が他の計算結果と一致しているならそれを採用
        if (totalAmount !== null) {
            if (derivedFromSummary !== null && this.nearlyEqual(totalAmount, derivedFromSummary, 1)) return totalAmount;
            if (derivedFromItems !== null && this.nearlyEqual(totalAmount, derivedFromItems, 1)) return totalAmount;
        }

        // 次に計算結果同士が一致するならそれを採用
        if (derivedFromSummary !== null && derivedFromItems !== null && this.nearlyEqual(derivedFromSummary, derivedFromItems, 1)) {
            return derivedFromSummary;
        }

        // total_amount が無い/不正なら、計算できた方を採用
        if (totalAmount === null) {
            if (derivedFromSummary !== null) return derivedFromSummary;
            if (derivedFromItems !== null) return derivedFromItems;
        }

        // ここまで来たら「候補が割れる」状態。total_amount があるなら残す（要確認になる）
        if (totalAmount !== null) return totalAmount;

        // 最後の手段
        return derivedFromSummary ?? derivedFromItems ?? null;
    }

    toFiniteNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    roundYen(value) {
        // レシートは基本的に円整数だが、モデル出力の揺れ（1234.0001 等）を吸収
        return Math.round(Number(value));
    }

    nearlyEqual(a, b, tolerance = 1) {
        return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
    }

    isReasonableAmount(value) {
        // 0円もありうるが、ここでは null/failed に落とすほどではない。上限だけ現実的に制限。
        return Number.isFinite(value) && value >= 0 && value < 100_000_000;
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


