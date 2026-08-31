/**
 * Musify — Firebase Authentication Module
 * Handles Google Sign-In, Email/Password auth, and auth state.
 */

const firebaseConfig = {
    apiKey: "AIzaSyBuF0daKG7GF20MaATMUSJ-S07ugm4j71w",
    authDomain: "musify-9208a.firebaseapp.com",
    projectId: "musify-9208a",
    storageBucket: "musify-9208a.firebasestorage.app",
    messagingSenderId: "293133023539",
    appId: "1:293133023539:web:6251ac4de33486e8f3e646",
    measurementId: "G-R404M2B5B1"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const firestoreInstance = firebase.firestore();
window.firestoreDb = firestoreInstance;

console.log('[Auth] Firebase initialized');

class AuthManager {
    constructor() {
        this.currentUser = null;
        this._authReadyResolve = null;
        this.authReady = new Promise(res => { this._authReadyResolve = res; });
    }

    /** Call once on app init. Also handles redirect result from Google redirect flow. */
    init(onSignedIn, onSignedOut) {

        // Handle result from signInWithRedirect (called after page redirect back)
        auth.getRedirectResult().then(result => {
            if (result && result.user) {
                console.log('[Auth] Redirect sign-in successful:', result.user.displayName);
            }
        }).catch(error => {
            console.error('[Auth] Redirect error:', error);
            alert('Google Sign-In failed:\n\n' + error.message + '\n\nPlease ensure Google Provider is ENABLED in your Firebase Console.');
        });

        auth.onAuthStateChanged(user => {
            this.currentUser = user;
            this._authReadyResolve();
            console.log('[Auth] Auth state changed:', user ? user.email : 'signed out');

            if (user) {
                store.setState({
                    user: {
                        uid: user.uid,
                        displayName: user.displayName,
                        email: user.email,
                        photoURL: user.photoURL
                    }
                });
                onSignedIn(user);
            } else {
                store.setState({ user: null });
                onSignedOut();
            }
        });
    }

    /**
     * Sign in with Google.
     * Uses redirect instead of popup to avoid popup blocker issues.
     */
    async signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            return await auth.signInWithPopup(provider);
        } catch (e) {
            console.error('[Auth] Google sign in failed:', e);
            throw e;
        }
    }

    async signInWithEmail(email, password) {
        return auth.signInWithEmailAndPassword(email, password);
    }

    async createAccount(email, password, displayName) {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        if (displayName) await cred.user.updateProfile({ displayName });
        return cred;
    }

    async resetPassword(email) {
        return auth.sendPasswordResetEmail(email);
    }

    async signOut() {
        return auth.signOut();
    }

    getUser()  { return this.currentUser; }
    getUid()   { return this.currentUser ? this.currentUser.uid : null; }
}

window.authManager = new AuthManager();

