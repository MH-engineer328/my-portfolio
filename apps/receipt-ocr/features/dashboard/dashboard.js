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
ReceiptApp.prototype.createReceiptCard = function(receipt) {
    const card = document.createElement('div');
    card.className = 'receipt-card';
    card.dataset.receiptId = receipt.id;

    const settings = this.storage.getSettings();
    const category = settings.categories.find(c => c.id === receipt.category?.id) || settings.categories.find(c => c.id === 'other');
    const categoryColor = category?.color || '#6b7280';

    card.innerHTML = `
        <div class="receipt-info">
            <div class="receipt-merchant">${receipt.merchant.name || '不明'}</div>
            <div class="receipt-date">${new Date(receipt.date).toLocaleDateString('ja-JP')}</div>
            ${receipt.category ? `<div class="receipt-category" style="color: ${categoryColor};">${receipt.category.name || ''}</div>` : ''}
        </div>
        <div class="receipt-amount">¥${(receipt.totalAmount || 0).toLocaleString()}</div>
    `;

    // カードクリック時の処理（将来的に詳細表示・編集機能を追加可能）
    card.addEventListener('click', () => {
        console.log('Receipt clicked:', receipt.id);
        // 将来的に詳細表示・編集機能を実装
    });

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

        // レシートカードを表示
        receipts.forEach(receipt => {
            const card = this.createReceiptCard(receipt);
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

