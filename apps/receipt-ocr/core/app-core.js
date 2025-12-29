/**
 * メインアプリケーションロジック（コア機能）
 * UI制御と画面遷移を管理
 */

class ReceiptApp {
    constructor() {
        this.storage = new ReceiptStorage();
        this.geminiService = new GeminiService(this.storage);
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
            ocrLoading: document.getElementById('ocrLoading'),
            imagePreview: document.getElementById('imagePreview'),
            editorLeft: document.querySelector('.editor-left'),

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
            summaryCard: document.getElementById('summaryCard'),
            monthlyTotal: document.getElementById('monthlyTotal'),
            captureBtnLarge: document.getElementById('captureBtnLarge'),
            budgetProgressContainer: document.getElementById('budgetProgressContainer'),
            budgetProgressBar: document.getElementById('budgetProgressBar'),
            budgetProgressText: document.getElementById('budgetProgressText'),
            budgetRemainingLabel: document.getElementById('budgetRemainingLabel'),
            budgetRemainingText: document.getElementById('budgetRemainingText'),
            monthlyBudgetTotal: document.getElementById('monthlyBudgetTotal'),
            budgetForecastMarker: document.getElementById('budgetForecastMarker'),
            budgetForecastLine: document.getElementById('budgetForecastLine'),
            budgetForecastDot: document.getElementById('budgetForecastDot'),
            budgetForecastRow: document.getElementById('budgetForecastRow'),
            budgetForecastText: document.getElementById('budgetForecastText'),
            categoryBreakdownContainer: document.getElementById('categoryBreakdownContainer'),
            weeklyChart: document.getElementById('weeklyChart'),
            receiptsContainer: document.getElementById('receiptsContainer'),
            dashboardAddBtn: document.getElementById('dashboardAddBtn'),
            openAllReceiptsBtn: document.getElementById('openAllReceiptsBtn'),
            allReceiptsModal: document.getElementById('allReceiptsModal'),
            closeAllReceiptsBtn: document.getElementById('closeAllReceiptsBtn'),
            allReceiptsContainer: document.getElementById('allReceiptsContainer'),

            // ヘッダー要素
            prevMonthBtn: document.getElementById('prevMonthBtn'),
            nextMonthBtn: document.getElementById('nextMonthBtn'),
            currentMonthDisplay: document.getElementById('currentMonthDisplay'),

            // 登録方法選択モーダル
            addChoiceModal: document.getElementById('addChoiceModal'),
            closeAddChoiceBtn: document.getElementById('closeAddChoiceBtn'),
            choiceCameraBtn: document.getElementById('choiceCameraBtn'),
            choiceManualBtn: document.getElementById('choiceManualBtn')
        };

        // 要素の存在確認
        // 存在しなくても良いオプション要素（画面構成により未配置なことがある）
        // - captureBtnLarge: ダッシュボード上の大きな撮影ボタン（現行UIでは未配置）
        // - openAllReceiptsBtn: 「もっと見る（全レシート）」導線（現行UIでは未配置）
        // ! 要確認
        const optionalElements = new Set([
            'dashboardAddBtn',
            'captureBtnLarge',
            'openAllReceiptsBtn'
        ]);

