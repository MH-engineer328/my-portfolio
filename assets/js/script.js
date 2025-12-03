class ProjectGallery {
    constructor() {
        this.slides = Array.from(document.querySelectorAll('.gallery-slide'));
        this.dots = Array.from(document.querySelectorAll('.dot'));
        this.prevBtn = document.querySelector('.nav-prev');
        this.nextBtn = document.querySelector('.nav-next');
        this.counterEl = document.querySelector('.current-project');
        this.container = document.querySelector('.gallery-container');

        this.currentIndex = 0;
        this.isTransitioning = false;
        this.touchStartX = 0;
        this.touchEndX = 0;

        this.bindEvents();
        this.updateUI();
    }

    bindEvents() {
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => this.gotoPrev());
        }
        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => this.gotoNext());
        }

        this.dots.forEach((dot, index) => {
            dot.addEventListener('click', () => this.goTo(index));
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowLeft') this.gotoPrev();
            if (event.key === 'ArrowRight') this.gotoNext();
        });

        if (this.container) {
            this.container.addEventListener('touchstart', (event) => {
                this.touchStartX = event.touches[0].clientX;
            }, { passive: true });

            this.container.addEventListener('touchend', (event) => {
                this.touchEndX = event.changedTouches[0].clientX;
                this.handleSwipe();
            }, { passive: true });

            let wheelTimeout;
            this.container.addEventListener('wheel', (event) => {
                event.preventDefault();
                clearTimeout(wheelTimeout);
                wheelTimeout = setTimeout(() => {
                    if (event.deltaY > 0) {
                        this.gotoNext();
                    } else {
                        this.gotoPrev();
                    }
                }, 80);
            }, { passive: false });
        }
    }

    gotoPrev() {
        if (this.isTransitioning) return;
        const nextIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
        this.transitionTo(nextIndex, 'prev');
    }

    gotoNext() {
        if (this.isTransitioning) return;
        const nextIndex = (this.currentIndex + 1) % this.slides.length;
        this.transitionTo(nextIndex, 'next');
    }

    goTo(index) {
        if (this.isTransitioning || index === this.currentIndex) return;
        const direction = index > this.currentIndex ? 'next' : 'prev';
        this.transitionTo(index, direction);
    }

    transitionTo(targetIndex, direction) {
        this.isTransitioning = true;

        this.slides.forEach((slide, index) => {
            slide.classList.remove('slide-out-left', 'slide-out-right', 'slide-in-left', 'slide-in-right', 'active');

            if (index === this.currentIndex) {
                slide.classList.add(direction === 'next' ? 'slide-out-left' : 'slide-out-right');
            }

            if (index === targetIndex) {
                slide.classList.add('active', direction === 'next' ? 'slide-in-right' : 'slide-in-left');
            }
        });

        this.currentIndex = targetIndex;
        this.updateUI();

        setTimeout(() => {
            this.slides.forEach(slide => {
                slide.classList.remove('slide-out-left', 'slide-out-right', 'slide-in-left', 'slide-in-right');
            });
            this.isTransitioning = false;
        }, 600);
    }

    updateUI() {
        this.dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === this.currentIndex);
        });

        if (this.counterEl) {
            this.counterEl.textContent = String(this.currentIndex + 1).padStart(2, '0');
        }
    }

    handleSwipe() {
        const threshold = 50;
        const distance = this.touchStartX - this.touchEndX;

        if (Math.abs(distance) < threshold) return;
        if (distance > 0) {
            this.gotoNext();
        } else {
            this.gotoPrev();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.gallery-slide')) {
        new ProjectGallery();
    }
});
