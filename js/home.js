// ==========================================
// home.js - หน้าแรกโฉมใหม่ (Hero + New Releases + Top 10 Chart + Artist Spotlight + Random)
//           และหน้าโปรไฟล์ & สถิติการฟังส่วนตัว (#view-profile)
// ==========================================

function getColoredArtist(artistStr) {
    if (typeof window.formatColoredArtistHtml === 'function') {
        return window.formatColoredArtistHtml(artistStr);
    }
    return '🎤 ' + (artistStr || '-');
}

function formatAddedDate(ts) {
    if (!ts) return '';
    const ms = (typeof ts === 'number') ? ts
        : (typeof ts === 'object' && ts.seconds) ? ts.seconds * 1000
        : new Date(ts).getTime();
    if (isNaN(ms)) return '';
    const d = new Date(ms);
    return `${d.getDate()}/${d.getMonth() + 1}`;
}

window.playRandomLibrarySong = function() {
    if (!window.songs || window.songs.length === 0) return;
    const pick = window.songs[Math.floor(Math.random() * window.songs.length)];
    if (pick) window.playSong(pick.id);
};

window.openArtistFromSpotlight = function(artistName) {
    if (!artistName) return;
    if (window.wm && typeof window.wm.openLibrary === 'function') window.wm.openLibrary();
    if (typeof window.filterByArtist === 'function') window.filterByArtist(artistName);
};

// ==========================================
// 🌟 1. Smart Hero Carousel (5 สไลด์ไฮไลต์ + แถบเวลาวิ่ง + เลื่อนอัตโนมัติ)
// ==========================================
const HERO_SLIDE_DURATION = 6000;
window._heroSlides = [];
window._heroIndex = 0;
window._heroTimer = null;
window._heroPaused = false;
window._heroRemaining = HERO_SLIDE_DURATION;
window._heroLastStart = 0;

function buildHeroSlides(forceRebuild) {
    if (!window.songs || window.songs.length === 0) return [];
    if (!forceRebuild && window._heroSlides && window._heroSlides.length > 0) {
        return window._heroSlides;
    }

    const usedIds = new Set();
    const slides = [];
    const pickUnique = (list) => {
        for (const s of list) {
            if (s && !usedIds.has(s.id)) {
                usedIds.add(s.id);
                return s;
            }
        }
        return null;
    };

    // 1. เพลงมาใหม่ล่าสุด
    const byDate = [...window.songs].filter(s => s.createdAt).sort((a, b) => b.createdAt - a.createdAt);
    const newest = pickUnique(byDate) || pickUnique(window.songs);
    if (newest) {
        const dStr = formatAddedDate(newest.createdAt);
        slides.push({
            song: newest,
            badge: `🆕 เพลงมาใหม่ล่าสุด${dStr ? ' · ' + dStr : ''}`,
            accent: '#0a84ff',
            subNote: 'เพิ่งเพิ่มเข้าสู่คลังเพลงสดๆ ร้อนๆ'
        });
    }

    // 2. อันดับ #1 ยอดฮิตในระบบ
    const byPlays = [...window.songs].sort((a, b) => ((b.plays || 0) - (a.plays || 0)) || ((b.seconds || 0) - (a.seconds || 0)));
    const topHit = pickUnique(byPlays);
    if (topHit) {
        slides.push({
            song: topHit,
            badge: `👑 ยอดฮิตติดชาร์ต${(topHit.plays || 0) > 0 ? ' · 👁 ' + topHit.plays + ' ครั้ง' : ''}`,
            accent: '#ff9f0a',
            subNote: 'เพลงที่มียอดเข้าฟังสูงสุดในคลังเพลง'
        });
    }

    // 3. เพลงที่มีเวอร์ชัน Cover พิเศษ
    const withCovers = [...window.songs].filter(s => s.covers && s.covers.length > 0).sort(() => 0.5 - Math.random());
    const coverPick = pickUnique(withCovers);
    if (coverPick) {
        slides.push({
            song: coverPick,
            badge: `🎧 พิเศษ · มี ${coverPick.covers.length} เวอร์ชัน Cover`,
            accent: '#bf5af2',
            subNote: 'สลับฟังเปรียบเทียบเสียงร้องหลายเวอร์ชันได้ในหน้าเล่นเพลง'
        });
    }

    // 4. แนะนำจากสไตล์ที่คุณฟัง (หรือเพลงฮิตลำดับถัดมา)
    let personalPick = null;
    if (window.stats && window.stats.songs) {
        const userTopIds = Object.entries(window.stats.songs)
            .sort((a, b) => ((b[1].plays || 0) - (a[1].plays || 0)))
            .map(([id]) => window.songs.find(s => s.id === id))
            .filter(Boolean);
        personalPick = pickUnique(userTopIds);
    }
    if (!personalPick) personalPick = pickUnique(byPlays);
    if (personalPick) {
        slides.push({
            song: personalPick,
            badge: (window.stats && window.stats.totalPlays > 0) ? '💖 แนะนำจากสไตล์ที่คุณฟัง' : '🔥 เพลงฮิตน่าฟัง',
            accent: '#ff375f',
            subNote: 'คัดสรรมาให้เปิดฟังซ้ำได้ไม่มีเบื่อ'
        });
    }

    // 5. Hidden Gem น่าค้นหา
    const gems = [...window.songs].sort(() => 0.5 - Math.random());
    const gemPick = pickUnique(gems);
    if (gemPick) {
        slides.push({
            song: gemPick,
            badge: '💎 Hidden Gem น่าค้นหา',
            accent: '#30d158',
            subNote: 'สุ่มเพลงดีในคลังที่อยากชวนให้ลองกดฟัง'
        });
    }

    window._heroSlides = slides;
    return slides;
}

