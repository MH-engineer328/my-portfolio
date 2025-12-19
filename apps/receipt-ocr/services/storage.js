/**
 * データ保存管理モジュール
 * LocalStorageを使用したレシートデータのCRUD操作
 */

class ReceiptStorage {
    constructor() {
        this.storageKey = 'smart_receipt_data_v1';
        this.categoryLearningKey = 'smart_receipt_category_learning_v1';
        this.settingsKey = 'smart_receipt_settings_v1';
        this.authKey = 'smart_receipt_auth_v1';
    }

    /**
     * すべてのレシートを取得
     */
    getAllReceipts() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : [];
    }

    /**
     * レシートを保存
     */
    saveReceipt(receipt) {
        const receipts = this.getAllReceipts();

        // IDがなければ新規作成
        if (!receipt.id) {
            receipt.id = this.generateUUID();
            receipt.createdAt = new Date().toISOString();
        }

        // 既存のレシートを更新、または新規追加
        const index = receipts.findIndex(r => r.id === receipt.id);
        if (index >= 0) {
            receipts[index] = receipt;
        } else {
            receipts.push(receipt);
        }

        localStorage.setItem(this.storageKey, JSON.stringify(receipts));
        return receipt;
    }

    /**
     * レシートを削除
     */
    deleteReceipt(id) {
        const receipts = this.getAllReceipts();
        const filtered = receipts.filter(r => r.id !== id);
        localStorage.setItem(this.storageKey, JSON.stringify(filtered));
    }

    /**
     * IDでレシートを取得
     */
    getReceiptById(id) {
        const receipts = this.getAllReceipts();
        return receipts.find(r => r.id === id);
    }

    /**
     * 日付でレシートを取得
     */
    getReceiptsByDate(date) {
        const receipts = this.getAllReceipts();
        return receipts.filter(r => r.date === date);
    }

    /**
     * 月のレシートを取得
     */
    getReceiptsByMonth(year, month) {
        const receipts = this.getAllReceipts();
        return receipts.filter(r => {
            const receiptDate = new Date(r.date);
            return receiptDate.getFullYear() === year && receiptDate.getMonth() === month;
        });
    }

    /**
     * 月の合計金額を計算
     */
    getMonthlyTotal(year, month) {
        const receipts = this.getReceiptsByMonth(year, month);
        return receipts.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    }

    /**
     * 週間のレシートを取得（月曜日始まり）
     */
    getWeeklyReceipts(startDate) {
        const receipts = this.getAllReceipts();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);

        return receipts.filter(r => {
            const receiptDate = new Date(r.date);
            return receiptDate >= startDate && receiptDate <= endDate;
        });
    }

    /**
     * カテゴリ学習データを取得
     */
    getCategoryLearning() {
        const data = localStorage.getItem(this.categoryLearningKey);
        return data ? JSON.parse(data) : {};
    }

    /**
     * カテゴリ学習データを保存
     */
    saveCategoryLearning(merchantName, categoryId) {
        const learning = this.getCategoryLearning();
        learning[merchantName] = categoryId;
        localStorage.setItem(this.categoryLearningKey, JSON.stringify(learning));
    }

    /**
     * カテゴリ学習データを消去
     */
    clearCategoryLearning() {
        localStorage.removeItem(this.categoryLearningKey);
    }

    /**
     * 設定を取得
     */
    getSettings() {
        const data = localStorage.getItem(this.settingsKey);
        if (data) {
            return JSON.parse(data);
        }

        // デフォルト設定
        return {
            weeklyBudget: 10000,
            categories: [
                { id: 'food', name: '食費', icon: '🍙', color: '#3b82f6' },
                { id: 'daily', name: '日用品', icon: '🧻', color: '#10b981' },
                { id: 'restaurant', name: '外食', icon: '🍽️', color: '#f97316' },
                { id: 'cafe', name: 'カフェ', icon: '☕', color: '#8b5cf6' },
                { id: 'transport', name: '交通費', icon: '🚃', color: '#ef4444' },
                { id: 'communication', name: '通信費', icon: '📱', color: '#06b6d4' },
                { id: 'fashion', name: '衣服・美容', icon: '💅', color: '#d946ef' },
                { id: 'medical', name: '医療・健康', icon: '💊', color: '#14b8a6' },
                { id: 'hobby', name: '趣味・娯楽', icon: '🎮', color: '#eab308' },
                { id: 'social', name: '交際費', icon: '🎁', color: '#f43f5e' },
                { id: 'education', name: '学習・書籍', icon: '📚', color: '#0ea5e9' },
                { id: 'subscription', name: 'サブスク', icon: '🔄', color: '#6366f1' },
                { id: 'other', name: 'その他', icon: '📦', color: '#6b7280' }
            ],
            categoryKeywords: {
                food: ['スーパー', 'コンビニ', 'セブン', 'ファミマ', 'ローソン', 'イオン'],
                daily: ['マツキヨ', '薬局', 'ドラッグ', 'マツモトキヨシ'],
                restaurant: ['ガスト', 'サイゼ', 'レストラン', 'すき家'],
                cafe: ['スタバ', 'タリーズ', 'カフェ', 'スターバックス'],
                transport: ['JR', '地下鉄', 'バス', 'タクシー', '電車'],
                communication: [],
                fashion: [],
                medical: [],
                hobby: [],
                social: [],
                education: [],
                subscription: [],
                other: []
            }
        };
    }

    /**
     * Gemini APIキー設定を取得（BYOK）
     * @returns {{ apiKey: string, useDemoMode: boolean }}
     */
    getAuthConfig() {
        const data = localStorage.getItem(this.authKey);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                return {
                    apiKey: parsed.apiKey || '',
                    useDemoMode: !!parsed.useDemoMode
                };
            } catch (e) {
                console.warn('Auth config parse error, fallback to default', e);
            }
        }
        return { apiKey: '', useDemoMode: false };
    }

    /**
     * Gemini APIキー設定を保存（BYOK）
     * @param {{ apiKey: string, useDemoMode: boolean }} config
     * @returns {{ apiKey: string, useDemoMode: boolean }}
     */
    saveAuthConfig(config) {
        const safeConfig = {
            apiKey: (config?.apiKey || '').trim(),
            useDemoMode: !!(config?.useDemoMode)
        };
        localStorage.setItem(this.authKey, JSON.stringify(safeConfig));
        return safeConfig;
    }

    /**
     * Gemini APIキー設定を削除（BYOK）
     */
    clearAuthConfig() {
        localStorage.removeItem(this.authKey);
    }

    /**
     * 設定を保存
     */
    saveSettings(settings) {
        localStorage.setItem(this.settingsKey, JSON.stringify(settings));
    }

    /**
     * UUID生成
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * 未分類・手動修正済み店舗のサジェスト候補を取得
     * フィルタ: category.id === 'other' かつ category.autoDetected === false
     * サニタイズ: 3文字未満、数字のみ・記号のみを除外（全角/半角をNFKCで正規化）
     * ソート: 出現頻度降順 → createdAt 降順
     * @param {number} limit - 返却する件数上限
     * @returns {Array<{ name: string, count: number, latestAt: string }>}
     */
    getRecentProblemMerchants(limit = 8) {
        const receipts = this.getAllReceipts();

        // 正規化・除外判定
        const normalizeName = (name) => {
            if (!name || typeof name !== 'string') return null;
            const normalized = name.normalize('NFKC').replace(/\s+/g, ' ').trim();
            if (normalized.length < 3) return null;

            const compact = normalized.replace(/\s+/g, '');
            // 数字のみ（全角数字含む）
            if (/^[\d０-９]+$/.test(compact)) return null;
            // 記号のみ（Unicodeの記号/句読点カテゴリ）
            if (/^[\p{P}\p{S}]+$/u.test(compact)) return null;
            return normalized;
        };

        const map = new Map();

        receipts.forEach((r) => {
            const category = r.category || {};
            if (category.id !== 'other' || category.autoDetected !== false) return;

            const candidate = normalizeName(r?.merchant?.name || r?.merchant?.raw || '');
            if (!candidate) return;

            const key = candidate.toLowerCase();
            const createdAt = r.createdAt || r.date || '';

            if (!map.has(key)) {
                map.set(key, { name: candidate, count: 1, latestAt: createdAt });
            } else {
                const current = map.get(key);
                current.count += 1;
                // createdAt が新しい方を保持
                if (!current.latestAt || new Date(createdAt) > new Date(current.latestAt)) {
                    current.latestAt = createdAt;
                }
            }
        });

        const sorted = Array.from(map.values()).sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return new Date(b.latestAt || 0) - new Date(a.latestAt || 0);
        });

        return sorted.slice(0, limit);
    }
}

// グローバルにエクスポート
window.ReceiptStorage = ReceiptStorage;

