/**
 * 設定モーダル関連機能
 * カテゴリ管理、キーワード管理
 */

// ReceiptAppクラスのプロトタイプにメソッドを追加

/**
 * 設定モーダルを表示
 */
ReceiptApp.prototype.showSettingsModal = function() {
    const modal = document.getElementById('settingsModal');
    if (!modal) {
        console.warn('設定モーダルが見つかりません。HTMLに設定モーダルを追加してください。');
        alert('設定画面は準備中です。');
        return;
    }

    // 現在の設定を読み込んでフォームに反映
    this.loadSettingsToForm();

    // モーダルを表示
    modal.style.display = 'flex';

    // 閉じるボタンのイベントリスナー
    const closeBtn = document.getElementById('closeSettingsBtn');
    if (closeBtn) {
        const closeHandler = () => {
            this.hideSettingsModal();
        };
        closeBtn.addEventListener('click', closeHandler);
    }

    // キャンセルボタンのイベントリスナー
    const cancelBtn = document.getElementById('cancelSettingsBtn');
    if (cancelBtn) {
        const cancelHandler = () => {
            this.hideSettingsModal();
        };
        cancelBtn.addEventListener('click', cancelHandler);
    }

    // 保存ボタンのイベントリスナー
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) {
        const saveHandler = () => {
            this.saveSettings();
        };
        saveBtn.addEventListener('click', saveHandler);
    }

    // カテゴリ追加ボタンのイベントリスナー
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    if (addCategoryBtn) {
        const addHandler = () => {
            this.addCategory();
        };
        addCategoryBtn.addEventListener('click', addHandler);
    }

    // 背景クリックで閉じる
    const overlay = modal.querySelector('.modal-overlay');
    if (overlay) {
        const overlayHandler = (e) => {
            if (e.target === overlay) {
                this.hideSettingsModal();
            }
        };
        overlay.addEventListener('click', overlayHandler);
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
 * 設定をフォームに読み込む
 */
ReceiptApp.prototype.loadSettingsToForm = function() {
    const settings = this.storage.getSettings();

    // 週間予算
    const budgetInput = document.getElementById('weeklyBudgetInput');
    if (budgetInput) {
        budgetInput.value = settings.weeklyBudget || 10000;
    }

    // カテゴリリストを表示
    this.renderCategoriesList();

    // キーワードリストを表示
    this.renderKeywordsList();
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

    // カテゴリの変更を保存
    this.saveCategoriesFromForm(settings);

    // キーワードの変更を保存
    this.saveKeywordsFromForm(settings);

    // LocalStorageに保存
    this.storage.saveSettings(settings);

    // カテゴリ分類器の設定を更新
    this.classifier.settings = settings;

    // エディタ画面のカテゴリ選択を更新
    this.updateCategorySelect();

    // ダッシュボードを更新（グラフの予算ラインが変わる）
    this.updateDashboard();

    // モーダルを閉じる
    this.hideSettingsModal();

    // 成功メッセージ（オプション）
    console.log('設定を保存しました');
};

/**
 * エディタ画面のカテゴリ選択を更新
 */
ReceiptApp.prototype.updateCategorySelect = function() {
    const categorySelect = this.elements.category;
    if (!categorySelect) return;

    const settings = this.storage.getSettings();
    const currentValue = categorySelect.value;

    // 既存のオプションをクリア（最初のオプション以外）
    categorySelect.innerHTML = '';

    // 新しいカテゴリを追加
    settings.categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        categorySelect.appendChild(option);
    });

    // 以前の値が存在する場合は選択
    if (settings.categories.some(c => c.id === currentValue)) {
        categorySelect.value = currentValue;
    } else {
        // 存在しない場合は最初のカテゴリを選択
        if (settings.categories.length > 0) {
            categorySelect.value = settings.categories[0].id;
        }
    }
};

/**
 * カテゴリリストを表示
 */