function clearHeroTimer() {
    if (window._heroTimer) {
        clearTimeout(window._heroTimer);
        window._heroTimer = null;
    }
}

function scheduleHeroNext(delay) {
    clearHeroTimer();
    const homeView = document.getElementById('view-home');
    if (window._heroPaused || document.hidden || (homeView && !homeView.classList.contains('active'))) return;

    const wait = typeof delay === 'number' ? Math.max(200, delay) : HERO_SLIDE_DURATION;
    window._heroRemaining = wait;
    window._heroLastStart = performance.now();
    window._heroTimer = setTimeout(() => {
        window.stepHeroSlide(1);
    }, wait);
}

window.pauseHeroCarousel = function() {
    if (window._heroPaused) return;
    window._heroPaused = true;
    const elapsed = performance.now() - (window._heroLastStart || performance.now());
    window._heroRemaining = Math.max(400, (window._heroRemaining || HERO_SLIDE_DURATION) - elapsed);
    clearHeroTimer();
    const card = document.querySelector('.home-hero-card');
    if (card) card.classList.add('is-paused');
};

window.resumeHeroCarousel = function() {
    if (!window._heroPaused) return;
    window._heroPaused = false;
    const card = document.querySelector('.home-hero-card');
    if (card) card.classList.remove('is-paused');
    scheduleHeroNext(window._heroRemaining);
};

window.goToHeroSlide = function(index) {
    const slides = window._heroSlides || [];
    if (slides.length === 0) return;
    window._heroIndex = ((index % slides.length) + slides.length) % slides.length;
    window._heroRemaining = HERO_SLIDE_DURATION;
    updateHeroSlideDOM();
    if (!window._heroPaused) scheduleHeroNext(HERO_SLIDE_DURATION);
};

window.stepHeroSlide = function(delta) {
    const slides = window._heroSlides || [];
    if (slides.length === 0) return;
    window.goToHeroSlide((window._heroIndex || 0) + delta);
};

function updateHeroSlideDOM() {
    const container = document.getElementById('homeHeroBanner');
    if (!container) return;
    const slides = window._heroSlides || [];
    const idx = window._heroIndex || 0;

    container.querySelectorAll('.home-hero-slide').forEach((el, i) => {
        el.classList.toggle('active', i === idx);
    });

    container.querySelectorAll('.hero-dot').forEach((dot, i) => {
        const isActive = (i === idx);
        dot.classList.toggle('active', isActive);
        const fill = dot.querySelector('.hero-dot-fill');
        if (fill) {
            fill.style.animation = 'none';
            void fill.offsetWidth;
            if (isActive) {
                fill.style.animation = `heroDotProgress ${HERO_SLIDE_DURATION}ms linear forwards`;
            }
        }
    });
}

