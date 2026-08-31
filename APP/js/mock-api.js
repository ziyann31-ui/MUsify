// Real API wrapper for Musify interacting with our Python Backend

class API {
    async detectPlaylist(url) {
        if (!url || !url.includes('spotify.com/playlist/')) {
            throw new Error("Invalid Spotify playlist URL. Please paste a valid share link (e.g., https://open.spotify.com/playlist/...).");
        }

        const response = await fetch(`/api/playlist?url=${encodeURIComponent(url)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Failed to resolve playlist.");
        }

        return data; // Returns { title, cover, trackCount, tracks: [...] }
    }

    async downloadTrack(track, progressCallback) {
        if (track.status !== 'available') {
            throw new Error(`Cannot download: ${track.reason || 'Restricted'}`);
        }

        // We simulate the actual audio blob download since Spotify API doesn't provide full audio files.
        // In a real production app with proper rights, this would hit a legal audio catalog backend.
        return new Promise((resolve, reject) => {
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 25; // slightly faster mock download
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(interval);
                    progressCallback(100);
                    
                    const mockAudioContent = new Blob(['mock audio content for ' + track.id], { type: 'audio/mpeg' });
                    resolve(mockAudioContent);
                } else {
                    progressCallback(Math.floor(progress));
                }
            }, 200);
        });
    }
}

window.api = new API();
