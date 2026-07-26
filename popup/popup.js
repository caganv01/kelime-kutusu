const $ = (id) => document.getElementById(id);

// Background'dan mesaj dinle: Firestore veri güncellemesi
browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'FIRESTORE_UPDATE') {
    const { toplam, bekleyen } = msg;

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
  }

  if (msg.type === 'AUTH_STATE_CHANGED') {
    const { uid } = msg;

    if (uid) {
      // Giriş yapıldı
      $('girisEkrani').classList.add('gizli');
      $('verilerEkrani').classList.remove('gizli');
    } else {
      // Çıkış yapıldı
      $('girisEkrani').classList.remove('gizli');
      $('verilerEkrani').classList.add('gizli');
    }
  }
});

// Giriş butonu
document.getElementById('girisBtn').addEventListener('click', () => {
  browser.runtime.sendMessage({ type: 'AUTH_LOGIN' });
});

// Popup açıldığında auth state'i sor
(async () => {
  const { uid } = await browser.runtime.sendMessage({ type: 'GET_AUTH_STATE' });

  if (uid) {
    $('girisEkrani').classList.add('gizli');
    $('verilerEkrani').classList.remove('gizli');
  } else {
    $('girisEkrani').classList.remove('gizli');
    $('verilerEkrani').classList.add('gizli');
  }
})();