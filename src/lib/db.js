import { openDB } from 'idb';

const DB_NAME = 'lekhak';
const DB_VERSION = 1;

/**
 * Schema (all stores keyed by string id)
 *  - books      { id, title, author, dedication, coverImageId, createdAt, updatedAt }
 *  - chapters   { id, bookId, order, title, content, updatedAt }   indexed by bookId
 *  - characters { id, bookId, name, description, traits, portraitId, updatedAt }
 *  - images     { id, bookId, blob, mime, prompt, style, model, parentId, createdAt }
 *  - glossary   { id, bookId, term, definition, etymology, updatedAt }
 *  - settings   { id, ... } (singleton with id='app')
 */

let dbPromise = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('books')) {
          db.createObjectStore('books', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('chapters')) {
          const s = db.createObjectStore('chapters', { keyPath: 'id' });
          s.createIndex('bookId', 'bookId');
          s.createIndex('order', ['bookId', 'order']);
        }
        if (!db.objectStoreNames.contains('characters')) {
          const s = db.createObjectStore('characters', { keyPath: 'id' });
          s.createIndex('bookId', 'bookId');
        }
        if (!db.objectStoreNames.contains('images')) {
          const s = db.createObjectStore('images', { keyPath: 'id' });
          s.createIndex('bookId', 'bookId');
          s.createIndex('parentId', 'parentId');
        }
        if (!db.objectStoreNames.contains('glossary')) {
          const s = db.createObjectStore('glossary', { keyPath: 'id' });
          s.createIndex('bookId', 'bookId');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/* ------------------------------- Books ------------------------------- */
export async function createBook({ title, author = '', dedication = '' }) {
  const db = await getDB();
  const now = Date.now();
  const book = {
    id: uid('bk'),
    title: title?.trim() || 'नवीन पुस्तक',
    author,
    dedication,
    coverImageId: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.put('books', book);
  return book;
}

export async function getBook(id) {
  return (await getDB()).get('books', id);
}

export async function listBooks() {
  const all = await (await getDB()).getAll('books');
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function updateBook(id, patch) {
  const db = await getDB();
  const existing = await db.get('books', id);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: Date.now() };
  await db.put('books', updated);
  return updated;
}

export async function deleteBook(id) {
  const db = await getDB();
  const tx = db.transaction(['books', 'chapters', 'characters', 'images', 'glossary'], 'readwrite');
  await tx.objectStore('books').delete(id);
  for (const store of ['chapters', 'characters', 'images', 'glossary']) {
    const idx = tx.objectStore(store).index('bookId');
    let cursor = await idx.openCursor(id);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
  }
  await tx.done;
}

/* ----------------------------- Chapters ----------------------------- */
export async function listChapters(bookId) {
  const db = await getDB();
  const all = await db.getAllFromIndex('chapters', 'bookId', bookId);
  return all.sort((a, b) => a.order - b.order);
}

export async function createChapter(bookId, { title = '', content = '' } = {}) {
  const db = await getDB();
  const existing = await listChapters(bookId);
  const now = Date.now();
  const chapter = {
    id: uid('ch'),
    bookId,
    order: existing.length,
    title: title || `प्रकरण ${existing.length + 1}`,
    content,
    updatedAt: now,
  };
  await db.put('chapters', chapter);
  await updateBook(bookId, {});
  return chapter;
}

export async function getChapter(id) {
  return (await getDB()).get('chapters', id);
}

export async function updateChapter(id, patch) {
  const db = await getDB();
  const existing = await db.get('chapters', id);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: Date.now() };
  await db.put('chapters', updated);
  await updateBook(existing.bookId, {});
  return updated;
}

export async function deleteChapter(id) {
  const db = await getDB();
  const ch = await db.get('chapters', id);
  if (!ch) return;
  await db.delete('chapters', id);
  // Reorder remaining
  const rest = await listChapters(ch.bookId);
  const tx = db.transaction('chapters', 'readwrite');
  await Promise.all(
    rest.map((c, i) => tx.store.put({ ...c, order: i }))
  );
  await tx.done;
}

export async function reorderChapters(bookId, orderedIds) {
  const db = await getDB();
  const tx = db.transaction('chapters', 'readwrite');
  await Promise.all(
    orderedIds.map(async (id, i) => {
      const ch = await tx.store.get(id);
      if (ch) await tx.store.put({ ...ch, order: i });
    })
  );
  await tx.done;
}

/* --------------------------- Characters --------------------------- */
export async function listCharacters(bookId) {
  return (await getDB()).getAllFromIndex('characters', 'bookId', bookId);
}

export async function createCharacter(bookId, data) {
  const db = await getDB();
  const character = {
    id: uid('cr'),
    bookId,
    name: data.name?.trim() || 'पात्र',
    description: data.description || '',
    traits: data.traits || '',
    portraitId: data.portraitId || null,
    updatedAt: Date.now(),
  };
  await db.put('characters', character);
  return character;
}

export async function updateCharacter(id, patch) {
  const db = await getDB();
  const existing = await db.get('characters', id);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: Date.now() };
  await db.put('characters', updated);
  return updated;
}

export async function deleteCharacter(id) {
  return (await getDB()).delete('characters', id);
}

/* ---------------------------- Images ------------------------------ */
export async function saveImage({ bookId, blob, mime, prompt, style, model, parentId = null }) {
  const db = await getDB();
  const image = {
    id: uid('im'),
    bookId,
    blob,
    mime: mime || 'image/png',
    prompt: prompt || '',
    style: style || 'realistic',
    model: model || 'gemini-3-pro-image-preview',
    parentId,
    createdAt: Date.now(),
  };
  await db.put('images', image);
  return image;
}

export async function getImage(id) {
  return id ? (await getDB()).get('images', id) : null;
}

export async function listImages(bookId) {
  const all = await (await getDB()).getAllFromIndex('images', 'bookId', bookId);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteImage(id) {
  return (await getDB()).delete('images', id);
}

/* ---------------------------- Glossary ---------------------------- */
export async function listGlossary(bookId) {
  const all = await (await getDB()).getAllFromIndex('glossary', 'bookId', bookId);
  return all.sort((a, b) => a.term.localeCompare(b.term, 'mr'));
}

export async function createGlossaryEntry(bookId, { term, definition = '', etymology = '' }) {
  const db = await getDB();
  const entry = {
    id: uid('gl'),
    bookId,
    term: term?.trim() || '',
    definition,
    etymology,
    updatedAt: Date.now(),
  };
  await db.put('glossary', entry);
  return entry;
}

export async function updateGlossaryEntry(id, patch) {
  const db = await getDB();
  const existing = await db.get('glossary', id);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: Date.now() };
  await db.put('glossary', updated);
  return updated;
}

export async function deleteGlossaryEntry(id) {
  return (await getDB()).delete('glossary', id);
}

/* ---------------------------- Settings ---------------------------- */
const DEFAULT_SETTINGS = {
  id: 'app',
  apiKey: '',
  fontSize: 'large', // small | medium | large | xlarge
  voiceLang: 'mr-IN',
  preferredImageModel: 'pro', // 'pro' | 'flash'
};

export async function getSettings() {
  const db = await getDB();
  const s = await db.get('settings', 'app');
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
}

export async function saveSettings(patch) {
  const db = await getDB();
  const existing = (await db.get('settings', 'app')) || DEFAULT_SETTINGS;
  const merged = { ...DEFAULT_SETTINGS, ...existing, ...patch, id: 'app' };
  await db.put('settings', merged);
  return merged;
}

/* --------------------------- Helpers ------------------------------ */
export async function exportAllData() {
  const db = await getDB();
  const stores = ['books', 'chapters', 'characters', 'images', 'glossary', 'settings'];
  const out = {};
  for (const s of stores) out[s] = await db.getAll(s);
  return out;
}

export async function fileToBlob(file) {
  return new Blob([await file.arrayBuffer()], { type: file.type });
}

export function blobToObjectURL(blob) {
  return blob ? URL.createObjectURL(blob) : null;
}

export async function base64ToBlob(b64, mime = 'image/png') {
  const res = await fetch(`data:${mime};base64,${b64}`);
  return res.blob();
}
