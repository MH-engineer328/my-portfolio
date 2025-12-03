/**
 * カテゴリ自動分類モジュール
 * 店舗名やキーワードからカテゴリを自動判定し、学習機能も提供
 */

class CategoryClassifier {
    constructor(storage) {
        this.storage = storage;
        this.settings = storage.getSettings();
    }

    /**
     * カテゴリを自動分類
     * @param {string} merchantName - 店舗名
     * @param {string} rawText - OCRで読み取った全文（オプション）
     * @returns {Object} { id: string, name: string, autoDetected: boolean }
     */
    classify(merchantName, rawText = '') {
        // 1. 学習データを最優先で確認
        const learning = this.storage.getCategoryLearning();
        if (learning[merchantName]) {
            const categoryId = learning[merchantName];
            const category = this.settings.categories.find(c => c.id === categoryId);
            if (category) {
                return {
                    id: categoryId,
                    name: category.name,
                    autoDetected: true
                };
            }
        }

        // 2. キーワードマッチング
        const searchText = (merchantName + ' ' + rawText).toLowerCase();
        const keywords = this.settings.categoryKeywords;

        for (const [categoryId, keywordList] of Object.entries(keywords)) {
            for (const keyword of keywordList) {
                if (searchText.includes(keyword.toLowerCase())) {
                    const category = this.settings.categories.find(c => c.id === categoryId);
                    if (category) {
                        return {
                            id: categoryId,
                            name: category.name,
                            autoDetected: true
                        };
                    }
                }
            }
        }

        // 3. デフォルト: その他
        const otherCategory = this.settings.categories.find(c => c.id === 'other');
        return {
            id: 'other',
            name: otherCategory ? otherCategory.name : 'その他',
            autoDetected: true
        };
    }

    /**
     * ユーザーがカテゴリを修正した場合、学習データに保存
     * @param {string} merchantName - 店舗名
     * @param {string} categoryId - カテゴリID
     */
    learn(merchantName, categoryId) {
        this.storage.saveCategoryLearning(merchantName, categoryId);
    }
}

// グローバルにエクスポート
window.CategoryClassifier = CategoryClassifier;

