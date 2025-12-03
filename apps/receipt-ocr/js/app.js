/**
 * メインアプリケーションロジック
 * UI制御と画面遷移を管理
 */

class ReceiptApp {
    constructor() {
        this.storage = new ReceiptStorage();
        this.ocrService = new OCRService();
        this.parser = new ReceiptParser();
        this.classifier = new CategoryClassifier(this.storage);

        this.currentReceipt = null;
        this.currentMonth = new Date();

        this.init();
    }

    init() {
        // DOM要素の取得
        this.elements = {
            dashboard: document.getElementById('dashboard'),
            editor: document.getElementById('editor'),
            fabBtn: document.getElementById('fabBtn'),
            imageInput: document.getElementById('imageInput'),
            captureBtn: document.getElementById('captureBtn'),
            receiptForm: document.getElementById('receiptForm'),
            cancelBtn: document.getElementById('cancelBtn'),
            retakeBtn: document.getElementById('retakeBtn'),
            ocrLoading: document.getElementById('ocrLoading'),
            imagePreview: document.getElementById('imagePreview'),

            // フォーム要素
            receiptDate: document.getElementById('receiptDate'),
            merchantName: document.getElementById('merchantName'),
            totalAmount: document.getElementById('totalAmount'),
            category: document.getElementById('category'),
            memo: document.getElementById('memo'),

            // ステータス表示
            dateStatus: document.getElementById('dateStatus'),
            merchantStatus: document.getElementById('merchantStatus'),
            amountStatus: document.getElementById('amountStatus'),
            dateError: document.getElementById('dateError'),
            merchantError: document.getElementById('merchantError'),
            amountError: document.getElementById('amountError'),

            // ダッシュボード要素
            monthlyTotal: document.getElementById('monthlyTotal'),
            weeklyChart: document.getElementById('weeklyChart'),
            calendarGrid: document.getElementById('calendarGrid'),
            calendarMonth: document.getElementById('calendarMonth'),
            prevMonth: document.getElementById('prevMonth'),
            nextMonth: document.getElementById('nextMonth'),
            receiptsContainer: document.getElementById('receiptsContainer')
        };

        // 要素の存在確認
        const missingElements = Object.entries(this.elements)
            .filter(([key, value]) => !value)
            .map(([key]) => key);

        if (missingElements.length > 0) {
            console.error('Missing DOM elements:', missingElements);
        }

        // イベントリスナーの設定
        this.setupEventListeners();

        // 初期表示
        this.showDashboard();
    }