ReceiptApp.prototype.renderCategoriesList = function() {
    const categoriesList = document.getElementById('categoriesList');
    if (!categoriesList) return;

    const settings = this.storage.getSettings();
    categoriesList.innerHTML = '';

    settings.categories.forEach(category => {
        const categoryItem = document.createElement('div');
        categoryItem.className = 'category-item';
        categoryItem.innerHTML = `
            <div class="category-info">
                <input type="color"
                       class="category-color"
                       value="${category.color}"
                       data-category-id="${category.id}" />
                <input type="text"
                       class="category-name"
                       value="${category.name || ''}"
                       placeholder="カテゴリ名を入力"
                       data-category-id="${category.id}" />
            </div>
            <button class="btn btn-danger btn-sm delete-category-btn"
                    data-category-id="${category.id}">
                削除
            </button>
        `;

        categoriesList.appendChild(categoryItem);
    });

    // 削除ボタンのイベントリスナー
    categoriesList.querySelectorAll('.delete-category-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const categoryId = e.target.dataset.categoryId;
            if (confirm('このカテゴリを削除しますか？')) {
                this.deleteCategory(categoryId);
            }
        });
    });
};

/**
 * キーワードリストを表示
 */
ReceiptApp.prototype.renderKeywordsList = function() {
    const keywordsList = document.getElementById('keywordsList');
    if (!keywordsList) return;

    // 折りたたみ状態を保持
    if (!this.keywordViewState) {
        this.keywordViewState = {};
    }
    if (!this.learningViewState) {
        this.learningViewState = { collapsed: false };
    }

    const settings = this.storage.getSettings();
    keywordsList.innerHTML = '';

    // 未分類・手動修正済みの店舗候補を取得（頻度優先＋鮮度）
    const historySuggestions = this.storage.getRecentProblemMerchants(8);

    // カラー計算ヘルパー（カテゴリ色を薄めて背景用に）
    const designColorMap = {
        food: '#3b82f6',
        daily: '#10b981',
        restaurant: '#f59e0b',
        cafe: '#8b5cf6',
        transport: '#ef4444',
        other: '#6b7280'
    };
    const toRgba = (hex, alpha = 0.12) => {
        if (!hex || typeof hex !== 'string') return `rgba(107, 114, 128, ${alpha})`; // fallback gray
        let c = hex.replace('#', '');
        if (c.length === 3) {
            c = c.split('').map(ch => ch + ch).join('');
        }
        if (c.length !== 6) return `rgba(107, 114, 128, ${alpha})`;
        const num = parseInt(c, 16);
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    settings.categories.forEach(category => {
        const keywords = settings.categoryKeywords[category.id] || [];
        const isCollapsed = this.keywordViewState[category.id]?.collapsed || false;
        const color = designColorMap[category.id] || category.color || '#6b7280';
        const bgColor = toRgba(color, 0.14);

        const keywordSection = document.createElement('div');
        keywordSection.className = 'keyword-section';
        keywordSection.innerHTML = `
            <div class="keyword-header">
                <h4>${category.name}</h4>
                <div class="keyword-meta">
                    <span class="keyword-count">${keywords.length}件</span>
                    <button class="keyword-toggle-btn" data-category-id="${category.id}">
                        ${isCollapsed ? '展開' : '折りたたむ'}
                    </button>
                </div>
            </div>
            <div class="keyword-tags ${isCollapsed ? 'is-collapsed' : ''}" data-category-id="${category.id}">
                ${keywords.length > 0 ? keywords.map(kw => `
                    <span class="keyword-tag" style="--category-color:${color}; --category-bg:${bgColor};">
                        ${kw}
                        <button class="keyword-remove" data-keyword="${kw}" data-category-id="${category.id}">×</button>
                    </span>
                `).join('') : '<span class="keyword-tag" style="opacity: 0.5;">キーワードがありません</span>'}
            </div>
            <div class="keyword-input-group">
                <input type="text"
                       class="keyword-input"
                       placeholder="キーワードを追加"
                       data-category-id="${category.id}" />
                <button class="btn btn-secondary btn-sm add-keyword-btn"
                        data-category-id="${category.id}">
                    追加
                </button>
            </div>
            <div class="history-suggestions">
                <div class="history-suggestions-header">
                    <span>最近の履歴から追加</span>
                    <span class="history-hint">未分類・手動修正済みの店舗名を優先表示</span>
                </div>
                <div class="history-suggestion-chips" data-category-id="${category.id}">
                    ${historySuggestions.length > 0 ? historySuggestions.map(s => `
                        <button class="history-chip" style="--category-color:${color}; --category-bg:${bgColor};" data-category-id="${category.id}" data-merchant="${s.name}">
                            ＋ ${s.name} <span class="chip-meta">${s.count}件</span>
                        </button>
                    `).join('') : '<span class="history-empty">候補がありません</span>'}
                </div>
            </div>
        `;

        keywordsList.appendChild(keywordSection);
    });

    // 学習済み店舗名（完全一致）の表示
    const learning = this.storage.getCategoryLearning() || {};
    const categoryNameMap = new Map(settings.categories.map(c => [c.id, c.name || c.id]));
    const categoryColorMap = new Map(settings.categories.map(c => [c.id, designColorMap[c.id] || c.color || '#6b7280']));

    const learningEntries = Object.entries(learning).map(([merchant, categoryId]) => ({
        merchant,
        categoryId,
        categoryName: categoryNameMap.get(categoryId) || categoryId,
        color: categoryColorMap.get(categoryId) || '#6b7280'
    }));

    const isLearningCollapsed = this.learningViewState.collapsed || false;

    const learningSection = document.createElement('div');
    learningSection.className = 'learning-section';
    learningSection.innerHTML = `
        <div class="learning-header">
            <h4>学習済み店舗名（完全一致）</h4>
            <div class="learning-meta">
                <span class="learning-count">${learningEntries.length}件</span>
                <button class="learning-toggle-btn">
                    ${isLearningCollapsed ? '展開' : '折りたたむ'}
                </button>
            </div>
        </div>
        <p class="learning-hint">
            ※ここで設定するのは「キーワード（部分一致）」です。個別店舗の学習データはレシート修正時に自動保存され、キーワード削除の影響を受けません。
        </p>
        <div class="learning-list ${isLearningCollapsed ? 'is-collapsed' : ''}">
            ${learningEntries.length > 0 ? learningEntries.map(entry => `
                <span class="learning-item" style="--learning-color:${entry.color};">
                    <span class="learning-dot" aria-hidden="true"></span>
                    <span class="learning-merchant">${entry.merchant}</span>
                    <span class="learning-category">${entry.categoryName}</span>
                </span>
            `).join('') : '<span class="learning-empty">学習済み店舗はまだありません</span>'}
        </div>
    `;

    keywordsList.appendChild(learningSection);

    // キーワード追加ボタンのイベントリスナー
    keywordsList.querySelectorAll('.add-keyword-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const categoryId = e.target.dataset.categoryId;
            const input = keywordsList.querySelector(`.keyword-input[data-category-id="${categoryId}"]`);
            if (input && input.value.trim()) {
                this.addKeyword(categoryId, input.value.trim());
                input.value = '';
            }
        });
    });

    // Enterキーで追加
    keywordsList.querySelectorAll('.keyword-input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const categoryId = e.target.dataset.categoryId;
                if (e.target.value.trim()) {
                    this.addKeyword(categoryId, e.target.value.trim());
                    e.target.value = '';
                }
            }
        });
    });

    // キーワード削除ボタンのイベントリスナー
    keywordsList.querySelectorAll('.keyword-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const categoryId = e.target.dataset.categoryId;
            const keyword = e.target.dataset.keyword;
            this.removeKeyword(categoryId, keyword);
        });
    });

    // 履歴チップでキーワードを追加
    keywordsList.querySelectorAll('.history-chip').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const categoryId = e.currentTarget.dataset.categoryId;
            const merchant = e.currentTarget.dataset.merchant;
            this.addKeyword(categoryId, merchant);
        });
    });

    // 学習済み店舗リストの折りたたみ/展開
    const learningToggleBtn = keywordsList.querySelector('.learning-toggle-btn');
    if (learningToggleBtn) {
        learningToggleBtn.addEventListener('click', () => {
            this.learningViewState.collapsed = !this.learningViewState.collapsed;
            this.renderKeywordsList();
        });
    }

    // 折りたたみ/展開トグル
    keywordsList.querySelectorAll('.keyword-toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const categoryId = e.target.dataset.categoryId;
            const current = this.keywordViewState[categoryId]?.collapsed || false;
            this.keywordViewState[categoryId] = { collapsed: !current };
            this.renderKeywordsList();
        });
    });
};

