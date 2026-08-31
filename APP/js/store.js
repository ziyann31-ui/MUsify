// Simple Pub/Sub State Manager
class Store {
    constructor(initialState = {}) {
        this.state = initialState;
        this.listeners = new Map();
    }

    getState() {
        return this.state;
    }

    setState(partialState) {
        this.state = { ...this.state, ...partialState };
        this.notify();
    }

    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);
        // Return unsubscribe function
        return () => {
            const arr = this.listeners.get(key);
            this.listeners.set(key, arr.filter(cb => cb !== callback));
        };
    }

    notify() {
        // Notify all generic listeners
        if (this.listeners.has('*')) {
            this.listeners.get('*').forEach(cb => cb(this.state));
        }
    }
}

// Initial state shape
const initialState = {
    currentView: 'home',
    user: null,
    library: {
        songs: [],
        playlists: [],
    },
    downloads: {
        active: false,
        queue: [],
        progress: 0, // 0-100
        completed: 0,
        total: 0
    },
    player: {
        currentTrack: null,
        isPlaying: false,
        progress: 0,
        duration: 0,
        queue: [],
        history: []
    }
};

window.store = new Store(initialState);
