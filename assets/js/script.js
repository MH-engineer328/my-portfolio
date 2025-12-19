/**
 * プロジェクトギャラリーのクラス
 * スライドショーの切り替えを管理する
 */
class ProjectGallery {
    /**
     * コンストラクタ：オブジェクトが作られるときに自動的に実行される
     * new ProjectGallery() が呼ばれると、この関数が実行される
     */
    constructor() {
        // HTML要素を取得して、this.○○（このオブジェクト専用の引き出し）に保存
        // querySelectorAll: 複数の要素を取得（配列になる）
        this.slides = Array.from(document.querySelectorAll('.gallery-slide'));
        this.dots = Array.from(document.querySelectorAll('.dot'));

        // querySelector: 1つの要素を取得
        this.prevBtn = document.querySelector('.nav-prev');
        this.nextBtn = document.querySelector('.nav-next');
        this.counterEl = document.querySelector('.current-project');
        this.container = document.querySelector('.gallery-container');

        // 状態を管理する変数（初期値を設定）
        this.currentIndex = 0;              // 現在表示中のスライド番号
        this.isTransitioning = false;       // アニメーション中かどうかのフラグ
        this.touchStartX = 0;               // タッチ開始位置（スワイプ用）
        this.touchEndX = 0;                 // タッチ終了位置（スワイプ用）

        // 準備作業を実行
        this.bindEvents();  // ボタンに「クリックされたら何をするか」を設定
        this.updateUI();   // 画面の表示を更新
    }

