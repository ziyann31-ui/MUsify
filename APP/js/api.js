/**
 * Musify API — communicates with the local Python backend proxy.
 * Spotify is used ONLY for playlist/track metadata.
 * Audio download is handled separately from legal sources only.
 */
class MusifyAPI {

    /**
     * Validate and extract the Spotify playlist ID from a share URL.
     * Returns the 22-char alphanumeric playlist ID, or throws on invalid input.
     */
    extractPlaylistId(url) {
        const trimmed = (url || '').trim();
        if (!trimmed) throw new Error('Please paste a Spotify playlist URL.');

        // Support both open.spotify.com and spotify: URI schemes
        const match = trimmed.match(/playlist[/:]([A-Za-z0-9]+)/);
        if (!match) {
            throw new Error(
                'Invalid Spotify playlist URL.\n' +
                'Expected format: https://open.spotify.com/playlist/...'
            );
        }
        return match[1];
    }

    async getConfig() {
        try {
            const res = await fetch('/api/config');
            if (res.ok) return await res.json();
        } catch(e) {}
        return {};
    }

    async saveConfig(config) {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        if (!res.ok) throw new Error("Failed to save config");
        return await res.json();
    }

    /**
     * Detect all tracks in a Spotify playlist via the Python backend.
     * Returns the exact playlist object — never guessed/substituted results.
     */
    async detectPlaylist(url) {
        // Validate URL client-side before hitting the server
        this.extractPlaylistId(url); // throws on bad input

        const endpoint = `/api/playlist?url=${encodeURIComponent(url.trim())}`;

        let response;
        try {
            response = await fetch(endpoint);
        } catch (networkErr) {
            throw new Error(
                'Cannot reach the Musify backend server.\n' +
                'Make sure server.py is running on localhost:8080.'
            );
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch playlist from Spotify.');
        }

        // Sanity-check shape
        if (!Array.isArray(data.tracks)) {
            throw new Error('Unexpected response from server — no track list returned.');
        }

        return data;
        // Shape: { title, cover, trackCount, tracks: [{ id, title, artist, album, cover, duration, previewUrl, status }] }
    }

    /**
     * Download audio for a track from a legally-permitted source.
     * Currently returns a placeholder blob. Replace with a real licensed
     * audio source endpoint (e.g. your own catalog, archive.org, etc.)
     * when available.
     *
     * @param {Object} track - Track metadata object from detectPlaylist()
     * @param {Function} progressCallback - Called with 0-100 progress values
     * @returns {Promise<Blob>} Audio blob
     */
    async downloadTrack(track, progressCallback) {
        if (track.status !== 'available') {
            throw new Error(`Track unavailable: ${track.reason || 'restricted'}`);
        }

        const endpoint = `/api/download?id=${encodeURIComponent(track.id)}&title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}`;
        
        let polling = true;
        
        // Start polling progress
        const pollProgress = async () => {
            while (polling) {
                try {
                    const res = await fetch(`/api/progress?id=${encodeURIComponent(track.id)}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.progress > 0) {
                            progressCallback(data.progress);
                        }
                    }
                } catch (e) { }
                await new Promise(r => setTimeout(r, 1000));
            }
        };
        
        pollProgress();

        let response;
        try {
            response = await fetch(endpoint);
        } catch (networkErr) {
            polling = false;
            throw new Error('Failed to download track from server.');
        }

        polling = false;
        progressCallback(100);

        if (!response.ok) {
            throw new Error('Failed to download track from server.');
        }

        const blob = await response.blob();
        return blob;
    }
}

window.api = new MusifyAPI();