window.renderHomeHero = function(forceRebuild) {
    const container = document.getElementById('homeHeroBanner');
    if (!container || !window.songs || window.songs.length === 0) return;

    const slides = buildHeroSlides(!!forceRebuild);
    if (slides.length === 0) return;
    if (forceRebuild) window._heroIndex = 0;
    else if (window._heroIndex >= slides.length) window._heroIndex = 0;

    const slidesHtml = slides.map((item, i) => {
        const song = item.song;
        const videoId = window.extractYouTubeID(song.audioPath);
        const maxResUrl = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '';
        const hqUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
        const isActive = (i === window._heroIndex);

        return `
            <div class="home-hero-slide ${isActive ? 'active' : ''}" data-index="${i}" style="--hero-accent:${item.accent};" onclick="playSong('${song.id}')">
                <div class="home-hero-backdrop">
                    <img class="home-hero-backdrop-img" src="${maxResUrl}" alt=""
                         onload="if(this.naturalWidth<=120 && '${hqUrl}') this.src='${hqUrl}';"
                         onerror="if(this.src!=='${hqUrl}') this.src='${hqUrl}';">
                </div>
                <div class="home-hero-content">
                    <div class="home-hero-left">
                        <div class="home-hero-badges">
                            <span class="home-hero-tag" style="background:color-mix(in srgb, ${item.accent} 32%, rgba(0,0,0,.55)); border-color:color-mix(in srgb, ${item.accent} 68%, transparent); color:#fff;">
                                ${item.badge}
                            </span>
                            ${song.covers && song.covers.length > 0 ? `<span class="home-hero-cover-tag">🎧 ${song.covers.length} Cover</span>` : ''}
                        </div>
                        <h2 class="home-hero-title">${song.title}</h2>
                        <div class="home-hero-artist">${getColoredArtist(song.artist)}</div>
                        <div class="home-hero-subnote">${item.subNote || ''}</div>
                        <div class="home-hero-actions" onclick="event.stopPropagation();">
                            <button class="btn-primary home-hero-play" onclick="playSong('${song.id}')">
                                <i class="fa-solid fa-play"></i> เล่นทันที
                            </button>
                            <button class="btn-secondary home-hero-btn" onclick="window.addToQueue && window.addToQueue('${song.id}')">
                                <i class="fa-solid fa-plus"></i> เข้าคิว
                            </button>
                            <button class="btn-secondary home-hero-btn" onclick="window.playRandomLibrarySong()" title="สุ่มเล่นเพลงจากคลัง">
                                <i class="fa-solid fa-shuffle"></i> สุ่มฟังทั้งคลัง
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const dotsHtml = slides.map((item, i) => `
        <button class="hero-dot ${i === window._heroIndex ? 'active' : ''}" onclick="window.goToHeroSlide(${i})" title="${item.badge} — ${item.song.title}" aria-label="สไลด์ที่ ${i + 1}">
            <span class="hero-dot-fill" style="${i === window._heroIndex ? `animation:heroDotProgress ${HERO_SLIDE_DURATION}ms linear forwards;` : ''}"></span>
        </button>
    `).join('');

    container.innerHTML = `
        <div class="home-hero-card" onmouseenter="window.pauseHeroCarousel()" onmouseleave="window.resumeHeroCarousel()">
            <div class="home-hero-Viewport">
                ${slidesHtml}
            </div>
            <div class="home-hero-footer">
                <div class="hero-dots" role="tablist">
                    ${dotsHtml}
                </div>
                <div class="hero-nav-controls">
                    <button class="hero-nav-btn" onclick="window.stepHeroSlide(-1)" title="สไลด์ก่อนหน้า" aria-label="สไลด์ก่อนหน้า">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                    <button class="hero-nav-btn" onclick="window.stepHeroSlide(1)" title="สไลด์ถัดไป" aria-label="สไลด์ถัดไป">
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                    <button class="hero-nav-btn" onclick="window.renderHomeHero(true)" title="สุ่มชุดสไลด์ใหม่" aria-label="สุ่มชุดสไลด์ใหม่">
                        <i class="fa-solid fa-arrows-rotate"></i>
                    </button>
                </div>
            </div>
        </div>
    `;

    // รองรับการปัดนิ้วซ้าย-ขวา (Touch Swipe) บนหน้าจอมือถือ
    const cardEl = container.querySelector('.home-hero-card');
    if (cardEl) {
        let touchStartX = 0;
        let touchStartY = 0;
        cardEl.addEventListener('touchstart', (e) => {
            if (!e.touches || !e.touches[0]) return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            window.pauseHeroCarousel();
        }, { passive: true });
        cardEl.addEventListener('touchend', (e) => {
            if (e.changedTouches && e.changedTouches[0]) {
                const dx = e.changedTouches[0].clientX - touchStartX;
                const dy = e.changedTouches[0].clientY - touchStartY;
                if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)) {
                    window.stepHeroSlide(dx < 0 ? 1 : -1);
                }
            }
            window.resumeHeroCarousel();
        }, { passive: true });
    }

    window._heroPaused = false;
    scheduleHeroNext(HERO_SLIDE_DURATION);
};

// ==========================================
// 🆕 2. เพลงที่เพิ่มล่าสุด (New Releases — Glass Media Cards + ป้ายเวลาอัจฉริยะ + ลูกศรเลื่อน)
// ==========================================
const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function parseTimestampMs(ts) {
    if (!ts) return NaN;
    if (typeof ts === 'number') return ts;
    if (typeof ts === 'object' && ts.seconds) return ts.seconds * 1000;
    return new Date(ts).getTime();
}

function formatSmartReleaseBadge(ts, idx) {
    const ms = parseTimestampMs(ts);
    if (isNaN(ms)) return { text: idx === 0 ? '🆕 ล่าสุด' : 'เพลงใหม่', cls: idx === 0 ? 'badge-latest' : '' };

    const d = new Date(ms);
    const dateLabel = `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]}`;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((startOfToday - startOfTarget) / 86400000);

    if (diffDays === 0) return { text: `🔥 มาใหม่วันนี้ · ${dateLabel}`, cls: 'badge-today' };
    if (diffDays === 1) return { text: `✨ เมื่อวาน · ${dateLabel}`, cls: 'badge-yesterday' };
    if (idx === 0) return { text: `🆕 ล่าสุด · ${dateLabel}`, cls: 'badge-latest' };
    if (diffDays > 1 && diffDays <= 7) return { text: `${diffDays} วันที่แล้ว · ${dateLabel}`, cls: 'badge-recent' };
    return { text: `📅 ${dateLabel}`, cls: '' };
}

window.setHomeRowExpanded = function(rowId, expanded, isManual) {
    const row = document.getElementById(rowId);
    if (!row) return;
    if (isManual) row._manualOverride = expanded;
    row.classList.toggle('is-expanded', !!expanded);

    const btnId = rowId === 'recentlyAddedList' ? 'btnExpandRecent' : (rowId === 'randomSongList' ? 'btnExpandRandom' : null);
    const btnEl = btnId ? document.getElementById(btnId) : null;
    if (btnEl) {
        btnEl.innerHTML = expanded
            ? '<i class="fa-solid fa-chevron-up"></i> ย่อเก็บ'
            : '<i class="fa-solid fa-chevron-down"></i> ขยายดูเพิ่ม';
    }
};

window.toggleHomeRowExpand = function(rowId, btnEl) {
    const row = document.getElementById(rowId);
    if (!row) return;
    const next = !row.classList.contains('is-expanded');
    window.setHomeRowExpanded(rowId, next, true);
};

// ระบบตรวจจับการเลื่อนหน้าจอในหน้าแรก (#view-home) เพื่อกาง/หดแถวการ์ดอัตโนมัติอย่างนุ่มนวล
let _homeScrollBound = false;
window.bindHomeAutoScroll = function() {
    if (_homeScrollBound) return;
    const scrollBody = document.querySelector('#view-home > .content-body');
    if (!scrollBody) return;
    _homeScrollBound = true;

    let ticking = false;
    const updateOnScroll = () => {
        ticking = false;
        const st = scrollBody.scrollTop;
        const vh = scrollBody.clientHeight || window.innerHeight;

        // เมื่อเลื่อนกลับขึ้นมาบนสุด ให้รีเซ็ต manual override และพับเก็บกลับสู่โหมดกะทัดรัดอัตโนมัติ
        const recRow = document.getElementById('recentlyAddedList');
        const rndRow = document.getElementById('randomSongList');
        const heroSlot = document.getElementById('homeHeroBanner');

        if (heroSlot) {
            heroSlot.classList.toggle('is-scrolled-compact', st > 90);
        }

        if (st <= 18) {
            if (recRow) {
                recRow._manualOverride = undefined;
                window.setHomeRowExpanded('recentlyAddedList', false, false);
            }
            if (rndRow) {
                rndRow._manualOverride = undefined;
                window.setHomeRowExpanded('randomSongList', false, false);
            }
            return;
        }

        // 1. กางโซน "เพลงที่เพิ่มล่าสุด" อัตโนมัติเมื่อเริ่มเลื่อนลงมา
        if (recRow && recRow._manualOverride === undefined) {
            if (st > 55 && !recRow.classList.contains('is-expanded')) {
                window.setHomeRowExpanded('recentlyAddedList', true, false);
            }
        }

        // 2. กางโซน "เพลงสุ่มน่าฟัง" อัตโนมัติเมื่อเลื่อนลงมาเห็นโซนด้านล่าง
        if (rndRow && rndRow._manualOverride === undefined) {
            const rect = rndRow.getBoundingClientRect();
            const bodyRect = scrollBody.getBoundingClientRect();
            const relTop = rect.top - bodyRect.top;
            if (relTop < vh * 0.86 && !rndRow.classList.contains('is-expanded')) {
                window.setHomeRowExpanded('randomSongList', true, false);
            } else if (relTop > vh * 1.05 && rndRow.classList.contains('is-expanded')) {
                window.setHomeRowExpanded('randomSongList', false, false);
            }
        }
    };

    scrollBody.addEventListener('scroll', updateOnScroll, { passive: true });
};

function renderExpandableGlassGrid(container, songs, cardOptionsFn) {
    container.innerHTML = '';
    const primaryGrid = document.createElement('div');
    primaryGrid.className = 'home-grid-subrow home-grid-primary';

    const secondaryGrid = document.createElement('div');
    secondaryGrid.className = 'home-grid-subrow home-grid-secondary';

    songs.forEach((song, idx) => {
        const opts = cardOptionsFn(song, idx);
        const card = createSpatialGlassCard(song, opts);
        if (idx < 4) primaryGrid.appendChild(card);
        else secondaryGrid.appendChild(card);
    });

    container.appendChild(primaryGrid);

    if (songs.length > 4) {
        const drawer = document.createElement('div');
        drawer.className = 'home-grid-drawer';
        const inner = document.createElement('div');
        inner.className = 'home-grid-drawer-inner';
        inner.appendChild(secondaryGrid);
        drawer.appendChild(inner);
        container.appendChild(drawer);
    }

    window.bindHomeAutoScroll();
}

window.quickQueueFromCard = function(event, songId, btnEl) {
    if (event) event.stopPropagation();
    if (typeof window.addToQueue === 'function') window.addToQueue(songId);
    if (btnEl) {
        const prevHtml = btnEl.innerHTML;
        btnEl.classList.add('added');
        btnEl.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => {
            btnEl.classList.remove('added');
            btnEl.innerHTML = prevHtml;
        }, 1200);
    }
};

function createSpatialGlassCard(song, options) {
    const idx = options.idx || 0;
    const isFeatured = !!options.isFeatured;
    const isExtraRow = idx >= 4;
    const badge = options.badge || { text: '✨ แนะนำ', cls: '' };
    const watermark = options.watermark || '';

    const item = document.createElement('div');
    item.className = 'release-glass-card'
        + (isFeatured ? ' is-featured-drop' : '')
        + (isExtraRow ? ' is-extra-row' : '');
    item.style.setProperty('--extra-idx', String(Math.max(0, idx - 4)));
    item.onclick = () => window.playSong(song.id);

    const videoId = window.extractYouTubeID(song.audioPath);
    const maxResUrl = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '';
    const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';
    const hasCovers = song.covers && song.covers.length > 0;
    const playsCount = song.plays || 0;

    const singers = window.getSingersList ? window.getSingersList(song.artist) : [];
    const firstSinger = singers[0] || '';
    const accentColor = (window.SINGER_COLORS && window.SINGER_COLORS[firstSinger])
        ? window.SINGER_COLORS[firstSinger]
        : '#0a84ff';

    item.style.setProperty('--card-accent', accentColor);

    item.innerHTML = `
        <div class="release-card-glow" style="background-image:url('${thumbUrl}');"></div>
        <div class="release-card-sheen"></div>

        <div class="release-card-stage">
            <div class="release-vinyl-peek">
                <div class="release-vinyl-grooves"></div>
                <div class="release-vinyl-center" style="background-image:url('${thumbUrl}');"></div>
            </div>
            <div class="release-card-art">
                <img src="${maxResUrl || thumbUrl}"
                     onload="if(this.naturalWidth<=120 && '${thumbUrl}') this.src='${thumbUrl}';"
                     onerror="if(this.src!=='${thumbUrl}') this.src='${thumbUrl}';" alt="">
                <div class="release-card-top-badges">
                    <span class="release-date-pill ${badge.cls}">${badge.text}</span>
                    ${hasCovers
                        ? `<span class="release-extra-pill cover">🎧 ${song.covers.length} Cover</span>`
                        : (playsCount > 0 ? `<span class="release-extra-pill">👁 ${playsCount}</span>` : '')
                    }
                </div>
                ${watermark ? `<div class="release-rank-watermark">${watermark}</div>` : ''}
            </div>
        </div>

        <div class="release-card-body">
            <div class="release-card-meta">
                <div class="release-card-title" title="${song.title}">${song.title}</div>
                <div class="release-card-artist">${getColoredArtist(song.artist)}</div>
            </div>
            <div class="release-card-actions">
                <button class="release-queue-btn" onclick="window.quickQueueFromCard(event, '${song.id}', this)" title="เพิ่มเข้าคิวเพลง">
                    <i class="fa-solid fa-plus"></i>
                </button>
                <button class="release-play-pill" onclick="event.stopPropagation(); window.playSong('${song.id}')" title="เล่นเพลงนี้">
                    <i class="fa-solid fa-play"></i>
                </button>
            </div>
        </div>
    `;
    return item;
}

window.renderRecentlyAdded = function() {
    const container = document.getElementById('recentlyAddedList');
    if (!container || !window.songs || window.songs.length === 0) return;

    const recent = [...window.songs]
        .filter(s => s.createdAt)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 8);

    renderExpandableGlassGrid(container, recent, (song, idx) => ({
        idx,
        isFeatured: idx === 0,
        badge: formatSmartReleaseBadge(song.createdAt, idx),
        watermark: `#${idx + 1}`
    }));
};

