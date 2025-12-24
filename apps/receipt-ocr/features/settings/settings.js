/**
 * 設定モーダル関連機能
 * 予算管理、カテゴリ表示、データ管理
 */

// ReceiptAppクラスのプロトタイプにメソッドを追加

// デフォルト設計カラー（DESIGN.mdの定義を固定使用）
const DEFAULT_CATEGORY_COLOR = '#6b7280';
const FIXED_CATEGORY_COLORS = {
    food: '#3b82f6',
    daily: '#10b981',
    restaurant: '#f97316',
    cafe: '#8b5cf6',
    transport: '#ef4444',
    communication: '#06b6d4',
    fashion: '#d946ef',
    medical: '#14b8a6',
    hobby: '#eab308',
    social: '#f43f5e',
    education: '#0ea5e9',
    subscription: '#6366f1',
    other: '#6b7280'
};

const resolveCategoryColor = (categoryId, color, fallback) => {
    if (FIXED_CATEGORY_COLORS[categoryId]) return FIXED_CATEGORY_COLORS[categoryId];
    if (color) return color;
    if (fallback) return fallback;
    return DEFAULT_CATEGORY_COLOR;
};

/**
 * 設定モーダルを表示
 */
ReceiptApp.prototype.showSettingsModal = function() {
    const modal = document.getElementById('settingsModal');
    if (!modal) {
        console.warn('設定モーダルが見つかりません。');
        return;
    }

    // 現在の設定を読み込んでフォームに反映
    this.loadSettingsToForm();

    // ナビゲーション初期化＆表示パネル反映
    this.initSettingsNavigation();
    this.activateSettingsSection(this.activeSettingsSection || 'budget');

    // モーダルを表示
    modal.style.display = 'flex';

    // 各ボタンのイベントリスナー（重複登録防止のため一度クリアして再登録するか、イベントデリゲーションを検討するが、
    // ここではシンプルに一度だけ登録される前提で、必要ならdataset等でガードする）
    
    const setupButton = (id, handler) => {
        const btn = document.getElementById(id);
        if (btn && !btn.dataset.bound) {
            btn.addEventListener('click', handler);
            btn.dataset.bound = 'true';
        }
    };

    setupButton('closeSettingsBtn', () => this.hideSettingsModal());
    setupButton('cancelSettingsBtn', () => this.hideSettingsModal());
    setupButton('saveSettingsBtn', () => this.saveSettings());
    setupButton('clearApiKeyBtn', () => this.clearAuthSettings());
    setupButton('clearLearningDataBtn', () => {
        if (confirm('店舗名とカテゴリの学習データをすべて削除しますか？\n（レシートデータ自体は削除されません）')) {
            this.storage.clearCategoryLearning();
            alert('学習データを消去しました。');
        }
    });

    // 背景クリックで閉じる
    const overlay = modal.querySelector('.modal-overlay');
    if (overlay && !overlay.dataset.bound) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.hideSettingsModal();
        });
        overlay.dataset.bound = 'true';
    }

    // ESCキーで閉じる
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            this.hideSettingsModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
};

/**
 * 設定モーダルを非表示
 */
ReceiptApp.prototype.hideSettingsModal = function() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

/**
 * 設定モーダルのナビゲーションを初期化
 */
ReceiptApp.prototype.initSettingsNavigation = function() {
    if (this.settingsNavInitialized) return;

    const nav = document.getElementById('settingsNav');
    if (nav) {
        nav.addEventListener('click', (e) => {
            const target = e.target.closest('.settings-nav__item');
            if (!target) return;
            const section = target.dataset.section;
            this.activateSettingsSection(section);
        });
        this.settingsNavInitialized = true;
    }
};

/**
 * 設定モーダルのセクション切り替え
 */
ReceiptApp.prototype.activateSettingsSection = function(section) {
    if (!section) return;
    this.activeSettingsSection = section;

    const navItems = document.querySelectorAll('.settings-nav__item');
    navItems.forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.section === section);
    });

    const panels = document.querySelectorAll('.settings-panel');
    panels.forEach(panel => {
        panel.classList.toggle('is-active', panel.dataset.section === section);
    });
};

/**
 * 設定をフォームに読み込む
 */
