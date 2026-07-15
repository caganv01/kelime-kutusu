const $ = (id) => document.getElementById(id);

(async () => {
  const { toplam, bekleyen } = await browser.runtime.sendMessage({ type: 'COUNT' });

  $('toplam').textContent   = toplam;
  $('bekleyen').textContent = bekleyen;

  if (toplam === 0) {
    $('quiz').classList.add('gizli');
    $('bos').classList.remove('gizli');
    return;
  }

  const btn = $('quiz');
  btn.disabled = bekleyen === 0;
  btn.textContent = bekleyen === 0
    ? 'Bugünlük bitti'
    : `Quiz başlat (${Math.min(bekleyen, 20)})`;

  btn.onclick = () => {
    browser.tabs.create({ url: browser.runtime.getURL('quiz/quiz.html') });
    window.close();
  };
})();