/**
 * ダッシュボード関連機能
 * 週間グラフ、カレンダー、最近のレシート表示
 */

// ReceiptAppクラスのプロトタイプにメソッドを追加

/**
 * 週間グラフを描画
 */
ReceiptApp.prototype.renderWeeklyChart = function() {
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

    const dayLabels = ['月', '火', '水', '木', '金', '土', '日'];
    const dailyBudget = settings.weeklyBudget / 7;
    const budgetLineData = Array(dayLabels.length).fill(dailyBudget);

    // カテゴリメタ情報をマップ化
    const categories = settings.categories || [];
    const categoryMetaMap = new Map();
    categories.forEach(cat => {
        if (cat && cat.id) {
            categoryMetaMap.set(cat.id, cat);
        }
    });

    const createZeroArray = () => Array(dayLabels.length).fill(0);
    const uncategorizedKey = 'uncategorized';
    const uncategorizedMeta = { id: uncategorizedKey, name: '未分類/その他', color: '#cbd5e1' };

    // カテゴリごとの日次集計用マップ（設定済みカテゴリは0埋めで初期化）
    const categoryDataMap = new Map();
    categoryMetaMap.forEach((cat) => {
        categoryDataMap.set(cat.id, createZeroArray());
    });
    categoryDataMap.set(uncategorizedKey, createZeroArray());

    weeklyReceipts.forEach(receipt => {
        const receiptDate = new Date(receipt.date);
        const dayIndex = receiptDate.getDay() === 0 ? 6 : receiptDate.getDay() - 1; // 月=0, 日=6
        const amount = receipt.totalAmount || 0;
        const categoryId = receipt?.category?.id;
        const targetId = categoryMetaMap.has(categoryId) ? categoryId : uncategorizedKey;
        const dataArray = categoryDataMap.get(targetId) || categoryDataMap.get(uncategorizedKey);
        dataArray[dayIndex] += amount;
    });

    // dataset化（未分類以外は合計0の場合は省略して凡例をすっきりさせる）
    const categoryDatasets = Array.from(categoryDataMap.entries())
        .map(([id, data]) => {
            const meta = categoryMetaMap.get(id) || uncategorizedMeta;
            const total = data.reduce((sum, v) => sum + v, 0);
            if (id !== uncategorizedKey && total === 0) return null;
            return {
                label: meta.name || '未分類/その他',
                data,
                backgroundColor: meta.color || '#94a3b8',
                stack: 'spending'
            };
        })
        .filter(Boolean);

    // Chart.jsで描画
    if (this.weeklyChartInstance) {
        this.weeklyChartInstance.destroy();
    }

    this.weeklyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dayLabels,
            datasets: [
                ...categoryDatasets,
                {
                    label: '1日あたりの予算',
                    data: budgetLineData,
                    type: 'line',
                    borderColor: '#f59e0b',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    order: categoryDatasets.length + 1
                }
            ]
        },
        options: {
            responsive: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            const datasetLabel = context.dataset.label || '';
                            const amount = context.parsed.y || 0;
                            if (context.dataset.type === 'line') {
                                return `${datasetLabel}: ¥${amount.toLocaleString()}`;
                            }
                            return `${datasetLabel}: ¥${amount.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true,
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
};

/**
 * カレンダーを描画
 */
ReceiptApp.prototype.renderCalendar = function() {
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
            // 日付をYYYY-MM-DD形式に変換
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            this.showDateReceiptsModal(dateStr);
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
};

/**
 * カレンダーの日付セルを作成
 */
ReceiptApp.prototype.createCalendarDay = function(day, isOtherMonth, amount = null) {
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
};

/**
 * 最近のレシートを表示
 */
ReceiptApp.prototype.renderRecentReceipts = function() {
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
        const card = this.createReceiptCard(receipt);
        this.elements.receiptsContainer.appendChild(card);
    });
};

/**
 * レシートカードを作成
 */
ReceiptApp.prototype.createReceiptCard = function(receipt, showDeleteButton = false) {
    const card = document.createElement('div');
    card.className = 'receipt-card';
    card.dataset.receiptId = receipt.id;

    const settings = this.storage.getSettings();
    const category = settings.categories.find(c => c.id === receipt.category?.id) || settings.categories.find(c => c.id === 'other');
    const categoryColor = category?.color || '#6b7280';

    // カテゴリバッジの背景色を計算（透明度を加えたRGBA形式）
    const toRgba = (hex, alpha = 1) => {
        if (!hex || typeof hex !== 'string') return `rgba(107, 114, 128, ${alpha})`;
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
    const categoryBgColor = toRgba(categoryColor, 0.15);
    const categoryBorderColor = toRgba(categoryColor, 0.3);

    const hasImage = !!receipt.image;

    card.innerHTML = `
        <div class="receipt-thumb" ${hasImage ? 'data-has-image="true"' : ''}>
            ${hasImage
                ? `<img src="${receipt.image}" alt="レシート画像のサムネイル" />`
                : `<div class="receipt-thumb-placeholder" aria-label="画像なし">📄</div>`}
        </div>
        <div class="receipt-body">
            <div class="receipt-title">${receipt.merchant.name || '不明'}</div>
            <div class="receipt-meta">
                <span class="receipt-date">${new Date(receipt.date).toLocaleDateString('ja-JP')}</span>
                ${receipt.category ? `
                    <span class="meta-dot">•</span>
                    <span class="receipt-category-badge" style="--category-color: ${categoryColor}; --category-bg: ${categoryBgColor}; --category-border: ${categoryBorderColor};">${receipt.category.name || ''}</span>
                ` : ''}
            </div>
        </div>
        <div class="receipt-right">
            <div class="receipt-amount">¥${(receipt.totalAmount || 0).toLocaleString()}</div>
            ${showDeleteButton ? `
            <div class="receipt-actions">
                <button class="receipt-edit-btn" aria-label="編集" title="編集">✏️</button>
                <button class="receipt-delete-btn" aria-label="削除" title="削除">🗑️</button>
            </div>
            ` : ''}
        </div>
    `;

    // カードクリック時の処理（将来的に詳細表示・編集機能を追加可能）
    card.addEventListener('click', (e) => {
        // 削除ボタンクリック時はカードのクリックイベントを無視
        if (e.target.closest('.receipt-delete-btn')) {
            return;
        }
        console.log('Receipt clicked:', receipt.id);
        // 将来的に詳細表示・編集機能を実装
    });

    // 削除ボタンのイベントリスナー
    if (showDeleteButton) {
        const deleteBtn = card.querySelector('.receipt-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // カードのクリックイベントを防ぐ
                this.deleteReceipt(receipt.id, receipt.date);
            });
        }

        const editBtn = card.querySelector('.receipt-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // カードのクリックイベントを防ぐ
                this.startEditReceipt(receipt.id);
            });
        }
    }

    // サムネイルクリックで画像プレビュー
    if (hasImage) {
        const thumb = card.querySelector('.receipt-thumb');
        if (thumb) {
            thumb.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showImagePreview(receipt.image);
            });
        }
    }

    return card;
};

/**
 * 日付別レシート一覧モーダルを表示
 */
ReceiptApp.prototype.showDateReceiptsModal = function(dateStr) {
    const modal = document.getElementById('dateReceiptsModal');
    const title = document.getElementById('dateReceiptsModalTitle');
    const container = document.getElementById('dateReceiptsContainer');

    if (!modal || !title || !container) {
        console.error('Date receipts modal elements not found');
        return;
    }

    // タイトルを設定
    const date = new Date(dateStr);
    title.textContent = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日のレシート`;

    // その日のレシートを取得
    const receipts = this.storage.getReceiptsByDate(dateStr);

    // レシートを表示
    container.innerHTML = '';

    if (receipts.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">この日のレシートはありません</p>';
    } else {
        // 合計金額を計算
        const totalAmount = receipts.reduce((sum, r) => sum + (r.totalAmount || 0), 0);

        // 合計表示
        const totalEl = document.createElement('div');
        totalEl.className = 'date-receipts-total';
        totalEl.innerHTML = `
            <div class="date-receipts-total-label">合計</div>
            <div class="date-receipts-total-amount">¥${totalAmount.toLocaleString()}</div>
        `;
        container.appendChild(totalEl);

        // レシートカードを表示（削除ボタン付き）
        receipts.forEach(receipt => {
            const card = this.createReceiptCard(receipt, true);
            container.appendChild(card);
        });
    }

    // モーダルを表示
    modal.style.display = 'flex';

    // イベントリスナーは初回のみ登録（重複防止）
    if (!this.dateReceiptsModalInitialized) {
        // 閉じるボタンのイベントリスナー
        const closeBtn = document.getElementById('closeDateReceiptsBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideDateReceiptsModal();
            });
        }

        // 背景クリックで閉じる
        const overlay = modal.querySelector('.modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.hideDateReceiptsModal();
                }
            });
        }

        this.dateReceiptsModalInitialized = true;
    }

    // ESCキーで閉じる（モーダルが表示されている間のみ有効）
    const escHandler = (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            this.hideDateReceiptsModal();
        }
    };
    // 既存のESCハンドラを削除してから追加
    if (this.dateReceiptsModalEscHandler) {
        document.removeEventListener('keydown', this.dateReceiptsModalEscHandler);
    }
    this.dateReceiptsModalEscHandler = escHandler;
    document.addEventListener('keydown', escHandler);
};

