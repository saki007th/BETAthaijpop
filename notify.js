// ==========================================
// 📋 ระบบประวัติการอัปเดตเพลง (Cinematic Hero + Ambient Feed)
// ==========================================

const THAI_SHORT_MONTHS = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

function parseCreatedMs(ts) {
    if (!ts) return 0;
    if (typeof ts === 'number') return ts;
    if (typeof ts === 'object' && typeof ts.seconds === 'number') return ts.seconds * 1000;
    const parsed = new Date(ts).getTime();
    return isNaN(parsed) ? 0 : parsed;
}

function getSongAccent(song) {
    if (!song) return '#0a84ff';
    const singers = (typeof window.getSingersList === 'function')
        ? window.getSingersList(song.artist)
        : String(song.artist || '').split(',').map(s => s.trim()).filter(Boolean);
    for (const s of singers) {
        if (window.SINGER_COLORS && window.SINGER_COLORS[s]) {
            return window.SINGER_COLORS[s];
        }
    }
    return '#0a84ff';
}

function formatNotifyColoredArtist(artistStr) {
    const raw = (artistStr || '-').trim();
    const singers = (typeof window.getSingersList === 'function')
        ? window.getSingersList(raw)
        : raw.split(',').map(s => s.trim()).filter(Boolean);
    if (!singers.length) return `🎤 ${raw}`;

    const parts = singers.map(name => {
        const c = (window.SINGER_COLORS && window.SINGER_COLORS[name]) ? window.SINGER_COLORS[name] : null;
        if (c) {
            return `<span style="display:inline-flex;align-items:center;gap:5px;color:${c};font-weight:600;"><span style="width:6px;height:6px;border-radius:50%;background:${c};box-shadow:0 0 6px ${c};display:inline-block;flex-shrink:0;"></span>${name}</span>`;
        }
        return `<span style="display:inline-flex;align-items:center;gap:5px;color:rgba(255,255,255,.78);"><span style="width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,.35);display:inline-block;flex-shrink:0;"></span>${name}</span>`;
    });
    return parts.join('<span style="color:rgba(255,255,255,.38);">, </span>');
}

