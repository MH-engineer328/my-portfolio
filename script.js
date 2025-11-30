// ハンバーガーメニューのトグル
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

hamburger.addEventListener('click', () => {
    navMenu.classList.toggle('active');
});

// ナビゲーションリンククリック時にメニューを閉じる
document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
    });
});

// スクロール時のナビゲーションバーのスタイル変更
let lastScroll = 0;
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    const currentScroll = window.scrollY;
    
    if (currentScroll > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
});

// ナビゲーションのアクティブ状態をスクロール位置に応じて更新
function updateActiveNav() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-menu a');
    
    let current = '';
    const scrollPosition = window.scrollY + 150;
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        
        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
            current = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
}

window.addEventListener('scroll', updateActiveNav);
window.addEventListener('load', updateActiveNav);

// フォーム送信処理とアニメーション
const contactForm = document.querySelector('.contact-form');
if (contactForm) {
    // フォームフィールドのフォーカスアニメーション
    const formInputs = contactForm.querySelectorAll('input, textarea');
    formInputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', function() {
            if (!this.value) {
                this.parentElement.classList.remove('focused');
            }
        });
        
        // ページ読み込み時に値がある場合
        if (input.value) {
            input.parentElement.classList.add('focused');
        }
    });
    
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // 送信ボタンのアニメーション
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        submitBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            submitBtn.style.transform = '';
            alert('お問い合わせありがとうございます！メール機能を実装する場合は、バックエンドの設定が必要です。');
            contactForm.reset();
            formInputs.forEach(input => {
                input.parentElement.classList.remove('focused');
            });
        }, 200);
    });
}

// スムーススクロール（フォールバック）
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// スクロール時のフェードインアニメーション（改善版）
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            setTimeout(() => {
                entry.target.classList.add('visible');
            }, index * 100);
            fadeObserver.unobserve(entry.target);
        }
    });
}, observerOptions);

// アニメーション対象の要素を監視
document.addEventListener('DOMContentLoaded', () => {
    // スキルカード
    document.querySelectorAll('.skill-card').forEach((el, index) => {
        el.classList.add('fade-in-up');
        fadeObserver.observe(el);
    });
    
    // プロジェクトカード
    document.querySelectorAll('.project-card').forEach((el, index) => {
        el.classList.add('fade-in-up');
        fadeObserver.observe(el);
    });
    
    // Aboutセクションのコンテンツ
    const aboutImage = document.querySelector('.about-image');
    const aboutText = document.querySelector('.about-text');
    if (aboutImage) {
        aboutImage.classList.add('slide-in-left');
        fadeObserver.observe(aboutImage);
    }
    if (aboutText) {
        aboutText.classList.add('slide-in-right');
        fadeObserver.observe(aboutText);
    }
    
    // セクションタイトル
    document.querySelectorAll('.section-title').forEach(el => {
        el.classList.add('fade-in-up');
        fadeObserver.observe(el);
    });
    
    // コンタクト情報
    document.querySelectorAll('.contact-item').forEach((el, index) => {
        el.classList.add('fade-in-up');
        fadeObserver.observe(el);
    });
});