/**
 * 日付別レシート一覧モーダルを非表示
 */
ReceiptApp.prototype.hideDateReceiptsModal = function() {
    const modal = document.getElementById('dateReceiptsModal');
    if (modal) {
        modal.style.display = 'none';
    }
    // ESCキーのイベントリスナーを削除
    if (this.dateReceiptsModalEscHandler) {
        document.removeEventListener('keydown', this.dateReceiptsModalEscHandler);
        this.dateReceiptsModalEscHandler = null;
    }
};

/**
 * すべてのレシート一覧モーダルを表示
 */
ReceiptApp.prototype.showAllReceiptsModal = function() {
    const modal = this.elements.allReceiptsModal;
    const container = this.elements.allReceiptsContainer;
    const closeBtn = this.elements.closeAllReceiptsBtn;

    if (!modal || !container) {
        console.error('All receipts modal elements not found');
        return;
    }

    const receipts = this.storage.getAllReceipts()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    container.innerHTML = '';

    if (receipts.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">まだレシートが登録されていません</p>';
    } else {
        receipts.forEach(receipt => {
            const card = this.createReceiptCard(receipt, true);
            container.appendChild(card);
        });
    }

    modal.style.display = 'flex';

    if (!this.allReceiptsModalInitialized) {
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideAllReceiptsModal();
            });
        }

        const overlay = modal.querySelector('.modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.hideAllReceiptsModal();
                }
            });
        }

        this.allReceiptsModalInitialized = true;
    }

    const escHandler = (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            this.hideAllReceiptsModal();
        }
    };
    if (this.allReceiptsModalEscHandler) {
        document.removeEventListener('keydown', this.allReceiptsModalEscHandler);
    }
    this.allReceiptsModalEscHandler = escHandler;
    document.addEventListener('keydown', escHandler);
};