function formatDateHeading(ms, nowMs) {
    if (!ms) return { dateText: 'ไม่ระบุวันที่', relText: '', isRecent: false };
    const d = new Date(ms);
    const dateText = `${d.getDate()} ${THAI_SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;

    const today = new Date(nowMs);
    today.setHours(0, 0, 0, 0);
    const targetDay = new Date(ms);
    targetDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - targetDay.getTime()) / (24 * 60 * 60 * 1000));

    let relText = '';
    if (diffDays <= 0) relText = 'วันนี้';
    else if (diffDays === 1) relText = 'เมื่อวาน';
    else if (diffDays <= 7) relText = `${diffDays} วันที่แล้ว`;

    return {
        dateText,
        relText,
        isRecent: diffDays <= 7
    };
}

window.checkNewSongsNotification = function() {
    if (!window.songs || window.songs.length === 0) return;

    // 🔴 สำหรับตัวเลขแจ้งเตือนสีแดง (Badge) ยังคงให้แสดงเฉพาะเพลงใหม่ใน 7 วัน
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const newSongsCount = window.songs.filter(s => {
        const ms = parseCreatedMs(s.createdAt);
        return ms > 0 && (now - ms) <= sevenDaysMs;
    }).length;

    const badge = document.getElementById('notifyBadge');
    if (badge) {
        if (newSongsCount > 0) {
            badge.style.display = 'block';
            badge.innerText = newSongsCount;
        } else {
            badge.style.display = 'none';
        }
    }
};

window.openNotifyWindow = function() {
    if (!window.songs || window.songs.length === 0) return;

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    // ดึงเพลงทั้งหมดที่มี createdAt เรียงใหม่สุด -> เก่าสุด
    const allSortedSongs = window.songs
        .filter(s => parseCreatedMs(s.createdAt) > 0)
        .sort((a, b) => parseCreatedMs(b.createdAt) - parseCreatedMs(a.createdAt));

    const new7Count = allSortedSongs.filter(s => (now - parseCreatedMs(s.createdAt)) <= sevenDaysMs).length;
    const new30Count = allSortedSongs.filter(s => (now - parseCreatedMs(s.createdAt)) <= thirtyDaysMs).length;
    const coverCount = allSortedSongs.filter(s => Array.isArray(s.covers) && s.covers.length > 0).length;

    const sheet = document.getElementById('genericModalSheet');
    const wrap = document.createElement('div');
    wrap.className = 'notify-cinematic-wrap';

    const latestSong = allSortedSongs[0] || null;
    let currentFilter = 'all';
    let searchQuery = '';
    let activeSpotlightSong = latestSong;

    function getSongThumb(song, highRes = false) {
        if (!song) return '';
        const vid = window.extractYouTubeID ? window.extractYouTubeID(song.audioPath) : '';
        if (!vid) return '';
        return `https://img.youtube.com/vi/${vid}/${highRes ? 'hqdefault' : 'mqdefault'}.jpg`;
    }

    function applyHeroSpotlight(song, isHoverPreview = false) {
        if (!song) return;
        activeSpotlightSong = song;
        const accent = getSongAccent(song);
        const hqThumb = getSongThumb(song, true);
        const mqThumb = getSongThumb(song, false);
        const ms = parseCreatedMs(song.createdAt);
        const { dateText, relText } = formatDateHeading(ms, now);

        if (sheet) {
            sheet.style.setProperty('--notify-hero-accent', accent);
        }
        wrap.style.setProperty('--notify-hero-accent', accent);
        wrap.style.setProperty('--notify-hero-img', hqThumb ? `url('${hqThumb}')` : 'none');

        const spotImg = wrap.querySelector('#notifySpotImg');
        if (spotImg && mqThumb && spotImg.getAttribute('src') !== mqThumb) {
            spotImg.src = mqThumb;
        }
        const spotTag = wrap.querySelector('#notifySpotTag');
        if (spotTag) {
            const label = isHoverPreview ? '✨ กำลังเลือกดู' : '🔥 เพิ่งเพิ่มล่าสุด';
            const dateBadge = relText ? `${relText} · ${dateText}` : dateText;
            spotTag.textContent = `${label} · ${dateBadge}`;
        }
        const spotTitle = wrap.querySelector('#notifySpotTitle');
        if (spotTitle) spotTitle.textContent = song.title || '-';

        const spotArtist = wrap.querySelector('#notifySpotArtist');
        if (spotArtist) spotArtist.innerHTML = formatNotifyColoredArtist(song.artist);
    }

    wrap.innerHTML = `
        <div class="notify-hero">
            <div class="notify-hero-bg"></div>
            <div class="notify-hero-glow"></div>
            <div class="notify-hero-scrim"></div>

            <div class="notify-hero-content">
                <div class="notify-hero-topbar">
                    <div>
                        <div class="notify-kicker"><i class="fa-solid fa-sparkles"></i> RELEASE TIMELINE</div>
                        <h2 class="notify-hero-title">📋 ประวัติการเพิ่มเพลงทั้งหมด</h2>
                        <div class="notify-hero-sub">
                            คลังเพลง ${allSortedSongs.length} เพลง${new7Count > 0 ? ` · <span style="color:#5ac8fa;font-weight:600;">เพิ่งเพิ่มสัปดาห์นี้ ${new7Count} เพลง</span>` : ''}
                        </div>
                    </div>
                    <button type="button" class="notify-close-btn" title="ปิดหน้าต่าง">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                ${latestSong ? `
                <div class="notify-hero-spotlight" id="notifyHeroSpotlight" title="คลิกเพื่อเล่นเพลงนี้">
                    <div class="notify-spot-art-wrap">
                        <img id="notifySpotImg" src="${getSongThumb(latestSong, false)}" alt="" onerror="this.style.display='none'">
                    </div>
                    <div class="notify-spot-info">
                        <div class="notify-spot-tag" id="notifySpotTag">🔥 เพิ่งเพิ่มล่าสุด</div>
                        <div class="notify-spot-title" id="notifySpotTitle"></div>
                        <div class="notify-spot-artist" id="notifySpotArtist"></div>
                    </div>
                    <div class="notify-spot-actions">
                        <button type="button" class="notify-row-btn queue" id="notifySpotQueueBtn" title="เพิ่มเข้าคิวเพลง">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                        <button type="button" class="notify-spot-play" id="notifySpotPlayBtn" title="เล่นเพลงนี้">
                            <i class="fa-solid fa-play"></i><span>เล่นเลย</span>
                        </button>
                    </div>
                </div>
                ` : ''}

                <div class="notify-controls-bar">
                    <div class="notify-filter-pills" id="notifyFilterPills">
                        <button type="button" class="notify-pill active" data-filter="all">ทั้งหมด (${allSortedSongs.length})</button>
                        <button type="button" class="notify-pill" data-filter="7d">🔥 7 วันล่าสุด (${new7Count})</button>
                        <button type="button" class="notify-pill" data-filter="30d">🌙 30 วัน (${new30Count})</button>
                        ${coverCount > 0 ? `<button type="button" class="notify-pill" data-filter="cover">🎧 มี Cover (${coverCount})</button>` : ''}
                    </div>
                    <div class="notify-search-wrap">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input type="text" class="notify-search-input" id="notifySearchInput" placeholder="ค้นหาเพลง หรือ ศิลปิน...">
                    </div>
                </div>
            </div>
        </div>

        <div class="notify-feed-scroll" id="notifyFeedScroll"></div>
    `;

    const closeBtn = wrap.querySelector('.notify-close-btn');
    if (closeBtn) closeBtn.onclick = () => window.closeSheet();

    const spotlightEl = wrap.querySelector('#notifyHeroSpotlight');
    if (spotlightEl) {
        spotlightEl.onclick = () => {
            if (!activeSpotlightSong) return;
            window.closeSheet();
            window.playSong(activeSpotlightSong.id);
        };
    }
    const spotQueueBtn = wrap.querySelector('#notifySpotQueueBtn');
    if (spotQueueBtn) {
        spotQueueBtn.onclick = (e) => {
            e.stopPropagation();
            if (!activeSpotlightSong) return;
            if (typeof window.quickQueueFromCard === 'function') {
                window.quickQueueFromCard(e, activeSpotlightSong.id, spotQueueBtn);
            } else if (typeof window.addToQueue === 'function') {
                window.addToQueue(activeSpotlightSong.id);
            }
        };
    }
    const spotPlayBtn = wrap.querySelector('#notifySpotPlayBtn');
    if (spotPlayBtn) {
        spotPlayBtn.onclick = (e) => {
            e.stopPropagation();
            if (!activeSpotlightSong) return;
            window.closeSheet();
            window.playSong(activeSpotlightSong.id);
        };
    }

    const feedScroll = wrap.querySelector('#notifyFeedScroll');

    function renderFeed() {
        if (!feedScroll) return;
        feedScroll.innerHTML = '';

        const q = searchQuery.trim().toLowerCase();
        const filtered = allSortedSongs.filter(song => {
            const ms = parseCreatedMs(song.createdAt);
            if (currentFilter === '7d' && (now - ms) > sevenDaysMs) return false;
            if (currentFilter === '30d' && (now - ms) > thirtyDaysMs) return false;
            if (currentFilter === 'cover' && !(Array.isArray(song.covers) && song.covers.length > 0)) return false;

            if (q) {
                const titleMatch = String(song.title || '').toLowerCase().includes(q);
                const artistMatch = String(song.artist || '').toLowerCase().includes(q);
                return titleMatch || artistMatch;
            }
            return true;
        });

        if (filtered.length === 0) {
            feedScroll.innerHTML = `
                <div style="text-align:center; color:var(--text-3); padding:52px 16px;">
                    <div style="font-size:28px; margin-bottom:8px; opacity:.5;">🎵</div>
                    <div style="font-weight:600; color:var(--text-2);">ไม่พบเพลงในหมวดที่เลือก</div>
                    <div style="font-size:12px; margin-top:4px;">ลองเปลี่ยนตัวกรองหรือคำค้นหาดูนะครับ</div>
                </div>
            `;
            return;
        }

        // จัดกลุ่มตามวัน (YYYY-M-D)
        const groups = [];
        const groupMap = new Map();

        filtered.forEach(song => {
            const ms = parseCreatedMs(song.createdAt);
            const d = new Date(ms);
            const dayKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
            let grp = groupMap.get(dayKey);
            if (!grp) {
                grp = { dayKey, dayMs: ms, songs: [] };
                groupMap.set(dayKey, grp);
                groups.push(grp);
            }
            grp.songs.push(song);
        });

        groups.forEach(grp => {
            const groupEl = document.createElement('div');
            groupEl.className = 'notify-date-group';

            const { dateText, relText, isRecent } = formatDateHeading(grp.dayMs, now);

            const headEl = document.createElement('div');
            headEl.className = 'notify-date-head';
            headEl.innerHTML = `
                <span class="notify-date-dot${isRecent ? '' : ' is-older'}"></span>
                <span class="notify-date-title">📅 ${dateText}</span>
                ${relText ? `<span class="notify-date-rel">${relText}</span>` : ''}
                <span class="notify-date-line"></span>
                <span class="notify-date-count">${grp.songs.length} เพลง</span>
            `;
            groupEl.appendChild(headEl);

            grp.songs.forEach(song => {
                const row = document.createElement('div');
                row.className = 'notify-ambient-row';

                const accent = getSongAccent(song);
                const thumbUrl = getSongThumb(song, false);
                const ms = parseCreatedMs(song.createdAt);
                const isNew7 = (now - ms) <= sevenDaysMs;
                const coverLen = Array.isArray(song.covers) ? song.covers.length : 0;
                const isVinyl = song.hasMv === false;

                row.style.setProperty('--row-accent', accent);
                if (thumbUrl) row.style.setProperty('--row-bg', `url('${thumbUrl}')`);

                row.innerHTML = `
                    <div class="notify-row-ambient"></div>
                    <div class="notify-row-glow"></div>

                    <div class="notify-row-thumb">
                        ${thumbUrl
                            ? `<img src="${thumbUrl}" alt="" loading="lazy" onerror="this.style.display='none'">`
                            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-3);font-size:10px;">🎵</div>`
                        }
                        <div class="notify-row-play-ov"><i class="fa-solid fa-play"></i></div>
                    </div>

                    <div class="notify-row-body">
                        <div class="notify-row-title-line">
                            <span class="notify-row-title"></span>
                            ${isNew7 ? `<span class="notify-badge-pill is-new">NEW</span>` : ''}
                            ${coverLen > 0 ? `<span class="notify-badge-pill is-cover">🎧 ${coverLen} Cover</span>` : ''}
                            ${isVinyl ? `<span class="notify-badge-pill is-vinyl">💿 Audio</span>` : ''}
                        </div>
                        <div class="notify-row-sub-line">${formatNotifyColoredArtist(song.artist)}</div>
                    </div>

                    <div class="notify-row-actions">
                        <button type="button" class="notify-row-btn queue" title="เพิ่มเข้าคิวเพลง">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                        <button type="button" class="notify-row-btn play" title="เล่นเพลงนี้">
                            <i class="fa-solid fa-play"></i>
                        </button>
                    </div>
                `;

                const titleSpan = row.querySelector('.notify-row-title');
                if (titleSpan) {
                    titleSpan.textContent = song.title || '-';
                    titleSpan.title = song.title || '';
                }

                // Hovering any song row morphs the Hero Banner's ambient backdrop & spotlight
                row.onmouseenter = () => applyHeroSpotlight(song, song.id !== (latestSong && latestSong.id));

                row.onclick = () => {
                    window.closeSheet();
                    window.playSong(song.id);
                };

                const qBtn = row.querySelector('.notify-row-btn.queue');
                if (qBtn) {
                    qBtn.onclick = (e) => {
                        e.stopPropagation();
                        if (typeof window.quickQueueFromCard === 'function') {
                            window.quickQueueFromCard(e, song.id, qBtn);
                        } else if (typeof window.addToQueue === 'function') {
                            window.addToQueue(song.id);
                        }
                    };
                }

                const pBtn = row.querySelector('.notify-row-btn.play');
                if (pBtn) {
                    pBtn.onclick = (e) => {
                        e.stopPropagation();
                        window.closeSheet();
                        window.playSong(song.id);
                    };
                }

                groupEl.appendChild(row);
            });

            feedScroll.appendChild(groupEl);
        });
    }

    // Bind filter pills
    const filterContainer = wrap.querySelector('#notifyFilterPills');
    if (filterContainer) {
        filterContainer.querySelectorAll('.notify-pill').forEach(btn => {
            btn.onclick = () => {
                filterContainer.querySelectorAll('.notify-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.getAttribute('data-filter') || 'all';
                renderFeed();
            };
        });
    }

    // Bind search input
    const searchInput = wrap.querySelector('#notifySearchInput');
    if (searchInput) {
        searchInput.oninput = (e) => {
            searchQuery = e.target.value || '';
            renderFeed();
        };
    }

    window.openSheet('📋 ประวัติการเพิ่มเพลงทั้งหมด', wrap, () => {
        if (sheet) {
            sheet.classList.remove('notify-cinematic-sheet');
            sheet.style.removeProperty('--notify-hero-accent');
        }
    });

    if (sheet) {
        sheet.classList.add('notify-cinematic-sheet');
    }

    if (latestSong) {
        applyHeroSpotlight(latestSong, false);
    }
    renderFeed();
};
