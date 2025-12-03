/**
 * データ保存管理モジュール
 * LocalStorageを使用したレシートデータのCRUD操作
 */

class ReceiptStorage {
    constructor() {
        this.storageKey = 'smart_receipt_data_v1';
        this.categoryLearningKey = 'smart_receipt_category_learning_v1';
        this.settingsKey = 'smart_receipt_settings_v1';
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
                { id: 'food', name: '食費', color: '#3b82f6' },
                { id: 'daily', name: '日用品', color: '#10b981' },
                { id: 'restaurant', name: '外食', color: '#f59e0b' },
                { id: 'cafe', name: 'カフェ', color: '#8b5cf6' },
                { id: 'transport', name: '交通費', color: '#ef4444' },
                { id: 'other', name: 'その他', color: '#6b7280' }
            ],
            categoryKeywords: {
                food: ['スーパー', 'コンビニ', 'セブン', 'ファミマ', 'ローソン', 'イオン'],
                daily: ['マツキヨ', '薬局', 'ドラッグ', 'マツモトキヨシ'],
                restaurant: ['ガスト', 'サイゼ', 'レストラン', 'すき家'],
                cafe: ['スタバ', 'タリーズ', 'カフェ', 'スターバックス'],
                transport: ['JR', '地下鉄', 'バス', 'タクシー', '電車']
            }
        };
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
}

// グローバルにエクスポート
window.ReceiptStorage = ReceiptStorage;

