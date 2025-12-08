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
            calendarScreen: document.getElementById('calendarScreen'),
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
        if (this.elements.calendarScreen) {
            this.elements.calendarScreen.classList.remove('active');
        }
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
        this.elements.editor.classList.add('active');
        if (this.elements.calendarScreen) {
            this.elements.calendarScreen.classList.remove('active');
        }
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
    showCalendar() {
        if (!this.elements.calendarScreen || !this.elements.dashboard || !this.elements.editor) {
            console.error('Calendar, Dashboard or Editor element not found');
            return;
        }
        this.elements.dashboard.classList.remove('active');
        this.elements.editor.classList.remove('active');
        this.elements.calendarScreen.classList.add('active');
        this.renderCalendar();
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
}

