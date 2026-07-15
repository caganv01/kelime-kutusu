let kart = null;

const MESAJ = {
  yukleniyor: 'çevriliyor…',
  kota: 'günlük kota doldu',
  ag: 'bağlantı yok',
  sunucu: 'servis yanıt vermedi',
  yok: 'çeviri bulunamadı'
};

document.addEventListener('dblclick', async () => {
  const sec  = window.getSelection();
  const term = sec.toString().trim();
  if (!term || !/^[a-zA-Z'-]{2,30}$/.test(term)) return;

  const cumle = sec.anchorNode?.textContent?.trim().slice(0, 300) ?? '';
  const rect  = sec.getRangeAt(0).getBoundingClientRect();

  kartGoster(rect, term, null, 'yukleniyor');

  const s = await browser.runtime.sendMessage({ type: 'LOOKUP', term });

  kartGoster(rect, term, s.tr, s.hata, async () => {
    const r = await browser.runtime.sendMessage({
      type: 'SAVE',
      payload: { term, definition_tr: s.tr, context: cumle, url: location.href }
    });
    return r.ok;
  });
});

document.addEventListener('click', (e) => {
  if (kart && !kart.contains(e.target)) {
    kart.remove();
    kart = null;
  }
});

function kartGoster(rect, term, tr, hata, onEkle) {
  kart?.remove();
  kart = document.createElement('div');
  const sh = kart.attachShadow({ mode: 'open' });

  sh.innerHTML = `
    <style>
      :host { all: initial; }
      .k {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #1c1c1e;
        border: 1px solid #3a3a3c;
        border-radius: 12px;
        padding: 14px 16px;
        width: 260px;
        box-shadow: 0 8px 32px rgba(0,0,0,.45);
        animation: gir .12s ease-out;
      }
      @keyframes gir { from { opacity: 0; transform: translateY(-4px); } }
      .term {
        font-size: 13px; font-weight: 500;
        color: #8e8e93; letter-spacing: .02em;
      }
      .tr {
        font-size: 21px; font-weight: 600;
        color: #64d2ff; margin-top: 5px;
        line-height: 1.3; word-break: break-word;
      }
      .tr.bos {
        font-size: 14px; font-weight: 400;
        color: #8e8e93; font-style: italic;
      }
      button {
        margin-top: 13px; width: 100%;
        background: #0a84ff; color: #fff;
        border: 0; border-radius: 8px; padding: 9px;
        font: 600 13px inherit; cursor: pointer;
        transition: background .1s;
      }
      button:hover    { background: #0071e3; }
      button:active   { background: #005bb5; }
      button:disabled { background: #2c2c2e; color: #8e8e93; cursor: default; }
    </style>
    <div class="k">
      <div class="term"></div>
      <div class="tr"></div>
    </div>
  `;

  sh.querySelector('.term').textContent = term;

  const trEl = sh.querySelector('.tr');
  if (tr) {
    trEl.textContent = tr;
  } else {
    trEl.classList.add('bos');
    trEl.textContent = MESAJ[hata] ?? '—';
  }

  if (onEkle) {
    const btn = document.createElement('button');
    btn.textContent = '+ ekle';
    btn.onclick = async () => {
      btn.disabled = true;
      btn.textContent = '…';
      btn.textContent = (await onEkle()) ? '✓ eklendi' : '• zaten var';
    };
    sh.querySelector('.k').append(btn);
  }

  Object.assign(kart.style, {
    position: 'fixed',
    top:  `${Math.min(rect.bottom + 8, innerHeight - 160)}px`,
    left: `${Math.max(8, Math.min(rect.left, innerWidth - 300))}px`,
    zIndex: '2147483647'
  });

  document.body.append(kart);
}