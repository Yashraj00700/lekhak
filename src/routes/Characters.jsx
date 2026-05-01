import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Users,
  Sparkles,
  Loader2,
  Trash2,
  Pencil,
} from 'lucide-react';
import PageTransition from '../components/PageTransition.jsx';
import Modal from '../components/Modal.jsx';
import {
  listBooks,
  getBook,
  listCharacters,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  saveImage,
  getImage,
} from '../lib/db.js';
import { generateCharacterPortrait, IMAGE_STYLES } from '../lib/gemini.js';
import { useToast } from '../hooks/useToast.jsx';
import { useLanguage } from '../hooks/useLanguage.jsx';

const EMPTY = { name: '', description: '', traits: '', portraitId: null };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Revoke every object URL held in the ref map and clear it.
 */
function revokeAll(mapRef) {
  for (const url of Object.values(mapRef.current)) {
    URL.revokeObjectURL(url);
  }
  mapRef.current = {};
}

export default function Characters() {
  const { bookId: routeBookId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useLanguage();

  const [bookId, setBookId] = useState(routeBookId || null);
  const [books, setBooks] = useState([]);
  const [characters, setCharacters] = useState([]);

  /**
   * portraitUrls is derived from the ref on each refresh so React can
   * re-render, but the actual object URL lifecycle is managed entirely
   * through the ref — never created during render.
   */
  const urlMapRef = useRef({});
  const [portraitUrls, setPortraitUrls] = useState({});

  const [editor, setEditor] = useState(null); // { mode:'create'|'edit', data }
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genStyle, setGenStyle] = useState('realistic');

  // Revoke all object URLs when the component unmounts.
  useEffect(() => {
    return () => revokeAll(urlMapRef);
  }, []);

  // Bootstrap: resolve bookId from route or from the first available book.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (routeBookId) {
        const b = await getBook(routeBookId);
        if (cancelled) return;
        if (!b) { navigate('/'); return; }
        setBookId(b.id);
      } else {
        const list = await listBooks();
        if (cancelled) return;
        setBooks(list);
        if (list.length > 0) setBookId(list[0].id);
      }
    })();
    return () => { cancelled = true; };
  }, [routeBookId, navigate]);

  // Re-fetch characters whenever bookId changes.
  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    refresh(cancelled).then(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  // ---------------------------------------------------------------------------
  // Data helpers
  // ---------------------------------------------------------------------------

  /**
   * Load the character list and build object URLs for any stored portraits.
   * Old URLs are revoked before new ones are created.
   */
  const refresh = async (cancelled = false) => {
    const list = await listCharacters(bookId);
    if (cancelled) return;

    // Build new map of blob URLs.
    const nextMap = {};
    for (const c of list) {
      if (c.portraitId) {
        const img = await getImage(c.portraitId);
        if (img?.blob) {
          nextMap[c.id] = URL.createObjectURL(img.blob);
        }
      }
    }

    // Revoke old URLs, install new ones.
    revokeAll(urlMapRef);
    urlMapRef.current = nextMap;

    setCharacters(list);
    setPortraitUrls({ ...nextMap });
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    if (!editor?.data?.name?.trim()) {
      toast.warning(t('characters.nameRequired'));
      return;
    }
    if (editor.mode === 'create') {
      await createCharacter(bookId, editor.data);
    } else {
      await updateCharacter(editor.data.id, editor.data);
    }
    setEditor(null);
    await refresh();
    toast.success(t('common.saved'));
  };

  const handleGeneratePortrait = async () => {
    const data = editor?.data;
    if (!data?.name?.trim() || !data?.description?.trim()) {
      toast.warning(t('characters.portraitFirst'));
      return;
    }
    setGenerating(true);
    try {
      const result = await generateCharacterPortrait({
        name: data.name,
        description: data.description,
        style: genStyle,
        model: 'pro',
      });
      const saved = await saveImage({
        bookId,
        blob: result.blob,
        mime: result.mime,
        prompt: `Portrait: ${data.name}`,
        style: genStyle,
        model: result.model,
      });

      // Revoke any previous preview URL for this character in the editor.
      if (data.id && urlMapRef.current[data.id]) {
        URL.revokeObjectURL(urlMapRef.current[data.id]);
      }

      // Create a new preview URL and store it.
      const previewUrl = URL.createObjectURL(result.blob);
      const tempKey = data.id || '__new__';
      urlMapRef.current[tempKey] = previewUrl;
      setPortraitUrls((prev) => ({ ...prev, [tempKey]: previewUrl }));

      setEditor((prev) => ({ ...prev, data: { ...prev.data, portraitId: saved.id, _previewKey: tempKey } }));
      toast.success(t('characters.portraitGenerated'));
    } catch (err) {
      toast.showError(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteCharacter(confirmDelete.id);
    setConfirmDelete(null);
    await refresh();
    toast.success(t('common.delete'));
  };

  // Derive a preview URL for the portrait shown inside the editor modal.
  const portraitForEditor = (() => {
    if (!editor?.data?.portraitId) return null;
    const key = editor.data._previewKey || editor.data.id;
    return portraitUrls[key] || null;
  })();

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <PageTransition>
      <div
        className="max-w-2xl mx-auto px-4 pt-4 pb-4"
        style={{ background: 'var(--theme-bg)', color: 'var(--theme-text)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          {routeBookId && (
            <button
              onClick={() => navigate(`/book/${routeBookId}`)}
              className="btn-icon rounded-[10px]"
              style={{ '--hover-bg': 'rgba(201,151,58,0.12)' }}
              aria-label={t('common.back')}
            >
              <ArrowLeft size={22} />
            </button>
          )}
          <div className="flex-1">
            <div
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: 'var(--theme-text-soft)' }}
            >
              {t('characters.eyebrow')}
            </div>
            <h1 className="font-tiro text-[1.8rem] m-0 leading-tight" style={{ color: 'var(--theme-text)' }}>
              {t('characters.title')}
            </h1>
          </div>
        </div>

        {/* Book selector (only when no route bookId and multiple books exist) */}
        {!routeBookId && books.length > 1 && (
          <select
            value={bookId || ''}
            onChange={(e) => setBookId(e.target.value)}
            className="input mb-4"
            style={{
              background: 'var(--theme-bg-input)',
              color: 'var(--theme-text)',
              borderColor: 'var(--theme-border)',
            }}
          >
            {books.map((b) => (
              <option key={b.id} value={b.id}>{b.title}</option>
            ))}
          </select>
        )}

        {/* Add button */}
        <button
          onClick={() => setEditor({ mode: 'create', data: { ...EMPTY } })}
          className="btn btn-primary w-full mb-4"
          disabled={!bookId}
        >
          <Plus size={20} />
          {t('characters.add')}
        </button>

        {/* List / empty state */}
        {characters.length === 0 ? (
          <div
            className="lekhak-card-paper p-8 text-center"
            style={{ background: 'var(--theme-bg-card)', borderColor: 'var(--theme-border)' }}
          >
            <div
              className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center"
              style={{ background: 'var(--theme-bg-input)', border: '1px solid var(--theme-border)' }}
            >
              <Users size={26} style={{ color: 'var(--theme-text-soft)' }} />
            </div>
            <p style={{ color: 'var(--theme-text-soft)' }}>{t('characters.empty')}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            <AnimatePresence>
              {characters.map((c, i) => (
                <motion.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, delay: i * 0.03 }}
                  className="lekhak-card-paper p-4 flex gap-3"
                  style={{ background: 'var(--theme-bg-card)', borderColor: 'var(--theme-border)' }}
                >
                  {/* Portrait thumbnail */}
                  <div
                    className="w-20 h-20 flex-shrink-0 rounded-[10px] overflow-hidden flex items-center justify-center"
                    style={{ background: 'var(--theme-bg-input)', border: '1px solid var(--theme-border)' }}
                  >
                    {portraitUrls[c.id] ? (
                      <img src={portraitUrls[c.id]} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <Users size={24} style={{ color: 'var(--theme-text-soft)', opacity: 0.5 }} />
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-tiro text-[1.25rem] m-0" style={{ color: 'var(--theme-text)' }}>
                      {c.name}
                    </h3>
                    {c.traits && (
                      <div className="text-xs italic mb-1" style={{ color: 'var(--theme-text-soft)' }}>
                        {c.traits}
                      </div>
                    )}
                    <p className="text-sm line-clamp-3 m-0" style={{ color: 'var(--theme-text-soft)' }}>
                      {c.description}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => setEditor({ mode: 'edit', data: { ...c } })}
                      className="btn-icon rounded-[8px]"
                      style={{ color: 'var(--theme-text-soft)' }}
                      aria-label={t('common.edit')}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(c)}
                      className="btn-icon rounded-[8px]"
                      style={{ color: 'var(--theme-text-soft)' }}
                      aria-label={t('common.delete')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Editor modal                                                        */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        open={!!editor}
        onClose={() => setEditor(null)}
        title={editor?.mode === 'create' ? t('characters.modalNew') : t('characters.modalEdit')}
        size="lg"
        footer={
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditor(null)} className="btn btn-ghost">
              {t('common.cancel')}
            </button>
            <button onClick={handleSave} className="btn btn-primary">
              {t('common.save')}
            </button>
          </div>
        }
      >
        {editor && (
          <div className="space-y-4">
            {/* Portrait preview + generate */}
            <div
              className="lekhak-card p-3 flex gap-3 items-center"
              style={{ background: 'var(--theme-bg-card)', borderColor: 'var(--theme-border)' }}
            >
              <div
                className="w-24 h-24 flex-shrink-0 rounded-[10px] overflow-hidden flex items-center justify-center"
                style={{ background: 'var(--theme-bg-input)', border: '1px solid var(--theme-border)' }}
              >
                {portraitForEditor ? (
                  <img src={portraitForEditor} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Users size={28} style={{ color: 'var(--theme-text-soft)', opacity: 0.5 }} />
                )}
              </div>
              <div className="flex-1">
                <select
                  value={genStyle}
                  onChange={(e) => setGenStyle(e.target.value)}
                  className="input mb-2 text-sm"
                  style={{
                    background: 'var(--theme-bg-input)',
                    color: 'var(--theme-text)',
                    borderColor: 'var(--theme-border)',
                  }}
                >
                  {IMAGE_STYLES.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleGeneratePortrait}
                  disabled={generating}
                  className="btn btn-secondary w-full text-sm h-10"
                >
                  {generating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {t('common.loading')}
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      {t('characters.generatePortrait')}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Name field */}
            <label className="block">
              <span
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--theme-text-soft)' }}
              >
                {t('characters.fieldName')} *
              </span>
              <input
                className="input"
                style={{
                  background: 'var(--theme-bg-input)',
                  color: 'var(--theme-text)',
                  borderColor: 'var(--theme-border)',
                }}
                value={editor.data.name}
                onChange={(e) =>
                  setEditor((prev) => ({ ...prev, data: { ...prev.data, name: e.target.value } }))
                }
                placeholder={t('characters.fieldNamePh')}
                autoFocus
              />
            </label>

            {/* Traits field */}
            <label className="block">
              <span
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--theme-text-soft)' }}
              >
                {t('characters.fieldTraits')}
              </span>
              <input
                className="input"
                style={{
                  background: 'var(--theme-bg-input)',
                  color: 'var(--theme-text)',
                  borderColor: 'var(--theme-border)',
                }}
                value={editor.data.traits}
                onChange={(e) =>
                  setEditor((prev) => ({ ...prev, data: { ...prev.data, traits: e.target.value } }))
                }
                placeholder={t('characters.fieldTraitsPh')}
              />
            </label>

            {/* Description field */}
            <label className="block">
              <span
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--theme-text-soft)' }}
              >
                {t('characters.fieldDescription')}
              </span>
              <textarea
                rows={5}
                className="textarea"
                style={{
                  background: 'var(--theme-bg-input)',
                  color: 'var(--theme-text)',
                  borderColor: 'var(--theme-border)',
                }}
                value={editor.data.description}
                onChange={(e) =>
                  setEditor((prev) => ({ ...prev, data: { ...prev.data, description: e.target.value } }))
                }
                placeholder={t('characters.fieldDescriptionPh')}
              />
            </label>
          </div>
        )}
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Confirm-delete modal                                                */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={t('characters.confirmDelete.title')}
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost">
              {t('common.cancel')}
            </button>
            <button
              onClick={handleDelete}
              className="btn"
              style={{ background: 'var(--theme-bg-card)', color: 'var(--theme-text)', borderColor: 'var(--theme-border)' }}
            >
              {t('common.delete')}
            </button>
          </div>
        }
      >
        <p style={{ color: 'var(--theme-text-soft)' }}>
          {t('characters.confirmDelete.body', { name: confirmDelete?.name ?? '' })}
        </p>
      </Modal>
    </PageTransition>
  );
}
