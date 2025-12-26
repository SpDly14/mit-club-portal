// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyD2tBVwZvVfBtBHGyBBCAgvkXDxHh-JQI0",
  authDomain: "club-management-mit.firebaseapp.com",
  projectId: "club-management-mit",
  storageBucket: "club-management-mit.firebasestorage.app",
  messagingSenderId: "1037830153502",
  appId: "1:1037830153502:web:49da56958d155529d1950f",
  measurementId: "G-YYTS787N75"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();
const auth = firebase.auth();

// Export for use in other files
window.db = db;
window.auth = auth;