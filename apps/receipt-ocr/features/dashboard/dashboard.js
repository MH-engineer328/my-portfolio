/**
 * ダッシュボード関連機能
 * サマリー、週間グラフ、最新レシート表示
 */

// ReceiptAppクラスのプロトタイプにメソッドを追加

/**
 * サマリーカードを描画（今月の支出＋予算進捗）
 */
ReceiptApp.prototype.renderSummaryCard = function() {
    if (!this.elements.monthlyTotal) return;

    const now = new Date();
    const monthlyTotal = this.storage.getMonthlyTotal(now.getFullYear(), now.getMonth());
    this.elements.monthlyTotal.textContent = monthlyTotal.toLocaleString();

    const settings = this.storage.getSettings() || {};
    const weeklyBudget = Number(settings.weeklyBudget) || 0;
    const monthlyBudget = weeklyBudget > 0 ? weeklyBudget * 4 : 0;

    if (this.elements.budgetValue) {
        this.elements.budgetValue.textContent = monthlyBudget > 0
            ? `¥${monthlyBudget.toLocaleString()}`
            : '未設定';
    }

    const fill = this.elements.budgetProgressFill;
    const progressText = this.elements.budgetProgressText;
    const remainingText = this.elements.budgetRemainingText;
    if (!fill || !progressText || !remainingText) return;

    fill.classList.remove('is-warning', 'is-danger');

    if (monthlyBudget <= 0) {
        fill.style.width = '0%';
        progressText.textContent = '予算未設定';
        remainingText.textContent = '設定で週間予算を登録してください';
        return;
    }

    const ratio = monthlyTotal / monthlyBudget;
    const percent = Math.min(Math.round(ratio * 100), 200);
    const remaining = monthlyBudget - monthlyTotal;

    if (ratio >= 1) {
        fill.classList.add('is-danger');
    } else if (ratio >= 0.8) {
        fill.classList.add('is-warning');
    }

    fill.style.width = `${Math.min(percent, 110)}%`;
    progressText.textContent = `消化率 ${percent}%`;
    remainingText.textContent = remaining >= 0
        ? `予算残高: ¥${remaining.toLocaleString()}`
        : `予算超過: ¥${Math.abs(remaining).toLocaleString()}`;
};

/**
 * 週間グラフを描画
 */
ReceiptApp.prototype.renderWeeklyChart = function() {
    if (!this.elements.weeklyChart) return;
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
    const weeklyBudget = Number(settings.weeklyBudget) || 0;

    const dayLabels = ['月', '火', '水', '木', '金', '土', '日'];
    const dailyBudget = weeklyBudget / 7;
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
                    borderWidth: 2.5,
                    borderDash: [6, 6],
                    tension: 0.35,
                    fill: false,
                    pointRadius: 3,
                    pointHoverRadius: 4,
                    order: categoryDatasets.length + 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 8,
                    right: 12,
                    left: 8,
                    bottom: 12
                }
            },
            elements: {
                bar: {
                    borderRadius: 10
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        color: '#374151',
                        padding: 16,
                        font: {
                            size: 12
                        }
                    }
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
                    stacked: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#4b5563'
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '¥' + value.toLocaleString();
                        },
                        color: '#4b5563'
                    },
                    grid: {
                        color: function(context) {
                            if (!weeklyBudget) return 'rgba(148, 163, 184, 0.25)';
                            const dailyBudget = weeklyBudget / 7;
                            if (Math.abs(context.tick.value - dailyBudget) < 10) {
                                return '#f59e0b';
                            }
                            return 'rgba(148, 163, 184, 0.25)';
                        }
                    }
                }
            }
        }
    });
};

/**
 * 最近のレシートを表示
 */