/**
 * カテゴリをフォームから保存
 */
ReceiptApp.prototype.saveCategoriesFromForm = function(settings) {
    const categoryItems = document.querySelectorAll('.category-item');
    const categories = [];

    categoryItems.forEach(item => {
        const colorInput = item.querySelector('.category-color');
        const nameInput = item.querySelector('.category-name');

        if (colorInput && nameInput) {
            categories.push({
                id: colorInput.dataset.categoryId,
                name: nameInput.value.trim() || '未設定',
                color: colorInput.value
            });
        }
    });

    settings.categories = categories;
};

/**
 * キーワードをフォームから保存
 */
ReceiptApp.prototype.saveKeywordsFromForm = function(settings) {
    const keywordSections = document.querySelectorAll('.keyword-section');

    keywordSections.forEach(section => {
        const categoryId = section.querySelector('.keyword-tags')?.dataset.categoryId;
        if (!categoryId) return;

        const keywords = [];
        section.querySelectorAll('.keyword-tag').forEach(tag => {
            const keyword = tag.textContent.trim().replace('×', '').trim();
            if (keyword && keyword !== 'キーワードがありません') {
                keywords.push(keyword);
            }
        });

        settings.categoryKeywords[categoryId] = keywords;
    });
};

/**
 * カテゴリを削除
 */
