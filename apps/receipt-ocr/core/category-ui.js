/**
 * カテゴリの見た目（ラベル/アイコン/色/予算）を統一するためのマップ。
 *
 * 注意:
 * - このプロジェクトはビルド無し（Tailwind CDN）なので、ここで定義したクラスをJSで付与して描画します。
 */

// 画像のコード（CATEGORY_MAP）に寄せた定義（本アプリのカテゴリIDに対応）
window.CATEGORY_MAP = {
    fashion: { label: '衣服', icon: 'fa-shirt', color: 'bg-fuchsia-100 text-fuchsia-600', budget: 10000 },
    hobby: { label: '趣味・娯楽', icon: 'fa-gamepad', color: 'bg-amber-100 text-amber-700', budget: 5000 },
    food: { label: '食費', icon: 'fa-bowl-rice', color: 'bg-blue-100 text-blue-700', budget: 30000 },
    transport: { label: '交通費', icon: 'fa-train-subway', color: 'bg-rose-100 text-rose-700', budget: 5000 },
    social: { label: '交際費', icon: 'fa-gift', color: 'bg-pink-100 text-pink-700', budget: 10000 },
    daily: { label: '日用品', icon: 'fa-toilet-paper', color: 'bg-emerald-100 text-emerald-700', budget: 5000 },
    other: { label: 'その他', icon: 'fa-ellipsis', color: 'bg-gray-200 text-gray-700', budget: 5000 },

    // 既存カテゴリ（未指定時の見た目が「その他」になるのを避けるために追加）
    restaurant: { label: '外食', icon: 'fa-utensils', color: 'bg-orange-100 text-orange-700', budget: 15000 },
    cafe: { label: 'カフェ', icon: 'fa-mug-hot', color: 'bg-violet-100 text-violet-700', budget: 5000 },
    communication: { label: '通信費', icon: 'fa-mobile-screen-button', color: 'bg-cyan-100 text-cyan-700', budget: 8000 },
    medical: { label: '医療・健康', icon: 'fa-pills', color: 'bg-teal-100 text-teal-700', budget: 8000 },
    education: { label: '学習・書籍', icon: 'fa-book', color: 'bg-sky-100 text-sky-700', budget: 5000 },
    subscription: { label: 'サブスク', icon: 'fa-arrows-rotate', color: 'bg-indigo-100 text-indigo-700', budget: 3000 }
};

/**
 * カテゴリのUIを取得
 * @param {string} categoryId - カテゴリID
 * @returns {object} - カテゴリのUI
 * @memo: アイコンが一致したらそれを返し、なければotherを返す
 */
window.getCategoryUI = function(categoryId) {
    const map = window.CATEGORY_MAP || {};
    return map[categoryId] || map.other || { label: 'その他', icon: 'fa-ellipsis', color: 'bg-gray-500 text-gray-600', budget: 0 };
};

/**
 * カテゴリのアイコンをHTMLで描画
 * @param {string} categoryId - カテゴリID
 * @returns {string} - HTML文字列
 * @memo: ヘルパー関数を経由して、カテゴリのアイコンをHTMLで描画
 */
window.renderCategoryIconHtml = function(categoryId) {
    const ui = window.getCategoryUI(categoryId);
    const iconClass = ui?.icon || 'fa-ellipsis';
    return `<i class="fa-solid ${iconClass}" aria-hidden="true"></i>`;
};


