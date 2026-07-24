// Firebase başlatma.
// Not: Buradaki değerler PUBLIC'tir (her web uygulamasında tarayıcıya gider).
// Güvenlik "apiKey gizli kalsın" ile değil, Firestore güvenlik kurallarıyla
// sağlanır — kullanıcı yalnızca kendi verisine erişebilir.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAbaNtSVqH_R18YHwG8_SmK5nX4rKW-ik0",
  authDomain: "kelime-kutusu-dca48.firebaseapp.com",
  projectId: "kelime-kutusu-dca48",
  storageBucket: "kelime-kutusu-dca48.firebasestorage.app",
  messagingSenderId: "999675176536",
  appId: "1:999675176536:web:9d178401992e911a704c2d"
};

const app = initializeApp(firebaseConfig);

// Uygulamanın her yerinden kullanacağımız iki servis:
export const auth = getAuth(app);   // kim giriş yaptı
export const db = getFirestore(app); // kelimelerin durduğu veritabanı
