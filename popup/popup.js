const $ = (id) => document.getElementById(id);

// Firebase SDK popup'a yüklenmez: MV3 eklenti sayfalarında CSP 'self' zorunludur
// ve https: kaynak eklenemez. Tüm Firebase işleri background.js'te olur; popup
// yalnızca mesajlaşır.

function ekran(girisMi) {
  $('girisEkrani').classList.toggle('gizli', !girisMi);
  $('verilerEkrani').classList.toggle('gizli', girisMi);
}

function ciz(toplam, bekleyen) {
  $('toplam').textContent   = toplam;
  $('bekleyen').textContent = bekleyen;

  const btn = $('quiz');

  if (toplam === 0) {
    btn.classList.add('gizli');
    $('bos').classList.remove('gizli');
    return;
  }

  btn.classList.remove('gizli');
  $('bos').classList.add('gizli');

  btn.disabled = bekleyen === 0;
  btn.textContent = bekleyen === 0
    ? '✓ Bugün tamamladın'
    : `📝 Quiz başlat (${Math.min(bekleyen, 20)} soru)`;
}

$('quiz').onclick = () => {
  browser.tabs.create({ url: browser.runtime.getURL('quiz/quiz.html') });
  window.close();
};

// Background'dan gelen canlı güncellemeler
browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'FIRESTORE_UPDATE') ciz(msg.toplam, msg.bekleyen);
  if (msg.type === 'AUTH_STATE_CHANGED') ekran(!msg.uid);
});

$('girisBtn').addEventListener('click', async () => {
  const not = $('girisNot');
  const adres = $('girisAdres');

  not.classList.remove('gizli');
  not.textContent = 'Google penceresi açılıyor…';
  adres.classList.add('gizli');

  const r = await browser.runtime.sendMessage({ type: 'AUTH_LOGIN' });
  if (r?.ok) return;

  if (r?.hata === 'client_id_yok') {
    not.textContent = 'OAuth istemcisi ayarlanmamış. Google Cloud Console\'da bu adresi yetkili yönlendirme URI\'si olarak ekle:';
    adres.textContent = r.yonlendirme;
    adres.classList.remove('gizli');
  } else {
    not.textContent = 'Giriş yapılamadı: ' + (r?.hata ?? 'bilinmeyen hata');
  }
});

// Açılışta durumu sor — canlı yayını beklemek yerine mevcut veriyi hemen çiz.
(async () => {
  const s = await browser.runtime.sendMessage({ type: 'GET_STATE' });
  ekran(!s.uid);
  if (s.uid) ciz(s.toplam, s.bekleyen);
})();
