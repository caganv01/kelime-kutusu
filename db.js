const db = new Dexie('kelime_kutusu');

db.version(1).stores({
  cards: 'id, &term, due_at, created_at'
});

async function kelimeEkle({ term, definition_tr, context, url }) {
  const now = Date.now();
  const kayit = {
    id: crypto.randomUUID(),
    term: term.toLowerCase().trim(),
    definition_tr,
    context,
    source_url: url,
    difficulty: 5.0,
    stability: 0.0,
    reps: 0,
    due_at: now,
    created_at: now,
    updated_at: now
  };

  try {
    await db.cards.add(kayit);
    return { ok: true, id: kayit.id };
  } catch (e) {
    if (e.name === 'ConstraintError') return { ok: false, reason: 'zaten_var' };
    throw e;
  }
}

async function sayac() {
  return db.cards.count();
}