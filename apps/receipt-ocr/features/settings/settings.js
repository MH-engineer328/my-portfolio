/**
 * 設定モーダル関連機能
 * カテゴリ管理、キーワード管理
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
    if (color) return color;
    if (fallback) return fallback;
    if (FIXED_CATEGORY_COLORS[categoryId]) return FIXED_CATEGORY_COLORS[categoryId];
    return DEFAULT_CATEGORY_COLOR;
};

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

    // ナビゲーション初期化＆表示パネル反映
    this.initSettingsNavigation();
    this.activateSettingsSection(this.activeSettingsSection || 'budget');

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
        this.cleanupEmptyCategories();
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
    const prevSection = this.activeSettingsSection;
    this.activeSettingsSection = section;

    // カテゴリ欄から離れるときに空のカテゴリをクリーンアップ
    if (prevSection === 'categories' && section !== 'categories') {
        this.cleanupEmptyCategories();
    }

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

    // 週間予算
    const budgetInput = document.getElementById('weeklyBudgetInput');
    if (budgetInput) {
        budgetInput.value = settings.weeklyBudget || 10000;
    }

    // カテゴリリストを表示
    this.renderCategoriesList();

    // キーワードカテゴリ選択を更新
    this.renderKeywordCategorySelector();

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

    const renderCategoryRow = (category) => {
        const fixedColor = resolveCategoryColor(category.id, category.color);
        const categoryItem = document.createElement('div');
        categoryItem.className = 'category-item';
        categoryItem.dataset.categoryId = category.id;
        categoryItem.innerHTML = `
            <div class="category-info">
                <label class="category-color-picker" aria-label="カテゴリ色を変更">
                    <span class="category-color-swatch" style="background:${fixedColor};"></span>
                    <input type="color"
                           class="category-color"
                           value="${fixedColor}"
                           data-category-id="${category.id}"
                           aria-label="カテゴリ色を選択" />
                </label>
                <input type="text"
                       class="category-name"
                       value="${category.name || ''}"
                       placeholder="カテゴリ名を入力"
                       data-category-id="${category.id}" />
            </div>
            <div class="category-actions">
                <button class="category-delete-btn"
                        type="button"
                        aria-label="カテゴリを削除"
                        data-category-id="${category.id}">
                    <span class="material-symbols-outlined" aria-hidden="true">delete</span>
                </button>
            </div>
        `;

        categoriesList.appendChild(categoryItem);
    };

    settings.categories.forEach(renderCategoryRow);

    if (this.isAddingCategory) {
        const draftName = this.newCategoryDraft?.name || '';
        const draftColor = this.newCategoryDraft?.color || DEFAULT_CATEGORY_COLOR;
        const draftItem = document.createElement('div');
        draftItem.className = 'category-item category-item--new';
        draftItem.innerHTML = `
            <div class="category-info">
                <label class="category-color-picker" aria-label="新しいカテゴリの色を選択">
                    <span class="category-color-swatch" style="background:${draftColor};"></span>
                    <input type="color"
                           class="category-color"
                           value="${draftColor}"
                           data-role="new-category-color"
                           aria-label="新しいカテゴリの色を選択" />
                </label>
                <input type="text"
                       class="category-name"
                       value="${draftName}"
                       placeholder="カテゴリ名を入力"
                       data-role="new-category-name" />
            </div>
            <div class="category-actions category-actions--new">
                <button class="category-add-save" type="button">追加</button>
                <button class="category-add-cancel" type="button">キャンセル</button>
            </div>
        `;
        categoriesList.appendChild(draftItem);
    }

    categoriesList.querySelectorAll('.category-color[data-category-id]').forEach(input => {
        input.addEventListener('input', (e) => {
            const color = e.target.value;
            const categoryId = e.target.dataset.categoryId;
            const swatch = e.target.closest('.category-color-picker')?.querySelector('.category-color-swatch');
            if (swatch) {
                swatch.style.backgroundColor = color;
            }
            this.updateCategoryColor(categoryId, color);
        });
    });

    // 削除ボタンのイベントリスナー
    categoriesList.querySelectorAll('.category-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const categoryId = btn.dataset.categoryId;
            if (confirm('このカテゴリを削除しますか？')) {
                this.deleteCategory(categoryId);
            }
        });
    });

    if (this.isAddingCategory) {
        const draftRow = categoriesList.querySelector('.category-item--new');
        if (draftRow) {
            const nameInput = draftRow.querySelector('[data-role="new-category-name"]');
            const colorInput = draftRow.querySelector('[data-role="new-category-color"]');
            const saveBtn = draftRow.querySelector('.category-add-save');
            const cancelBtn = draftRow.querySelector('.category-add-cancel');

            if (nameInput) {
                nameInput.addEventListener('input', (e) => {
                    this.newCategoryDraft = {
                        ...(this.newCategoryDraft || {}),
                        name: e.target.value
                    };
                });
            }

            if (colorInput) {
                colorInput.addEventListener('input', (e) => {
                    const color = e.target.value;
                    const swatch = e.target.closest('.category-color-picker')?.querySelector('.category-color-swatch');
                    if (swatch) {
                        swatch.style.backgroundColor = color;
                    }
                    this.newCategoryDraft = {
                        ...(this.newCategoryDraft || {}),
                        color
                    };
                });
            }

            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    const name = (nameInput?.value || '').trim();
                    const color = colorInput?.value || DEFAULT_CATEGORY_COLOR;
                    if (!name) {
                        alert('カテゴリ名を入力してください。');
                        nameInput?.focus();
                        return;
                    }
                    this.commitNewCategory(name, color);
                });
            }

            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    this.isAddingCategory = false;
                    this.newCategoryDraft = null;
                    this.renderCategoriesList();
                });
            }

            // フォーカス初期化
            if (nameInput) {
                nameInput.focus();
            }
        }
    }
};

/**
 * カテゴリ色を即時反映・保存
 */
