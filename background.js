// Firebase SDK ve Dexie manifest.json'daki background.scripts ile yüklenir.
// Firefox MV3'te arka plan bir *event page*'dir (service worker değil), bu yüzden
// importScripts() burada tanımlı değildir — kütüphaneler manifest'ten gelir.

const firebaseConfig = {
  apiKey: "AIzaSyAbaNtSVqH_R18YHwG8_SmK5nX4rKW-ik0",
  authDomain: "kelime-kutusu-dca48.firebaseapp.com",
  projectId: "kelime-kutusu-dca48",
  storageBucket: "kelime-kutusu-dca48.firebasestorage.app",
  messagingSenderId: "999675176536",
  appId: "1:999675176536:web:9d178401992e911a704c2d"
};

// Firebase'in Google girişi için otomatik oluşturduğu Web OAuth istemcisi.
// Yetkili yönlendirme URI'leri arasında browser.identity.getRedirectURL()
// değeri kayıtlıdır. Client ID gizli değildir — apiKey gibi istemciye gider.
const OAUTH_CLIENT_ID = '999675176536-3cfjft67n5t8e0uuqugd6sho96ee310i.apps.googleusercontent.com';

firebase.initializeApp(firebaseConfig);
const firestore = firebase.firestore();
const auth = firebase.auth();

let currentUserId = null;
let sonSayac = null;          // son bilinen {toplam, bekleyen}
let kartlariBirak = null;     // aktif onSnapshot aboneliğini kapatan fonksiyon

// Firebase oturumu IndexedDB'den geri yüklenene kadar bekleyenler için.
let authCozuldu;
const authHazir = new Promise((r) => { authCozuldu = r; });

const kartlarRef = (uid) => firestore.collection('users').doc(uid).collection('cards');
const metaRef    = (uid) => firestore.collection('users').doc(uid).collection('meta').doc('state');

auth.onAuthStateChanged((user) => {
  currentUserId = user ? user.uid : null;
  sonSayac = null;
  console.log('[kelime-kutusu] oturum:', currentUserId);

  yayinla({ type: 'AUTH_STATE_CHANGED', uid: currentUserId });

  if (kartlariBirak) { kartlariBirak(); kartlariBirak = null; }

  if (user) {
    kartlariBirak = kartlarRef(user.uid).onSnapshot(
      (anlik) => {
        sonSayac = sayacHesapla(anlik.docs.map((d) => d.data()));
        yayinla({ type: 'FIRESTORE_UPDATE', ...sonSayac });
      },
      (e) => console.error('[kelime-kutusu] dinleme hatası:', e)
    );
  }

  authCozuldu();
});

browser.runtime.onMessage.addListener(mesajIsle);

browser.runtime.onInstalled.addListener(async () => {
  const kalici = await navigator.storage.persist();
  console.log('[kelime-kutusu] kalıcı depolama:', kalici);
});

async function mesajIsle(msg) {
  switch (msg.type) {
    case 'LOOKUP': return cevir(msg.term);

    case 'SAVE': {
      const yerel = await kelimeEkle(msg.payload);
      // Buluta yazım yerel sonuca bağlı değil: kelime yerelde varken buluta
      // hiç gitmemiş olabilir. Mükerrerliği Firestore transaction'ı eler.
      const bulut = currentUserId ? await kelimeFirebase(currentUserId, msg.payload) : null;
      return { ...yerel, ok: yerel.ok || Boolean(bulut?.ok) };
    }

    case 'COUNT': return sayac();

    case 'GET_STATE': {
      await authHazir;
      if (!currentUserId) return { uid: null };
      const s = sonSayac ?? await sayacGetir(currentUserId);
      return { uid: currentUserId, ...s };
    }

    case 'AUTH_LOGIN':  return girisYap();
    case 'AUTH_LOGOUT': { await auth.signOut(); return { ok: true }; }
  }
}

// Eklentide signInWithPopup çalışmaz: Firebase, çağıran origin'in "yetkili alan
// adı" olmasını ister ve moz-extension:// böyle bir alan adı olamaz. Bunun yerine
// Google'dan launchWebAuthFlow ile id_token alıp signInWithCredential kullanıyoruz.
async function girisYap() {
  const yonlendirme = browser.identity.getRedirectURL();

  if (OAUTH_CLIENT_ID.startsWith('BURAYA_')) {
    console.error('[kelime-kutusu] OAUTH_CLIENT_ID ayarlanmadı. Yönlendirme URI:', yonlendirme);
    return { ok: false, hata: 'client_id_yok', yonlendirme };
  }

  try {
    const adres = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    adres.searchParams.set('client_id', OAUTH_CLIENT_ID);
    adres.searchParams.set('response_type', 'id_token');
    adres.searchParams.set('redirect_uri', yonlendirme);
    adres.searchParams.set('scope', 'openid email profile');
    adres.searchParams.set('nonce', crypto.randomUUID());
    adres.searchParams.set('prompt', 'select_account');

    const cevap = await browser.identity.launchWebAuthFlow({
      url: adres.toString(),
      interactive: true
    });

    // id_token yanıt URL'sinin fragment kısmında döner.
    const idToken = new URLSearchParams(new URL(cevap).hash.slice(1)).get('id_token');
    if (!idToken) return { ok: false, hata: 'token_yok' };

    await auth.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(idToken));
    return { ok: true };
  } catch (e) {
    console.error('[kelime-kutusu] giriş hatası:', e);
    return { ok: false, hata: String(e) };
  }
}

function sayacHesapla(kartlar) {
  const simdi = Date.now();
  return {
    toplam: kartlar.length,
    bekleyen: kartlar.filter((k) => k.due_at <= simdi).length
  };
}

async function sayacGetir(uid) {
  const anlik = await kartlarRef(uid).get();
  return sayacHesapla(anlik.docs.map((d) => d.data()));
}

// Popup kapalıyken sendMessage reddeder; bu beklenen bir durum, sessizce geçiyoruz.
function yayinla(msg) {
  browser.runtime.sendMessage(msg).catch(() => {});
}

async function kelimeFirebase(uid, { term, definition_tr, context, url }) {
  // web/store.js ile aynı mantık: paket ataması transaction içinde yapılır.
  const id = term.toLowerCase().trim();
  const now = Date.now();

  try {
    return await firestore.runTransaction(async (tx) => {
      // 1) Kelime zaten var mı? (compat SDK'da exists bir özellik, metot değil)
      const kart = kartlarRef(uid).doc(id);
      const kartAnlik = await tx.get(kart);
      if (kartAnlik.exists) return { ok: false, reason: 'zaten_var' };

      // 2) Açık paketi oku (meta yoksa Paket 1'den başla)
      const meta = metaRef(uid);
      const metaAnlik = await tx.get(meta);
      let openPackageNo = 1, openPackageCount = 0;
      if (metaAnlik.exists) {
        const d = metaAnlik.data();
        openPackageNo    = d.openPackageNo    || 1;
        openPackageCount = d.openPackageCount || 0;
      }

      // 3) Paket 20'ye ulaştıysa yenisini aç
      if (openPackageCount >= 20) { openPackageNo += 1; openPackageCount = 0; }
      openPackageCount += 1;

      // 4) meta + kelimeyi aynı transaction'da yaz
      tx.set(meta, { openPackageNo, openPackageCount });
      tx.set(kart, {
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

      return { ok: true, id, package_no: openPackageNo };
    });
  } catch (e) {
    console.error('[kelime-kutusu] Firebase yazma hatası:', e);
    return { ok: false, reason: 'hata' };
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
