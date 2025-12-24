/**
 * ダッシュボード関連機能
 * サマリー、週間グラフ、最新レシート表示
 */

// ReceiptAppクラスのプロトタイプにメソッドを追加

// HEX → RGBA 変換（不正値はブルー系にフォールバック）
const hexToRgba = (hex, alpha = 1, fallbackHex = '#3b82f6') => {
    if (!hex || typeof hex !== 'string') {
        return hexToRgba(fallbackHex, alpha, fallbackHex);
    }
    let normalized = hex.trim().replace('#', '');
    if (normalized.length === 3) {
        normalized = normalized.split('').map(ch => ch + ch).join('');
    }
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
        return hexToRgba(fallbackHex, alpha, fallbackHex);
    }
    const num = parseInt(normalized, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// 設定からカテゴリ情報を取得（見つからない場合は other を返す）
const findCategorySetting = (settings = {}, categoryId) => {
    const categories = settings.categories || [];
    return categories.find(c => c.id === categoryId) || categories.find(c => c.id === 'other') || null;
};

/**
 * サマリーカードを描画（今月の支出＋予算進捗）
 */
ReceiptApp.prototype.renderSummaryCard = function() {
    if (!this.elements.monthlyTotal) return;

    const displayDate = this.currentMonth || new Date();
    const monthlyTotal = this.storage.getMonthlyTotal(displayDate.getFullYear(), displayDate.getMonth());
    this.elements.monthlyTotal.textContent = monthlyTotal.toLocaleString();

    const settings = this.storage.getSettings() || {};
    const weeklyBudget = Number(settings.weeklyBudget) || 0;
    const monthlyBudget = weeklyBudget > 0 ? weeklyBudget * 4 : 0;

    const progressBar = this.elements.budgetProgressBar;
    const progressText = this.elements.budgetProgressText;
    const remainingLabel = this.elements.budgetRemainingLabel;
    const remainingText = this.elements.budgetRemainingText;
    const budgetTotalEl = this.elements.monthlyBudgetTotal;
    const progressContainer = this.elements.budgetProgressContainer;
    const forecastMarker = this.elements.budgetForecastMarker;
    const forecastLine = this.elements.budgetForecastLine;
    const forecastDot = this.elements.budgetForecastDot;
    const forecastRow = this.elements.budgetForecastRow;
    const forecastText = this.elements.budgetForecastText;

    if (!progressBar || !progressText || !remainingText) return;

    if (budgetTotalEl) {
        budgetTotalEl.textContent = `¥${monthlyBudget.toLocaleString()}`;
    }

    if (monthlyBudget <= 0) {
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        remainingText.textContent = '¥0';
        if (progressContainer) progressContainer.classList.remove('is-over');
        if (forecastMarker) {
            forecastMarker.style.opacity = '0';
            forecastMarker.title = '';
        }
        if (forecastRow) forecastRow.style.display = 'none';
        return;
    }

    const remaining = monthlyBudget - monthlyTotal;
    const spentRatio = monthlyTotal / monthlyBudget;
    const displayRatio = Math.min(spentRatio, 1); // バーは100%で止める

    // バーの幅を支出割合に設定
    progressBar.style.width = `${displayRatio * 100}%`;

    // 進捗率に応じたクラス制御
    const summaryCard = document.getElementById('summaryCard');
    if (summaryCard) {
        summaryCard.classList.remove('is-low', 'is-medium', 'is-over');
        if (spentRatio >= 1) {
            summaryCard.classList.add('is-over');
        } else if (spentRatio >= 0.5) {
            summaryCard.classList.add('is-medium');
        } else {
            summaryCard.classList.add('is-low');
        }
    }

    // テキスト表示を更新
    progressText.textContent = `${Math.round(spentRatio * 100)}%`;

    if (remaining >= 0) {
        remainingText.textContent = `¥${remaining.toLocaleString()}`;
        if (remainingLabel) remainingLabel.textContent = '残り:';
        if (progressContainer) progressContainer.classList.remove('is-over');
    } else {
        remainingText.textContent = `¥${Math.abs(remaining).toLocaleString()}`;
        if (remainingLabel) remainingLabel.textContent = '超過:';
        if (progressContainer) progressContainer.classList.add('is-over');
    }

    /**
     * 月末予測ライン（案3）
     * - 現在までの平均ペース（月初〜今日）から月末の合計を推定
     * - 予算に対する「月末時点の到達点」をバー上に縦線で表示
     */
    const now = new Date();
    const isCurrentMonth = displayDate.getFullYear() === now.getFullYear() && displayDate.getMonth() === now.getMonth();
    
    const dayOfMonth = isCurrentMonth ? Math.max(1, now.getDate()) : 30; // 過去月なら便宜上30日とするが、基本非表示にする
    const daysInMonth = new Date(displayDate.getFullYear(), displayDate.getMonth() + 1, 0).getDate();
    const forecastTotal = (monthlyTotal / (isCurrentMonth ? dayOfMonth : daysInMonth)) * daysInMonth;
    const forecastRatio = monthlyBudget > 0 ? (forecastTotal / monthlyBudget) : 0;
    const forecastDisplayRatio = Math.min(Math.max(forecastRatio, 0), 1); // 表示位置は0〜100%に丸める
    const showForecast = isCurrentMonth && monthlyTotal > 0 && Number.isFinite(forecastRatio);
    const isForecastOver = forecastRatio > 1;

    if (forecastMarker) {
        if (showForecast) {
            forecastMarker.style.left = `${forecastDisplayRatio * 100}%`;
            forecastMarker.style.transform = 'translateX(-50%)';
            forecastMarker.style.opacity = '1';
            forecastMarker.title = `月末予想: ¥${Math.round(forecastTotal).toLocaleString()}（予算比 ${Math.round(forecastRatio * 100)}%）`;
        } else {
            forecastMarker.style.opacity = '0';
            forecastMarker.title = '';
        }
    }

    // 超過見込みならアンバー系に（カードの雰囲気に合わせて控えめに）
    if (forecastLine) {
        forecastLine.style.background = isForecastOver ? 'rgba(245, 158, 11, 0.75)' : '';
    }
    if (forecastDot) {
        forecastDot.style.background = isForecastOver ? '#f59e0b' : '';
        forecastDot.style.boxShadow = isForecastOver
            ? '0 0 0 3px rgba(245, 158, 11, 0.18)'
            : '';
    }

    if (forecastRow && forecastText) {
        if (showForecast) {
            forecastRow.style.display = 'flex';
            forecastText.textContent = `¥${Math.round(forecastTotal).toLocaleString()}（${Math.round(forecastRatio * 100)}%）`;
        } else {
            forecastRow.style.display = 'none';
            forecastText.textContent = '-';
        }
    }
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

    // 期間ラベルを更新（12/4 - 12/10 形式）
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const rangeLabel = document.getElementById('weeklyRangeLabel');
    if (rangeLabel) {
        rangeLabel.textContent = `${monday.getMonth() + 1}/${monday.getDate()} - ${sunday.getMonth() + 1}/${sunday.getDate()}`;
    }

    // 週間データを取得
    const weeklyReceipts = this.storage.getWeeklyReceipts(monday);
    const settings = this.storage.getSettings();
    const weeklyBudget = Number(settings.weeklyBudget) || 0;

    const dayLabels = ['月', '火', '水', '木', '金', '土', '日'];
    const todayIndex = (() => {
        const d = new Date();
        const dow = d.getDay(); // 0=日
        return dow === 0 ? 6 : dow - 1; // 月=0, 日=6
    })();
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

    // 週間レポート：画像のような青い吹き出し（常時表示）
    const getOrCreateWeeklyBubble = (chart) => {
        const parent = chart.canvas.parentNode;
        let el = parent.querySelector('.weekly-tooltip-bubble');
        if (!el) {
            el = document.createElement('div');
            el.className = 'weekly-tooltip-bubble';
            parent.appendChild(el);
        }
        return el;
    };

    const weeklyBubblePlugin = {
        id: 'weeklyBubble',
        afterDatasetsDraw(chart) {
            const bubble = getOrCreateWeeklyBubble(chart);

            // 各曜日の合計（棒グラフのみ。予算ラインは除外）
            const totals = new Array(chart.data.labels.length).fill(0);
            chart.data.datasets.forEach(ds => {
                if (ds.type === 'line') return;
                ds.data.forEach((value, i) => {
                    totals[i] += (Number(value) || 0);
                });
            });

            // 表示する曜日（基本: 今日 / 今日が0なら最大値）
            let idx = todayIndex;
            if ((totals[idx] || 0) <= 0) {
                let max = 0;
                let maxIdx = -1;
                totals.forEach((t, i) => {
                    if (t > max) { max = t; maxIdx = i; }
                });
                idx = maxIdx;
            }

            if (idx == null || idx < 0 || (totals[idx] || 0) <= 0) {
                bubble.classList.remove('is-visible');
                return;
            }

            const total = totals[idx];
            bubble.textContent = `¥${total.toLocaleString()}`;

            const xPos = chart.scales.x.getPixelForTick(idx);
            const yPos = chart.scales.y.getPixelForValue(total);

            // 位置微調整：右に寄せ、棒グラフから少し上に浮かせる
            const offsetX = 12 // 右に寄せる量
            const offsetY = 10; // 上に上げる量
            bubble.style.left = `${xPos + offsetX}px`;
            bubble.style.top = `${yPos - offsetY}px`;
            bubble.classList.add('is-visible');
        }
    };

    // 棒グラフを描画
    this.weeklyChartInstance = new Chart(ctx, {
        type: 'bar',
        plugins: [weeklyBubblePlugin],
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
                    top: 20, // ラベル表示スペース確保のため少し広げる
                    right: 12,
                    left: 8,
                    bottom: 12
                }
            },
            elements: {
                bar: {
                    borderRadius: 4
                }
            },
            barPercentage: 0.7,
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
                    enabled: false
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: (ctx) => (ctx.index === todayIndex ? '#2563eb' : '#111827'),
                        font: (ctx) => (ctx.index === todayIndex ? { weight: '800' } : { weight: '600' })
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '¥' + value.toLocaleString();
                        },
                        color: '#111827',
                        maxTicksLimit: 5
                    },
                    grid: {
                        borderDash: [2, 2],
                        color: function(context) {
                            if (!weeklyBudget) return '#e5e7eb';
                            const dailyBudget = weeklyBudget / 7;
                            if (Math.abs(context.tick.value - dailyBudget) < 10) {
                                return '#f59e0b';
                            }
                            return '#e5e7eb';
                        }
                    },
                    border: {
                        display: false
                    }
                }
            }
        }
    });
};