ReceiptApp.prototype.loadSettingsToForm = function() {
    const settings = this.storage.getSettings();
    this.loadAuthSettings();

    // 週間予算
    const budgetInput = document.getElementById('weeklyBudgetInput');
    if (budgetInput) {
        budgetInput.value = settings.weeklyBudget || 10000;
    }

    // カテゴリリストを表示
    this.renderCategoriesList();
};

/**
 * Gemini BYOK 設定をフォームにロード
 */
ReceiptApp.prototype.loadAuthSettings = function() {
    const apiKeyInput = document.getElementById('geminiApiKeyInput');
    const demoToggle = document.getElementById('geminiDemoModeToggle');

    const auth = this.storage.getAuthConfig();
    if (apiKeyInput) {
        apiKeyInput.value = auth.apiKey || '';
    }
    if (demoToggle) {
        demoToggle.checked = !!auth.useDemoMode || !auth.apiKey;
    }
    this.updateApiKeyStatus(auth);

    if (demoToggle && !demoToggle.dataset.bound) {
        demoToggle.addEventListener('change', () => {
            const updated = this.storage.saveAuthConfig({
                apiKey: apiKeyInput ? apiKeyInput.value : '',
                useDemoMode: demoToggle.checked
            });
            this.updateApiKeyStatus(updated);
        });
        demoToggle.dataset.bound = 'true';
    }
};

ReceiptApp.prototype.updateApiKeyStatus = function(auth) {
    const status = document.getElementById('geminiApiKeyStatus');
    if (!status) return;
    if (auth.apiKey) {
        status.textContent = auth.useDemoMode
            ? 'APIキーは保存済みですがデモモードで動作します。'
            : '保存済みの API キーを使用します。';
    } else {
        status.textContent = 'APIキー未設定: デモモードのダミー結果を返します。';
    }
};

/**
 * 設定を保存
 */
ReceiptApp.prototype.saveSettings = function() {
    const settings = this.storage.getSettings();

    // 週間予算を更新
    const budgetInput = document.getElementById('weeklyBudgetInput');
    if (budgetInput) {
        const newBudget = parseInt(budgetInput.value) || 10000;
        if (newBudget < 0) {
            alert('予算は0円以上で入力してください。');
            return;
        }
        settings.weeklyBudget = newBudget;
    }

    // Gemini BYOK 設定を保存
    const apiKeyInput = document.getElementById('geminiApiKeyInput');
    const demoToggle = document.getElementById('geminiDemoModeToggle');
    if (apiKeyInput && demoToggle) {
        this.storage.saveAuthConfig({
            apiKey: apiKeyInput.value,
            useDemoMode: demoToggle.checked
        });
    }

    // LocalStorageに保存
    this.storage.saveSettings(settings);

    // カテゴリ分類器の設定を更新
    this.classifier.settings = settings;

    // ダッシュボードを更新（グラフの予算ラインが変わる）
    this.updateDashboard();

    // モーダルを閉じる
    this.hideSettingsModal();

    console.log('設定を保存しました');
};

/**
 * カテゴリリストを表示（表示のみに変更）
 */
ReceiptApp.prototype.renderCategoriesList = function() {
    const categoriesList = document.getElementById('categoriesList');
    if (!categoriesList) return;

    const settings = this.storage.getSettings();
    categoriesList.innerHTML = '';

    settings.categories.forEach(category => {
        const fixedColor = resolveCategoryColor(category.id, category.color);
        const ui = (typeof window.getCategoryUI === 'function') ? window.getCategoryUI(category.id) : null;
        const iconHtml = (typeof window.renderCategoryIconHtml === 'function')
            ? window.renderCategoryIconHtml(category.id)
            : (category.icon || '🧾');
        const colorClass = ui?.color || '';

        const iconClassAttr = colorClass ? `category-icon-display ${colorClass}` : 'category-icon-display';
        const iconStyleAttr = colorClass ? '' : `style="color:${fixedColor}; background:${fixedColor}1F;"`;
        const categoryItem = document.createElement('div');
        categoryItem.className = 'category-item category-item--static';
        categoryItem.innerHTML = `
            <div class="category-info">
                <span class="${iconClassAttr}" ${iconStyleAttr}>${iconHtml}</span>
                <span class="category-name-display">${category.name}</span>
            </div>
        `;
        categoriesList.appendChild(categoryItem);
    });
};

