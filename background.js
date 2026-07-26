// Firebase SDK (local - CSP uyumluluğu)
importScripts('lib/firebase-app-compat.js');
importScripts('lib/firebase-firestore-compat.js');
importScripts('lib/firebase-auth-compat.js');

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
let firestoreUnsubscribe = null;

// User auth state değişirse currentUserId güncelle + Firestore listener başlat/durdur
auth.onAuthStateChanged((user) => {
  currentUserId = user ? user.uid : null;
  console.log('[kelime-kutusu] currentUserId:', currentUserId);

  // popup'a auth state değişimini bildir
  browser.runtime.sendMessage({ type: 'AUTH_STATE_CHANGED', uid: currentUserId }).catch(() => {});

  // Firestore listener: paketleri dinle ve popup'a gönder
  if (firestoreUnsubscribe) firestoreUnsubscribe();

  if (user) {
    const cardsRef = firestore.collection('users').doc(user.uid).collection('cards');
    firestoreUnsubscribe = cardsRef.onSnapshot((snapshot) => {
      const cards = snapshot.docs.map(d => d.data());
      const now = Date.now();
      const toplam = cards.length;
      const bekleyen = cards.filter(c => c.due_at <= now).length;

      // popup'a veri gönder
      browser.runtime.sendMessage({
        type: 'FIRESTORE_UPDATE',
        toplam,
        bekleyen
      }).catch(() => {});
    });
  }
});

browser.runtime.onMessage.addListener(mesajIsle);

browser.runtime.onInstalled.addListener(async () => {
  const kalici = await navigator.storage.persist();
  console.log('[kelime-kutusu] kalıcı depolama:', kalici);
});

async function mesajIsle(msg) {
  switch (msg.type) {
    case 'LOOKUP': return cevir(msg.term);
    case 'SAVE':   {
      const res = await kelimeEkle(msg.payload);
      // Başarılıysa Firebase'e de yaz (paket atamsı ile transaction)
      if (res.ok && currentUserId) {
        await kelimeFirebase(currentUserId, msg.payload);
      }
      return res;
    }
    case 'COUNT':  return sayac();
    case 'GET_AUTH_STATE': return { uid: currentUserId };
    case 'AUTH_LOGIN': {
      const provider = new firebase.auth.GoogleAuthProvider();
      try {
        await auth.signInWithPopup(provider);
        return { ok: true };
      } catch (e) {
        console.error('[kelime-kutusu] Auth hatası:', e);
        return { ok: false, error: String(e) };
      }
    }
  }
}

async function kelimeFirebase(uid, { term, definition_tr, context, url }) {
  // Web app'ın store.js ile aynı mantık: transaction ile paket ataması
  const id = term.toLowerCase().trim();
  const now = Date.now();

  try {
    await firestore.runTransaction(async (tx) => {
      // 1) Kelime zaten var mı?
      const kartRef = firestore.collection('users').doc(uid).collection('cards').doc(id);
      const kartSnap = await tx.get(kartRef);
      if (kartSnap.exists()) {
        console.log('[kelime-kutusu] Kelime zaten var:', id);
        return;
      }

      // 2) Meta durumu oku (hangi paket açık, kaçıncı pozisyon)
      const metaRef = firestore.collection('users').doc(uid).collection('meta').doc('state');
      const metaSnap = await tx.get(metaRef);
      let openPackageNo = 1, openPackageCount = 0;
      if (metaSnap.exists()) {
        const meta = metaSnap.data();
        openPackageNo = meta.openPackageNo || 1;
        openPackageCount = meta.openPackageCount || 0;
      }

      // 3) Paket 20 kelimeye ulaştıysa yeni pakete geç
      if (openPackageCount >= 20) {
        openPackageNo += 1;
        openPackageCount = 0;
      }
      openPackageCount += 1;

      // 4) Transaction'da meta + kelimeyi yaz (atomik)
      tx.set(metaRef, { openPackageNo, openPackageCount });
      tx.set(kartRef, {
        term: id,
        definition_tr,
        context: context || '',
        source_url: url || '',
        package_no: openPackageNo,
        difficulty: 5.0,
        stability: 0.0,
        reps: 0,
        due_at: now,
        created_at: now,
        updated_at: now
      });
    });
    console.log('[kelime-kutusu] Firebase yazıldı (paket atamsı):', id);
  } catch (e) {
    console.error('[kelime-kutusu] Firebase hatası:', e);
  }
}

async function cevir(term) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 8000);

  try {
    const r = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(term)}&langpair=en|tr`,
      { signal: c.signal }
    );

    if (r.status === 429) return { tr: null, hata: 'kota' };
    if (!r.ok)            return { tr: null, hata: 'sunucu' };

    const d  = await r.json();
    const tr = d?.responseData?.translatedText?.trim();

    if (!tr)                                     return { tr: null, hata: 'yok' };
    if (tr.includes('MYMEMORY WARNING'))         return { tr: null, hata: 'kota' };
    if (tr.toLowerCase() === term.toLowerCase()) return { tr: null, hata: 'yok' };

    return { tr };
  } catch {
    return { tr: null, hata: 'ag' };
  } finally {
    clearTimeout(t);
  }
}