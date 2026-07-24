// Çoktan seçmeli quiz. Eski eklenti içi quiz mantığının web'e taşınmış hâli.
// paket: quiz yapılacak kelimeler (seçilen paket)
// havuz: çeldirici (yanlış şık) üretmek için tüm kelimeler
// onBitti(dogru, toplam): quiz bitince çağrılır (paket listesine dönmek için)

import { ilerlemeGuncelle } from "./store.js";

const $ = (id) => document.getElementById(id);
const karistir = (a) =>
  a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

export function quizBaslat(uid, paket, havuz, onBitti) {
  const oturum = karistir(paket);      // paketteki tüm kelimeler, karışık sırayla
  let i = 0, dogru = 0;

  goster();

  function goster() {
    const k = oturum[i];

    $("qIlerleme").textContent = `${i + 1} / ${oturum.length}`;
    $("qSkor").textContent = `${dogru} doğru`;
    $("qDolu").style.width = `${(i / oturum.length) * 100}%`;
    $("qSoru").textContent = k.term;

    const b = $("qBaglam");
    if (k.context && k.context.length > k.term.length + 10) {
      b.textContent = `"${k.context.slice(0, 120)}…"`;
      b.classList.remove("gizli");
    } else {
      b.classList.add("gizli");
    }

    // 3 çeldirici: bu kelime dışındaki tüm kelimelerden (paket <4 ise diğer
    // paketlerden de gelir, çünkü havuz = tüm kelimeler)
    const yanlislar = karistir(havuz.filter((c) => c.term !== k.term)).slice(0, 3);
    const secenekler = karistir([k, ...yanlislar]);

    const kap = $("qSecenekler");
    kap.innerHTML = "";
    $("qDevam").classList.add("gizli");

    for (const s of secenekler) {
      const btn = document.createElement("button");
      btn.className = "sec";
      btn.textContent = s.definition_tr;
      btn.onclick = () => cevapla(btn, s.term === k.term, k, kap);
      kap.append(btn);
    }
  }

  async function cevapla(basilan, isabet, kart, kap) {
    for (const btn of kap.children) {
      btn.disabled = true;
      if (btn.textContent === kart.definition_tr) btn.classList.add("dogru");
      else if (btn === basilan)                   btn.classList.add("yanlis");
      else                                        btn.classList.add("solgun");
    }

    if (isabet) dogru++;
    $("qSkor").textContent = `${dogru} doğru`;

    // Basit ilerleme güncellemesi (spec'teki geçici mantık; ileride FSRS olabilir).
    // Firestore'a yazılır → ilerleme cihazlar arası korunur.
    const gun = 86400000;
    const reps = isabet ? kart.reps + 1 : 0;
    const aralik = isabet ? Math.pow(2, reps) * gun : 10 * 60 * 1000;
    await ilerlemeGuncelle(uid, kart.term, {
      reps,
      difficulty: Math.min(10, Math.max(1, kart.difficulty + (isabet ? -0.2 : 0.8))),
      due_at: Date.now() + aralik
    });

    const d = $("qDevam");
    d.textContent = i === oturum.length - 1 ? "Bitir" : "Devam";
    d.classList.remove("gizli");
    d.onclick = () => {
      i++;
      if (i < oturum.length) goster();
      else onBitti(dogru, oturum.length);
    };
  }
}