/**
 * 履歴画面のリストを描画
 */
ReceiptApp.prototype.renderHistoryList = function() {
    if (!this.elements.historyListContainer) return;

    // カテゴリフィルタの初期化（初回のみ）
    if (!this.historyFiltersInitialized) {
        this.initHistoryFilters();
    }

    const query = this.elements.historySearchInput ? this.elements.historySearchInput.value.toLowerCase() : '';
    const selectedCategory = this.currentHistoryCategory || 'all';

    let receipts = this.storage.getAllReceipts() || [];

    // 検索フィルタ
    if (query) {
        receipts = receipts.filter(r => 
            (r.merchant?.name || '').toLowerCase().includes(query) ||
            (r.memo || '').toLowerCase().includes(query)
        );
    }

    // カテゴリフィルタ
    if (selectedCategory !== 'all') {
        receipts = receipts.filter(r => r.category?.id === selectedCategory);
    }

    // ソート（日付降順）
    receipts.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

    // サマリーの更新
    this.updateHistorySummary(receipts);

    this.elements.historyListContainer.innerHTML = '';

    if (receipts.length === 0) {
        this.elements.historyListContainer.innerHTML = '<p class="text-center text-slate-400 py-12">履歴が見つかりません</p>';
        return;
    }

    // 日付別にグルーピング
    const grouped = receipts.reduce((map, receipt) => {
        const d = new Date(receipt.date || receipt.createdAt);
        if (isNaN(d.getTime())) return map;
        d.setHours(0, 0, 0, 0);
        const key = d.getTime();
        if (!map.has(key)) {
            map.set(key, {
                date: d,
                receipts: [],
                total: 0
            });
        }
        const data = map.get(key);
        data.receipts.push(receipt);
        data.total += (receipt.totalAmount || 0);
        return map;
    }, new Map());

    const dateKeys = Array.from(grouped.keys()).sort((a, b) => b - a);
    const fragment = document.createDocumentFragment();

    dateKeys.forEach(key => {
        const data = grouped.get(key);
        
        // 日付ヘッダー
        const dateHeader = document.createElement('div');
        dateHeader.className = 'flex justify-between items-center mt-4 mb-2 px-1';
        const dateStr = `${data.date.getMonth() + 1}月${data.date.getDate()}日`;
        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][data.date.getDay()];
        
        dateHeader.innerHTML = `
            <span class="text-sm font-bold text-slate-500">${dateStr} (${dayOfWeek})</span>
            <span class="text-xs font-bold text-slate-400">¥${data.total.toLocaleString()}</span>
        `;
        fragment.appendChild(dateHeader);

        // レシートアイテム
        data.receipts.forEach(receipt => {
            const item = this.createReceiptCard(receipt, true);
            fragment.appendChild(item);
        });
    });

    this.elements.historyListContainer.appendChild(fragment);
};

