// Main Bootstrapper for Musify
document.addEventListener('DOMContentLoaded', async () => {

    // Initialize IndexedDB first
    try {
        await window.db.init();
        console.log('[Musify] IndexedDB initialized.');
    } catch (e) {
        console.error('[Musify] Failed to initialize database:', e);
    }

    // Determine if we're running on Vercel (no Python backend)
    window.isVercel = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

    // Auth state callbacks
    const onSignedIn = async (user) => {
        console.log('[Musify] Signed in as:', user.displayName || user.email);

        // Load merged library (local + Firestore cloud)
        try {
            const songs = await window.db.getAllSongs();
            window.store.setState({ library: { ...window.store.getState().library, songs } });
        } catch (e) {
            console.error('[Musify] Failed to load library:', e);
        }

        // Switch to home view
        window.store.setState({ currentView: 'home' });
    };

    const onSignedOut = () => {
        console.log('[Musify] Signed out — showing auth screen.');
        window.store.setState({ currentView: 'auth', library: { songs: [], playlists: [] } });
        window.store.notify();
    };

    // Start auth listener — fires onSignedIn or onSignedOut once Firebase resolves auth state
    window.authManager.init(onSignedIn, onSignedOut);

    // Force initial render while auth resolves
    store.notify();
});

// App namespace for global access
window.app = {
    store: window.store,
    db: window.db,
    player: window.player,
    ui: window.ui,
    api: window.api,
    auth: window.authManager
};