ReceiptApp.prototype.updateCategoryColor = function(categoryId, color) {
    if (!categoryId || !color) return;
    const settings = this.storage.getSettings();
    const target = settings.categories.find(c => c.id === categoryId);
    if (!target) return;

    target.color = color;
    this.storage.saveSettings(settings);
    if (this.classifier) {
        this.classifier.settings = settings;
    }
    this.renderKeywordCategorySelector(categoryId);
    this.renderKeywordsList();
    if (typeof this.updateDashboard === 'function') {
        this.updateDashboard();
    }
};

/**
 * 新規カテゴリの追加を確定
 */
ReceiptApp.prototype.commitNewCategory = function(name, color) {
    const settings = this.storage.getSettings();

    const newId = 'category_' + Date.now();
    const newCategory = {
        id: newId,
        name: name.trim(),
        color: resolveCategoryColor(newId, color)
    };

    settings.categories.push(newCategory);

    if (!settings.categoryKeywords[newId]) {
        settings.categoryKeywords[newId] = [];
    }

    this.activeKeywordCategoryId = newId;
    this.isAddingCategory = false;
    this.newCategoryDraft = null;

    this.storage.saveSettings(settings);
    if (this.classifier) {
        this.classifier.settings = settings;
    }

    this.renderCategoriesList();
    this.renderKeywordCategorySelector(newId);
    this.renderKeywordsList();
    if (typeof this.updateDashboard === 'function') {
        this.updateDashboard();
    }
};

/**
 * キーワードカテゴリ選択の描画
 */