/**
 * 履歴画面のカテゴリフィルタを初期化
 */
ReceiptApp.prototype.initHistoryFilters = function() {
    if (!this.elements.historyCategoryFilters) return;

    const settings = this.storage.getSettings() || {};
    const categories = settings.categories || [];

    const container = this.elements.historyCategoryFilters;
    // 「すべて」ボタンは既にあるので、それ以外のカテゴリを追加
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'px-4 py-2 rounded-full bg-white border border-slate-200 text-sm font-bold text-slate-600 whitespace-nowrap transition-all active:scale-95 [&.active]:bg-primary [&.active]:text-white [&.active]:border-primary';
        btn.dataset.category = cat.id;
        btn.textContent = cat.name;
        
        btn.addEventListener('click', () => {
            // 他のボタンのactiveを解除
            container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.currentHistoryCategory = cat.id;
            this.renderHistoryList();
        });
        
        container.appendChild(btn);
    });

    // 「すべて」ボタンのイベント
    const allBtn = container.querySelector('[data-category="all"]');
    if (allBtn) {
        allBtn.addEventListener('click', () => {
            container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            this.currentHistoryCategory = 'all';
            this.renderHistoryList();
        });
    }

    this.historyFiltersInitialized = true;
};

/**
 * 履歴画面のサマリー（合計・件数）を更新
 */