    /**
     * イベントリスナーの設定：ボタンがクリックされたときの動作を準備する
     * この関数は準備だけを行い、実際の処理はクリックされたときに実行される
     */
    bindEvents() {
        // 「←」ボタンがクリックされたら gotoPrev() を実行
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => this.gotoPrev());
        }
        // 「→」ボタンがクリックされたら gotoNext() を実行
        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => this.gotoNext());
        }

        // ドットボタンがクリックされたら、その番号のスライドに移動
        this.dots.forEach((dot, index) => {
            dot.addEventListener('click', () => this.goTo(index));
        });

        // キーボード操作：左右の矢印キーでスライドを切り替え
        document.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowLeft') this.gotoPrev();
            if (event.key === 'ArrowRight') this.gotoNext();
        });

        // タッチ操作（スマホ）とマウスホイール操作（PC）の設定
        if (this.container) {
            // タッチ開始：スワイプ開始位置を記録
            this.container.addEventListener('touchstart', (event) => {
                this.touchStartX = event.touches[0].clientX;
            }, { passive: true });

            // タッチ終了：スワイプ終了位置を記録して、スワイプ処理を実行
            this.container.addEventListener('touchend', (event) => {
                this.touchEndX = event.changedTouches[0].clientX;
                this.handleSwipe();
            }, { passive: true });

            // マウスホイール操作：上下スクロールでスライドを切り替え
            let wheelTimeout;
            this.container.addEventListener('wheel', (event) => {
                event.preventDefault();  // 通常のスクロールを無効化
                clearTimeout(wheelTimeout);  // 前のタイマーをクリア
                // 80ms後に実行（連続スクロールを防ぐ）
                wheelTimeout = setTimeout(() => {
                    if (event.deltaY > 0) {
                        this.gotoNext();  // 下にスクロール → 次のスライド
                    } else {
                        this.gotoPrev();  // 上にスクロール → 前のスライド
                    }
                }, 80);
            }, { passive: false });
        }
    }

    /**
     * 前のスライドに移動
     * 「←」ボタンがクリックされたときに呼ばれる
     */
    gotoPrev() {
        // アニメーション中は何もしない（連続クリックを防ぐ）
        if (this.isTransitioning) return;
        // 前のスライド番号を計算（最後のスライドの場合は最初に戻る）
        const nextIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
        this.transitionTo(nextIndex, 'prev');
    }

    /**
     * 次のスライドに移動
     * 「→」ボタンがクリックされたときに呼ばれる
     */
    gotoNext() {
        // アニメーション中は何もしない（連続クリックを防ぐ）
        if (this.isTransitioning) return;
        // 次のスライド番号を計算（最後のスライドの場合は最初に戻る）
        const nextIndex = (this.currentIndex + 1) % this.slides.length;
        this.transitionTo(nextIndex, 'next');
    }

    /**
     * 指定した番号のスライドに直接移動
     * ドットボタンがクリックされたときに呼ばれる
     * @param {number} index - 移動先のスライド番号
     */
    goTo(index) {
        // アニメーション中、または既にそのスライドが表示されている場合は何もしない
        if (this.isTransitioning || index === this.currentIndex) return;
        // 移動方向を判定（前か後か）
        const direction = index > this.currentIndex ? 'next' : 'prev';
        this.transitionTo(index, direction);
    }

    /**
     * スライドの切り替えアニメーションを実行
     * @param {number} targetIndex - 移動先のスライド番号
     * @param {string} direction - 移動方向（'next' または 'prev'）
     */
    transitionTo(targetIndex, direction) {
        // アニメーション中フラグを立てる（連続クリックを防ぐ）
        this.isTransitioning = true;

        // 全てのスライドに対して処理
        this.slides.forEach((slide, index) => {
            // 既存のアニメーションクラスを削除
            slide.classList.remove('slide-out-left', 'slide-out-right', 'slide-in-left', 'slide-in-right', 'active');

            // 現在表示中のスライド：退場アニメーションを追加
            if (index === this.currentIndex) {
                slide.classList.add(direction === 'next' ? 'slide-out-left' : 'slide-out-right');
            }

            // 移動先のスライド：入場アニメーションと active クラスを追加
            if (index === targetIndex) {
                slide.classList.add('active', direction === 'next' ? 'slide-in-right' : 'slide-in-left');
            }
        });

        // 現在のスライド番号を更新
        this.currentIndex = targetIndex;
        // UI（ドット、カウンター）を更新
        this.updateUI();

        // 600ms後にアニメーションクラスを削除（アニメーション完了後）
        setTimeout(() => {
            this.slides.forEach(slide => {
                slide.classList.remove('slide-out-left', 'slide-out-right', 'slide-in-left', 'slide-in-right');
            });
            // アニメーション完了フラグを下ろす
            this.isTransitioning = false;
        }, 600);
    }

    /**
     * UIの更新：ドットの active クラスとカウンターの表示を更新
     */
    updateUI() {
        // ドットボタンの active クラスを更新（現在のスライドに対応するドットを強調表示）
        this.dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === this.currentIndex);
        });

        // カウンターの表示を更新（例：01, 02, 03）
        if (this.counterEl) {
            this.counterEl.textContent = String(this.currentIndex + 1).padStart(2, '0');
        }
    }

    /**
     * スワイプ操作を処理（スマホで左右にスワイプしたとき）
     * touchstart と touchend で記録した位置から、スワイプ方向を判定
     */
    handleSwipe() {
        const threshold = 50;  // スワイプと判定する最小距離（ピクセル）
        const distance = this.touchStartX - this.touchEndX;  // スワイプの距離

        // スワイプ距離が閾値より小さい場合は無視
        if (Math.abs(distance) < threshold) return;

        // 左にスワイプ（distance > 0）→ 次のスライド
        // 右にスワイプ（distance < 0）→ 前のスライド
        if (distance > 0) {
            this.gotoNext();
        } else {
            this.gotoPrev();
        }
    }
}

/**
 * ページが読み込まれたときに実行される
 * DOMContentLoaded: HTMLの読み込みが完了したときに発火するイベント
 */
document.addEventListener('DOMContentLoaded', () => {
    // ギャラリースライドが存在する場合のみ、ProjectGallery オブジェクトを作成
    // new ProjectGallery() が実行されると、constructor() が自動的に呼ばれる
    if (document.querySelector('.gallery-slide')) {
        new ProjectGallery();
    }
});
