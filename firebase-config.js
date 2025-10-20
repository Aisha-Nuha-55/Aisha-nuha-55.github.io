// Firebase connection and Firestore exports (ES Modules)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    doc, 
    getDocs, 
    onSnapshot, 
    runTransaction,
    writeBatch,
    query, 
    where,
    Timestamp,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBYYWRXHXSCIKSh71ai5lX2AUZbg-0nETc",
  authDomain: "smartcanteen-93a19.firebaseapp.com",
  projectId: "smartcanteen-93a19",
  storageBucket: "smartcanteen-93a19.appspot.com",
  messagingSenderId: "1046459200849",
  appId: "1:1046459200849:web:abc7ebee99cb24ee68cf70"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore
const db = getFirestore(app);

// Export Firestore instance and functions
export { 
    db, 
    collection, 
    doc, 
    getDocs, 
    onSnapshot, 
    runTransaction,
    writeBatch,
    query,
    where,
    Timestamp,
    getDoc
};
