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
                       value="${category.name}"
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

    const settings = this.storage.getSettings();
    keywordsList.innerHTML = '';

    settings.categories.forEach(category => {
        const keywords = settings.categoryKeywords[category.id] || [];

        const keywordSection = document.createElement('div');
        keywordSection.className = 'keyword-section';
        keywordSection.innerHTML = `
            <h4>${category.name}</h4>
            <div class="keyword-tags" data-category-id="${category.id}">
                ${keywords.length > 0 ? keywords.map(kw => `
                    <span class="keyword-tag">
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
        `;

        keywordsList.appendChild(keywordSection);
    });

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
ReceiptApp.prototype.addKeyword = function(categoryId, keyword) {
    if (!keyword || keyword.trim() === '') return;

    const settings = this.storage.getSettings();
    if (!settings.categoryKeywords[categoryId]) {
        settings.categoryKeywords[categoryId] = [];
    }

    const keywords = settings.categoryKeywords[categoryId];
    if (!keywords.includes(keyword.trim())) {
        keywords.push(keyword.trim());
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
        name: '新しいカテゴリ',
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
