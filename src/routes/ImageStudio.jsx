import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  Download,
  ImageIcon,
  Loader2,
  Sparkles,
  Star,
  Trash2,
  Wand2,
  ZapIcon as Zap,
} from 'lucide-react';
import PageTransition from '../components/PageTransition.jsx';
import Modal from '../components/Modal.jsx';
import TribalDivider from '../components/TribalDivider.jsx';
import {
  deleteImage,
  getBook,
  listBooks,
  listChapters,
  listImages,
  saveImage,
  updateBook,
} from '../lib/db.js';
import { generateImage, editImage, IMAGE_STYLES } from '../lib/gemini.js';
import { useToast } from '../hooks/useToast.jsx';
import { useLanguage } from '../hooks/useLanguage.jsx';

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */

/**
 * Build a single object-URL for a blob and register it in the ref-map so
 * it can be revoked later.  Never call URL.createObjectURL during render.
 *
 * @param {Map<string,string>} map  – the live blobUrlMap ref value
 * @param {string}             id   – image record id
 * @param {Blob}               blob – image blob
 * @returns {string}                – the new object URL
 */
function allocUrl(map, id, blob) {
  // Revoke any previous URL for this id before creating a new one.
  const prev = map.get(id);
  if (prev) URL.revokeObjectURL(prev);
  const url = URL.createObjectURL(blob);
  map.set(id, url);
  return url;
}

/* ─────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────── */

