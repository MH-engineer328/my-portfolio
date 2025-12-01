/**
 * OCR処理サービス
 * Tesseract.jsを使用した画像解析と前処理
 */

class OCRService {
    constructor() {
        this.worker = null;
        this.isInitialized = false;
    }

    /**
     * Tesseract.jsの初期化
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            // Tesseract.jsのワーカーを作成
            const { createWorker } = Tesseract;
            this.worker = await createWorker('jpn');
            this.isInitialized = true;
        } catch (error) {
            console.error('OCR初期化エラー:', error);
            throw error;
        }
    }

    /**
     * 画像を前処理（グレースケール化・二値化）
     */
    preprocessImage(imageElement) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = imageElement.width;
        canvas.height = imageElement.height;

        ctx.drawImage(imageElement, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // グレースケール化と二値化
        for (let i = 0; i < data.length; i += 4) {
            const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const threshold = 128; // 閾値
            const binary = gray > threshold ? 255 : 0;

            data[i] = binary;     // R
            data[i + 1] = binary; // G
            data[i + 2] = binary; // B
            // data[i + 3] は alpha（そのまま）
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    /**
     * 画像からテキストを抽出
     */
    async recognizeText(imageFile) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return new Promise(async (resolve, reject) => {
            try {
                // 画像を読み込み
                const imageUrl = URL.createObjectURL(imageFile);
                const img = new Image();

                img.onload = async () => {
                    try {
                        // 画像前処理
                        const processedCanvas = this.preprocessImage(img);

                        // OCR実行
                        const { data } = await this.worker.recognize(processedCanvas);

                        // メモリ解放
                        URL.revokeObjectURL(imageUrl);

                        resolve({
                            text: data.text,
                            words: data.words || [],
                            lines: data.lines || []
                        });
                    } catch (error) {
                        URL.revokeObjectURL(imageUrl);
                        reject(error);
                    }
                };

                img.onerror = () => {
                    URL.revokeObjectURL(imageUrl);
                    reject(new Error('画像の読み込みに失敗しました'));
                };

                img.src = imageUrl;
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 画像をリサイズ（LocalStorage用のサムネイル作成）
     */
    resizeImage(file, maxWidth = 300) {
        return new Promise((resolve) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const img = new Image();

                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // アスペクト比を維持してリサイズ
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    // Base64に変換
                    const base64 = canvas.toDataURL('image/jpeg', 0.8);
                    resolve(base64);
                };

                img.src = e.target.result;
            };

            reader.readAsDataURL(file);
        });
    }

    /**
     * クリーンアップ（ワーカーの終了）
     */
    async terminate() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
            this.isInitialized = false;
        }
    }
}

// グローバルにエクスポート
window.OCRService = OCRService;