ReceiptApp.prototype.renderRecentReceipts = function() {
    if (!this.elements.receiptsContainer) return;

    const receipts = this.storage.getAllReceipts() || [];
    const normalizeDate = (value) => {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return null;
        d.setHours(0, 0, 0, 0);
        return d;
    };
    const formatKey = (d) => d.toISOString().slice(0, 10);
    const isSameDay = (a, b) => a.getTime() === b.getTime();
    const isYesterday = (target) => {
        const y = new Date();
        y.setHours(0, 0, 0, 0);
        y.setDate(y.getDate() - 1);
        return isSameDay(target, y);
    };

    const sorted = receipts
        .filter(r => r && (r.date || r.createdAt))
        .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    const recent = sorted.slice(0, 12);

    this.elements.receiptsContainer.innerHTML = '';

    if (recent.length === 0) {
        this.elements.receiptsContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 1rem 0;">まだレシートが登録されていません</p>';
        return;
    }

    // 日付キーでグルーピング
    const grouped = recent.reduce((map, receipt) => {
        const d = normalizeDate(receipt.date || receipt.createdAt);
        if (!d) return map;
        const key = formatKey(d);
        if (!map.has(key)) {
            map.set(key, []);
        }
        map.get(key).push(receipt);
        return map;
    }, new Map());

    // 日付降順で描画
    const today = normalizeDate(new Date());
    const dateKeys = Array.from(grouped.keys()).sort((a, b) => new Date(b) - new Date(a));
    const fragment = document.createDocumentFragment();

    dateKeys.forEach((dateKey) => {
        const group = document.createElement('div');
        group.className = 'timeline-group';

        const header = document.createElement('div');
        header.className = 'timeline-date-header';

        const dateObj = normalizeDate(dateKey);
        const labelBase = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
        const labelText = isSameDay(dateObj, today)
            ? `今日 (${labelBase})`
            : isYesterday(dateObj)
                ? `昨日 (${labelBase})`
                : labelBase;

        header.innerHTML = `
            <span class="timeline-date-label ${isSameDay(dateObj, today) ? 'is-today' : ''}">${labelText}</span>
        `;

        const itemsWrapper = document.createElement('div');
        itemsWrapper.className = 'timeline-items';

        grouped.get(dateKey).forEach((receipt) => {
            const item = this.createTimelineItem(receipt);
            itemsWrapper.appendChild(item);
        });

        group.appendChild(header);
        group.appendChild(itemsWrapper);
        fragment.appendChild(group);
    });

    this.elements.receiptsContainer.appendChild(fragment);
};

/**
 * タイムライン用のレシート行を生成
 */
ReceiptApp.prototype.createTimelineItem = function(receipt) {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    item.dataset.receiptId = receipt.id;

    const formatRelativeDay = (dateObj) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(dateObj);
        target.setHours(0, 0, 0, 0);
        const diff = (today - target) / (1000 * 60 * 60 * 24);
        if (diff === 0) return '今日';
        if (diff === 1) return '昨日';
        return null;
    };

    const settings = this.storage.getSettings();
    const categories = settings.categories || [];
    const category = categories.find(c => c.id === receipt.category?.id) || categories.find(c => c.id === 'other');
    const categoryColor = category?.color || '#3b82f6';
    const toRgba = (hex, alpha = 1) => {
        if (!hex || typeof hex !== 'string') return `rgba(59, 130, 246, ${alpha})`;
        let c = hex.replace('#', '');
        if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
        if (c.length !== 6) return `rgba(59, 130, 246, ${alpha})`;
        const num = parseInt(c, 16);
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const iconMap = {
        food: '🍚',
        daily: '🧻',
        restaurant: '🍽️',
        cafe: '☕',
        transport: '🚌',
        other: '🧾'
    };
    const icon = iconMap[category?.id] || '🧾';
    const date = new Date(receipt.date);
    const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;
    const relative = formatRelativeDay(date);
    const categoryBgColor = toRgba(categoryColor, 0.16);
    const categoryBorderColor = toRgba(categoryColor, 0.32);

    item.innerHTML = `
        <div class="timeline-icon" style="--icon-color: ${categoryColor}; --icon-bg: ${toRgba(categoryColor, 0.12)}; --icon-border: ${toRgba(categoryColor, 0.28)};">
            ${icon}
        </div>
        <div class="timeline-body">
            <div class="timeline-title">${receipt.merchant?.name || '不明な店舗'}</div>
            <div class="timeline-meta">
                <span class="timeline-date">${dateLabel}</span>
                ${relative ? `<span class="timeline-relative">${relative}</span>` : ''}
                <span class="timeline-category-badge" style="--category-color:${categoryColor}; --category-bg:${categoryBgColor}; --category-border:${categoryBorderColor};">${receipt.category?.name || 'その他'}</span>
            </div>
        </div>
        <div class="timeline-amount">¥${(receipt.totalAmount || 0).toLocaleString()}</div>
    `;

    item.addEventListener('click', () => {
        console.log('Receipt clicked:', receipt.id);
        // 将来的に詳細表示を追加予定
    });

    return item;
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


