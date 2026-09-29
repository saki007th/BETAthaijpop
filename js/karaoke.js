// ==========================================
// karaoke.js - Word-level karaoke highlight (ทีละคำ)
// ระบบเสริม: ทำงานคู่กับ line-level sync เดิม (player.js) โดยไม่แก้ของเดิม
// ถ้าไฟล์นี้ถูกลบ ระบบจะกลับไปเป็นแบบเดิมทันที (ไม่มีข้อมูลเก่าเสียหาย)
// ==========================================
(function () {
    'use strict';

    const K = {
        rafId: null,
        // เวลาแบบลื่น (วินาที) — คำนวณจาก getCurrentTime() + เวลาที่ผ่านไปจริง
        smoothT: 0,
        lastYtT: -1,
        lastAt: 0,
        isPlaying: false,
        // index ของท่อนที่กำลัง wrap คำไว้ (null = ยังไม่ได้ wrap)
        wrappedIndex: null,
        wordSpans: [],
        // คำที่ "กวาดอยู่" ตอนนี้ (ใช้ลดจำนวน DOM write)
        animating: -1,
        // ปิดใช้งาน: localStorage 'karaoke_off' = '1' หรือปุ่มในหน้าตั้งค่า
        disabled: false,
        warnedIndexes: new Set()
    };

    // ---------- utilities ----------
    const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

    function isDisabled() {
        if (K.disabled) return true;
        try { return localStorage.getItem('karaoke_off') === '1'; } catch (e) { return false; }
    }

    function getSong() {
        if (!window.songs || !window.currentSongId) return null;
        return window.songs.find(s => s.id === window.currentSongId) || null;
    }

    // เวลาจบของคำ: คำถัดไป หรือท่อนถัดไป (ลด 0.05 ไม่ให้ทับกัน) หรือครบสูงสุด 1.5 วิ
    function wordEnd(times, i, lineEnd) {
        const nextWord = (i + 1 < times.length) ? times[i + 1] : null;
        const t1 = nextWord != null ? nextWord : lineEnd;
        return Math.min(t1 != null ? t1 : times[i] + 1.5, times[i] + 1.5);
    }

    // เวลาจบของท่อน = เวลาเริ่มท่อนถัดไป, หรือ null ถ้าเป็นท่อนสุดท้าย
    function lineEndTime(timestamps, i) {
        for (let j = i + 1; j < timestamps.length; j++) {
            if (timestamps[j] != null) return timestamps[j];
        }
        return null;
    }

    // ---------- tokenize ----------
    // ตัดคำจากข้อความภาษาใดก็ได้ โดยเก็บช่องว่างไว้เป็น token แยก
    // คืน { text, weight } — weight ใช้หารเวลาตามสัดส่วนอักษร
    function tokenize(text) {
        const raw = String(text || '');
        const parts = raw.split(/(\s+)/).filter(p => p.length > 0);
        const toks = [];
        for (const p of parts) {
            if (/^\s+$/.test(p)) { toks.push({ text: p, isSpace: true, weight: 0 }); continue; }
            toks.push({ text: p, isSpace: false, weight: Math.max(1, p.length) });
        }
        return toks;
    }

    // แปลงรายการเวลาของคำใน "คำแม่" ให้เข้ากับคำของบรรทัดนี้
    // - จำนวนคำเท่ากัน → 1:1
    // - ไม่เท่ากัน → หารเวลาตามสัดส่วนจำนวนอักษร
    function alignWords(lineTokens, masterTimes, lineStart, lineEnd) {
        const words = lineTokens.filter(t => !t.isSpace);
        if (!words.length || !masterTimes || masterTimes.length < 2) return null;

        const span = (lineEnd != null ? lineEnd : lineStart + 2.5) - lineStart;
        if (!(span > 0.05)) return null;

        if (words.length === masterTimes.length) {
            return { words, times: masterTimes.slice(0, words.length), exact: true };
        }

        // หารตามสัดส่วนอักษร
        const totalW = words.reduce((s, w) => s + w.weight, 0) || 1;
        const out = [];
        let acc = 0;
        for (let k = 0; k < words.length; k++) {
            const t = lineStart + (acc / totalW) * span;
            out.push(t);
            acc += words[k].weight;
        }
        return { words, times: out, exact: false };
    }

    // ---------- หาคำในบรรทัดภาษาใดภาษาหนึ่ง ----------
    // เนื้อเพลงหนึ่งท่อนมีหลายบรรทัด (ญี่ปุ่น/โรมาจิ/ไทย) — wordTimes ผูกกับบรรทัดแรก
    // ถ้าเป็น dual-lyric (main || sub) ให้นับเฉพาะ .lyric-main
    // เพราะ textContent ของทั้งแถวจะรวม main+sub เข้าด้วยกัน
    function findLangRow(lineEl, langIdx) {
        const row = lineEl.querySelector('.lang-' + langIdx);
        if (!row) return null;
        return row.querySelector('.lyric-main') || row;
    }

    // ---------- wrap คำของท่อน active ----------
    function unwrapAll() {
        if (K.wordSpans.length) {
            const parents = new Set();
            for (const sp of K.wordSpans) {
                const parent = sp.parentNode;
                if (!parent) continue;
                parents.add(parent);
                parent.replaceChild(document.createTextNode(sp.textContent), sp);
            }
            // รวม text node ที่เหลือกลับเป็นข้อความเดียว (คืนสภาพเดิม)
            parents.forEach(p => { if (p.isConnected) p.normalize(); });
        }
        K.wordSpans = [];
        K.animating = -1;
        K.wrappedIndex = null;
    }

    function wrapActiveLine() {
        const idx = window.currentLyricIndex;
        if (K.wrappedIndex === idx) return;
        unwrapAll();
        if (idx == null || idx < 0) return;

        const song = getSong();
        if (!song) return;

        const wt = window.getActiveWordTimes(song);
        const entry = wt[idx];
        if (!entry || !Array.isArray(entry.t) || entry.t.length < 2) return;

        const timestamps = window.getActiveTimestamps(song);
        const lineStart = timestamps[idx];
        if (lineStart == null) return;
        const lineEnd = lineEndTime(timestamps, idx);

        const block = (window.currentLyricsArray || [])[idx];
        if (!block || block.trim() === '[ดนตรี]') return;

        const lineEl = document.getElementById('lyric-line-' + idx);
        if (!lineEl || !lineEl.isConnected) return;

        // ตรวจความสอดคล้องกับบรรทัดแรกก่อน (กันข้อมูลผิดทำให้ข้อความมั่ว)
        const firstRow = findLangRow(lineEl, 0);
        if (!firstRow) return;
        const masterTokens = tokenize(firstRow.textContent);
        const masterWords = masterTokens.filter(t => !t.isSpace);
        if (!masterWords.length) return;

        const drift = Math.abs(masterWords.length - entry.t.length) / entry.t.length;
        if (drift > 0.2) {
            if (!K.warnedIndexes.has(idx)) {
                K.warnedIndexes.add(idx);
                console.warn('[karaoke] line #' + (idx + 1) + ' word count mismatch (' + masterWords.length + ' vs ' + entry.t.length + ') - skipped');
            }
            return;
        }

        // ทีละบรรทัดภาษา (0..2) + บรรทัดย่อยของ dual-lyric
        const rows = lineEl.querySelectorAll('.lang-0, .lang-1, .lang-2');
        rows.forEach((row) => {
            const targets = [];
            const main = row.querySelector('.lyric-main');
            const sub = row.querySelector('.lyric-sub');
            if (main) targets.push(main);
            if (sub) targets.push(sub);
            if (!targets.length) targets.push(row);

            for (const target of targets) {
                const toks = tokenize(target.textContent);
                const aligned = alignWords(toks, entry.t, lineStart, lineEnd);
                if (!aligned) continue;

                const times = aligned.times;
                const frag = document.createDocumentFragment();
                let wi = 0;
                for (const tok of toks) {
                    if (tok.isSpace) { frag.appendChild(document.createTextNode(tok.text)); continue; }
                    const t0 = times[wi];
                    const nextT = (wi + 1 < times.length) ? times[wi + 1] : lineEnd;
                    const t1 = Math.min(nextT != null ? nextT : t0 + 1.5, t0 + 1.5);

                    const sp = document.createElement('span');
                    sp.className = 'kw';
                    sp.textContent = tok.text;
                    sp.dataset.kwT = String(t0);
                    sp.dataset.kwT1 = String(t1);
                    frag.appendChild(sp);
                    K.wordSpans.push(sp);
                    wi++;
                }
                target.textContent = '';
                target.appendChild(frag);
            }
        });

        K.wrappedIndex = idx;
    }

    // ---------- นาฬิกาเวลาแบบลื่น ----------
    function readTime() {
        const yt = window.ytPlayer;
        if (!yt || typeof yt.getCurrentTime !== 'function') return false;
        let t;
        try { t = yt.getCurrentTime(); } catch (e) { return false; }
        if (typeof t !== 'number' || t <= 0) return false;

        const now = performance.now();
        if (Math.abs(t - K.lastYtT) > 0.001) {
            K.lastYtT = t;
            K.lastAt = now;
        }
        K.smoothT = K.lastYtT + (K.isPlaying ? (now - K.lastAt) / 1000 : 0);
        return true;
    }

    // ---------- วาดความคืบหน้าของแต่ละคำ ----------
    function paint() {
        if (!K.wordSpans.length) return;
        const t = K.smoothT;

        for (let i = 0; i < K.wordSpans.length; i++) {
            const sp = K.wordSpans[i];
            if (!sp || !sp.isConnected) continue;
            const t0 = parseFloat(sp.dataset.kwT);
            const t1 = parseFloat(sp.dataset.kwT1);
            if (isNaN(t0) || isNaN(t1)) continue;

            const p = clamp01((t - t0) / Math.max(0.06, t1 - t0));
            const cur = sp._p;
            if (cur === undefined || Math.abs(cur - p) > 0.002) {
                sp.style.setProperty('--kw-p', p.toFixed(3));
                sp._p = p;
            }
        }
    }

    // ---------- loop ----------
    function tick() {
        K.rafId = requestAnimationFrame(tick);
        if (document.hidden) return;
        if (isDisabled()) return;

        try {
            readTime();
            wrapActiveLine();
            paint();
        } catch (e) {
            // ห้าม error หลุดออกไปกวนระบบเดิม
            console.warn('[karaoke]', e);
            cancelAnimationFrame(K.rafId);
            K.rafId = null;
        }
    }

    function start() {
        if (K.rafId != null) return;
        K.rafId = requestAnimationFrame(tick);
    }

    function stop() {
        if (K.rafId != null) { cancelAnimationFrame(K.rafId); K.rafId = null; }
        unwrapAll();
    }

    // ---------- เชื่อมกับระบบเดิม ----------
    const origUpdate = window.updateLyricDisplay;
    window.updateLyricDisplay = function () {
        const r = origUpdate.apply(this, arguments);
        try { if (K.wrappedIndex !== window.currentLyricIndex) unwrapAll(); } catch (e) {}
        return r;
    };

    const origRender = window.renderLyricsToContainer;
    window.renderLyricsToContainer = function () {
        const r = origRender.apply(this, arguments);
        try { unwrapAll(); } catch (e) {}
        return r;
    };

    // ---------- โหมด refine: จับเวลาทีละคำด้วยมือ ----------
    const R = {
        active: false,
        lineIndex: -1,
        wordIndex: 0,
        words: [],
        times: []
    };

    function refineLineAt(idx) {
        const song = getSong();
        if (!song || idx < 0) return false;
        const wt = window.getActiveWordTimes(song);
        const timestamps = window.getActiveTimestamps(song);
        const block = (window.currentLyricsArray || [])[idx];
        if (!block || block.trim() === '[ดนตรี]' || timestamps[idx] == null) return false;

        // ต้องมีเวลาเริ่มท่อนอยู่แล้ว
        const rows = String(block).split('\n').map(s => s.trim()).filter(s => s !== '');
        if (!rows.length) return false;
        const toks = tokenize(rows[0]).filter(t => !t.isSpace);

        // เริ่มจากค่าที่มีอยู่ ถ้ายังไม่มีให้สร้างแบบ auto ก่อน
        let entry = wt[idx];
        if (!entry || !Array.isArray(entry.t) || entry.t.length !== toks.length) {
            const lineEnd = lineEndTime(timestamps, idx);
            const gen = generateForLine(block, timestamps[idx], lineEnd);
            if (!gen) return false;
            entry = gen;
        }

        R.lineIndex = idx;
        R.words = toks.map(t => t.text);
        R.times = entry.t.slice();
        R.wordIndex = 0;
        R.mode = entry.mode || 'auto';
        return true;
    }

    function renderRefineBar() {
        let bar = document.getElementById('refineBar');
        if (!R.active) { if (bar) bar.remove(); return; }
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'refineBar';
            bar.style.cssText = 'position:fixed; left:50%; transform:translateX(-50%); bottom:24px; z-index:900; background:rgba(20,20,26,.94); border:1px solid rgba(175,82,222,.5); border-radius:12px; padding:14px 18px; color:#fff; max-width:min(92vw,640px); box-shadow:0 12px 40px rgba(0,0,0,.6);';
            document.body.appendChild(bar);
        }
        const cur = R.words[R.wordIndex] != null ? R.words[R.wordIndex] : '(จบ)';
        bar.innerHTML = `
            <div style="font-size:.8em; color:#af52de; font-weight:bold; margin-bottom:6px;">
                🎤 จับเวลาทีละคำ — ท่อน #${R.lineIndex + 1} · คำที่ ${Math.min(R.wordIndex + 1, R.words.length)}/${R.words.length}
            </div>
            <div style="font-size:1.1em; margin-bottom:4px;">${String(cur).replace(/</g, '&lt;')}</div>
            <div style="font-size:.78em; color:#aaa;">
                <b>Space</b> จับเวลา · <b>↓/↑</b> เลื่อนคำ · <b>W/Esc</b> ออก
            </div>`;
    }

    function persistRefine() {
        const song = getSong();
        if (!song) return;
        const isCover = (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]);
        const target = isCover ? song.covers[window.currentCoverIndex] : song;
        if (!target.wordTimes) target.wordTimes = [];
        target.wordTimes[R.lineIndex] = { t: R.times.slice(), mode: 'tap' };
    }

    window.karaokeRefine = {
        isActive: () => R.active,
        start() {
            const idx = window.currentLyricIndex;
            const startIdx = (idx >= 0) ? idx : 0;
            if (!refineLineAt(startIdx)) { alert('ท่อนนี้ยังไม่มีเวลาเริ่ม — กด Space จับจังหวะท่อนก่อน'); return; }
            R.active = true;
            window.lyricManualOverride = true;
            unwrapAll();
            renderRefineBar();
        },
        stop() {
            if (!R.active) return;
            R.active = false;
            persistRefine();
            window.saveTimestampsToFirebase().then(() => {
                window.karaoke.reset();
                window.renderTimestampEditor();
            }).catch(e => console.error(e));
            renderRefineBar();
        },
        move(delta) {
            if (!R.active) return;
            R.wordIndex = Math.max(0, Math.min(R.wordIndex + delta, R.words.length - 1));
            renderRefineBar();
        },
        tapCurrentTime() {
            if (!R.active) return;
            const yt = window.ytPlayer;
            if (!yt || typeof yt.getCurrentTime !== 'function') return;
            const offsetMs = parseInt(localStorage.getItem('admin_audio_offset')) || 0;
            const t = Math.max(0, yt.getCurrentTime() - offsetMs / 1000);

            R.times[R.wordIndex] = +t.toFixed(3);
            R.mode = 'tap';
            if (R.wordIndex < R.words.length - 1) R.wordIndex++;
            renderRefineBar();
            // เขียนทันทีทีละคำ (Firestore เขียนบ่อยได้เพราะ refine เป็นงานแอดมินแบบครั้งคราว)
            persistRefine();
            window.saveTimestampsToFirebase().catch(e => console.error(e));
        }
    };

    // ตามสถานะการเล่น
    const origState = window.onPlayerStateChange;
    if (typeof origState === 'function') {
        window.onPlayerStateChange = function (event) {
            if (event && event.data === 1) { K.isPlaying = true; start(); }
            else { K.isPlaying = false; }
            return origState.apply(this, arguments);
        };
    }

    window.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { K.isPlaying = false; }
        else { K.isPlaying = true; }
    });

    // ---------- สร้าง word timing อัตโนมัติ ----------
    // แบ่งเวลาของท่อนตามสัดส่วนจำนวนอักษรของแต่ละคำ (ประมาณดีสำหรับเสียงที่ร้องสม่ำเสมอ)
    function generateForLine(block, lineStart, lineEnd) {
        const span = (lineEnd != null ? lineEnd : lineStart + 2.5) - lineStart;
        if (!(span > 0.1)) return null;

        // ใช้บรรทัดภาษาแรกที่ไม่ว่างเป็นตัวแทน
        const rows = String(block || '').split('\n').map(s => s.trim()).filter(s => s !== '');
        if (!rows.length) return null;
        const toks = tokenize(rows[0]).filter(t => !t.isSpace);
        if (!toks.length) return null;

        const totalW = toks.reduce((s, w) => s + w.weight, 0) || 1;
        const times = [];
        let acc = 0;
        for (const tok of toks) {
            times.push(+(lineStart + (acc / totalW) * span).toFixed(3));
            acc += tok.weight;
        }
        return { t: times, mode: 'auto' };
    }

    window.karaokeGenerateForCurrent = function () {
        const song = getSong();
        if (!song) return 0;
        const timestamps = window.getActiveTimestamps(song);
        const isCover = (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]);
        const target = isCover ? song.covers[window.currentCoverIndex] : song;
        if (!target.wordTimes) target.wordTimes = [];

        let made = 0;
        window.currentLyricsArray.forEach((block, i) => {
            if (timestamps[i] == null) return;
            if (block.trim() === '[ดนตรี]') return;
            target.wordTimes[i] = generateForLine(block, timestamps[i], lineEndTime(timestamps, i));
            if (target.wordTimes[i]) made++;
        });
        return made;
    };

    // ---------- API สำหรับ Phase 2/3 + ปุ่มในหน้าตั้งค่า ----------
    window.karaoke = {
        start,
        stop,
        reset: unwrapAll,
        isRunning: () => K.rafId != null,
        isDisabled,
        setDisabled(v) {
            K.disabled = !!v;
            try { localStorage.setItem('karaoke_off', v ? '1' : '0'); } catch (e) {}
            if (v) { stop(); } else { K.isPlaying = true; start(); }
        },
        toggle() { window.karaoke.setDisabled(!window.karaoke.isDisabled()); return window.karaoke.isDisabled(); }
    };

    // เริ่มทำงานทันที (ถ้าเปิดปิดอยู่)
    if (!isDisabled()) start();
})();