ReceiptApp.prototype.deleteCategory = function(categoryId) {
    // 使用中のカテゴリかチェック
    const receipts = this.storage.getAllReceipts();
    const isUsed = receipts.some(r => r.category && r.category.id === categoryId);

    if (isUsed) {
        alert('このカテゴリは使用中のため削除できません。');
        return;
    }

    const settings = this.storage.getSettings();
    settings.categories = settings.categories.filter(c => c.id !== categoryId);

    // キーワードも削除
    if (settings.categoryKeywords[categoryId]) {
        delete settings.categoryKeywords[categoryId];
    }

    this.storage.saveSettings(settings);
    this.renderCategoriesList();
    this.renderKeywordsList();
};

/**
 * キーワードを追加
 */
ReceiptApp.prototype.addKeyword = function(categoryId, keywordInput) {
    if (!keywordInput || keywordInput.trim() === '') return;

    const settings = this.storage.getSettings();
    if (!settings.categoryKeywords[categoryId]) {
        settings.categoryKeywords[categoryId] = [];
    }

    const keywords = settings.categoryKeywords[categoryId];
    // カンマ・読点・空白で分割して一括追加（最大20件）
    const candidates = keywordInput
        .split(/[,、\s]+/)
        .map(k => k.trim())
        .filter(k => k.length > 0)
        .slice(0, 20);

    if (candidates.length === 0) return;

    let added = false;
    candidates.forEach(kw => {
        if (!keywords.includes(kw)) {
            keywords.push(kw);
            added = true;
        }
    });

    if (added) {
        this.storage.saveSettings(settings);
        this.renderKeywordsList();
    }
};

/**
 * キーワードを削除
 */
ReceiptApp.prototype.removeKeyword = function(categoryId, keyword) {
    const settings = this.storage.getSettings();
    if (settings.categoryKeywords[categoryId]) {
        settings.categoryKeywords[categoryId] =
            settings.categoryKeywords[categoryId].filter(kw => kw !== keyword);
        this.storage.saveSettings(settings);
        this.renderKeywordsList();
    }
};

/**
 * カテゴリを追加
 */
ReceiptApp.prototype.addCategory = function() {
    const settings = this.storage.getSettings();

    // 新しいカテゴリIDを生成
    const newId = 'category_' + Date.now();
    const newCategory = {
        id: newId,
        name: '',
        color: '#6b7280'
    };

    settings.categories.push(newCategory);

    // キーワード配列も初期化
    if (!settings.categoryKeywords[newId]) {
        settings.categoryKeywords[newId] = [];
    }

    this.storage.saveSettings(settings);

    // リストを再描画
    this.renderCategoriesList();
    this.renderKeywordsList();
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
        originalInit.call(this);
        this.initBottomNav();
    };

    ReceiptApp.prototype.showDashboard = function() {
        originalShowDashboard.call(this);
        if (typeof this.setActiveBottomNav === 'function') {
            this.setActiveBottomNav('dashboard');
        }
    };

    ReceiptApp.prototype.showEditor = function(receipt) {
        // 編集時は渡されたレシートをそのまま委譲し、既存データをフォームに反映する
        originalShowEditor.call(this, receipt);
        if (typeof this.setActiveBottomNav === 'function') {
            this.setActiveBottomNav('editor');
        }
    };

    ReceiptApp.prototype.showCalendar = function(scrollTarget) {
        originalShowCalendar.call(this, scrollTarget);
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