/**
 * APIキーを削除してデモモードへ戻す
 */
ReceiptApp.prototype.clearAuthSettings = function() {
    const apiKeyInput = document.getElementById('geminiApiKeyInput');
    const demoToggle = document.getElementById('geminiDemoModeToggle');
    this.storage.clearAuthConfig();
    if (apiKeyInput) apiKeyInput.value = '';
    if (demoToggle) demoToggle.checked = true;
    this.updateApiKeyStatus({ apiKey: '', useDemoMode: true });
};

/**
 * ボトムナビを初期化
 */
ReceiptApp.prototype.initBottomNav = function() {
    this.bottomNav = document.getElementById('bottomNav');
    if (!this.bottomNav) return;

    const items = Array.from(this.bottomNav.querySelectorAll('.bottom-nav__item'));
    items.forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.navAction || 'dashboard';
            const scrollTarget = btn.dataset.scrollTarget;
            this.handleBottomNavAction(action, scrollTarget);
        });
    });

    this.setActiveBottomNav('dashboard');
};

/**
 * ボトムナビ操作
 */
ReceiptApp.prototype.handleBottomNavAction = function(action, scrollTarget) {
    switch (action) {
        case 'dashboard':
            this.showDashboard();
            this.scrollToTarget(scrollTarget || '#dashboard');
            break;
        case 'homeV2':
            this.showHomeV2();
            this.scrollToTarget(scrollTarget || '#homeV2');
            break;
        case 'calendar':
            this.showCalendar(scrollTarget || '#calendarSection');
            break;
        case 'editor':
            this.showEditor();
            break;
        default:
            this.showDashboard();
            break;
    }

    this.setActiveBottomNav(action);
};

/**
 * ボトムナビのアクティブ状態を更新
 */
ReceiptApp.prototype.setActiveBottomNav = function(action) {
    if (!this.bottomNav) return;
    const items = this.bottomNav.querySelectorAll('.bottom-nav__item');
    items.forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.navAction === action);
    });
};

/**
 * ターゲットへのスムーススクロール
 */
ReceiptApp.prototype.scrollToTarget = function(selector) {
    if (!selector) return;
    const target = document.querySelector(selector);
    if (!target) return;

    const headerOffset = 80;
    const rect = target.getBoundingClientRect();
    const top = window.pageYOffset + rect.top - headerOffset;

    window.scrollTo({
        top: Math.max(top, 0),
        behavior: 'smooth'
    });
};

// 既存メソッドをラップしてボトムナビ連携を追加
(function() {
    const originalInit = ReceiptApp.prototype.init;
    const originalShowDashboard = ReceiptApp.prototype.showDashboard;
    const originalShowEditor = ReceiptApp.prototype.showEditor;
    const originalShowCalendar = ReceiptApp.prototype.showCalendar;
    const originalShowHomeV2 = ReceiptApp.prototype.showHomeV2;

    ReceiptApp.prototype.init = function() {
        if (typeof originalInit === 'function') {
            originalInit.call(this);
        }
        this.initBottomNav();
    };

    ReceiptApp.prototype.showDashboard = function() {
        if (typeof originalShowDashboard === 'function') {
            originalShowDashboard.call(this);
        }
        if (typeof this.setActiveBottomNav === 'function') {
            this.setActiveBottomNav('dashboard');
        }
    };

    ReceiptApp.prototype.showEditor = function(receipt, isManual = false) {
        if (typeof originalShowEditor === 'function') {
            originalShowEditor.call(this, receipt, isManual);
        }
        if (typeof this.setActiveBottomNav === 'function') {
            this.setActiveBottomNav('editor');
        }
    };

    ReceiptApp.prototype.showCalendar = function(scrollTarget) {
        if (typeof originalShowCalendar === 'function') {
            originalShowCalendar.call(this, scrollTarget);
        }
        if (typeof this.setActiveBottomNav === 'function') {
            this.setActiveBottomNav('calendar');
        }
    };

    ReceiptApp.prototype.showHomeV2 = function() {
        if (typeof originalShowHomeV2 === 'function') {
            originalShowHomeV2.call(this);
        }
        if (typeof this.setActiveBottomNav === 'function') {
            this.setActiveBottomNav('homeV2');
        }
    };
})();