ReceiptApp.prototype.updateHistorySummary = function(filteredReceipts) {
    if (!this.elements.historyMonthlyTotal || !this.elements.historyMonthlyCount) return;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 表示中の月（フィルタがかかっていない場合は今月）のデータを集計
    // ここでは単純に「現在表示されているリスト」の合計を表示する形にする
    // （検索結果が反映されるので分かりやすい）
    const total = filteredReceipts.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    const count = filteredReceipts.length;

    this.elements.historyMonthlyTotal.textContent = `¥${total.toLocaleString()}`;
    this.elements.historyMonthlyCount.textContent = `${count}件`;
    
    if (this.elements.historySummaryLabel) {
        const query = this.elements.historySearchInput?.value;
        if (query) {
            this.elements.historySummaryLabel.textContent = `「${query}」の検索結果`;
        } else {
            this.elements.historySummaryLabel.textContent = '全期間の合計支出';
        }
    }
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
    // 日付キーはローカルタイムの深夜0時のタイムスタンプで保持し、UTC変換による日付ズレを防ぐ
    const formatKey = (d) => d.getTime();
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
            map.set(key, {
                receipts: [],
                dailyTotal: 0
            });
        }
        const data = map.get(key);
        data.receipts.push(receipt);
        data.dailyTotal += (receipt.totalAmount || 0);
        return map;
    }, new Map());

    // 日付降順で描画
    const today = normalizeDate(new Date());
    const dateKeys = Array.from(grouped.keys()).sort((a, b) => b - a);
    const fragment = document.createDocumentFragment();

    dateKeys.forEach((dateKey, index) => {
        const data = grouped.get(dateKey);
        const dateObj = new Date(Number(dateKey));
        const isLatest = index === 0;

        const group = document.createElement('div');
        group.className = `timeline-group accordion ${isLatest ? 'is-expanded' : ''}`;

        const header = document.createElement('div');
        header.className = 'timeline-date-header accordion-toggle';

        const labelBase = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
        const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()];
        const labelText = isSameDay(dateObj, today)
            ? `今日 (${labelBase} ${dayOfWeek})`
            : isYesterday(dateObj)
                ? `昨日 (${labelBase} ${dayOfWeek})`
                : `${labelBase} ${dayOfWeek}`;

        header.innerHTML = `
            <div class="timeline-date-info">
                <span class="timeline-date-label ${isSameDay(dateObj, today) ? 'is-today' : ''}">${labelText}</span>
            </div>
            <div class="timeline-date-summary">
                <span class="timeline-daily-total">¥${data.dailyTotal.toLocaleString()}</span>
                <span class="accordion-icon">▼</span>
            </div>
        `;

        const itemsWrapper = document.createElement('div');
        itemsWrapper.className = 'timeline-items accordion-content';

        // 最新の日付以外は初期状態で高さを0にする（CSSで制御するがJSでも初期状態を設定）
        if (!isLatest) {
            itemsWrapper.style.maxHeight = '0px';
        }

        data.receipts.forEach((receipt) => {
            const item = this.createTimelineItem(receipt);
            itemsWrapper.appendChild(item);
        });

        header.addEventListener('click', () => {
            const isExpanded = group.classList.toggle('is-expanded');
            if (isExpanded) {
                itemsWrapper.style.maxHeight = itemsWrapper.scrollHeight + 'px';
            } else {
                itemsWrapper.style.maxHeight = '0px';
            }
        });

        group.appendChild(header);
        group.appendChild(itemsWrapper);
        fragment.appendChild(group);

        // 描画後に高さを正しく設定するための調整（最新分）
        if (isLatest) {
            setTimeout(() => {
                itemsWrapper.style.maxHeight = itemsWrapper.scrollHeight + 'px';
            }, 0);
        }
    });

    this.elements.receiptsContainer.appendChild(fragment);
};

/**
 * タイムライン用のレシート行を生成（コンパクト版）
 */
ReceiptApp.prototype.createTimelineItem = function(receipt) {
    const item = document.createElement('div');
    item.className = 'timeline-item is-compact';
    item.dataset.receiptId = receipt.id;

    const settings = this.storage.getSettings() || {};
    const categorySetting = findCategorySetting(settings, receipt.category?.id);
    const categoryId = receipt.category?.id || categorySetting?.id;

    const ui = (typeof window.getCategoryUI === 'function') ? window.getCategoryUI(categoryId) : null;
    const iconHtml = (typeof window.renderCategoryIconHtml === 'function')
        ? window.renderCategoryIconHtml(categoryId)
        : '🧾';
    const colorClass = ui?.color || '';

    item.innerHTML = `
        <div class="timeline-icon ${colorClass}">${iconHtml}</div>
        <div class="timeline-body">
            <div class="timeline-title" style="font-size: 0.9rem;">${receipt.merchant?.name || '不明な店舗'}</div>
        </div>
        <div class="timeline-amount" style="font-size: 0.95rem;">¥${(receipt.totalAmount || 0).toLocaleString()}</div>
    `;

    item.addEventListener('click', () => {
        console.log('Receipt clicked:', receipt.id);
    });

    return item;
};

