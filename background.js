browser.runtime.onMessage.addListener(mesajIsle);

browser.runtime.onInstalled.addListener(async () => {
  const kalici = await navigator.storage.persist();
  console.log('[kelime-kutusu] kalıcı depolama:', kalici);
});

async function mesajIsle(msg) {
  switch (msg.type) {
    case 'LOOKUP': return cevir(msg.term);
    case 'SAVE':   return kelimeEkle(msg.payload);
    case 'COUNT':  return sayac();
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