export default function ImageStudio() {
  const { bookId: routeBookId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useLanguage();

  // ── book / list state ──────────────────────────────────────
  const [bookId, setBookId] = useState(routeBookId || null);
  const [books, setBooks] = useState([]);
  const [book, setBook] = useState(null);

  // ── image gallery state ────────────────────────────────────
  const [images, setImages] = useState([]);
  // thumbUrls mirrors the blobUrlMap ref so the component can re-render
  // when URLs change — but we never create URLs inside render itself.
  const [thumbUrls, setThumbUrls] = useState({});

  /**
   * Map of id → object-URL.  Kept as a ref so that cleanup functions and
   * async callbacks always see the latest entries without stale closures.
   */
  const blobUrlMap = useRef(new Map());

  // ── generator state ────────────────────────────────────────
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('warli');
  const [model, setModel] = useState('pro');
  const [busy, setBusy] = useState(false);

  // ── chapter context (always-on) ────────────────────────────
  const [chapterContext, setChapterContext] = useState('');

  // ── modal state ────────────────────────────────────────────
  const [editing, setEditing] = useState(null);   // { image }
  const [editInstr, setEditInstr] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [preview, setPreview] = useState(null);

  /* ── Revoke ALL object-URLs on unmount ────────────────────── */
  useEffect(() => {
    const map = blobUrlMap.current;
    return () => {
      map.forEach((url) => URL.revokeObjectURL(url));
      map.clear();
    };
  }, []);

  /* ── Initial load ─────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (routeBookId) {
        const b = await getBook(routeBookId);
        if (cancelled) return;
        if (!b) { navigate('/'); return; }
        setBook(b);
        setBookId(b.id);
      } else {
        const list = await listBooks();
        if (cancelled) return;
        setBooks(list);
        if (list.length > 0) {
          const b = list[0];
          setBookId(b.id);
          setBook(b);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [routeBookId, navigate]);

  /* ── Load images whenever bookId changes ──────────────────── */
  useEffect(() => {
    if (!bookId) return;
    refreshImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  /* ── Load chapter context whenever bookId changes ─────────── */
  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    (async () => {
      try {
        const chapters = await listChapters(bookId);
        if (cancelled) return;
        // Concatenate all chapter content, trimmed, up to ~2000 chars so the
        // generation prompt stays a reasonable size.
        const text = chapters
          .map((c) => (c.content || '').trim())
          .filter(Boolean)
          .join('\n\n')
          .slice(0, 2000);
        setChapterContext(text);
      } catch {
        // Non-critical — silently ignore if chapters can't be read.
      }
    })();
    return () => { cancelled = true; };
  }, [bookId]);

  /* ── Helpers ──────────────────────────────────────────────── */

  const refreshImages = async () => {
    if (!bookId) return;
    const list = await listImages(bookId);
    setImages(list);

    // Rebuild URL map: revoke any URL that no longer has a matching image,
    // then allocate URLs for any image that doesn't have one yet.
    const map = blobUrlMap.current;
    const liveIds = new Set(list.map((img) => img.id));

    // Revoke stale entries.
    map.forEach((url, id) => {
      if (!liveIds.has(id)) {
        URL.revokeObjectURL(url);
        map.delete(id);
      }
    });

    // Allocate new entries.
    for (const img of list) {
      if (img.blob && !map.has(img.id)) {
        allocUrl(map, img.id, img.blob);
      }
    }

    // Snapshot into state so the component re-renders with the new URLs.
    setThumbUrls(Object.fromEntries(map));
  };

  /* ── Generate ─────────────────────────────────────────────── */
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.warning(t('images.descRequired'));
      return;
    }
    if (!bookId) {
      toast.warning(t('images.bookFirst'));
      return;
    }
    setBusy(true);
    try {
      // Build the final prompt, optionally enriched with chapter context.
      const basePrompt = prompt.trim();
      const enrichedPrompt = chapterContext
        ? `${basePrompt} (कथेचा संदर्भ: ${chapterContext.slice(0, 500)})`
        : basePrompt;

      const result = await generateImage({ prompt: enrichedPrompt, style, model });
      await saveImage({
        bookId,
        blob: result.blob,
        mime: result.mime,
        prompt: basePrompt,
        style,
        model: result.model,
      });
      setPrompt('');
      await refreshImages();
      toast.success(t('images.generated'));
    } catch (err) {
      toast.showError(err);
    } finally {
      setBusy(false);
    }
  };

  /* ── Edit (multi-turn) ────────────────────────────────────── */
  const handleEdit = async () => {
    if (!editing || !editInstr.trim()) {
      toast.warning(t('images.editRequired'));
      return;
    }
    setBusy(true);
    try {
      const result = await editImage({
        baseImageBlob: editing.image.blob,
        baseMime: editing.image.mime,
        instruction: editInstr.trim(),
        model: editing.image.model?.includes('flash') ? 'flash' : 'pro',
      });
      await saveImage({
        bookId,
        blob: result.blob,
        mime: result.mime,
        prompt: `${editing.image.prompt} → ${editInstr.trim()}`,
        style: editing.image.style,
        model: result.model,
        parentId: editing.image.id,
      });
      setEditing(null);
      setEditInstr('');
      await refreshImages();
      toast.success(t('images.edited'));
    } catch (err) {
      toast.showError(err);
    } finally {
      setBusy(false);
    }
  };

  /* ── Delete ───────────────────────────────────────────────── */
  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteImage(confirmDelete.id);
    if (book?.coverImageId === confirmDelete.id) {
      const updated = await updateBook(book.id, { coverImageId: null });
      setBook(updated);
    }
    setConfirmDelete(null);
    await refreshImages();
    toast.success(t('images.deleted'));
  };

  /* ── Set cover ────────────────────────────────────────────── */
  const setCover = async (imgId) => {
    if (!book) return;
    const updated = await updateBook(book.id, { coverImageId: imgId });
    setBook(updated);
    toast.success(t('images.coverSet'));
  };

  /* ── Download ─────────────────────────────────────────────── */
  const downloadImage = (img) => {
    const url = thumbUrls[img.id];
    if (!url) return;
    const ext = (img.mime || 'image/png').split('/')[1] || 'png';
    const a = document.createElement('a');
    a.href = url;
    a.download = `lekhak-${img.id}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <PageTransition>
      <div
        className="max-w-2xl mx-auto px-4 pt-4 pb-4"
        style={{ background: 'var(--theme-bg)' }}
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
              {t('images.eyebrow')}
            </div>
            <h1
              className="font-tiro text-[1.8rem] m-0 leading-tight"
              style={{ color: 'var(--theme-text)' }}
            >
              {t('images.title')}
            </h1>
          </div>
        </div>

        {/* Book picker (standalone mode with multiple books) */}
        {!routeBookId && books.length > 1 && (
          <div className="mb-4">
            <select
              value={bookId || ''}
              onChange={(e) => {
                const id = e.target.value;
                setBookId(id);
                setBook(books.find((b) => b.id === id) || null);
              }}
              className="input"
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
          </div>
        )}

        {/* Generator card */}
        <div
          className="lekhak-card-paper p-4 mb-4"
          style={{ background: 'var(--theme-bg-card)', borderColor: 'var(--theme-border)' }}
        >
          {/* Description */}
          <label className="block mb-3">
            <span
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--theme-text-soft)' }}
            >
              {t('images.descLabel')}
            </span>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="textarea"
              placeholder={t('images.descPlaceholder')}
              style={{
                background: 'var(--theme-bg-input)',
                color: 'var(--theme-text)',
                borderColor: 'var(--theme-border)',
              }}
            />
          </label>

          {/* Style picker */}
          <div className="mb-3">
            <div
              className="text-sm font-medium mb-1.5"
              style={{ color: 'var(--theme-text-soft)' }}
            >
              {t('images.styleLabel')}
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
              {IMAGE_STYLES.map((s) => (
                <StyleChip
                  key={s.key}
                  label={t(`images.style.${s.key}`)}
                  active={style === s.key}
                  onClick={() => setStyle(s.key)}
                />
              ))}
            </div>
          </div>

          {/* Quality picker */}
          <div className="mb-3">
            <div
              className="text-sm font-medium mb-1.5"
              style={{ color: 'var(--theme-text-soft)' }}
            >
              {t('images.qualityLabel')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ModelChoice
                label={t('images.qualityHigh')}
                hint={t('images.qualityHighHint')}
                icon={Star}
                active={model === 'pro'}
                onClick={() => setModel('pro')}
              />
              <ModelChoice
                label={t('images.qualityFast')}
                hint={t('images.qualityFastHint')}
                icon={Zap}
                active={model === 'flash'}
                onClick={() => setModel('flash')}
              />
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={busy || !prompt.trim()}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                {t('images.generating')}
              </>
            ) : (
              <>
                <Sparkles size={20} />
                {t('images.generate')}
              </>
            )}
          </button>
        </div>

        <TribalDivider variant="gond" />

        {/* Gallery heading */}
        <h2
          className="font-tiro text-[1.4rem] mb-3 mt-4 flex items-center gap-2"
          style={{ color: 'var(--theme-text)' }}
        >
          <ImageIcon size={20} style={{ color: 'var(--theme-text-soft)' }} />
          {t('images.gallery', { n: images.length })}
        </h2>

        {/* Skeleton while first generation is pending */}
        {busy && images.length === 0 && (
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="aspect-square shimmer rounded-[12px]"
                style={{ background: 'var(--theme-bg-card)' }}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!busy && images.length === 0 && (
          <div
            className="lekhak-card-paper p-8 text-center"
            style={{ background: 'var(--theme-bg-card)', borderColor: 'var(--theme-border)' }}
          >
            <div
              className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center border"
              style={{
                background: 'var(--theme-bg-input)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <ImageIcon size={26} style={{ color: 'var(--theme-text-soft)' }} />
            </div>
            <p style={{ color: 'var(--theme-text-soft)' }}>{t('images.empty')}</p>
          </div>
        )}

        {/* Gallery grid */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <AnimatePresence>
              {images.map((img, i) => (
                <motion.div
                  key={img.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.22, delay: i * 0.03 }}
                  className="relative group rounded-[12px] overflow-hidden aspect-square"
                  style={{
                    border: '2px solid var(--theme-border)',
                    background: 'var(--theme-bg-card)',
                  }}
                >
                  {thumbUrls[img.id] && (
                    <button
                      onClick={() => setPreview(img)}
                      className="block w-full h-full"
                      aria-label={img.prompt}
                    >
                      <img
                        src={thumbUrls[img.id]}
                        alt={img.prompt}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  )}

                  {/* Style / model badge */}
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-[rgba(0,0,0,0.7)] to-transparent pointer-events-none">
                    <div className="text-[10px] text-white uppercase tracking-wider opacity-90">
                      {img.style} · {img.model?.includes('flash') ? 'Flash' : 'Pro'}
                    </div>
                  </div>

                  {/* Cover badge */}
                  {book?.coverImageId === img.id && (
                    <div
                      className="absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-bold pointer-events-none"
                      style={{
                        background: 'var(--theme-bg-card)',
                        color: 'var(--theme-text)',
                        border: '1px solid var(--theme-border)',
                      }}
                    >
                      {t('images.cover')}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Preview / Action modal ────────────────────────────── */}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={t('images.title')}
        size="lg"
      >
        {preview && (
          <div className="space-y-3">
            {thumbUrls[preview.id] && (
              <img
                src={thumbUrls[preview.id]}
                alt={preview.prompt}
                className="w-full rounded-[10px]"
                style={{ border: '1px solid var(--theme-border)' }}
              />
            )}
            <p
              className="text-sm italic"
              style={{ color: 'var(--theme-text-soft)' }}
            >
              "{preview.prompt}"
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setEditing({ image: preview });
                  setPreview(null);
                }}
                className="btn btn-secondary"
              >
                <Wand2 size={18} />
                {t('common.edit')}
              </button>
              <button
                onClick={() => {
                  setCover(preview.id);
                  setPreview(null);
                }}
                className="btn btn-ghost"
              >
                <BookOpen size={18} />
                {t('images.cover')}
              </button>
              <button
                onClick={() => downloadImage(preview)}
                className="btn btn-ghost"
              >
                <Download size={18} />
                {t('common.download')}
              </button>
              <button
                onClick={() => {
                  setConfirmDelete(preview);
                  setPreview(null);
                }}
                className="btn"
                style={{ background: 'var(--theme-text-soft)', color: 'var(--theme-bg)' }}
              >
                <Trash2 size={18} />
                {t('common.delete')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Multi-turn edit modal ─────────────────────────────── */}
      <Modal
        open={!!editing}
        onClose={() => { setEditing(null); setEditInstr(''); }}
        title={t('images.editTitle')}
        size="lg"
        footer={
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setEditing(null); setEditInstr(''); }}
              className="btn btn-ghost"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleEdit}
              disabled={busy || !editInstr.trim()}
              className="btn btn-primary disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {t('common.aiGenerating')}
                </>
              ) : (
                <>
                  <Wand2 size={18} />
                  {t('common.save')}
                </>
              )}
            </button>
          </div>
        }
      >
        {editing && (
          <div className="space-y-3">
            {thumbUrls[editing.image.id] && (
              <img
                src={thumbUrls[editing.image.id]}
                alt=""
                className="w-full rounded-[10px]"
                style={{ border: '1px solid var(--theme-border)' }}
              />
            )}
            <label className="block">
              <span
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--theme-text-soft)' }}
              >
                {t('images.editLabel')}
              </span>
              <textarea
                rows={3}
                value={editInstr}
                onChange={(e) => setEditInstr(e.target.value)}
                className="textarea"
                placeholder={t('images.editPlaceholder')}
                autoFocus
                style={{
                  background: 'var(--theme-bg-input)',
                  color: 'var(--theme-text)',
                  borderColor: 'var(--theme-border)',
                }}
              />
            </label>
          </div>
        )}
      </Modal>

      {/* ── Confirm delete modal ──────────────────────────────── */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={t('images.confirmDelete.title')}
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setConfirmDelete(null)}
              className="btn btn-ghost"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleDelete}
              className="btn"
              style={{ background: 'var(--theme-text-soft)', color: 'var(--theme-bg)' }}
            >
              {t('common.delete')}
            </button>
          </div>
        }
      >
        <p style={{ color: 'var(--theme-text-soft)' }}>
          {t('images.confirmDelete.body')}
        </p>
      </Modal>
    </PageTransition>
  );
}

/* ─────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────── */

function StyleChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 px-4 h-11 rounded-[10px] border text-sm font-medium transition-colors"
      style={
        active
          ? {
              background: 'var(--theme-text)',
              color: 'var(--theme-bg)',
              borderColor: 'var(--theme-border)',
            }
          : {
              background: 'var(--theme-bg-input)',
              color: 'var(--theme-text)',
              borderColor: 'var(--theme-border)',
            }
      }
    >
      {label}
    </button>
  );
}

function ModelChoice({ label, hint, icon: Icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="p-3 rounded-[10px] border-2 transition-all text-left"
      style={
        active
          ? {
              background: 'var(--theme-text)',
              color: 'var(--theme-bg)',
              borderColor: 'var(--theme-border)',
            }
          : {
              background: 'var(--theme-bg-input)',
              color: 'var(--theme-text)',
              borderColor: 'var(--theme-border)',
            }
      }
    >
      <div className="flex items-center gap-1.5 font-semibold">
        <Icon size={16} />
        {label}
      </div>
      <div
        className="text-xs mt-0.5"
        style={{ opacity: active ? 0.8 : 1, color: active ? 'inherit' : 'var(--theme-text-soft)' }}
      >
        {hint}
      </div>
    </button>
  );
}