/**
 * すべてのレシート一覧モーダルを非表示
 */
ReceiptApp.prototype.hideAllReceiptsModal = function() {
    const modal = this.elements.allReceiptsModal;
    if (modal) {
        modal.style.display = 'none';
    }
    if (this.allReceiptsModalEscHandler) {
        document.removeEventListener('keydown', this.allReceiptsModalEscHandler);
        this.allReceiptsModalEscHandler = null;
    }
};

/**
 * 画像プレビューを表示
 */
ReceiptApp.prototype.showImagePreview = function(src) {
    const modal = document.getElementById('imagePreviewModal');
    const img = document.getElementById('imagePreviewModalImg');
    const closeBtn = document.getElementById('closeImagePreviewBtn');

    if (!modal || !img || !closeBtn) {
        console.error('Image preview modal elements not found');
        return;
    }

    img.src = src;
    modal.style.display = 'flex';

    // 閉じるハンドラ
    const hide = () => this.hideImagePreview();

    // 既存リスナーをクリアしてから追加
    closeBtn.replaceWith(closeBtn.cloneNode(true));
    const newCloseBtn = document.getElementById('closeImagePreviewBtn');
    newCloseBtn.addEventListener('click', hide);

    const overlay = modal.querySelector('.modal-overlay');
    if (overlay) {
        overlay.replaceWith(overlay.cloneNode(true));
        modal.querySelector('.modal-overlay').addEventListener('click', hide);
    }

    // ESC
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            this.hideImagePreview();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
};

/**
 * 画像プレビューを非表示
 */
ReceiptApp.prototype.hideImagePreview = function() {
    const modal = document.getElementById('imagePreviewModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

/**
 * レシートを削除
 */
ReceiptApp.prototype.deleteReceipt = function(receiptId, receiptDate) {
    // 確認ダイアログ
    if (!confirm('このレシートを削除しますか？')) {
        return;
    }

    // レシートを削除
    this.storage.deleteReceipt(receiptId);

    // モーダルが開いている場合は更新
    const modal = document.getElementById('dateReceiptsModal');
    if (modal && modal.style.display === 'flex') {
        // 同じ日付でモーダルを再表示
        this.showDateReceiptsModal(receiptDate);
    }

    // ダッシュボードを更新
    this.updateDashboard();
};