/**
 * レシート履歴の折りたたみ機能を初期化
 */
ReceiptApp.prototype.initCollapsibleHistory = function() {
    const header = document.getElementById('recentSectionHeader');
    const section = document.getElementById('recentSection');
    if (!header || !section) return;

    // 初期状態を読み込み
    const isCollapsed = localStorage.getItem('recentSectionCollapsed') === 'true';
    if (isCollapsed) {
        section.classList.add('is-collapsed');
    }

    header.addEventListener('click', () => {
        const collapsed = section.classList.toggle('is-collapsed');
        localStorage.setItem('recentSectionCollapsed', collapsed);
    });
};

/**
 * レシートカードを作成
 */
ReceiptApp.prototype.createReceiptCard = function(receipt, showDeleteButton = false) {
    const card = document.createElement('div');
    card.className = 'receipt-card';
    card.dataset.receiptId = receipt.id;

    const settings = this.storage.getSettings() || {};
    const categorySetting = findCategorySetting(settings, receipt.category?.id);
    const categoryColor = categorySetting?.color || '#6b7280';
    const categoryName = receipt.category?.name || categorySetting?.name || '';
    const categoryBgColor = hexToRgba(categoryColor, 0.15, '#6b7280');
    const categoryBorderColor = hexToRgba(categoryColor, 0.3, '#6b7280');

    const categoryId = receipt.category?.id || categorySetting?.id || 'other';
    const ui = (typeof window.getCategoryUI === 'function') ? window.getCategoryUI(categoryId) : null;
    const iconHtml = (typeof window.renderCategoryIconHtml === 'function')
        ? window.renderCategoryIconHtml(categoryId)
        : '🧾';
    const colorClass = ui?.color || '';

    const date = new Date(receipt.date);
    const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;

    card.innerHTML = `
        <div class="receipt-icon ${colorClass}">${iconHtml}</div>
        <div class="receipt-body">
            <div class="receipt-title">${receipt.merchant.name || '不明'}</div>
            <div class="receipt-meta">
                <span class="receipt-date">${dateLabel}</span>
                ${receipt.category ? `
                    <span class="receipt-category-badge" style="background:${categoryBgColor}; color:${categoryColor}; border:1px solid ${categoryBorderColor};">${categoryName}</span>
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

/**
 * 予算設定ボトムシートの初期化
 */
ReceiptApp.prototype.initBudgetBottomSheet = function() {
    const editBtn = document.getElementById('budgetEditBtn');
    const sheet = document.getElementById('budgetBottomSheet');
    const overlay = document.getElementById('budgetSheetOverlay');
    const closeBtn = document.getElementById('closeBudgetSheetBtn');
    const saveBtn = document.getElementById('saveBudgetBtn');
    const input = document.getElementById('bottomSheetWeeklyBudget');

    if (!editBtn || !sheet || !overlay || !closeBtn || !saveBtn || !input) {
        return;
    }

    // 編集ボタンクリック
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // サマリーカード全体のクリックイベントを防ぐ
        this.showBudgetBottomSheet();
    });

    // 閉じるボタン
    closeBtn.addEventListener('click', () => this.hideBudgetBottomSheet());

    // オーバーレイクリック
    overlay.addEventListener('click', () => this.hideBudgetBottomSheet());

    // 保存ボタン
    saveBtn.addEventListener('click', () => this.saveWeeklyBudget());

    // Enterキーで保存
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            this.saveWeeklyBudget();
        }
    });
};

/**
 * 予算設定ボトムシートを表示
 */
ReceiptApp.prototype.showBudgetBottomSheet = function() {
    const sheet = document.getElementById('budgetBottomSheet');
    const input = document.getElementById('bottomSheetWeeklyBudget');

    if (!sheet || !input) return;

    // 現在の設定値を反映
    const settings = this.storage.getSettings();
    input.value = settings.weeklyBudget || 10000;

    sheet.style.display = 'flex';
    // ブラウザの描画を待ってからクラスを付与（アニメーションのため）
    setTimeout(() => {
        sheet.classList.add('is-visible');
        input.focus();
        input.select();
    }, 10);
};

/**
 * 予算設定ボトムシートを非表示
 */