// ==========================================
// 🏆 3. ชาร์ตเพลงฮิต Top 10 (ยอดรวมทั้งระบบ)
// ==========================================
window.renderSystemTop = function() {
    const container = document.getElementById('systemTopList');
    if (!container || !window.songs) return;

    const list = [...window.songs]
        .filter(s => (s.plays || 0) > 0)
        .sort((a, b) => (b.plays - a.plays) || ((b.seconds || 0) - (a.seconds || 0)))
        .slice(0, 10);

    if (list.length === 0) {
        container.innerHTML = `
            <div class="home-panel-card">
                <div class="stats-card-head">
                    <h2 class="section-title">🏆 ชาร์ตเพลงฮิต Top 10</h2>
                </div>
                <div class="stats-empty">ยังไม่มีข้อมูลการจัดอันดับ<br><span style="font-size:.9em; color:var(--text-3);">ล็อกอินแล้วกดเล่นเพลง ยอดวิวจะรวมกันที่นี่ 🎧</span></div>
            </div>
        `;
        return;
    }

    const items = list.map((s, idx) => {
        const rank = idx + 1;
        const rankClass = rank <= 3 ? `rank-top-${rank}` : '';
        const videoId = window.extractYouTubeID(s.audioPath);
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/default.jpg` : '';
        return `
            <div class="chart-song-item" onclick="playSong('${s.id}')">
                <div class="chart-rank ${rankClass}">${rank}</div>
                <img src="${thumbUrl}" onerror="this.style.display='none'">
                <div class="stat-song-info">
                    <div class="stat-song-title">${s.title}</div>
                    <div class="stat-song-artist">${getColoredArtist(s.artist)}</div>
                </div>
                <div class="stat-song-meta">👁 ${s.plays} ครั้ง<br>🎧 ${window.formatShortDuration(s.seconds || 0)}</div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="home-panel-card">
            <div class="stats-card-head">
                <h2 class="section-title">🏆 ชาร์ตเพลงฮิต Top 10</h2>
                <span class="stats-account-tag">ยอดรวมทุกบัญชีที่ล็อกอิน</span>
            </div>
            <div class="top-chart-grid">
                ${items}
            </div>
        </div>
    `;
};

// ==========================================
// 🎤 4. Artist Spotlight (ไฮไลต์ศิลปินแนะนำ)
// ==========================================
window.renderArtistWidget = function() {
    const container = document.getElementById('artistWidgetContent');
    if (!container || !window.songs || window.songs.length === 0) return;

    const artistSet = new Set();
    window.songs.forEach(s => window.getSingersList(s.artist).forEach(n => artistSet.add(n)));
    const allArtists = Array.from(artistSet).filter(a => a !== 'ดนตรี');

    if (allArtists.length === 0) {
        container.innerHTML = '<div style="color: var(--text-3); text-align: center;">ไม่พบข้อมูลศิลปิน</div>';
        return;
    }

    const randomArtist = allArtists[Math.floor(Math.random() * allArtists.length)];
    const artistSongs = window.songs.filter(song => window.getSingersList(song.artist).includes(randomArtist) || (song.artist || '').includes(randomArtist));
    const totalPlays = artistSongs.reduce((sum, s) => sum + (s.plays || 0), 0);
    const shuffledSongs = [...artistSongs].sort(() => 0.5 - Math.random());
    const displaySongs = shuffledSongs.slice(0, 4);
    const badgeColor = (window.SINGER_COLORS && window.SINGER_COLORS[randomArtist])
        ? window.SINGER_COLORS[randomArtist]
        : (window.getArtistColor ? window.getArtistColor(randomArtist) : '#0a84ff');

    const firstVideoId = artistSongs[0] ? window.extractYouTubeID(artistSongs[0].audioPath) : null;
    const avatarThumb = firstVideoId ? `https://img.youtube.com/vi/${firstVideoId}/mqdefault.jpg` : '';
    const initial = randomArtist.charAt(0).toUpperCase();
    const safeArtistArg = randomArtist.replace(/'/g, "\\'");

    const songsHtml = displaySongs.map(song => {
        const videoId = window.extractYouTubeID(song.audioPath);
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';
        return `
            <div class="spotlight-song-card" onclick="playSong('${song.id}')">
                <img src="${thumbUrl}" onerror="this.style.display='none'">
                <div class="stat-song-info">
                    <div class="stat-song-title">${song.title}</div>
                    <div class="stat-song-artist">${getColoredArtist(song.artist)}</div>
                </div>
                <div class="spotlight-play-icon"><i class="fa-solid fa-play"></i></div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="artist-spotlight-card" style="--spot-color:${badgeColor};">
            <div class="artist-spotlight-top">
                <div class="artist-spotlight-identity" onclick="window.openArtistFromSpotlight('${safeArtistArg}')" title="ดูเพลงทั้งหมดของศิลปินนี้">
                    <div class="artist-card-avatar" style="background-image:url('${avatarThumb}'); border:2px solid ${badgeColor};">
                        <span class="artist-card-initial" style="color:${badgeColor};">${initial}</span>
                    </div>
                    <div class="artist-spotlight-meta">
                        <div class="artist-spotlight-eyebrow">🎤 ศิลปินแนะนำ</div>
                        <div class="artist-spotlight-name" style="color:${badgeColor};">${randomArtist}</div>
                        <div class="artist-spotlight-sub">🎵 ${artistSongs.length} เพลงในคลัง${totalPlays > 0 ? ` · 👁 ${totalPlays} ครั้ง` : ''}</div>
                    </div>
                </div>
                <div class="artist-spotlight-actions">
                    <button class="btn-secondary spotlight-all-btn" onclick="window.openArtistFromSpotlight('${safeArtistArg}')">
                        ดูทั้งหมด (${artistSongs.length}) <i class="fa-solid fa-arrow-right"></i>
                    </button>
                    <button class="widget-refresh-btn" onclick="renderArtistWidget()" title="สุ่มศิลปินใหม่">
                        <i class="fa-solid fa-arrows-rotate"></i>
                    </button>
                </div>
            </div>
            <div class="spotlight-song-grid">
                ${songsHtml}
            </div>
        </div>
    `;
};

// ==========================================
// ✨ 5. เพลงสุ่มน่าฟัง (Random Picks — Spatial Glass Grid ยุบ/ขยายในหน้าเดียว)
// ==========================================
window.renderRandomPlaylist = function() {
    const container = document.getElementById('randomSongList');
    if (!container || !window.songs || window.songs.length === 0) return;

    const shuffled = [...window.songs].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 8);

    renderExpandableGlassGrid(container, selected, (song, idx) => ({
        idx,
        isFeatured: false,
        badge: { text: '🎲 สุ่มแนะนำ', cls: '' },
        watermark: ''
    }));
};

// ==========================================
// 👤 6. หน้าโปรไฟล์และสถิติการฟังของคุณ (#view-profile)
// - แสดงข้อมูลบัญชี + ปุ่มเข้า/ออกจากระบบ
// - สรุปเวลาฟัง + ศิลปินที่ฟังบ่อยที่สุด
// - จัดอันดับเพลงที่คุณฟังบ่อยที่สุด (Most Played) + เพิ่งฟังไปล่าสุด
// ==========================================
window.renderProfileView = function() {
    const container = document.getElementById('profileViewContainer');
    if (!container) return;

    const user = window.currentUser || null;
    const isLoggedIn = !!window.isLoggedIn && !!user;
    const isAdmin = !!window.isAdmin;
    const displayName = isLoggedIn
        ? (user.displayName || (user.email ? user.email.split('@')[0] : 'ผู้ใช้งาน'))
        : 'ผู้เยี่ยมชม (ยังไม่ได้เข้าสู่ระบบ)';
    const emailText = isLoggedIn
        ? (user.email || '')
        : 'เข้าสู่ระบบด้วย Google เพื่อซิงค์สถิติการฟังและ Playlist ข้ามอุปกรณ์';
    const photoStyle = (isLoggedIn && user.photoURL) ? `background-image:url('${user.photoURL}');` : '';

    const st = window.stats || { totalPlays: 0, totalSeconds: 0, todaySeconds: 0, todayCount: 0, songs: {}, recent: [] };
    const hasData = (st.totalPlays > 0 || st.totalSeconds > 0) && window.songs && window.songs.length > 0;

    // คำนวณศิลปินที่คุณฟังบ่อยที่สุด
    let topArtistName = '—';
    let topArtistColor = 'var(--text-1)';
    let topArtistPlays = 0;
    if (hasData && st.songs) {
        const artistScores = {};
        Object.entries(st.songs).forEach(([id, v]) => {
            const song = (window.songs || []).find(s => s.id === id);
            if (!song) return;
            window.getSingersList(song.artist).forEach(singer => {
                if (!singer || singer === 'ดนตรี') return;
                if (!artistScores[singer]) artistScores[singer] = { plays: 0, seconds: 0 };
                artistScores[singer].plays += (v.plays || 0);
                artistScores[singer].seconds += (v.seconds || 0);
            });
        });
        const sortedArtists = Object.entries(artistScores)
            .sort((a, b) => (b[1].plays - a[1].plays) || (b[1].seconds - a[1].seconds));
        if (sortedArtists.length > 0) {
            topArtistName = sortedArtists[0][0];
            topArtistPlays = sortedArtists[0][1].plays;
            topArtistColor = (window.SINGER_COLORS && window.SINGER_COLORS[topArtistName])
                ? window.SINGER_COLORS[topArtistName]
                : '#0a84ff';
        }
    }

    // 🔥 เพลงที่คุณฟังบ่อยที่สุด (Top 10)
    const topEntries = Object.entries(st.songs || {})
        .map(([id, v]) => ({ id, ...v }))
        .filter(e => (e.plays || 0) > 0 || (e.seconds || 0) > 0)
        .sort((a, b) => (b.plays - a.plays) || (b.seconds - a.seconds))
        .slice(0, 10);

    const maxUserPlays = topEntries.length > 0 ? Math.max(1, topEntries[0].plays || 1) : 1;

    const topSongsHtml = topEntries.map((e, idx) => {
        const song = (window.songs || []).find(s => s.id === e.id);
        if (!song) return '';
        const rank = idx + 1;
        const rankClass = rank <= 3 ? `rank-top-${rank}` : '';
        const barPct = Math.max(8, Math.round(((e.plays || 1) / maxUserPlays) * 100));
        const videoId = window.extractYouTubeID(song.audioPath);
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/default.jpg` : '';
        return `
            <div class="chart-song-item profile-top-song" onclick="playSong('${e.id}')">
                <div class="chart-rank ${rankClass}">${rank}</div>
                <img src="${thumbUrl}" onerror="this.style.display='none'">
                <div class="stat-song-info">
                    <div class="stat-song-title">${song.title}</div>
                    <div class="stat-song-artist">${getColoredArtist(song.artist)}</div>
                    <div class="profile-song-bar"><div class="profile-song-bar-fill" style="width:${barPct}%;"></div></div>
                </div>
                <div class="stat-song-meta"><b>${e.plays} ครั้ง</b><br>🎧 ${window.formatShortDuration(e.seconds || 0)}</div>
            </div>
        `;
    }).join('');

    // 🕘 เพิ่งฟังไปล่าสุด (Recent 8)
    const recentList = (st.recent || []).slice(0, 8);
    const recentSongsHtml = recentList.map(r => {
        const song = (window.songs || []).find(s => s.id === r.songId);
        if (!song) return '';
        const videoId = window.extractYouTubeID(song.audioPath);
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/default.jpg` : '';
        return `
            <div class="stat-song-item" onclick="playSong('${r.songId}')">
                <img src="${thumbUrl}" onerror="this.style.display='none'">
                <div class="stat-song-info">
                    <div class="stat-song-title">${song.title}</div>
                    <div class="stat-song-artist">${getColoredArtist(song.artist)}</div>
                </div>
                <div class="stat-song-meta">🎧 ${window.formatShortDuration(r.sec || 0)}</div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="profile-hero-card">
            <div class="profile-hero-left">
                <div class="profile-hero-avatar" style="${photoStyle}">
                    ${isLoggedIn && user.photoURL ? '' : '<i class="fa-solid fa-user"></i>'}
                </div>
                <div class="profile-hero-info">
                    <div class="profile-hero-badges">
                        <span class="profile-role-badge ${isLoggedIn ? 'online' : ''}">
                            ${isLoggedIn ? '🟢 ซิงค์บัญชี Google แล้ว' : '🔒 บันทึกชั่วคราวในเครื่อง'}
                        </span>
                        ${isAdmin ? '<span class="profile-admin-tag" style="margin:0;">👑 แอดมิน</span>' : ''}
                    </div>
                    <h2 class="profile-hero-name">${displayName}</h2>
                    <div class="profile-hero-email">${emailText}</div>
                </div>
            </div>
            <div class="profile-hero-actions">
                ${isLoggedIn
                    ? `<button class="btn-secondary profile-logout-btn" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i> ออกจากระบบ</button>`
                    : `<button class="btn-primary" onclick="loginWithGoogle()" style="margin:0;"><i class="fa-brands fa-google"></i> เข้าสู่ระบบด้วย Google</button>`
                }
            </div>
        </div>

        <div class="stats-card">
            <div class="stats-card-head">
                <h2 class="section-title">📊 สรุปสถิติการฟังของคุณ</h2>
            </div>
            <div class="stats-grid profile-stats-grid">
                <div class="stat-box">
                    <div class="stat-value">${window.formatDuration ? window.formatDuration(st.totalSeconds || 0) : '0 วินาที'}</div>
                    <div class="stat-label">⏱ เวลาฟังทั้งหมด</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${st.totalPlays || 0}</div>
                    <div class="stat-label">🎵 จำนวนครั้งที่เล่น</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${window.formatShortDuration ? window.formatShortDuration(st.todaySeconds || 0) : '0s'}</div>
                    <div class="stat-label">🎧 วันนี้ (${st.todayCount || 0} เพลง)</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value" style="color:${topArtistColor}; font-size:16px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${topArtistName}</div>
                    <div class="stat-label">💖 ศิลปินที่ฟังบ่อยสุด${topArtistPlays > 0 ? ` (${topArtistPlays} ครั้ง)` : ''}</div>
                </div>
            </div>

            ${!hasData ? `
                <div class="stats-empty" style="margin-top:18px;">
                    ยังไม่มีสถิติการฟังเพลง<br>
                    <span style="font-size:.9em; color:var(--text-3);">กดเล่นเพลงจากหน้าแรกหรือคลังเพลง แล้วอันดับเพลงที่คุณฟังบ่อยที่สุดจะแสดงที่นี่ 🎧</span>
                </div>
            ` : `
                <div class="profile-lists-layout">
                    <div class="stats-col">
                        <div class="stats-col-title">🔥 เพลงที่คุณฟังบ่อยที่สุด (Top ${topEntries.length})</div>
                        ${topSongsHtml || '<div class="stats-empty">ยังไม่มีข้อมูล</div>'}
                    </div>
                    <div class="stats-col">
                        <div class="stats-col-title">🕘 เพิ่งฟังไปล่าสุด</div>
                        ${recentSongsHtml || '<div class="stats-empty">ยังไม่มีข้อมูล</div>'}
                    </div>
                </div>
            `}
        </div>
    `;
};

// คงชื่อ window.renderHomeStats ไว้เพื่อให้ stats.js / library.js เรียกอัปเดตหน้าโปรไฟล์ได้ทันที
window.renderHomeStats = window.renderProfileView;
