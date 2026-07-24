// Firestore okuma/yazma işleri. Hem web hem (ileride) eklenti aynı mantığı kullanır.
// Veri yolu: users/{uid}/cards/{cardId}  +  users/{uid}/meta/state

import { db } from "./firebase.js";
import {
  doc, collection, getDocs, query, orderBy, runTransaction, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const kartRef = (uid, id) => doc(db, "users", uid, "cards", id);
const metaRef = (uid)     => doc(db, "users", uid, "meta", "state");
const cardsRef = (uid)    => collection(db, "users", uid, "cards");

// Kelime ekle. cardId = küçük harfe indirgenmiş term → aynı kelime iki kez
// eklenemez (Dexie'deki &term tekil indeksinin karşılığı).
//
// Paket ataması bir TRANSACTION içinde yapılır: aynı anda hem meta/state okunup
// güncellenir hem de kelime yazılır. Böylece "20'ye ulaşınca yeni paket" mantığı
// atomik ve tutarlı olur — yarıda kalıp veri bozulmaz.
export async function kelimeEkle(uid, { term, definition_tr, context = "", source_url = "" }) {
  const id = term.toLowerCase().trim();
  const now = Date.now();

  try {
    return await runTransaction(db, async (tx) => {
      // 1) Kelime zaten var mı?
      const kartSnap = await tx.get(kartRef(uid, id));
      if (kartSnap.exists()) return { ok: false, reason: "zaten_var" };

      // 2) Açık paketi oku (meta yoksa Paket 1'den başla)
      const metaSnap = await tx.get(metaRef(uid));
      let openPackageNo = 1, openPackageCount = 0;
      if (metaSnap.exists()) {
        ({ openPackageNo, openPackageCount } = metaSnap.data());
      }

      // 3) Paket dolduysa yenisini aç
      if (openPackageCount >= 20) { openPackageNo += 1; openPackageCount = 0; }
      openPackageCount += 1;

      // 4) meta + kelimeyi aynı transaction'da yaz
      tx.set(metaRef(uid), { openPackageNo, openPackageCount });
      tx.set(kartRef(uid, id), {
        term: id, definition_tr, context, source_url,
        package_no: openPackageNo,
        difficulty: 5.0, stability: 0.0, reps: 0,
        due_at: now, created_at: now, updated_at: now
      });

      return { ok: true, id, package_no: openPackageNo };
    });
  } catch (e) {
    return { ok: false, reason: "hata", error: String(e) };
  }
}

// Tüm kelimeleri oluşturulma sırasına göre getir.
export async function kelimeleriGetir(uid) {
  const q = query(cardsRef(uid), orderBy("created_at"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

// Quiz cevabından sonra ilerlemeyi güncelle (ileride quiz'de kullanacağız).
export async function ilerlemeGuncelle(uid, id, alanlar) {
  await updateDoc(kartRef(uid, id), { ...alanlar, updated_at: Date.now() });
}