ReceiptApp.prototype.hideBudgetBottomSheet = function() {
    const sheet = document.getElementById('budgetBottomSheet');
    if (!sheet) return;

    sheet.classList.remove('is-visible');
    // アニメーション完了後に非表示にする
    setTimeout(() => {
        sheet.style.display = 'none';
    }, 300);
};

/**
 * 週間予算を保存
 */
ReceiptApp.prototype.saveWeeklyBudget = function() {
    const input = document.getElementById('bottomSheetWeeklyBudget');
    if (!input) return;

    const newBudget = parseInt(input.value) || 0;
    if (newBudget < 0) {
        alert('予算は0円以上で入力してください。');
        return;
    }

    // 設定を更新して保存
    const settings = this.storage.getSettings();
    settings.weeklyBudget = newBudget;
    this.storage.saveSettings(settings);

    // 分類器などの設定も更新（必要に応じて）
    if (this.classifier) {
        this.classifier.settings = settings;
    }

    // UIを更新
    this.updateDashboard();

    // ボトムシートを閉じる
    this.hideBudgetBottomSheet();

    console.log('Budget updated:', newBudget);
};

/**
 * カレンダーモーダルを表示
 */
ReceiptApp.prototype.showCalendarModal = function() {
    const modal = document.getElementById('calendarModal');
    if (!modal) {
        console.error('Calendar modal not found');
        return;
    }

    // 現在の日付でカレンダーを初期化
    this.calendarCurrentMonth = new Date();
    // 初期表示は「今日」を選択して、当日分リストをすぐ見せる（導線改善）
    this.calendarSelectedDate = this.formatDateForStorage(new Date());
    this.renderCalendar();
    // 下段のリストを更新（renderCalendar内で選択状態は反映されるが、リストは別で描画）
    this.renderCalendarSelectedDayList(this.calendarSelectedDate);

    modal.style.display = 'flex';

    // イベントリスナーは初回のみ登録（重複防止）
    if (!this.calendarModalInitialized) {
        const closeBtn = document.getElementById('closeCalendarBtn');
        const prevBtn = document.getElementById('calendarPrevBtn');
        const nextBtn = document.getElementById('calendarNextBtn');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideCalendarModal();
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.calendarCurrentMonth.setMonth(this.calendarCurrentMonth.getMonth() - 1);
                this.renderCalendar();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.calendarCurrentMonth.setMonth(this.calendarCurrentMonth.getMonth() + 1);
                this.renderCalendar();
            });
        }

        // 背景クリックで閉じる
        const overlay = modal.querySelector('.modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.hideCalendarModal();
                }
            });
        }

        this.calendarModalInitialized = true;
    }

    // ESCキーで閉じる
    const escHandler = (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            this.hideCalendarModal();
        }
    };
    if (this.calendarModalEscHandler) {
        document.removeEventListener('keydown', this.calendarModalEscHandler);
    }
    this.calendarModalEscHandler = escHandler;
    document.addEventListener('keydown', escHandler);
};

/**
 * カレンダーモーダルを非表示
 */
ReceiptApp.prototype.hideCalendarModal = function() {
    const modal = document.getElementById('calendarModal');
    if (modal) {
        modal.style.display = 'none';
    }
    // 詳細セクションはレイアウト上「常設」だが、閉じる際は中身をリセット
    this.calendarSelectedDate = null;
    this.renderCalendarSelectedDayList(null);
    // ESCキーのイベントリスナーを削除
    if (this.calendarModalEscHandler) {
        document.removeEventListener('keydown', this.calendarModalEscHandler);
        this.calendarModalEscHandler = null;
    }
};

/**
 * カレンダーを描画
 */
ReceiptApp.prototype.renderCalendar = function() {
    const grid = document.getElementById('calendarGrid');
    const monthLabel = document.getElementById('calendarMonth');
    if (!grid || !monthLabel) {
        console.error('Calendar elements not found');
        return;
    }

    const year = this.calendarCurrentMonth.getFullYear();
    const month = this.calendarCurrentMonth.getMonth();

    // 月ラベルを更新
    monthLabel.textContent = `${year}年${month + 1}月`;

    // すべてのレシートを取得して日付別に集計
    const receipts = this.storage.getAllReceipts() || [];
    const dailyTotals = new Map();

    receipts.forEach(receipt => {
        if (!receipt.date) return;
        const dateStr = receipt.date; // YYYY-MM-DD形式
        const amount = receipt.totalAmount || 0;
        if (dailyTotals.has(dateStr)) {
            dailyTotals.set(dateStr, dailyTotals.get(dateStr) + amount);
        } else {
            dailyTotals.set(dateStr, amount);
        }
    });

    // カレンダーグリッドをクリア
    grid.innerHTML = '';

    // 曜日ヘッダー
    const dayHeaders = ['日', '月', '火', '水', '木', '金', '土'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        grid.appendChild(header);
    });

    // 月の最初の日と最後の日を取得
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay(); // 0=日曜日
    const daysInMonth = lastDay.getDate();

    // 前月の最後の日を取得（前月の日付を表示するため）
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    // 前月の日付を表示
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const day = prevMonthLastDay - i;
        const dateStr = this.formatDateForStorage(new Date(year, month - 1, day));
        const dayEl = this.createCalendarDay(day, true, dailyTotals.get(dateStr) || 0, dateStr);
        grid.appendChild(dayEl);
    }

    // 今月の日付を表示
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = this.formatDateForStorage(new Date(year, month, day));
        const isSelected = this.calendarSelectedDate === dateStr;
        const dayEl = this.createCalendarDay(day, false, dailyTotals.get(dateStr) || 0, dateStr, isSelected);
        grid.appendChild(dayEl);
    }

    // 次月の日付を表示（グリッドを埋めるため）
    const totalCells = grid.children.length;
    const remainingCells = 42 - totalCells; // 6週間分（7列×6行）
    for (let day = 1; day <= remainingCells; day++) {
        const dateStr = this.formatDateForStorage(new Date(year, month + 1, day));
        const dayEl = this.createCalendarDay(day, true, dailyTotals.get(dateStr) || 0, dateStr);
        grid.appendChild(dayEl);
    }
};

