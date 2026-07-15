const $ = (id) => document.getElementById(id);
const karistir = (a) => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);

let oturum = [], havuz = [], i = 0, dogru = 0;

(async () => {
  const now = Date.now();

  havuz = await db.cards.filter(c => c.definition_tr).toArray();
  if (havuz.length < 4) {
    return mesaj('Yetersiz', `Çoktan seçmeli için en az 4 kelime gerekli.<br>Şu an ${havuz.length} tane var.`);
  }

  oturum = karistir(await db.cards
    .where('due_at').belowOrEqual(now)
    .filter(c => c.definition_tr)
    .toArray()
  ).slice(0, 20);

  if (!oturum.length) return mesaj('Bitti', 'Bugün tekrar zamanı gelen kelime yok.');

  $('oyun').classList.remove('gizli');
  goster();
})();

function goster() {
  const k = oturum[i];

  $('ilerleme').textContent = `${i + 1} / ${oturum.length}`;
  $('skor').textContent = `${dogru} doğru`;
  $('dolu').style.width = `${(i / oturum.length) * 100}%`;

  $('soru').textContent = k.term;

  const b = $('baglam');
  if (k.context && k.context.length > k.term.length + 10) {
    b.textContent = `"${k.context.slice(0, 120)}…"`;
    b.classList.remove('gizli');
  } else {
    b.classList.add('gizli');
  }

  const yanlislar = karistir(havuz.filter(c => c.id !== k.id)).slice(0, 3);
  const secenekler = karistir([k, ...yanlislar]);

  const kap = $('secenekler');
  kap.innerHTML = '';
  $('devam').classList.add('gizli');

  for (const s of secenekler) {
    const btn = document.createElement('button');
    btn.className = 'sec';
    btn.textContent = s.definition_tr;
    btn.onclick = () => cevapla(btn, s.id === k.id, k, kap);
    kap.append(btn);
  }
}

async function cevapla(basilan, isabet, kart, kap) {
  for (const btn of kap.children) {
    btn.disabled = true;
    if (btn.textContent === kart.definition_tr) btn.classList.add('dogru');
    else if (btn === basilan)                   btn.classList.add('yanlis');
    else                                        btn.classList.add('solgun');
  }

  if (isabet) dogru++;
  $('skor').textContent = `${dogru} doğru`;

  await ilerlet(kart, isabet);

  const d = $('devam');
  d.textContent = i === oturum.length - 1 ? 'Bitir' : 'Devam';
  d.classList.remove('gizli');
  d.onclick = () => {
    i++;
    if (i < oturum.length) goster();
    else {
      $('oyun').classList.add('gizli');
      mesaj(`${dogru}/${oturum.length}`, 'Oturum tamamlandı.');
    }
  };
}

// GEÇİCİ — Adım 5'te FSRS ile değişecek
async function ilerlet(kart, isabet) {
  const gun = 86400000;
  const reps = isabet ? kart.reps + 1 : 0;
  const aralik = isabet ? Math.pow(2, reps) * gun : 10 * 60 * 1000;

  await db.cards.update(kart.id, {
    reps,
    difficulty: Math.min(10, Math.max(1, kart.difficulty + (isabet ? -0.2 : 0.8))),
    due_at: Date.now() + aralik,
    updated_at: Date.now()
  });
}

function mesaj(baslik, alt) {
  $('mBaslik').textContent = baslik;
  $('mAlt').innerHTML = alt;
  $('mesaj').classList.remove('gizli');
}
navigator.storage?.persist?.();

$('disa').onclick = async () => {
  const veri = await db.cards.toArray();
  if (!veri.length) return alert('Aktarılacak kelime yok.');

  const blob = new Blob([JSON.stringify(veri)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kelimeler-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};

$('ice').onclick = () => $('dosya').click();

$('dosya').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const veri = JSON.parse(await f.text());
    if (!Array.isArray(veri) || !veri[0]?.id) throw 0;
    await db.cards.bulkPut(veri);
    alert(`${veri.length} kelime aktarıldı.`);
    location.reload();
  } catch {
    alert('Dosya okunamadı.');
  }
  e.target.value = '';
};