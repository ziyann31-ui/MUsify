import http.server
import socketserver
import json
import urllib.request
import urllib.parse
import urllib.error
import base64
import os
import re
import sys
import traceback

PORT = 8080
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")

print(f"[Musify] Starting server on port {PORT}...", flush=True)
print(f"[Musify] Config file: {CONFIG_FILE}", flush=True)

download_progress = {}

class SpotifyEmbedScraper:
    def fetch_playlist(self, playlist_id):
        url = f'https://open.spotify.com/embed/playlist/{playlist_id}'
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        })
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                html = resp.read().decode('utf-8')
            match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html)
            if not match:
                raise Exception("Could not find playlist data on Spotify embed page.")
            data = json.loads(match.group(1))
            entity = data.get('props', {}).get('pageProps', {}).get('state', {}).get('data', {}).get('entity', {})
            if not entity:
                raise Exception("Spotify embed returned empty entity. Playlist may be private.")
            return entity
        except urllib.error.URLError as e:
            raise Exception(f"Network error fetching Spotify embed: {e.reason}")
        except Exception as e:
            raise Exception(f"Spotify Scraper error: {e}")

spotify = SpotifyEmbedScraper()

class MusifyHandler(http.server.SimpleHTTPRequestHandler):
    timeout = 60  # Allow up to 60s for long operations

    def log_message(self, format, *args):
        print(f"[Musify] {self.address_string()} - {format % args}", flush=True)

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)

        if parsed_path.path == "/api/playlist":
            self.handle_playlist(parsed_path)
        elif parsed_path.path == "/api/progress":
            self.handle_progress(parsed_path)
        elif parsed_path.path == "/api/download":
            self.handle_download(parsed_path)
        elif parsed_path.path == "/api/config":
            self.handle_get_config(parsed_path)
        else:
            super().do_GET()
            
    def do_POST(self):
        parsed_path = urllib.parse.urlparse(self.path)
        if parsed_path.path == "/api/config":
            self.handle_post_config(parsed_path)
        else:
            self.send_error(404, "Not Found")

    def handle_get_config(self, parsed_path):
        config = {}
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r') as f:
                try:
                    config = json.load(f)
                except:
                    pass
        body = json.dumps(config).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def handle_post_config(self, parsed_path):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        try:
            new_config = json.loads(post_data.decode('utf-8'))
            with open(CONFIG_FILE, 'w') as f:
                json.dump(new_config, f, indent=4)
            self.send_response(200)
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')
        except Exception as e:
            self.send_error(400, f"Bad Request: {e}")

    def handle_progress(self, parsed_path):
        query = urllib.parse.parse_qs(parsed_path.query)
        track_id = query.get("id", [""])[0]
        
        global download_progress
        pct = download_progress.get(track_id, 0)
        
        body = json.dumps({"progress": pct}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def handle_download(self, parsed_path):
        query = urllib.parse.parse_qs(parsed_path.query)
        track_id = query.get("id", [""])[0]
        title = query.get("title", [""])[0]
        artist = query.get("artist", [""])[0]
        
        if not track_id or not title:
            self.send_error(400, "Missing parameters")
            return
            
        search_query = f"ytsearch1:{title} {artist}"
        
        config = {}
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r') as f:
                try: config = json.load(f)
                except: pass
        
        dl_folder = config.get("download_folder", "downloads")
        if not dl_folder.strip():
            dl_folder = "downloads"
            
        os.makedirs(dl_folder, exist_ok=True)
        
        global download_progress
        download_progress[track_id] = 0
        
        out_file = None
        
        try:
            import yt_dlp
            
            def progress_hook(d):
                if d['status'] == 'downloading':
                    total = d.get('total_bytes') or d.get('total_bytes_estimate')
                    downloaded = d.get('downloaded_bytes', 0)
                    if total:
                        pct = int((downloaded / total) * 100)
                        download_progress[track_id] = pct
                elif d['status'] == 'finished':
                    download_progress[track_id] = 100

            class YtLogger:
                def debug(self, msg): pass
                def warning(self, msg): pass
                def error(self, msg): print(msg, flush=True)

            ydl_opts = {
                'format': 'bestaudio/best',
                'logger': YtLogger(),
                'progress_hooks': [progress_hook],
                'outtmpl': os.path.join(dl_folder, f'{track_id}.%(ext)s'),
                'quiet': True,
                'noplaylist': True,
            }
            
            # Use ffmpeg only if available on PATH
            import shutil
            if shutil.which("ffmpeg"):
                ydl_opts['postprocessors'] = [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }]

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(search_query, download=True)
                entries = info.get('entries', [])
                if entries:
                    info = entries[0]
                ext = 'mp3' if shutil.which("ffmpeg") else info.get('ext', 'webm')
                out_file = os.path.join(dl_folder, f"{track_id}.{ext}")
            
            if out_file and os.path.exists(out_file):
                with open(out_file, "rb") as f:
                    file_data = f.read()
                
                self.send_response(200)
                self.send_header("Content-Type", "audio/mpeg" if ext == "mp3" else f"audio/{ext}")
                self.send_header("Content-Length", str(len(file_data)))
                self.send_header("Content-Disposition", f'attachment; filename="{title} - {artist}.{ext}"')
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(file_data)
            else:
                self.send_error(500, "Failed to download file.")
        except Exception as e:
            traceback.print_exc()
            self.send_error(500, str(e))
        finally:
            if track_id in download_progress:
                del download_progress[track_id]

    def handle_playlist(self, parsed_path):
        query = urllib.parse.parse_qs(parsed_path.query)
        url = query.get("url", [""])[0]

        try:
            match = re.search(r"playlist/([a-zA-Z0-9]+)", url)
            if not match:
                raise ValueError("Could not extract playlist ID from the provided URL.")
            playlist_id = match.group(1)
            print(f"[Musify] Fetching playlist: {playlist_id}", flush=True)

            pl_data = spotify.fetch_playlist(playlist_id)

            cover_art = pl_data.get("coverArt") or {}
            sources = cover_art.get("sources") or [{}]
            cover_url = sources[0].get("url", "") if sources else ""

            response_data = {
                "title": pl_data.get("name") or "Unknown Playlist",
                "cover": cover_url,
                "trackCount": 0,
                "tracks": []
            }

            tracks_list = pl_data.get("trackList") or []
            response_data["trackCount"] = len(tracks_list)
            
            for item in tracks_list:
                duration_ms = item.get("duration") or 0
                mins = duration_ms // 60000
                secs = (duration_ms % 60000) // 1000
                audio_preview = item.get("audioPreview") or {}
                uri = item.get("uri") or ""
                track_id = uri.split(":")[-1] if ":" in uri else item.get("uid", "")
                
                response_data["tracks"].append({
                    "id": track_id,
                    "title": item.get("title", "Unknown"),
                    "artist": item.get("subtitle", "Unknown Artist"),
                    "album": "",
                    "cover": cover_url, 
                    "duration": f"{mins}:{secs:02d}",
                    "previewUrl": audio_preview.get("url", ""),
                    "status": "available"
                })

            print(f"[Musify] Returning {len(response_data['tracks'])} tracks.", flush=True)

            body = json.dumps(response_data).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(body)

        except Exception as e:
            traceback.print_exc()
            body = json.dumps({"error": str(e)}).encode("utf-8")
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(body)

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

class MusifyServer(socketserver.ThreadingMixIn, ReusableTCPServer):
    daemon_threads = True
    # Disable keepalive timeout so slow Spotify fetches don't get cut off
    def get_request(self):
        request, client_address = super().get_request()
        request.settimeout(None)  # No socket timeout
        return request, client_address

with MusifyServer(("", PORT), MusifyHandler) as httpd:
    print(f"[Musify] Server is live at http://localhost:{PORT}", flush=True)
    httpd.serve_forever()