ReceiptApp.prototype.renderKeywordCategorySelector = function(preferredCategoryId) {
    const selector = document.getElementById('keywordCategorySelect');
    if (!selector) return;

    const settings = this.storage.getSettings();
    selector.innerHTML = '';

    if (!settings.categories || settings.categories.length === 0) {
        selector.disabled = true;
        return;
    }

    selector.disabled = false;

    settings.categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name || '未設定';
        selector.appendChild(option);
    });

    const existsPreferred = preferredCategoryId && settings.categories.some(c => c.id === preferredCategoryId);
    const existsCurrent = this.activeKeywordCategoryId && settings.categories.some(c => c.id === this.activeKeywordCategoryId);
    const nextActive = existsPreferred
        ? preferredCategoryId
        : (existsCurrent ? this.activeKeywordCategoryId : settings.categories[0].id);

    this.activeKeywordCategoryId = nextActive;
    selector.value = nextActive;

    selector.onchange = () => {
        this.activeKeywordCategoryId = selector.value;
        if (this.keywordViewState && this.activeKeywordCategoryId) {
            this.keywordViewState[this.activeKeywordCategoryId] = { collapsed: false };
        }
        this.renderKeywordsList();
        // 選択したカテゴリまでスクロール
        setTimeout(() => {
            const target = document.querySelector(`.keyword-section[data-category-id="${this.activeKeywordCategoryId}"]`);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 50);
    };
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
    if (this.keywordGlobalFilter === undefined) {
        this.keywordGlobalFilter = '';
    }

    const settings = this.storage.getSettings();
    keywordsList.innerHTML = '';

    if (!settings.categories || settings.categories.length === 0) {
        keywordsList.innerHTML = '<p class="form-hint">先にカテゴリを作成してください。</p>';
        return;
    }

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

    // グローバル検索ボックスを生成
    const globalSearchWrap = document.createElement('div');
    globalSearchWrap.className = 'keyword-global-search';
    globalSearchWrap.innerHTML = `
        <span class="material-symbols-outlined keyword-search-icon" aria-hidden="true">search</span>
        <input type="text"
               id="keywordGlobalSearchInput"
               class="keyword-search-input"
               placeholder="🔍 キーワードを検索..."
               value="${this.keywordGlobalFilter || ''}" />
    `;
    keywordsList.appendChild(globalSearchWrap);

    const globalSearchInput = globalSearchWrap.querySelector('#keywordGlobalSearchInput');
    if (globalSearchInput) {
        globalSearchInput.addEventListener('input', (e) => {
            this.keywordGlobalFilter = e.target.value || '';
            this.renderKeywordsList();
        });
    }

    const availableIds = settings.categories.map(c => c.id);
    const globalQuery = (this.keywordGlobalFilter || '').trim().toLowerCase();
    const isSearching = globalQuery.length > 0;

    // すべてのカテゴリをアコーディオンで表示
    settings.categories.forEach(category => {
        const categoryId = category.id;
        const keywords = settings.categoryKeywords[categoryId] || [];
        if (!this.keywordViewState[categoryId]) {
            // デフォルトは折りたたみ
            this.keywordViewState[categoryId] = { collapsed: true };
        }

        const isUserCollapsed = !!this.keywordViewState[categoryId].collapsed;
        const color = resolveCategoryColor(categoryId, category.color);
        const bgColor = toRgba(color, 0.14);

        const filteredKeywords = !isSearching
            ? keywords
            : keywords.filter(kw => (kw || '').toLowerCase().includes(globalQuery));
        const hasHit = filteredKeywords.length > 0;

        // 検索中はヒット有無で自動開閉、未検索時はユーザー操作状態を尊重
        const isExpanded = isSearching ? hasHit : !isUserCollapsed;

        // 未分類・手動修正済みの店舗候補を取得（頻度優先＋鮮度）
        const historySuggestions = this.storage.getRecentProblemMerchants(8);

        const keywordSection = document.createElement('div');
        keywordSection.className = `keyword-section ${isExpanded ? 'is-open' : 'is-collapsed'} ${isSearching ? 'is-searching' : ''}`;
        keywordSection.dataset.categoryId = categoryId;

        const hitsLabel = isSearching ? `<span class="keyword-hit">${filteredKeywords.length}/${keywords.length}件ヒット</span>` : '';

        keywordSection.innerHTML = `
            <button class="keyword-header-btn" type="button" data-category-id="${categoryId}" aria-expanded="${isExpanded}" ${isSearching ? 'aria-disabled="true"' : ''}>
                <div class="keyword-header-left">
                    <span class="keyword-name">${category.name}</span>
                    <span class="keyword-count-badge">${keywords.length}</span>
                    ${hitsLabel}
                </div>
                <div class="keyword-header-right">
                    <span class="keyword-toggle-label">${isExpanded ? '閉じる' : '開く'}</span>
                    <span class="keyword-toggle-icon" aria-hidden="true">${isExpanded ? '▼' : '▶'}</span>
                </div>
            </button>
            <div class="keyword-body ${isExpanded ? 'is-open' : 'is-collapsed'}" data-category-id="${categoryId}">
                <div class="keyword-tags" data-category-id="${categoryId}">
                    ${keywords.length > 0 ? keywords.map(kw => {
                        const visible = !globalQuery || (kw || '').toLowerCase().includes(globalQuery);
                        return `
                            <span class="keyword-tag" data-keyword="${kw}" style="--category-color:${color}; --category-bg:${bgColor}; display:${visible ? 'inline-flex' : 'none'};">
                                ${kw}
                                <button class="keyword-remove" data-keyword="${kw}" data-category-id="${categoryId}">×</button>
                            </span>
                        `;
                    }).join('') : '<span class="keyword-tag keyword-tag--empty">キーワードがありません</span>'}
                </div>
                <div class="keyword-input-group">
                    <input type="text"
                           class="keyword-input"
                           placeholder="キーワードを追加"
                           data-category-id="${categoryId}" />
                    <button class="btn btn-secondary btn-sm add-keyword-btn"
                            data-category-id="${categoryId}">
                        追加
                    </button>
                </div>
                <div class="history-suggestions">
                    <div class="history-suggestions-header">
                        <span>最近の履歴から追加</span>
                        <span class="history-hint">未分類・手動修正済みの店舗名を優先表示</span>
                    </div>
                    <div class="history-suggestion-chips" data-category-id="${categoryId}">
                        ${historySuggestions.length > 0 ? historySuggestions.map(s => `
                            <button class="history-chip" style="--category-color:${color}; --category-bg:${bgColor};" data-category-id="${categoryId}" data-merchant="${s.name}">
                                ＋ ${s.name} <span class="chip-meta">${s.count}件</span>
                            </button>
                        `).join('') : '<span class="history-empty">候補がありません</span>'}
                    </div>
                </div>
            </div>
        `;

        keywordsList.appendChild(keywordSection);

        // 開閉操作（検索中は無効）
        const headerBtn = keywordSection.querySelector('.keyword-header-btn');
        if (headerBtn) {
            headerBtn.disabled = isSearching;
            headerBtn.classList.toggle('is-disabled', isSearching);
            headerBtn.addEventListener('click', () => {
                if (isSearching) return;
                const current = this.keywordViewState[categoryId]?.collapsed || false;
                this.keywordViewState[categoryId] = { collapsed: !current };
                this.renderKeywordsList();
            });
        }
    });

    // 学習済み店舗名（完全一致）の表示
    const learning = this.storage.getCategoryLearning() || {};
    const categoryNameMap = new Map(settings.categories.map(c => [c.id, c.name || c.id]));
    const categoryColorMap = new Map(settings.categories.map(c => [c.id, resolveCategoryColor(c.id, c.color)]));

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
};

