/**
 * エディタ/フォーム関連機能
 */

// ReceiptAppクラスのプロトタイプにメソッドを追加

/**
 * 画像アップロード処理
 */
ReceiptApp.prototype.handleImageUpload = async function(file) {
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
};

/**
 * フォームに値を設定
 */
ReceiptApp.prototype.fillForm = function(parsed, category) {
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
};

/**
 * フィールドのステータス表示を更新
 */
ReceiptApp.prototype.updateFieldStatus = function(fieldName, confidence) {
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
};

/**
 * レシートを保存
 */
ReceiptApp.prototype.saveReceipt = function() {
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
};

/**
 * フォームをリセット
 */
ReceiptApp.prototype.resetForm = function() {
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
};

/**
 * 既存レシートをフォームへ読み込み
 */
ReceiptApp.prototype.loadReceiptToForm = function(receipt) {
    if (!receipt) return;

    // 一旦クリアしてから値を反映
    this.resetForm();

    this.elements.receiptDate.value = receipt.date || '';
    this.elements.merchantName.value = receipt.merchant?.name || '';
    if (typeof receipt.totalAmount === 'number') {
        this.elements.totalAmount.value = receipt.totalAmount;
    }

    const categoryId = receipt.category?.id || 'other';
    const hasOption = Array.from(this.elements.category.options).some(opt => opt.value === categoryId);
    this.elements.category.value = hasOption ? categoryId : 'other';

    this.elements.memo.value = receipt.memo || '';

    if (receipt.image) {
        this.elements.imagePreview.innerHTML = `<img src="${receipt.image}" alt="レシート画像">`;
    }

    this.currentReceipt = receipt;
};

/**
 * レシート編集を開始（ダッシュボードから遷移）
 */
ReceiptApp.prototype.startEditReceipt = function(receiptId) {
    const target = this.storage.getReceiptById(receiptId);
    if (!target) {
        alert('レシートが見つかりませんでした');
        return;
    }
    // モーダルが開いている場合は閉じてから編集画面へ
    if (typeof this.hideDateReceiptsModal === 'function') {
        this.hideDateReceiptsModal();
    }
    this.showEditor(target);
};