        const missingElements = Object.entries(this.elements)
            .filter(([key, value]) => !value && !optionalElements.has(key))
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
        // 戻るボタンのクリックイベント
        const backLink = document.getElementById('backLink');
        if (backLink) {
            // Smart Receiptのホーム（ダッシュボード）に戻る
            backLink.href = '#';
            backLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showDashboard();
            });
        }

        // FABボタン
        if (this.elements.fabBtn) {
            this.elements.fabBtn.addEventListener('click', () => {
                console.log('FAB button clicked');
                this.showAddChoiceModal();
            });
        } else {
            console.error('FAB button not found');
        }

        // 登録方法選択モーダル
        if (this.elements.closeAddChoiceBtn) {
            this.elements.closeAddChoiceBtn.addEventListener('click', () => {
                this.hideAddChoiceModal();
            });
        }

        // 登録方法選択モーダルの背景クリックで閉じる
        if (this.elements.addChoiceModal) {
            const overlay = this.elements.addChoiceModal.querySelector('.modal-overlay');
            if (overlay) {
                overlay.addEventListener('click', () => {
                    this.hideAddChoiceModal();
                });
            }
        }

        if (this.elements.choiceCameraBtn) {
            this.elements.choiceCameraBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hideAddChoiceModal();
                this.showEditor();
                this.elements.imageInput.click();
            });
        }

        if (this.elements.choiceManualBtn) {
            this.elements.choiceManualBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hideAddChoiceModal();
                this.showEditor(null, true); // 第2引数にisManualフラグ
            });
        }

        // カメラボタン
        this.elements.captureBtn.addEventListener('click', () => {
            this.elements.imageInput.click();
        });

        // ダッシュボードの大きな撮影ボタン
        if (this.elements.captureBtnLarge) {
            this.elements.captureBtnLarge.addEventListener('click', () => {
                this.elements.imageInput.click();
            });
        }

        // ダッシュボードの追加ボタン（現在未使用だが存在時のみ対応）
        if (this.elements.dashboardAddBtn) {
            this.elements.dashboardAddBtn.addEventListener('click', () => {
                this.showEditor();
            });
        }

        // もっと見る（全レシート）
        if (this.elements.openAllReceiptsBtn) {
            this.elements.openAllReceiptsBtn.addEventListener('click', () => {
                this.showAllReceiptsModal();
            });
        }

        // カレンダーボタン（およびカテゴリ別内訳の詳細ボタン）
        const openCalendarBtn = document.getElementById('openCalendarBtn');
        const categoryDetailBtn = document.getElementById('categoryDetailBtn');

        const openCalendar = () => {
            if (this.showCalendarModal) {
                this.showCalendarModal();
            }
        };

        if (openCalendarBtn) {
            openCalendarBtn.addEventListener('click', openCalendar);
        }
        if (categoryDetailBtn) {
            categoryDetailBtn.addEventListener('click', openCalendar);
        }

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
        this.elements.cancelBtn.addEventListener('click', () => {
            const ctx = this.editReturnContext;
            // カレンダーから編集に入った場合は、キャンセル時にカレンダーへ戻す
            if (ctx && ctx.screen === 'calendar' && typeof this.showCalendarModal === 'function') {
                this.showDashboard(); // モーダルの土台としてダッシュボードを表示
                this.showCalendarModal({
                    month: ctx.month || null,
                    selectedDate: ctx.selectedDate || null
                });
                this.editReturnContext = null;
                return;
            }
            this.showDashboard();
        });

        // カテゴリ変更時の学習
        this.elements.category.addEventListener('change', () => {
            if (this.currentReceipt && this.currentReceipt.merchant) {
                const merchantName = this.elements.merchantName.value;
                const categoryId = this.elements.category.value;
                this.classifier.learn(merchantName, categoryId);
            }
        });

        // サマリーカード（将来の詳細表示用プレースホルダー）
        if (this.elements.summaryCard) {
            const openSummaryDetail = () => {
                // TODO: 詳細画面への遷移を実装
                console.log('Summary card clicked');
            };
            this.elements.summaryCard.addEventListener('click', openSummaryDetail);
            this.elements.summaryCard.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openSummaryDetail();
                }
            });
        }

        // 設定ボタン
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.showSettingsModal();
            });
        }

        // 月移動ボタン
        if (this.elements.prevMonthBtn) {
            this.elements.prevMonthBtn.addEventListener('click', () => {
                this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
                this.updateDashboard();
            });
        }

        if (this.elements.nextMonthBtn) {
            this.elements.nextMonthBtn.addEventListener('click', () => {
                this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
                this.updateDashboard();
            });
        }
    }

    /**
     * ダッシュボードを表示
     * @param {string|null} highlightReceiptId - 保存直後に強調表示するレシートID
     */
    showDashboard(highlightReceiptId = null) {
        if (!this.elements.dashboard || !this.elements.editor) {
            console.error('Dashboard or Editor element not found');
            return;
        }
        this.elements.dashboard.classList.add('active');
        if (this.elements.homeV2) {
            this.elements.homeV2.classList.remove('active');
        }
        this.elements.editor.classList.remove('active');
        // bodyからクラスを削除して設定ボタンを表示する
        document.body.classList.remove('editor-active');
        // FABボタンを表示
        if (this.elements.fabBtn) {
            this.elements.fabBtn.style.display = 'inline-flex';
        }
        this.updateDashboard();
    }

    /**
     * エディタを表示
     * @param {Object|null} receipt 編集対象のレシート（新規の場合は null）
     * @param {boolean} isManual 手入力モードかどうか
     */
    showEditor(receipt = null, isManual = false) {
        if (!this.elements.dashboard || !this.elements.editor) {
            console.error('Dashboard or Editor element not found');
            return;
        }
        this.elements.dashboard.classList.remove('active');
        if (this.elements.homeV2) {
            this.elements.homeV2.classList.remove('active');
        }
        this.elements.editor.classList.add('active');
        // bodyにクラスを追加して設定ボタンを非表示にする
        document.body.classList.add('editor-active');
        // FABボタンを非表示
        if (this.elements.fabBtn) {
            this.elements.fabBtn.style.display = 'none';
        }

        // 手入力モードまたは画像なしレシート編集時のUI調整
        const hideImageUI = isManual || (receipt && !receipt.image);
        if (this.elements.editorLeft) {
            this.elements.editorLeft.style.display = hideImageUI ? 'none' : '';
        }

        if (receipt) {
            this.loadReceiptToForm(receipt);
            this.currentReceipt = receipt;
        } else if (isManual) {
            this.initManualInput();
            this.currentReceipt = null;
        } else {
            this.resetForm();
            this.currentReceipt = null;
        }
    }

    /**
     * 登録方法選択モーダルを表示
     */
    showAddChoiceModal() {
        if (this.elements.addChoiceModal) {
            this.elements.addChoiceModal.style.display = 'flex';
        }
    }

    /**
     * 登録方法選択モーダルを非表示
     */
    hideAddChoiceModal() {
        if (this.elements.addChoiceModal) {
            this.elements.addChoiceModal.style.display = 'none';
        }
    }

    /**
     * 手入力モードで初期化
     */
    initManualInput() {
        this.resetForm();

        // 今日をデフォルトに設定
        const today = new Date().toISOString().split('T')[0];
        this.elements.receiptDate.value = today;

        // 店名を空に
        this.elements.merchantName.value = '';

        // 金額を空に
        this.elements.totalAmount.value = '';

        // カテゴリを「その他」に
        this.elements.category.value = 'other';
        // 手入力画面での自動フォーカスは、モバイルでの不要なスクロール（画面ジャンプ）の原因になるため行わない
    }

    /**
     * カレンダーを表示
     */
    showCalendar(scrollTarget = '#calendarSection') {
        if (!this.elements.dashboard || !this.elements.editor) {
            console.error('Dashboard or Editor element not found');
            return;
        }
        // カレンダー機能は廃止されたため、ホームの履歴セクションにフォーカス
        const targetSelector = scrollTarget && scrollTarget !== '#calendarSection'
            ? scrollTarget
            : '#recentSection';
        this.showDashboard();
        this.scrollToTarget(targetSelector);
    }

    /**
     * 新ホーム画面（プレビュー）を表示
     */
    showHomeV2() {
        if (!this.elements.homeV2) {
            console.warn('Home V2 element not found');
            return;
        }
        this.elements.homeV2.classList.add('active');
        if (this.elements.dashboard) {
            this.elements.dashboard.classList.remove('active');
        }
        if (this.elements.editor) {
            this.elements.editor.classList.remove('active');
        }
        this.updateHomeV2();
    }

    /**
     * 新ホーム画面（プレビュー）を更新
     */
    updateHomeV2() {
        if (!this.elements.homeV2MonthlyTotal) return;

        // 月次合計と先月比較
        const now = new Date();
        const monthlyTotal = this.storage.getMonthlyTotal(now.getFullYear(), now.getMonth());
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevTotal = this.storage.getMonthlyTotal(prevMonthDate.getFullYear(), prevMonthDate.getMonth());
        const diff = monthlyTotal - prevTotal;
        const rate = prevTotal === 0 ? null : (diff / prevTotal) * 100;

        this.elements.homeV2MonthlyTotal.textContent = `${monthlyTotal.toLocaleString()}`;
        if (this.elements.homeV2Delta) {
            if (rate === null) {
                this.elements.homeV2Delta.textContent = '前月データなし';
                this.elements.homeV2Delta.style.background = '#f3f4f6';
                this.elements.homeV2Delta.style.color = '#6b7280';
            } else {
                const sign = rate >= 0 ? '+' : '';
                this.elements.homeV2Delta.textContent = `${sign}${rate.toFixed(1)}%`;
                this.elements.homeV2Delta.style.background = rate >= 0 ? 'rgba(231, 57, 8, 0.08)' : 'rgba(16, 185, 129, 0.12)';
                this.elements.homeV2Delta.style.color = rate >= 0 ? '#c53030' : '#0f9c5a';
            }
        }

        // 週間バー（過去7日）
        if (this.elements.homeV2WeeklyBars) {
            const monday = (() => {
                const today = new Date();
                const mondayCalc = new Date(today);
                const day = today.getDay();
                const diff = today.getDate() - day + (day === 0 ? -6 : 1);
                mondayCalc.setDate(diff);
                mondayCalc.setHours(0, 0, 0, 0);
                return mondayCalc;
            })();
            const weeklyReceipts = this.storage.getWeeklyReceipts(monday);
            const dailyTotals = [0, 0, 0, 0, 0, 0, 0];
            weeklyReceipts.forEach(receipt => {
                const receiptDate = new Date(receipt.date);
                const dayIndex = receiptDate.getDay() === 0 ? 6 : receiptDate.getDay() - 1;
                dailyTotals[dayIndex] += receipt.totalAmount || 0;
            });
            const maxAmount = Math.max(...dailyTotals, 1);
            const dayLabels = ['月', '火', '水', '木', '金', '土', '日'];
            this.elements.homeV2WeeklyBars.innerHTML = '';
            dailyTotals.forEach((amount, idx) => {
                const bar = document.createElement('div');
                bar.className = 'home-v2-bar';
                const fill = document.createElement('div');
                fill.className = 'home-v2-bar-fill';
                fill.style.height = `${Math.max((amount / maxAmount) * 100, 8)}%`;
                fill.title = `¥${amount.toLocaleString()}`;
                const label = document.createElement('div');
                label.className = 'home-v2-bar-label';
                label.textContent = dayLabels[idx];
                bar.appendChild(fill);
                bar.appendChild(label);
                this.elements.homeV2WeeklyBars.appendChild(bar);
            });
        }

        // 最近のレシート（5件）
        if (this.elements.homeV2Recent) {
            const receipts = this.storage.getAllReceipts()
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5);
            this.elements.homeV2Recent.innerHTML = '';
            if (receipts.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'home-v2-empty';
                empty.textContent = 'まだレシートが登録されていません';
                this.elements.homeV2Recent.appendChild(empty);
            } else {
                receipts.forEach(receipt => {
                    const item = document.createElement('div');
                    item.className = 'home-v2-recent-item';

                    const icon = document.createElement('div');
                    icon.className = 'home-v2-recent-icon';
                    icon.textContent = '🧾';

                    const body = document.createElement('div');
                    body.className = 'home-v2-recent-body';
                    const title = document.createElement('p');
                    title.className = 'home-v2-recent-title';
                    title.textContent = receipt.merchant?.name || '不明な店舗';
                    const meta = document.createElement('p');
                    meta.className = 'home-v2-recent-meta';
                    meta.textContent = new Date(receipt.date).toLocaleDateString('ja-JP');
                    body.appendChild(title);
                    body.appendChild(meta);

                    const amount = document.createElement('div');
                    amount.className = 'home-v2-recent-amount';
                    amount.textContent = `¥${(receipt.totalAmount || 0).toLocaleString()}`;

                    item.appendChild(icon);
                    item.appendChild(body);
                    item.appendChild(amount);
                    this.elements.homeV2Recent.appendChild(item);
                });
            }
        }
    }

    /**
     * ダッシュボードを更新
     */
    updateDashboard() {
        this.updateMonthDisplay();
        this.renderSummaryCard();
        // 週間グラフの代わりにカテゴリ別内訳を表示（既存コード維持のためコメントアウト）
        // this.renderWeeklyChart();
        this.renderCategoryBreakdown();
        this.renderRecentReceipts();
    }

    /**
     * 月表示を更新
     */
    updateMonthDisplay() {
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth() + 1;

        // ヘッダーの表示を更新
        if (this.elements.currentMonthDisplay) {
            this.elements.currentMonthDisplay.textContent = `${year}年${month}月`;
        }

        // ダッシュボード内の「〇月の総支出」テキストを更新
        const currentMonthText = document.getElementById('currentMonthText');
        if (currentMonthText) {
            currentMonthText.textContent = month;
        }
    }
}

