/**
 * Vercel Serverless Function — /api/playlist
 * Scrapes Spotify embed page and returns playlist track metadata.
 * Mirrors the Python server.py handle_playlist() logic.
 */

const https = require('https');

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timed out')); });
    });
}

module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    // Extract playlist ID
    const match = url.match(/playlist[/:]([A-Za-z0-9]+)/);
    if (!match) return res.status(400).json({ error: 'Could not extract playlist ID from URL.' });
    const playlistId = match[1];

    try {
        const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
        const html = await fetchUrl(embedUrl);

        const dataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
        if (!dataMatch) throw new Error('Could not find playlist data on Spotify embed page.');

        const data = JSON.parse(dataMatch[1]);
        const entity = (data?.props?.pageProps?.state?.data?.entity) || {};

        if (!entity || !entity.trackList) throw new Error('Spotify embed returned empty data. Playlist may be private.');

        const coverArt = entity.coverArt || {};
        const sources = coverArt.sources || [];
        const coverUrl = sources.length > 0 ? sources[0].url || '' : '';

        const tracks = (entity.trackList || []).map(item => {
            const durationMs = item.duration || 0;
            const mins = Math.floor(durationMs / 60000);
            const secs = Math.floor((durationMs % 60000) / 1000);
            const uri = item.uri || '';
            const trackId = uri.includes(':') ? uri.split(':').pop() : (item.uid || '');
            const audioPreview = item.audioPreview || {};

            return {
                id: trackId,
                title: item.title || 'Unknown',
                artist: (item.subtitle || 'Unknown Artist').replace(/\u00a0/g, ', '),
                album: '',
                cover: coverUrl,
                duration: `${mins}:${String(secs).padStart(2, '0')}`,
                previewUrl: audioPreview.url || '',
                status: 'available'
            };
        });

        return res.status(200).json({
            title: entity.name || entity.title || 'Unknown Playlist',
            cover: coverUrl,
            trackCount: tracks.length,
            tracks
        });

    } catch (e) {
        console.error('[Musify API] Playlist error:', e.message);
        return res.status(400).json({ error: e.message });
    }
};