/**
 * カテゴリをフォームから保存
 */
ReceiptApp.prototype.saveCategoriesFromForm = function(settings) {
    const categoryItems = document.querySelectorAll('.category-item[data-category-id]');
    const categories = [];

    categoryItems.forEach(item => {
        const colorInput = item.querySelector('.category-color');
        const nameInput = item.querySelector('.category-name');
        const targetInput = nameInput || colorInput;
        if (!targetInput) return;

        const name = nameInput ? nameInput.value.trim() : '';
        if (name.length === 0) return; // 空欄はスキップ
        const categoryId = targetInput.dataset.categoryId;
        categories.push({
            id: categoryId,
            name,
            color: resolveCategoryColor(categoryId, colorInput ? colorInput.value : undefined)
        });
    });

    settings.categories = categories;
};

/**
 * 空のカテゴリ（名称未入力）を削除し、関連キーワードも整理
 */
ReceiptApp.prototype.cleanupEmptyCategories = function() {
    const settings = this.storage.getSettings();
    const before = settings.categories.length;
    const cleaned = [];

    settings.categories.forEach(cat => {
        const name = (cat.name || '').trim();
        if (name.length === 0) {
            // 紐づくキーワードも削除
            if (settings.categoryKeywords[cat.id]) {
                delete settings.categoryKeywords[cat.id];
            }
            return;
        }
        cleaned.push({ ...cat, name });
    });

    if (cleaned.length !== before) {
        settings.categories = cleaned;
        this.storage.saveSettings(settings);
        this.isAddingCategory = false;
        this.newCategoryDraft = null;
        // UI再描画
        this.renderCategoriesList();
        this.renderKeywordCategorySelector();
        this.renderKeywordsList();
    }
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

    // キーワード選択のアクティブ状態を補正
    if (this.activeKeywordCategoryId === categoryId) {
        this.activeKeywordCategoryId = settings.categories[0]?.id || '';
    }

    this.storage.saveSettings(settings);
    this.renderCategoriesList();
    this.renderKeywordCategorySelector();
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
    if (this.isAddingCategory) {
        const draftNameInput = document.querySelector('[data-role="new-category-name"]');
        if (draftNameInput) {
            draftNameInput.focus();
        }
        return;
    }

    this.isAddingCategory = true;
    this.newCategoryDraft = this.newCategoryDraft || { name: '', color: DEFAULT_CATEGORY_COLOR };

    this.renderCategoriesList();
    setTimeout(() => {
        const draftNameInput = document.querySelector('[data-role="new-category-name"]');
        if (draftNameInput) {
            draftNameInput.focus();
        }
    }, 0);
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