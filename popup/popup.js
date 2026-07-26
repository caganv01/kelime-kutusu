const $ = (id) => document.getElementById(id);

// Firebase config (background.js ile aynı)
const firebaseConfig = {
  apiKey: "AIzaSyAbaNtSVqH_R18YHwG8_SmK5nX4rKW-ik0",
  authDomain: "kelime-kutusu-dca48.firebaseapp.com",
  projectId: "kelime-kutusu-dca48",
  storageBucket: "kelime-kutusu-dca48.firebasestorage.app",
  messagingSenderId: "999675176536",
  appId: "1:999675176536:web:9d178401992e911a704c2d"
};

firebase.initializeApp(firebaseConfig);
const firestore = firebase.firestore();
const auth = firebase.auth();

let currentUserId = null;

// Firebase auth state değişirse, Firestore listener başlat
auth.onAuthStateChanged((user) => {
  currentUserId = user ? user.uid : null;

  if (user) {
    // Firestore'dan real-time listener: paketleri otomatik güncelle
    const cardsRef = firestore.collection('users').doc(user.uid).collection('cards');

    cardsRef.onSnapshot((snapshot) => {
      const cards = snapshot.docs.map(d => d.data());
      const now = Date.now();

      const toplam = cards.length;
      const bekleyen = cards.filter(c => c.due_at <= now).length;

      $('toplam').textContent = toplam;
      $('bekleyen').textContent = bekleyen;

      if (toplam === 0) {
        $('quiz').classList.add('gizli');
        $('bos').classList.remove('gizli');
        return;
      }

      const btn = $('quiz');
      btn.disabled = bekleyen === 0;
      btn.textContent = bekleyen === 0
        ? '✓ Bugün tamamladın'
        : `📝 Quiz başlat (${Math.min(bekleyen, 20)} soru)`;

      btn.onclick = () => {
        browser.tabs.create({ url: browser.runtime.getURL('quiz/quiz.html') });
        window.close();
      };

      $('quiz').classList.remove('gizli');
      $('bos').classList.add('gizli');
    });
  } else {
    // Giriş yapılmadıysa
    $('toplam').textContent = '–';
    $('bekleyen').textContent = '–';
    $('quiz').classList.add('gizli');
    $('bos').classList.remove('gizli');
  }
});