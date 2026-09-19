/* =========================================================
   carousel.js
========================================================= */

const carouselSlides = [

    {
        image: './banner1.png.png',
        tab: 'standings',
        alt: 'STANDINGS'
    },

    {
        image: './banner2.png.png',
        tab: 'fixtures',
        alt: 'MATCHES'
    },

    {
        image: './banner3.png',
        tab: 'totw',
        alt: 'TOTW'
    },

    {
        image: './banner4.png.PNG',
        tab: 'stats',
        alt: 'STATISTICS'
    }

];

let carouselIndex = 0;
let carouselTimer = null;
let touchStartX = 0;
let touchEndX = 0;


function buildCarousel() {

    const track = document.getElementById('carouselTrack');
    const dots = document.getElementById('carouselDots');

    if (!track || !dots) {
        return;
    }

    track.innerHTML = '';
    dots.innerHTML = '';

    carouselSlides.forEach(function(slide, index) {

        const item = document.createElement('div');
        item.className = 'carousel-slide';

        if (index === 0) {
            item.classList.add('active');
        }

        const img = document.createElement('img');
        img.src = slide.image;
        img.alt = slide.alt;

        img.onerror = function () {

            console.error('Carousel image not found:', slide.image);

            this.style.display = 'none';

            const parent = this.parentElement;

            if (parent && !parent.querySelector('.carousel-fallback')) {

                const fallback = document.createElement('div');
                fallback.className = 'carousel-fallback';

                fallback.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#38003c 0%,#ff005a 100%);color:#fff;font-weight:900;font-size:clamp(20px,5vw,36px);letter-spacing:3px;text-transform:uppercase;text-shadow:0 4px 15px rgba(0,0,0,.6);text-align:center;padding:20px;';

                fallback.textContent = slide.alt || 'BANNER';

                parent.appendChild(fallback);
            }
        };

        item.appendChild(img);

        item.addEventListener('click', function() {
            switchTab(slide.tab);
        });

        track.appendChild(item);

        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'carousel-dot';

        if (index === 0) {
            dot.classList.add('active');
        }

        dot.addEventListener('click', function(event) {
            event.stopPropagation();
            goToCarousel(index);
        });

        dots.appendChild(dot);
    });
}


function goToCarousel(index) {

    carouselIndex = (index + carouselSlides.length) % carouselSlides.length;

    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.carousel-dot');

    slides.forEach(function(slide, i) {
        slide.classList.toggle('active', i === carouselIndex);
    });

    dots.forEach(function(dot, i) {
        dot.classList.toggle('active', i === carouselIndex);
    });
}


function nextCarousel() {
    goToCarousel(carouselIndex + 1);
}


function startCarousel() {
    stopCarousel();
    carouselTimer = setInterval(nextCarousel, 5000);
}


function stopCarousel() {
    if (carouselTimer) {
        clearInterval(carouselTimer);
        carouselTimer = null;
    }
}


function setupCarouselTouch() {

    const carousel = document.getElementById('carousel');

    if (!carousel) {
        return;
    }

    carousel.addEventListener('touchstart', function(event) {

        if (event.changedTouches && event.changedTouches.length) {
            touchStartX = event.changedTouches[0].screenX;
        }

        stopCarousel();

    }, { passive: true });

    carousel.addEventListener('touchend', function(event) {

        if (event.changedTouches && event.changedTouches.length) {
            touchEndX = event.changedTouches[0].screenX;
        }

        const difference = touchEndX - touchStartX;

        if (Math.abs(difference) > 50) {
            if (difference < 0) {
                nextCarousel();
            } else {
                goToCarousel(carouselIndex - 1);
            }
        }

        startCarousel();

    }, { passive: true });
}
