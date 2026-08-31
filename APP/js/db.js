// IndexedDB wrapper for Musify — with Firestore sync for metadata
const DB_NAME = 'MusifyDB';
const DB_VERSION = 1;
const STORE_SONGS = 'songs'; // Metadata
const STORE_AUDIO = 'audio'; // Blobs (local only — too large for Firestore)

class Database {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => reject(event.target.error);

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_SONGS)) {
                    db.createObjectStore(STORE_SONGS, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORE_AUDIO)) {
                    db.createObjectStore(STORE_AUDIO, { keyPath: 'id' });
                }
            };
        });
    }

    /** Save song metadata to IndexedDB AND Firestore, audio blob to IndexedDB only */
    async saveSong(metadata, audioBlob) {
        const songRecord = { ...metadata, downloadedAt: Date.now() };

        // 1. Save to local IndexedDB
        await new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_SONGS, STORE_AUDIO], 'readwrite');
            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e.target.error);

            transaction.objectStore(STORE_SONGS).put(songRecord);
            if (audioBlob) {
                transaction.objectStore(STORE_AUDIO).put({ id: metadata.id, blob: audioBlob });
            }
        });

        // 2. Mirror metadata to Firestore (if signed in)
        const uid = window.authManager ? window.authManager.getUid() : null;
        if (uid && window.firestoreDb && metadata.id) {
            try {
                const firestoreMeta = { ...songRecord };
                delete firestoreMeta.blob; // never put blobs in Firestore
                await window.firestoreDb
                    .collection('users').doc(uid)
                    .collection('songs').doc(metadata.id)
                    .set(firestoreMeta);
            } catch (e) {
                console.warn('[DB] Firestore sync failed (non-fatal):', e.message);
            }
        }
    }

    /** Get all songs — merges Firestore cloud library with local IndexedDB */
    async getAllSongs() {
        // Local songs from IndexedDB
        const localSongs = await new Promise((resolve, reject) => {
            const transaction = this.db.transaction(STORE_SONGS, 'readonly');
            const store = transaction.objectStore(STORE_SONGS);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });

        // Merge with Firestore cloud songs (if signed in)
        const uid = window.authManager ? window.authManager.getUid() : null;
        if (uid && window.firestoreDb) {
            try {
                const snapshot = await window.firestoreDb
                    .collection('users').doc(uid)
                    .collection('songs').get();

                const cloudSongs = snapshot.docs.map(d => d.data());
                const localIds = new Set(localSongs.map(s => s.id));

                // Add cloud-only songs (downloaded on another device)
                const cloudOnly = cloudSongs.filter(s => !localIds.has(s.id));
                return [...localSongs, ...cloudOnly];
            } catch (e) {
                console.warn('[DB] Firestore fetch failed (non-fatal):', e.message);
            }
        }

        return localSongs;
    }

    async getAudioBlob(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(STORE_AUDIO, 'readonly');
            const store = transaction.objectStore(STORE_AUDIO);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result ? request.result.blob : null);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async deleteSong(id) {
        // Delete from IndexedDB
        await new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_SONGS, STORE_AUDIO], 'readwrite');
            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e.target.error);
            transaction.objectStore(STORE_SONGS).delete(id);
            transaction.objectStore(STORE_AUDIO).delete(id);
        });

        // Delete from Firestore (if signed in)
        const uid = window.authManager ? window.authManager.getUid() : null;
        if (uid && window.firestoreDb) {
            try {
                await window.firestoreDb
                    .collection('users').doc(uid)
                    .collection('songs').doc(id)
                    .delete();
            } catch (e) {
                console.warn('[DB] Firestore delete failed (non-fatal):', e.message);
            }
        }
    }
}

window.db = new Database();

