import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
// import { getStorage } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBLy76V8Z1cNwOx0dvlXbmj5RRAVbH5ErU",
  authDomain: "marrymate-ef082.firebaseapp.com",
  projectId: "marrymate-ef082",
  storageBucket: "marrymate-ef082.firebasestorage.app",
  messagingSenderId: "294355598492",
  appId: "1:294355598492:web:02f5e5d177d64f81eec159"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
// export const storage = getStorage(app);