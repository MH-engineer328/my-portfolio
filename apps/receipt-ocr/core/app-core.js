/**
 * メインアプリケーションロジック（コア機能）
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
            summaryCard: document.getElementById('summaryCard'),
            monthlyTotal: document.getElementById('monthlyTotal'),
            budgetValue: document.getElementById('budgetValue'),
            budgetProgressFill: document.getElementById('budgetProgressFill'),
            budgetProgressText: document.getElementById('budgetProgressText'),
            budgetRemainingText: document.getElementById('budgetRemainingText'),
            weeklyChart: document.getElementById('weeklyChart'),
            receiptsContainer: document.getElementById('receiptsContainer'),
            dashboardAddBtn: document.getElementById('dashboardAddBtn'),
            openAllReceiptsBtn: document.getElementById('openAllReceiptsBtn'),
            allReceiptsModal: document.getElementById('allReceiptsModal'),
            closeAllReceiptsBtn: document.getElementById('closeAllReceiptsBtn'),
            allReceiptsContainer: document.getElementById('allReceiptsContainer')
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
        if (this.elements.homeV2) {
            this.elements.homeV2.classList.remove('active');
        }
        this.elements.editor.classList.remove('active');
        this.updateDashboard();
    }

    /**
     * エディタを表示
     * @param {Object|null} receipt 編集対象のレシート（新規の場合は null）
     */
    showEditor(receipt = null) {
        if (!this.elements.dashboard || !this.elements.editor) {
            console.error('Dashboard or Editor element not found');
            return;
        }
        this.elements.dashboard.classList.remove('active');
        if (this.elements.homeV2) {
            this.elements.homeV2.classList.remove('active');
        }
        this.elements.editor.classList.add('active');
        if (receipt) {
            this.loadReceiptToForm(receipt);
            this.currentReceipt = receipt;
        } else {
            this.resetForm();
            this.currentReceipt = null;
        }
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
        this.renderSummaryCard();
        this.renderWeeklyChart();
        this.renderRecentReceipts();
    }
}