/**
 * カレンダーの日付セルを作成
 */
ReceiptApp.prototype.createCalendarDay = function(dayNumber, isOtherMonth, amount, dateStr, isSelected = false) {
    const day = document.createElement('div');    day.className = 'calendar-day relative';

    const todayObj = new Date();
    const todayStr = this.formatDateForStorage(todayObj);
    const isToday = (dateStr === todayStr) && !isOtherMonth;

    if (isOtherMonth) {
        day.classList.add('other-month');
    }
    if (isSelected) {
        day.classList.add('selected');
    }

    // 今日を青く強調
    if (isToday) {
        day.classList.add('!border-blue-600', '!border-2');
    }
    day.dataset.date = dateStr;

    const numberEl = document.createElement('div');
    numberEl.className = `calendar-day-number ${isToday ? 'bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center' : ''}`;
    numberEl.textContent = dayNumber;
    day.appendChild(numberEl);

    if (amount > 0) {
        const amountEl = document.createElement('div');
        amountEl.className = 'calendar-day-amount';
        amountEl.textContent = `¥${amount.toLocaleString()}`;

        day.appendChild(amountEl);
    }

    // クリックイベント
    day.addEventListener('click', () => {
        this.selectCalendarDate(dateStr);
    });

    return day;
};

/**
 * カレンダーで日付を選択
 */
ReceiptApp.prototype.selectCalendarDate = function(dateStr) {
    // 選択状態を更新
    this.calendarSelectedDate = dateStr;

    // すべての日付セルの選択状態を更新
    const allDays = document.querySelectorAll('.calendar-day');
    allDays.forEach(day => {
        day.classList.remove('selected');
        if (day.dataset.date === dateStr) {
            day.classList.add('selected');
        }
    });

    // 下段（当日分リスト）を更新
    this.renderCalendarSelectedDayList(dateStr);
};

/**
 * カレンダーモーダル下段：選択日の明細リスト（ハイブリッド形式）を描画
 */
ReceiptApp.prototype.renderCalendarSelectedDayList = function(dateStr) {
    const details = document.getElementById('calendarDetails');
    const detailsDate = document.getElementById('calendarDetailsDate');
    const detailsList = document.getElementById('calendarDetailsList');

    if (!details || !detailsDate || !detailsList) {
        console.error('Calendar details elements not found');
        return;
    }

    // タイムライン（コンパクト）スタイルを流用
    detailsList.classList.add('timeline-items');

    detailsList.innerHTML = '';

    // 未選択時のプレースホルダ
    if (!dateStr) {
        details.style.display = 'block';
        detailsDate.textContent = '日付を選択してください';
        const emptyMsg = document.createElement('p');
        emptyMsg.style.textAlign = 'center';
        emptyMsg.style.color = 'var(--text-secondary, #6b7280)';
        emptyMsg.style.padding = '1.5rem 0';
        emptyMsg.textContent = 'カレンダーから日付を選ぶと、この日の明細がここに表示されます。';
        detailsList.appendChild(emptyMsg);
        return;
    }

    // 日付ラベル
    const date = new Date(dateStr);
    detailsDate.textContent = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;

    // `smart_receipt_data_v1`（storageKey）から該当日を抽出
    const receipts = (this.storage.getReceiptsByDate(dateStr) || [])
        .slice()
        .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));

    if (receipts.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.style.textAlign = 'center';
        emptyMsg.style.color = 'var(--text-secondary, #6b7280)';
        emptyMsg.style.padding = '1.75rem 0';
        emptyMsg.textContent = 'この日の記録はありません';
        detailsList.appendChild(emptyMsg);
        details.style.display = 'block';
        return;
    }

    receipts.forEach((receipt) => {
        detailsList.appendChild(this.createCalendarHybridTimelineItem(receipt));
    });

    // 合計
    const totalAmount = receipts.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    const totalEl = document.createElement('div');
    totalEl.className = 'calendar-details-total';
    totalEl.innerHTML = `
        <span class="calendar-details-total-label">合計</span>
        <span class="calendar-details-total-amount">¥${totalAmount.toLocaleString()}</span>
    `;
    detailsList.appendChild(totalEl);

    details.style.display = 'block';
};

