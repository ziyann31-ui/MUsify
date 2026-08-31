class PlayerManager {
    constructor() {
        this.audio = new Audio();
        this.simulatedPlayback = null;
        
        this.audio.addEventListener('timeupdate', () => {
            if (this.audio.duration) {
                store.setState({
                    player: {
                        ...store.getState().player,
                        progress: this.audio.currentTime,
                        duration: this.audio.duration
                    }
                });
            }
        });

        this.audio.addEventListener('ended', () => {
            this.next();
        });
    }

    async play(trackId) {
        const state = store.getState();
        const track = state.library.songs.find(s => s.id === trackId) || 
                      state.downloads.queue.find(s => s.id === trackId);
        
        if (!track) return;

        store.setState({
            player: {
                ...state.player,
                currentTrack: track,
                isPlaying: true,
                progress: 0
            }
        });

        // Try to get offline blob
        try {
            const blob = await window.db.getAudioBlob(trackId);
            if (blob) {
                const url = URL.createObjectURL(blob);
                this.audio.src = url;
                try {
                    await this.audio.play();
                    this.stopSimulation();
                } catch (e) {
                    console.warn("Failed to play real audio (likely mock blob), simulating playback.");
                    this.simulatePlayback();
                }
            } else {
                console.warn("No offline blob found, simulate streaming/playback");
                this.simulatePlayback();
            }
        } catch (e) {
            console.error("Playback error", e);
            this.simulatePlayback();
        }
    }

    pause() {
        this.audio.pause();
        this.stopSimulation();
        store.setState({
            player: {
                ...store.getState().player,
                isPlaying: false
            }
        });
    }

    resume() {
        if (!store.getState().player.currentTrack) return;
        
        store.setState({
            player: {
                ...store.getState().player,
                isPlaying: true
            }
        });
        
        if (this.audio.src && !this.simulatedPlayback) {
            this.audio.play().catch(() => this.simulatePlayback());
        } else {
            this.simulatePlayback();
        }
    }

    toggle() {
        if (store.getState().player.isPlaying) {
            this.pause();
        } else {
            this.resume();
        }
    }

    next() {
        // Mock next track logic
        this.pause();
        store.setState({
            player: {
                ...store.getState().player,
                progress: 0
            }
        });
    }

    previous() {
        // Mock previous track logic
        this.pause();
        store.setState({
            player: {
                ...store.getState().player,
                progress: 0
            }
        });
    }

    seek(percent) {
        const state = store.getState();
        const duration = state.player.duration || 200; // Mock 200s duration
        const newTime = (percent / 100) * duration;
        
        if (this.audio.src && !this.simulatedPlayback) {
            this.audio.currentTime = newTime;
        } else {
            store.setState({
                player: {
                    ...state.player,
                    progress: newTime
                }
            });
        }
    }

    // --- Simulation for Mock Data ---
    simulatePlayback() {
        this.stopSimulation();
        const duration = 200; // Mock 200 seconds
        store.setState({
            player: {
                ...store.getState().player,
                duration: duration
            }
        });

        this.simulatedPlayback = setInterval(() => {
            const state = store.getState();
            let newProgress = state.player.progress + 1;
            
            if (newProgress >= duration) {
                this.next();
            } else {
                store.setState({
                    player: {
                        ...state.player,
                        progress: newProgress
                    }
                });
            }
        }, 1000);
    }

    stopSimulation() {
        if (this.simulatedPlayback) {
            clearInterval(this.simulatedPlayback);
            this.simulatedPlayback = null;
        }
    }
}

window.player = new PlayerManager();
