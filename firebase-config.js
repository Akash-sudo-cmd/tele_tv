// ====================================================================
// 1) FIREBASE PROJECT CONFIG
// Firebase Console → your project → ⚙ Project settings → General →
// "Your apps" → SDK setup and configuration → copy the config object
// and paste its values below.
// ====================================================================
const firebaseConfig = {
  apiKey: "AIzaSyCoMmmnM1Zc9h7-eDYrZuV4gEZOff2RiQw",
  authDomain: "tele-tv-5bfd8.firebaseapp.com",
  projectId: "tele-tv-5bfd8",
  storageBucket: "tele-tv-5bfd8.firebasestorage.app",
  messagingSenderId: "640877488027",
  appId: "1:640877488027:web:e200d6154f68fb6a5a633e"
};

// ====================================================================
// 2) SHARED SITE PASSWORD
// Anyone who enters this password gets full view + edit access.
// Don't write the plain password here — paste its SHA-256 hash instead,
// so it isn't sitting in plain text in your public GitHub repo.
//
// To generate the hash:
//   1. Open your live site once it's deployed (must be https:// or
//      localhost — hashing needs a "secure context").
//   2. Open the browser DevTools console (F12) and paste:
//
//      crypto.subtle.digest("SHA-256", new TextEncoder().encode("yourPasswordHere"))
//        .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2,"0")).join("")))
//
//   3. Copy the printed hash and paste it below.
// ====================================================================
const SITE_PASSWORD_HASH = "d0313478cf91b5959009ecff1b9fc4ba0345d7ac0616e2b1b339327433081248";