    setupEventListeners() {
        // 戻るボタンのパスを動的に解決
        const backLink = document.getElementById('backLink');
        if (backLink) {
            // 現在のパスから相対的に解決
            const currentPath = window.location.pathname;
            const appPath = '/apps/receipt-ocr/';
            if (currentPath.includes(appPath)) {
                // アプリ内からアクセスしている場合
                backLink.href = currentPath.replace(appPath, '/');
            } else {
                // それ以外の場合は相対パス
                backLink.href = '../index.html';
            }
        }

        // FABボタン
        if (this.elements.fabBtn) {
            this.elements.fabBtn.addEventListener('click', () => {
                console.log('FAB button clicked');
                this.showEditor();
            });
        } else {
            console.error('FAB button not found');
        }

        // カメラボタン
        this.elements.captureBtn.addEventListener('click', () => {
            this.elements.imageInput.click();
        });

        // 画像選択
        this.elements.imageInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleImageUpload(e.target.files[0]);
            }
        });

        // フォーム送信
        this.elements.receiptForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveReceipt();
        });

        // キャンセル
        this.elements.cancelBtn.addEventListener('click', () => this.showDashboard());

        // 再撮影
        this.elements.retakeBtn.addEventListener('click', () => {
            this.elements.imageInput.click();
        });

        // カテゴリ変更時の学習
        this.elements.category.addEventListener('change', () => {
            if (this.currentReceipt && this.currentReceipt.merchant) {
                const merchantName = this.elements.merchantName.value;
                const categoryId = this.elements.category.value;
                this.classifier.learn(merchantName, categoryId);
            }
        });

        // カレンダーナビゲーション
        if (this.elements.prevMonth) {
            this.elements.prevMonth.addEventListener('click', () => {
                this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
                this.renderCalendar();
            });
        }

        if (this.elements.nextMonth) {
            this.elements.nextMonth.addEventListener('click', () => {
                this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
                this.renderCalendar();
            });
        }

        // 設定ボタン
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.showSettingsModal();
            });
        } else {
            console.warn('設定ボタンが見つかりません');
        }
    }

    /**
     * ダッシュボードを表示
     */
    showDashboard() {
        if (!this.elements.dashboard || !this.elements.editor) {
            console.error('Dashboard or Editor element not found');
            return;
        }
        this.elements.dashboard.classList.add('active');
        this.elements.editor.classList.remove('active');
        this.updateDashboard();
    }

    /**
     * エディタを表示
     */
    showEditor() {
        if (!this.elements.dashboard || !this.elements.editor) {
            console.error('Dashboard or Editor element not found');
            return;
        }
        this.elements.dashboard.classList.remove('active');
        this.elements.editor.classList.add('active');
        this.resetForm();
    }

    /**
     * ダッシュボードを更新
     */
    updateDashboard() {
        // 月次合計
        const now = new Date();
        const monthlyTotal = this.storage.getMonthlyTotal(now.getFullYear(), now.getMonth());
        this.elements.monthlyTotal.textContent = `¥${monthlyTotal.toLocaleString()}`;

        // 週間グラフ
        this.renderWeeklyChart();

        // カレンダー
        this.renderCalendar();

        // 最近のレシート
        this.renderRecentReceipts();
    }

    /**
     * 画像アップロード処理
     */
    async handleImageUpload(file) {
        // 画像プレビュー
        const reader = new FileReader();
        reader.onload = (e) => {
            this.elements.imagePreview.innerHTML = `<img src="${e.target.result}" alt="レシート画像">`;
        };
        reader.readAsDataURL(file);

        // OCR処理開始
        this.elements.ocrLoading.style.display = 'block';

        try {
            // OCR実行
            const ocrResult = await this.ocrService.recognizeText(file);

            // テキスト解析
            const parsed = this.parser.parse(ocrResult.text);

            // カテゴリ自動分類
            const category = this.classifier.classify(
                parsed.merchant.name || '',
                parsed.rawText
            );

            // フォームに値を設定
            this.fillForm(parsed, category);

            // 画像をリサイズして保存用に準備
            const thumbnail = await this.ocrService.resizeImage(file);
            this.currentReceipt = {
                image: thumbnail,
                ocrRawText: ocrResult.text
            };

        } catch (error) {
            console.error('OCR処理エラー:', error);
            alert('レシートの読み取りに失敗しました。もう一度お試しください。');
        } finally {
            this.elements.ocrLoading.style.display = 'none';
        }
    }

    /**
     * フォームに値を設定
     */
    fillForm(parsed, category) {
        // 日付
        this.elements.receiptDate.value = parsed.date.value;
        this.updateFieldStatus('date', parsed.date.confidence);

        // 店舗名
        this.elements.merchantName.value = parsed.merchant.name || '';
        this.updateFieldStatus('merchant', parsed.merchant.confidence);

        // 金額
        if (parsed.amount.value !== null) {
            this.elements.totalAmount.value = parsed.amount.value;
        }
        this.updateFieldStatus('amount', parsed.amount.confidence);

        // カテゴリ
        this.elements.category.value = category.id;
    }

    /**
     * フィールドのステータス表示を更新
     */
    updateFieldStatus(fieldName, confidence) {
        const statusEl = this.elements[fieldName + 'Status'];
        const errorEl = this.elements[fieldName + 'Error'];
        const inputEl = this.elements[fieldName === 'date' ? 'receiptDate' :
                                      fieldName === 'merchant' ? 'merchantName' : 'totalAmount'];

        // 既存のクラスをクリア
        statusEl.className = 'field-status';
        errorEl.classList.remove('show');
        inputEl.classList.remove('error');

        if (confidence === 'high') {
            statusEl.className = 'field-status success';
            statusEl.textContent = '✓ 正常に読み取れました';
        } else if (confidence === 'low') {
            statusEl.className = 'field-status warning';
            statusEl.textContent = '⚠ 要確認';
        } else if (confidence === 'failed') {
            statusEl.className = 'field-status';
            errorEl.textContent = '読み取りができなかったので、入力してください';
            errorEl.classList.add('show');
            inputEl.classList.add('error');
        }
    }

    /**
     * レシートを保存
     */
    saveReceipt() {
        const receipt = {
            ...this.currentReceipt,
            date: this.elements.receiptDate.value,
            merchant: {
                name: this.elements.merchantName.value,
                confidence: 'confirmed'
            },
            totalAmount: parseInt(this.elements.totalAmount.value) || 0,
            category: {
                id: this.elements.category.value,
                name: this.elements.category.options[this.elements.category.selectedIndex].text,
                autoDetected: false
            },
            memo: this.elements.memo.value,
            status: 'confirmed'
        };

        // カテゴリ学習
        this.classifier.learn(receipt.merchant.name, receipt.category.id);

        // 保存
        this.storage.saveReceipt(receipt);

        // ダッシュボードに戻る
        this.showDashboard();
    }

    /**
     * フォームをリセット
     */
    resetForm() {
        this.elements.receiptForm.reset();
        this.elements.imagePreview.innerHTML = '<p class="placeholder-text">レシート画像をアップロード</p>';
        this.currentReceipt = null;

        // ステータス表示をクリア
        ['date', 'merchant', 'amount'].forEach(field => {
            this.elements[field + 'Status'].textContent = '';
            this.elements[field + 'Error'].classList.remove('show');
            const inputEl = this.elements[field === 'date' ? 'receiptDate' :
                                          field === 'merchant' ? 'merchantName' : 'totalAmount'];
            inputEl.classList.remove('error');
        });
    }

    /**
     * 週間グラフを描画
     */
    renderWeeklyChart() {
        const ctx = this.elements.weeklyChart.getContext('2d');

        // 今週の月曜日を取得
        const today = new Date();
        const monday = new Date(today);
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1); // 月曜日に調整
        monday.setDate(diff);
        monday.setHours(0, 0, 0, 0);

        // 週間データを取得
        const weeklyReceipts = this.storage.getWeeklyReceipts(monday);
        const settings = this.storage.getSettings();

        // 日別の合計を計算
        const dailyTotals = [0, 0, 0, 0, 0, 0, 0]; // 月〜日
        weeklyReceipts.forEach(receipt => {
            const receiptDate = new Date(receipt.date);
            const dayIndex = receiptDate.getDay() === 0 ? 6 : receiptDate.getDay() - 1; // 月=0, 日=6
            dailyTotals[dayIndex] += receipt.totalAmount || 0;
        });

        // グラフの色を決定（予算超過は赤、予算内は青、50%以下は緑）
        const colors = dailyTotals.map(amount => {
            if (amount > settings.weeklyBudget / 7) return '#ef4444'; // 超過
            if (amount > settings.weeklyBudget / 14) return '#3b82f6'; // 予算内
            return '#10b981'; // 50%以下
        });

        // Chart.jsで描画
        if (this.weeklyChartInstance) {
            this.weeklyChartInstance.destroy();
        }

        const dailyBudget = settings.weeklyBudget / 7;
        const budgetLineData = Array(7).fill(dailyBudget);

        this.weeklyChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['月', '火', '水', '木', '金', '土', '日'],
                datasets: [
                    {
                        label: '支出',
                        data: dailyTotals,
                        backgroundColor: colors
                    },
                    {
                        label: '1日あたりの予算',
                        data: budgetLineData,
                        type: 'line',
                        borderColor: '#f59e0b',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        pointRadius: 0,
                        pointHoverRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            filter: function(item, chart) {
                                // 棒グラフの凡例は非表示、線グラフ（予算ライン）のみ表示
                                return item.datasetIndex === 1;
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const dailyBudget = settings.weeklyBudget / 7;
                                const amount = context.parsed.y;
                                const diff = amount - dailyBudget;
                                let label = `¥${amount.toLocaleString()}`;
                                if (diff > 0) {
                                    label += ` (予算超過: +¥${diff.toLocaleString()})`;
                                } else {
                                    label += ` (予算内: ¥${Math.abs(diff).toLocaleString()}余り)`;
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '¥' + value.toLocaleString();
                            }
                        },
                        grid: {
                            color: function(context) {
                                // 予算ラインの位置に破線を描画（視覚的な目安）
                                const dailyBudget = settings.weeklyBudget / 7;
                                if (Math.abs(context.tick.value - dailyBudget) < 10) {
                                    return '#f59e0b';
                                }
                                return '#e2e8f0';
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * カレンダーを描画
     */
    renderCalendar() {
        if (!this.elements.calendarGrid || !this.elements.calendarMonth) {
            console.error('Calendar elements not found');
            return;
        }

        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();

        // 月の表示を更新
        if (this.elements.calendarMonth) {
            this.elements.calendarMonth.textContent = `${year}年${month + 1}月`;
        }

        // カレンダーのグリッドをクリア
        this.elements.calendarGrid.innerHTML = '';

        // 曜日ヘッダー
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        weekdays.forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day-header';
            dayEl.textContent = day;
            dayEl.style.fontWeight = '600';
            dayEl.style.textAlign = 'center';
            this.elements.calendarGrid.appendChild(dayEl);
        });

        // 月の最初の日と最後の日
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const firstDayOfWeek = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        // 前月の日付を表示
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            const dayEl = this.createCalendarDay(prevMonthLastDay - i, true);
            this.elements.calendarGrid.appendChild(dayEl);
        }

        // 今月の日付
        const receipts = this.storage.getReceiptsByMonth(year, month);
        const dailyTotals = {};
        receipts.forEach(receipt => {
            const day = new Date(receipt.date).getDate();
            dailyTotals[day] = (dailyTotals[day] || 0) + (receipt.totalAmount || 0);
        });

        for (let day = 1; day <= daysInMonth; day++) {
            const dayEl = this.createCalendarDay(day, false, dailyTotals[day]);
            dayEl.addEventListener('click', () => {
                // 日付クリック時の処理（将来的に実装）
                console.log(`Clicked: ${year}-${month + 1}-${day}`);
            });
            this.elements.calendarGrid.appendChild(dayEl);
        }

        // 次月の日付を表示（グリッドを埋める）
        const totalCells = this.elements.calendarGrid.children.length;
        const remainingCells = 42 - totalCells; // 6週間分
        for (let day = 1; day <= remainingCells; day++) {
            const dayEl = this.createCalendarDay(day, true);
            this.elements.calendarGrid.appendChild(dayEl);
        }
    }

    /**
     * カレンダーの日付セルを作成
     */
    createCalendarDay(day, isOtherMonth, amount = null) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day' + (isOtherMonth ? ' other-month' : '');

        const dayNumber = document.createElement('div');
        dayNumber.className = 'calendar-day-number';
        dayNumber.textContent = day;
        dayEl.appendChild(dayNumber);

        if (amount && !isOtherMonth) {
            const dayAmount = document.createElement('div');
            dayAmount.className = 'calendar-day-amount';
            dayAmount.textContent = `¥${amount.toLocaleString()}`;
            dayEl.appendChild(dayAmount);
        }

        return dayEl;
    }

    /**
     * 最近のレシートを表示
     */
    renderRecentReceipts() {
        const receipts = this.storage.getAllReceipts();
        const recent = receipts
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);

        this.elements.receiptsContainer.innerHTML = '';

        if (recent.length === 0) {
            this.elements.receiptsContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted);">まだレシートが登録されていません</p>';
            return;
        }

        recent.forEach(receipt => {
            const card = document.createElement('div');
            card.className = 'receipt-card';

            card.innerHTML = `
                <div class="receipt-info">
                    <div class="receipt-merchant">${receipt.merchant.name || '不明'}</div>
                    <div class="receipt-date">${new Date(receipt.date).toLocaleDateString('ja-JP')}</div>
                </div>
                <div class="receipt-amount">¥${(receipt.totalAmount || 0).toLocaleString()}</div>
            `;

            this.elements.receiptsContainer.appendChild(card);
        });
    }

    /**
     * 設定モーダルを表示
     */
    showSettingsModal() {
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
    }

    /**
     * 設定モーダルを非表示
     */
    hideSettingsModal() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * 設定をフォームに読み込む
     */
    loadSettingsToForm() {
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
    }

    /**
     * 設定を保存
     */
    saveSettings() {
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
    }

    /**
     * エディタ画面のカテゴリ選択を更新
     */
    updateCategorySelect() {
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
    }

    /**
     * カテゴリリストを表示
     */
    renderCategoriesList() {
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
    }

    /**
     * キーワードリストを表示
     */
    renderKeywordsList() {
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
    }

    /**
     * カテゴリをフォームから保存
     */
    saveCategoriesFromForm(settings) {
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
    }

    /**
     * キーワードをフォームから保存
     */
    saveKeywordsFromForm(settings) {
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
    }

    /**
     * カテゴリを削除
     */
    deleteCategory(categoryId) {
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
    }

    /**
     * キーワードを追加
     */
    addKeyword(categoryId, keyword) {
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
    }

    /**
     * キーワードを削除
     */
    removeKeyword(categoryId, keyword) {
        const settings = this.storage.getSettings();
        if (settings.categoryKeywords[categoryId]) {
            settings.categoryKeywords[categoryId] = 
                settings.categoryKeywords[categoryId].filter(kw => kw !== keyword);
            this.renderKeywordsList();
        }
    }

    /**
     * カテゴリを追加
     */
    addCategory() {
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
    }
}

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ReceiptApp();
});