/**
 * カレンダーモーダル下段用：タイムライン（コンパクト）風カード（編集ボタン付き）
 */
ReceiptApp.prototype.createCalendarHybridTimelineItem = function(receipt) {
    const item = document.createElement('div');
    item.className = 'timeline-item is-compact calendar-hybrid-item';
    item.dataset.receiptId = receipt.id;

    const settings = this.storage.getSettings() || {};
    const categorySetting = findCategorySetting(settings, receipt.category?.id);
    const categoryId = receipt.category?.id || categorySetting?.id || 'other';

    const ui = (typeof window.getCategoryUI === 'function') ? window.getCategoryUI(categoryId) : null;
    const iconHtml = (typeof window.renderCategoryIconHtml === 'function')
        ? window.renderCategoryIconHtml(categoryId)
        : '🧾';
    const colorClass = ui?.color || '';

    item.innerHTML = `
        <div class="timeline-icon ${colorClass}">${iconHtml}</div>
        <div class="timeline-body">
            <div class="timeline-title">${receipt.merchant?.name || '不明な店舗'}</div>
        </div>
        <div class="timeline-right">
            <div class="timeline-amount">¥${(receipt.totalAmount || 0).toLocaleString()}</div>
            <button class="receipt-edit-btn calendar-edit-btn" type="button" aria-label="編集" title="編集">
                <span class="material-symbols-outlined" aria-hidden="true">edit</span>
            </button>
        </div>
    `;

    const editBtn = item.querySelector('.calendar-edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.startEditReceipt(receipt.id);
        });
    }

    return item;
};

/**
 * 日付をYYYY-MM-DD形式にフォーマット
 */
ReceiptApp.prototype.formatDateForStorage = function(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * カテゴリ別内訳を描画
 */
ReceiptApp.prototype.renderCategoryBreakdown = function() {
    const container = this.elements.categoryBreakdownContainer;
    if (!container) return;

    const displayDate = this.currentMonth || new Date();
    const receipts = this.storage.getReceiptsByMonth(displayDate.getFullYear(), displayDate.getMonth());
    const settings = this.storage.getSettings() || {};
    const categories = settings.categories || [];

    // カテゴリごとの合計を計算
    const totals = {};
    receipts.forEach(r => {
        const catId = r.category?.id || 'other';
        totals[catId] = (totals[catId] || 0) + (r.totalAmount || 0);
    });

    // 支出があるカテゴリのみ抽出してソート（降順）
    const sortedCategories = categories
        .map(cat => ({
            ...cat,
            amount: totals[cat.id] || 0
        }))
        .filter(cat => cat.amount > 0)
        .sort((a, b) => b.amount - a.amount);

    container.innerHTML = '';

    if (sortedCategories.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-400 py-8 text-sm">今月の支出データがありません</p>';
        return;
    }

    // 最大支出額を取得（ゲージの100%基準）
    const maxAmount = Math.max(...sortedCategories.map(c => c.amount));

    sortedCategories.forEach(cat => {
        const row = document.createElement('div');
        row.className = 'category-row flex flex-col gap-2';
        const progressWidth = (cat.amount / maxAmount) * 100;
        const ui = (typeof window.getCategoryUI === 'function') ? window.getCategoryUI(cat.id) : null;
        const iconHtml = (typeof window.renderCategoryIconHtml === 'function')
            ? window.renderCategoryIconHtml(cat.id)
            : (cat.icon || '🧾');
        const colorClass = ui?.color || '';

        row.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg border border-black/5 ${colorClass}">${iconHtml}</div>
                    <span class="font-bold text-slate-700 text-[0.9rem]">${cat.name}</span>
                </div>
                <span class="font-black text-slate-900 text-[0.95rem]">¥${cat.amount.toLocaleString()}</span>
            </div>
            <div class="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden ml-[52px] w-[calc(100%-52px)]">
                <div class="h-full rounded-full transition-all duration-1000 ease-out" style="width: ${progressWidth}%; background-color: ${cat.color};"></div>
            </div>
        `;
        container.appendChild(row);
    });
};

// 既存メソッドをラップしてボトムシート連携を追加
(function() {
    const originalInit = ReceiptApp.prototype.init;
    ReceiptApp.prototype.init = function() {
        if (originalInit) {
            originalInit.call(this);
        }
        this.initBudgetBottomSheet();
        this.initCollapsibleHistory();
    };
})();


