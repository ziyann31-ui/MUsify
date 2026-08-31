// ─── UIManager ────────────────────────────────────────────────────────────────
class UIManager {
    constructor() {
        this.appContainer = document.getElementById('main-content');
        this.currentRenderedView = null;
        this._importState = null; // Persists playlist data across re-renders

        this.initNavigation();
        this.initPlayerUI();

        store.subscribe('*', (state) => this.onStateChange(state));
    }

    // ── Navigation ──────────────────────────────────────────────────────────

    initNavigation() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                store.setState({ currentView: view });
            });
        });
    }

    onStateChange(state) {
        // Hide nav + mini player on auth screen
        const isAuth = state.currentView === 'auth';
        const nav = document.getElementById('bottom-nav');
        const miniPlayer = document.getElementById('mini-player');
        if (nav) nav.style.display = isAuth ? 'none' : '';
        if (miniPlayer && isAuth) miniPlayer.classList.add('hidden');

        if (!isAuth) this.updateNavigation(state.currentView);
        this.renderView(state.currentView);
        this.updatePlayerUI(state.player);
    }

    updateNavigation(activeView) {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === activeView);
        });
    }

    // ── View Renderer ───────────────────────────────────────────────────────

    renderView(viewId) {
        // Import view is stateful — don't re-render if already active
        if (this.currentRenderedView === viewId && viewId !== 'library') return;
        this.currentRenderedView = viewId;

        const template = document.getElementById(`tpl-${viewId}`);
        if (!template) return;

        const clone = template.content.cloneNode(true);
        this.appContainer.innerHTML = '';
        this.appContainer.appendChild(clone);

        if (viewId === 'home')     this.initHomeView();
        if (viewId === 'import')   this.initImportView();
        if (viewId === 'library')  this.initLibraryView();
        if (viewId === 'search')   this.initSearchView();
        if (viewId === 'settings') this.initSettingsView();
        if (viewId === 'auth')     this.initAuthView();

        if (window.lucide) window.lucide.createIcons();
    }

    switchView(viewId) {
        store.setState({ currentView: viewId });
    }

    // ── Full-Screen Player Toggle ────────────────────────────────────────────

    toggleFullScreenPlayer() {
        document.getElementById('full-player').classList.toggle('hidden');
    }

    // ── Player UI ────────────────────────────────────────────────────────────

    initPlayerUI() {
        document.getElementById('mp-play-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            window.player.toggle();
        });
        document.getElementById('mp-next-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            window.player.next();
        });
        document.getElementById('fp-play-btn').addEventListener('click', () => {
            window.player.toggle();
        });
        document.getElementById('fp-seek-slider').addEventListener('input', (e) => {
            window.player.seek(e.target.value);
        });
    }

    updatePlayerUI(playerState) {
        const mp = document.getElementById('mini-player');
        if (!playerState || !playerState.currentTrack) {
            mp.classList.add('hidden');
            return;
        }

        mp.classList.remove('hidden');
        const track = playerState.currentTrack;

        document.getElementById('mp-title').textContent  = track.title;
        document.getElementById('mp-artist').textContent = track.artist;
        document.getElementById('mp-artwork').src        = track.cover || '';

        const playing = playerState.isPlaying;
        document.getElementById('mp-play-btn').innerHTML = playing
            ? '<i data-lucide="pause"></i>'
            : '<i data-lucide="play"></i>';

        document.getElementById('fp-title').textContent  = track.title;
        document.getElementById('fp-artist').textContent = track.artist;
        document.getElementById('fp-artwork').src        = track.cover || '';

        document.getElementById('fp-play-btn').innerHTML = playing
            ? '<i data-lucide="pause" size="32"></i>'
            : '<i data-lucide="play" size="32"></i>';

        if (playerState.duration > 0) {
            const pct = (playerState.progress / playerState.duration) * 100;
            document.getElementById('mp-progress').style.width = `${pct}%`;
            document.getElementById('fp-seek-slider').value     = pct;
            document.getElementById('fp-current-time').textContent = this.formatTime(playerState.progress);
            document.getElementById('fp-duration').textContent     = this.formatTime(playerState.duration);
        }

        if (window.lucide) window.lucide.createIcons();
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    // ── Home View ────────────────────────────────────────────────────────────

    initHomeView() {
        const state = store.getState();
        const songs = state.library.songs || [];
        const user  = state.user;

        // Populate user avatar
        const avatarImg  = document.getElementById('user-avatar-img');
        const avatarIcon = document.getElementById('user-avatar-icon');
        if (avatarImg && user && user.photoURL) {
            avatarImg.src = user.photoURL;
            avatarImg.style.display = 'block';
            if (avatarIcon) avatarIcon.style.display = 'none';
        }

        const recentContainer = document.getElementById('home-recent');
        const recommendedContainer = document.getElementById('home-recommended');

        if (songs.length === 0) {
            recentContainer.innerHTML = `
                <div class="empty-state-inline">
                    <i data-lucide="music-2"></i>
                    <span>No music yet. Head to <strong>Import</strong> to add tracks.</span>
                </div>`;
            recommendedContainer.innerHTML = '';
            return;
        }

        songs.slice(0, 10).forEach(song => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <img src="${this.esc(song.cover)}" alt="Cover" onerror="this.src=''">
                <div class="card-title truncate">${this.esc(song.title)}</div>
                <div class="card-subtitle truncate">${this.esc(song.artist)}</div>`;
            card.addEventListener('click', () => window.player.play(song.id));
            recentContainer.appendChild(card);
        });

        [...songs].reverse().slice(0, 12).forEach(song => {
            const item = document.createElement('div');
            item.className = 'grid-card';
            item.innerHTML = `
                <img src="${this.esc(song.cover)}" alt="${this.esc(song.title)}" onerror="this.src=''">
                <div class="grid-card-title truncate">${this.esc(song.title)}</div>
                <div class="grid-card-sub truncate">${this.esc(song.artist)}</div>`;
            item.addEventListener('click', () => window.player.play(song.id));
            recommendedContainer.appendChild(item);
        });
    }

    // ── Library View ─────────────────────────────────────────────────────────

    initLibraryView() {
        const container = document.getElementById('library-content');
        const songs = store.getState().library.songs || [];

        if (songs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="inbox"></i>
                    <p>Your library is empty.<br>Import tracks to get started.</p>
                </div>`;
            return;
        }

        songs.forEach(song => {
            const el = document.createElement('div');
            el.className = 'list-item';
            el.innerHTML = `
                <img src="${this.esc(song.cover)}" alt="Cover" onerror="this.src=''">
                <div class="list-item-info">
                    <div class="list-item-title truncate">${this.esc(song.title)}</div>
                    <div class="list-item-subtitle truncate">${this.esc(song.artist)} · ${this.esc(song.album || '')}</div>
                </div>
                <div class="list-item-meta">
                    <span class="offline-badge">Offline</span>
                </div>`;
            el.addEventListener('click', () => window.player.play(song.id));
            container.appendChild(el);
        });
    }

    // ── Search View ──────────────────────────────────────────────────────────

    initSearchView() {
        const input = document.getElementById('search-input');
        const results = document.getElementById('search-results');
        const songs = store.getState().library.songs || [];

        const render = (query) => {
            const q = query.toLowerCase().trim();
            const filtered = q
                ? songs.filter(s =>
                    s.title.toLowerCase().includes(q) ||
                    s.artist.toLowerCase().includes(q) ||
                    (s.album || '').toLowerCase().includes(q))
                : [];

            if (!q) {
                results.innerHTML = `<div class="empty-state"><i data-lucide="search"></i><p>Search your local library</p></div>`;
            } else if (filtered.length === 0) {
                results.innerHTML = `<div class="empty-state"><i data-lucide="frown"></i><p>No results for "<strong>${this.esc(q)}</strong>"</p></div>`;
            } else {
                results.innerHTML = '';
                filtered.forEach(song => {
                    const el = document.createElement('div');
                    el.className = 'list-item';
                    el.innerHTML = `
                        <img src="${this.esc(song.cover)}" alt="Cover" onerror="this.src=''">
                        <div class="list-item-info">
                            <div class="list-item-title truncate">${this.esc(song.title)}</div>
                            <div class="list-item-subtitle truncate">${this.esc(song.artist)}</div>
                        </div>`;
                    el.addEventListener('click', () => window.player.play(song.id));
                    results.appendChild(el);
                });
            }
            if (window.lucide) window.lucide.createIcons();
        };

        input.addEventListener('input', (e) => render(e.target.value));
        render('');
    }

    // ── Import View ──────────────────────────────────────────────────────────

    initImportView() {
        const urlInput              = document.getElementById('import-url');
        const btnDetect             = document.getElementById('btn-detect');
        const resultsSection        = document.getElementById('import-results');
        const trackList             = document.getElementById('import-track-list');
        const selectAllCb           = document.getElementById('import-select-all');
        const btnDownloadSelected   = document.getElementById('btn-download-selected');
        const btnDownloadAll        = document.getElementById('btn-download-all');
        const overallBar            = document.getElementById('overall-progress-container');
        const overallFill           = document.getElementById('overall-progress-fill');
        const overallText           = document.getElementById('overall-progress-text');
        const overallDetail         = document.getElementById('overall-progress-detail');
        const detectedCount         = document.getElementById('detected-count');
        const plCover               = document.getElementById('pl-cover');
        const plTitle               = document.getElementById('pl-title');
        const plMeta                = document.getElementById('pl-meta');
        const plSelectedCount       = document.getElementById('pl-selected-count');
        const errorBanner           = document.getElementById('import-error');

        let playlist = null;           // { title, cover, trackCount, tracks[] }
        let isDownloading = false;

        // ── Restore persisted playlist from previous render ────────────────
        if (this._importState) {
            playlist = this._importState;
            this._renderPlaylist(playlist, {
                trackList, plCover, plTitle, plMeta, plSelectedCount,
                resultsSection, selectAllCb, detectedCount
            });
            this._updateSelectionCount(trackList, plSelectedCount, btnDownloadSelected);
        }

        // ── URL input — clear error on typing ─────────────────────────────
        urlInput.addEventListener('input', () => {
            errorBanner.classList.add('hidden');
            errorBanner.textContent = '';
        });

        // ── Detect button ─────────────────────────────────────────────────
        btnDetect.addEventListener('click', async () => {
            if (isDownloading) return;
            const url = urlInput.value.trim();

            errorBanner.classList.add('hidden');
            btnDetect.innerHTML = `<span class="btn-spinner"></span> Detecting…`;
            btnDetect.disabled = true;
            resultsSection.classList.add('hidden');
            trackList.innerHTML = '';

            try {
                playlist = await window.api.detectPlaylist(url);
                this._importState = playlist; // persist for re-renders

                this._renderPlaylist(playlist, {
                    trackList, plCover, plTitle, plMeta, plSelectedCount,
                    resultsSection, selectAllCb, detectedCount
                });
                this._updateSelectionCount(trackList, plSelectedCount, btnDownloadSelected);
                if (window.lucide) window.lucide.createIcons();

            } catch (err) {
                errorBanner.textContent = err.message || 'Unknown error.';
                errorBanner.classList.remove('hidden');
                playlist = null;
                this._importState = null;
            } finally {
                btnDetect.textContent = 'Detect Songs';
                btnDetect.disabled = false;
            }
        });

        // ── Select All checkbox ───────────────────────────────────────────
        selectAllCb.addEventListener('change', (e) => {
            trackList.querySelectorAll('.track-cb:not(:disabled)').forEach(cb => {
                cb.checked = e.target.checked;
            });
            this._updateSelectionCount(trackList, plSelectedCount, btnDownloadSelected);
        });

        // ── Per-track checkbox delegation ─────────────────────────────────
        trackList.addEventListener('change', (e) => {
            if (e.target.classList.contains('track-cb')) {
                const all  = trackList.querySelectorAll('.track-cb:not(:disabled)');
                const chk  = trackList.querySelectorAll('.track-cb:not(:disabled):checked');
                selectAllCb.indeterminate = chk.length > 0 && chk.length < all.length;
                selectAllCb.checked       = chk.length === all.length;
                this._updateSelectionCount(trackList, plSelectedCount, btnDownloadSelected);
            }
        });

        // ── Download helpers ──────────────────────────────────────────────
        const lockUI = (lock) => {
            isDownloading = lock;
            btnDetect.disabled           = lock;
            btnDownloadAll.disabled      = lock;
            btnDownloadSelected.disabled = lock;
            selectAllCb.disabled         = lock;
        };

        const download = async (tracks) => {
            if (!tracks.length) {
                this._showToast('No available tracks selected.', 'warn');
                return;
            }

            lockUI(true);
            overallBar.classList.remove('hidden');

            let done = 0;
            const total = tracks.length;

            const updateBar = (currentPct) => {
                const pct = Math.min(100, Math.floor(((done * 100) + currentPct) / (total * 100) * 100));
                overallFill.style.width    = `${pct}%`;
                overallText.textContent    = `${pct}%`;
                overallDetail.textContent  = `${done} / ${total} tracks`;
            };
            updateBar(0);

            let successCount = 0;

            for (const track of tracks) {
                const row    = trackList.querySelector(`[data-track-id="${track.id}"]`);
                const badge  = row ? row.querySelector('.track-status-badge') : null;
                const bar    = row ? row.querySelector('.track-progress-bar-fill') : null;
                const pctEl  = row ? row.querySelector('.track-pct') : null;

                if (badge)  { badge.className = 'track-status-badge status-downloading'; badge.textContent = 'Downloading'; }
                if (bar)    bar.style.width = '0%';

                try {
                    const blob = await window.api.downloadTrack(track, (p) => {
                        if (bar) bar.style.width = `${p}%`;
                        if (pctEl) pctEl.textContent = `${p}%`;
                        updateBar(p);
                    });

                    await window.db.saveSong(track, blob);
                    successCount++;

                    if (badge)  { badge.className = 'track-status-badge status-done'; badge.textContent = '✓ Saved'; }
                    if (pctEl)  pctEl.textContent = '';

                } catch (err) {
                    console.warn('Download failed for', track.id, err);
                    if (badge)  { badge.className = 'track-status-badge status-error'; badge.textContent = 'Failed'; }
                    if (pctEl)  pctEl.textContent = '';
                }

                done++;
                updateBar(0);
            }

            lockUI(false);

            // Refresh local library
            const localSongs = await window.db.getAllSongs();
            store.setState({ library: { ...store.getState().library, songs: localSongs } });

            this._showToast(`${successCount} of ${total} tracks saved to library.`, successCount === total ? 'success' : 'warn');
        };

        btnDownloadAll.addEventListener('click', async () => {
            if (!playlist) return;
            await download(playlist.tracks.filter(t => t.status === 'available'));
        });

        btnDownloadSelected.addEventListener('click', async () => {
            if (!playlist) return;
            const checked = Array.from(trackList.querySelectorAll('.track-cb:checked'));
            const ids = new Set(checked.map(cb => cb.dataset.trackId));
            await download(playlist.tracks.filter(t => ids.has(t.id)));
        });
    }

    // ── Import helpers ────────────────────────────────────────────────────────

    _renderPlaylist(playlist, { trackList, plCover, plTitle, plMeta, plSelectedCount,
                                resultsSection, selectAllCb, detectedCount }) {
        plCover.src             = playlist.cover || '';
        plTitle.textContent     = playlist.title || 'Unknown Playlist';
        plMeta.textContent      = `${playlist.trackCount} track${playlist.trackCount !== 1 ? 's' : ''} in playlist`;
        detectedCount.textContent = `${playlist.tracks.length} detected`;

        // Handle duplicates: mark duplicate track IDs
        const seenIds = new Map();
        playlist.tracks.forEach(t => {
            seenIds.set(t.id, (seenIds.get(t.id) || 0) + 1);
        });

        trackList.innerHTML = '';
        playlist.tracks.forEach((track, idx) => {
            const isAvailable = track.status === 'available';
            const isDuplicate = seenIds.get(track.id) > 1;

            const el = document.createElement('div');
            el.className = 'import-track-row';
            el.dataset.trackId = track.id;

            el.innerHTML = `
                <label class="import-track-check">
                    <input
                        type="checkbox"
                        class="track-cb"
                        data-idx="${idx}"
                        data-track-id="${track.id}"
                        ${isAvailable && !isDuplicate ? 'checked' : ''}
                        ${!isAvailable || isDuplicate ? 'disabled' : ''}
                    >
                </label>

                <div class="import-track-art">
                    <img
                        src="${this.esc(track.cover)}"
                        alt="${this.esc(track.title)}"
                        loading="lazy"
                        onerror="this.src=''; this.parentElement.classList.add('art-placeholder')"
                    >
                    ${!isAvailable ? '<div class="art-overlay-lock"><i data-lucide="lock"></i></div>' : ''}
                </div>

                <div class="import-track-info">
                    <div class="import-track-title truncate" title="${this.esc(track.title)}">
                        ${this.esc(track.title)}
                        ${isDuplicate ? '<span class="badge badge-dup">duplicate</span>' : ''}
                    </div>
                    <div class="import-track-artist truncate">${this.esc(track.artist)}</div>
                    <div class="import-track-album truncate">${this.esc(track.album)}</div>
                    <div class="import-track-meta">
                        <span class="meta-chip"><i data-lucide="clock-3"></i>${this.esc(track.duration)}</span>
                        <span class="meta-chip id-chip" title="Spotify Track ID">${this.esc(track.id)}</span>
                        ${!isAvailable ? `<span class="meta-chip unavail-chip">Unavailable</span>` : ''}
                    </div>
                    <div class="track-progress-bar hidden">
                        <div class="track-progress-bar-fill"></div>
                    </div>
                </div>

                <div class="import-track-right">
                    <span class="track-status-badge ${isAvailable ? (isDuplicate ? 'status-dup' : 'status-ready') : 'status-unavail'}">
                        ${isDuplicate ? 'Duplicate' : (isAvailable ? 'Ready' : 'Unavailable')}
                    </span>
                    <span class="track-pct"></span>
                </div>`;

            // Show progress bar on download start
            el.querySelector('.track-cb')?.addEventListener('change', () => {});
            trackList.appendChild(el);
        });

        // Default check all available non-duplicates
        const availCbs = trackList.querySelectorAll('.track-cb:not(:disabled)');
        selectAllCb.checked       = availCbs.length > 0;
        selectAllCb.indeterminate = false;

        resultsSection.classList.remove('hidden');
    }

    _updateSelectionCount(trackList, plSelectedCount, btnDownloadSelected) {
        const checked = trackList.querySelectorAll('.track-cb:checked').length;
        plSelectedCount.textContent = checked > 0 ? `${checked} selected` : '';
        btnDownloadSelected.disabled = checked === 0;
    }

    /** Simple toast notification */
    _showToast(message, type = 'info') {
        const existing = document.getElementById('musify-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'musify-toast';
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('toast-visible'));
        setTimeout(() => {
            toast.classList.remove('toast-visible');
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    }

    /** HTML-escape a value for safe insertion */
    esc(val) {
        return String(val ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    async initSettingsView() {
        // Populate user card
        const user = store.getState().user;
        const userCard = document.getElementById('settings-user-card');
        if (userCard && user) {
            userCard.innerHTML = `
                <img src="${this.esc(user.photoURL || '')}" alt="" onerror="this.style.display='none'">
                <div class="settings-user-card-info">
                    <div class="settings-user-name">${this.esc(user.displayName || 'Musify User')}</div>
                    <div class="settings-user-email">${this.esc(user.email || '')}</div>
                </div>`;
        }

        // Load current config from backend
        const config = await app.api.getConfig().catch(() => ({}));
        const folderInput = document.getElementById('settings-download-folder');
        const saveBtn = document.getElementById('btn-save-settings');
        const statusEl = document.getElementById('settings-status');

        if (folderInput && config.download_folder) {
            folderInput.value = config.download_folder;
        }


        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const folder = folderInput ? folderInput.value.trim() : 'downloads';
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';
                try {
                    await app.api.saveConfig({ ...config, download_folder: folder || 'downloads' });
                    statusEl.textContent = '✓ Settings saved!';
                    this._showToast('Settings saved!', 'success');
                } catch (e) {
                    statusEl.textContent = '✗ Failed to save: ' + e.message;
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Settings';
                }
            });
        }
    }

    // ── Auth View ─────────────────────────────────────────────────────────────

    initAuthView() {
        const googleBtn   = document.getElementById('btn-google-signin');
        const emailInput  = document.getElementById('auth-email');
        const passInput   = document.getElementById('auth-password');
        const nameInput   = document.getElementById('auth-name');
        const loginBtn    = document.getElementById('btn-email-login');
        const createBtn   = document.getElementById('btn-create-account');
        const resetBtn    = document.getElementById('btn-reset-password');
        const toggleLink  = document.getElementById('auth-toggle-link');
        const errorEl     = document.getElementById('auth-error');
        const nameRow     = document.getElementById('auth-name-row');
        const loginGroup  = document.getElementById('auth-login-group');
        const createGroup = document.getElementById('auth-create-group');

        let isCreating = false;

        const showError = (msg) => {
            if (errorEl) { errorEl.textContent = msg; errorEl.classList.remove('hidden'); }
        };
        const clearError = () => {
            if (errorEl) { errorEl.textContent = ''; errorEl.classList.add('hidden'); }
        };
        const setLoading = (btn, loading, text) => {
            btn.disabled = loading;
            btn.innerHTML = loading ? `<span class="btn-spinner"></span> ${text}` : text;
        };

        // Google Sign-In
        if (googleBtn) {
            googleBtn.addEventListener('click', async () => {
                clearError();
                setLoading(googleBtn, true, 'Signing in…');
                try {
                    await window.authManager.signInWithGoogle();
                    // authManager.init onSignedIn callback handles the rest
                } catch (e) {
                    showError(this._friendlyAuthError(e.code, e.message));
                    setLoading(googleBtn, false, '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style="height:18px;vertical-align:middle;margin-right:8px"> Continue with Google');
                }
            });
        }

        // Toggle between Login and Create Account
        if (toggleLink) {
            toggleLink.addEventListener('click', (e) => {
                e.preventDefault();
                isCreating = !isCreating;
                if (nameRow)     nameRow.classList.toggle('hidden', !isCreating);
                if (loginGroup)  loginGroup.classList.toggle('hidden', isCreating);
                if (createGroup) createGroup.classList.toggle('hidden', !isCreating);
                clearError();
            });
        }

        // Email login
        if (loginBtn) {
            loginBtn.addEventListener('click', async () => {
                clearError();
                const email = emailInput?.value.trim();
                const pass  = passInput?.value;
                if (!email || !pass) return showError('Please enter your email and password.');
                setLoading(loginBtn, true, 'Signing in…');
                try {
                    await window.authManager.signInWithEmail(email, pass);
                } catch (e) {
                    showError(this._friendlyAuthError(e.code, e.message));
                    setLoading(loginBtn, false, 'Sign In');
                }
            });
        }

        // Create account
        if (createBtn) {
            createBtn.addEventListener('click', async () => {
                clearError();
                const email = emailInput?.value.trim();
                const pass  = passInput?.value;
                const name  = nameInput?.value.trim();
                if (!email || !pass) return showError('Please enter your email and password.');
                if (pass.length < 6)  return showError('Password must be at least 6 characters.');
                setLoading(createBtn, true, 'Creating account…');
                try {
                    await window.authManager.createAccount(email, pass, name);
                } catch (e) {
                    showError(this._friendlyAuthError(e.code, e.message));
                    setLoading(createBtn, false, 'Create Account');
                }
            });
        }

        // Password reset
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                clearError();
                const email = emailInput?.value.trim();
                if (!email) return showError('Enter your email above to reset your password.');
                try {
                    await window.authManager.resetPassword(email);
                    if (errorEl) { errorEl.textContent = '✓ Reset email sent! Check your inbox.'; errorEl.classList.remove('hidden'); errorEl.style.color = 'var(--accent-color)'; }
                } catch (e) {
                    showError(this._friendlyAuthError(e.code));
                }
            });
        }
    }

    /** Convert Firebase error codes to friendly messages */
    _friendlyAuthError(code, message) {
        if (!code) return message || 'An unknown error occurred.';
        if (code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') return 'Invalid email or password.';
        if (code === 'auth/user-not-found') return 'No account found with this email.';
        if (code === 'auth/wrong-password') return 'Incorrect password.';
        if (code === 'auth/email-already-in-use') return 'Email is already in use.';
        if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
        if (code === 'auth/operation-not-allowed') return 'Provider not enabled in Firebase Console (Authentication > Sign-in method).';
        return 'Auth Error (' + code + '): ' + (message || '');
    }
}

window.ui = new UIManager();

