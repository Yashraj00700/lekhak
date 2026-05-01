import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  Wand2,
  X,
  ZapIcon as Zap,
  Star,
  BookOpen,
  Download,
} from 'lucide-react';
import PageTransition from '../components/PageTransition.jsx';
import Modal from '../components/Modal.jsx';
import TribalDivider from '../components/TribalDivider.jsx';
import {
  listBooks,
  getBook,
  listImages,
  saveImage,
  deleteImage,
  updateBook,
} from '../lib/db.js';
import { generateImage, editImage, IMAGE_STYLES } from '../lib/gemini.js';
import { useToast } from '../hooks/useToast.jsx';

export default function ImageStudio() {
  const { bookId: routeBookId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [bookId, setBookId] = useState(routeBookId || null);
  const [books, setBooks] = useState([]);
  const [book, setBook] = useState(null);
  const [images, setImages] = useState([]);
  const [thumbUrls, setThumbUrls] = useState({});

  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('warli');
  const [model, setModel] = useState('pro');
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(null); // { image, instruction }
  const [editInstr, setEditInstr] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [preview, setPreview] = useState(null);

  /* ---------- Load ---------- */
  useEffect(() => {
    (async () => {
      if (routeBookId) {
        const b = await getBook(routeBookId);
        if (!b) { navigate('/'); return; }
        setBook(b);
        setBookId(b.id);
      } else {
        const list = await listBooks();
        setBooks(list);
        if (list.length > 0) {
          const b = list[0];
          setBookId(b.id);
          setBook(b);
        }
      }
    })();
  }, [routeBookId, navigate]);

  useEffect(() => {
    if (!bookId) return;
    refreshImages();
    return () => {
      Object.values(thumbUrls).forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line
  }, [bookId]);

  const refreshImages = async () => {
    if (!bookId) return;
    const list = await listImages(bookId);
    setImages(list);
    const urls = {};
    for (const img of list) {
      if (img.blob) urls[img.id] = URL.createObjectURL(img.blob);
    }
    setThumbUrls((prev) => {
      Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
      return urls;
    });
  };

  /* ---------- Generate ---------- */
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.warning('कृपया चित्राचे वर्णन लिहा');
      return;
    }
    if (!bookId) {
      toast.warning('आधी पुस्तक तयार करा');
      return;
    }
    setBusy(true);
    try {
      const result = await generateImage({
        prompt: prompt.trim(),
        style,
        model,
      });
      await saveImage({
        bookId,
        blob: result.blob,
        mime: result.mime,
        prompt: prompt.trim(),
        style,
        model: result.model,
      });
      setPrompt('');
      await refreshImages();
      toast.success('चित्र तयार झाले');
    } catch (err) {
      toast.error(err.marathiMessage || 'चित्र तयार करता आले नाही');
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Edit (multi-turn) ---------- */
  const handleEdit = async () => {
    if (!editing || !editInstr.trim()) {
      toast.warning('कृपया बदल काय हवा ते लिहा');
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
      toast.success('संपादित चित्र जतन केले');
    } catch (err) {
      toast.error(err.marathiMessage || 'चित्र संपादित करता आले नाही');
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Delete ---------- */
  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteImage(confirmDelete.id);
    if (book?.coverImageId === confirmDelete.id) {
      const updated = await updateBook(book.id, { coverImageId: null });
      setBook(updated);
    }
    setConfirmDelete(null);
    await refreshImages();
    toast.success('चित्र काढले');
  };

  /* ---------- Set cover ---------- */
  const setCover = async (imgId) => {
    if (!book) return;
    const updated = await updateBook(book.id, { coverImageId: imgId });
    setBook(updated);
    toast.success('मुखपृष्ठ चित्र सेट केले');
  };

  /* ---------- Download ---------- */
  const downloadImage = (img) => {
    const url = thumbUrls[img.id];
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `lekhak-${img.id}.${(img.mime || 'image/png').split('/')[1] || 'png'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          {routeBookId && (
            <button
              onClick={() => navigate(`/book/${routeBookId}`)}
              className="btn-icon rounded-[10px] hover:bg-[rgba(201,151,58,0.12)]"
              aria-label="मागे"
            >
              <ArrowLeft size={22} />
            </button>
          )}
          <div className="flex-1">
            <div className="text-[var(--color-terracotta)] text-xs font-semibold tracking-widest uppercase">
              चित्र स्टुडिओ
            </div>
            <h1 className="font-tiro text-[1.8rem] m-0 leading-tight">चित्रे तयार करा</h1>
          </div>
        </div>

        {!routeBookId && books.length > 1 && (
          <div className="mb-4">
            <select
              value={bookId || ''}
              onChange={(e) => {
                setBookId(e.target.value);
                setBook(books.find((b) => b.id === e.target.value));
              }}
              className="input"
            >
              {books.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          </div>
        )}

        {/* Generator card */}
        <div className="lekhak-card-paper p-4 mb-4">
          <label className="block mb-3">
            <span className="block text-sm font-medium text-[var(--color-ink-soft)] mb-1.5">
              चित्राचे वर्णन
            </span>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="textarea"
              placeholder="उदा. एक आदिवासी स्त्री जंगलात मातीचे भांडे घेऊन चालत आहे, सूर्यास्ताचा प्रकाश"
            />
          </label>

          <div className="mb-3">
            <div className="text-sm font-medium text-[var(--color-ink-soft)] mb-1.5">शैली</div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
              {IMAGE_STYLES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStyle(s.key)}
                  className={
                    'flex-shrink-0 px-4 h-11 rounded-[10px] border text-sm font-medium transition-colors ' +
                    (style === s.key
                      ? 'bg-[var(--color-terracotta)] text-[var(--color-cream)] border-[var(--color-terracotta-dark)]'
                      : 'bg-[var(--color-cream)] text-[var(--color-ink)] border-[var(--color-gold)]')
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <div className="text-sm font-medium text-[var(--color-ink-soft)] mb-1.5">गुणवत्ता</div>
            <div className="grid grid-cols-2 gap-2">
              <ModelChoice
                label="उच्च गुणवत्ता"
                hint="Nano Banana Pro"
                icon={Star}
                active={model === 'pro'}
                onClick={() => setModel('pro')}
              />
              <ModelChoice
                label="जलद"
                hint="Nano Banana 2"
                icon={Zap}
                active={model === 'flash'}
                onClick={() => setModel('flash')}
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={busy || !prompt.trim()}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                तयार होत आहे…
              </>
            ) : (
              <>
                <Sparkles size={20} />
                चित्र तयार करा
              </>
            )}
          </button>
        </div>

        <TribalDivider variant="gond" />

        {/* Gallery */}
        <h2 className="font-tiro text-[1.4rem] mb-3 mt-4 flex items-center gap-2">
          <ImageIcon size={20} className="text-[var(--color-terracotta)]" />
          संग्रह ({images.length})
        </h2>

        {busy && images.length === 0 && (
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-square shimmer rounded-[12px]" />
            ))}
          </div>
        )}

        {!busy && images.length === 0 && (
          <div className="lekhak-card-paper p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[var(--color-parchment)] flex items-center justify-center border border-[var(--color-gold)]">
              <ImageIcon size={26} className="text-[var(--color-terracotta)]" />
            </div>
            <p className="text-[var(--color-ink-soft)]">अजून कोणतेही चित्र नाही</p>
          </div>
        )}

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
                  className="relative group rounded-[12px] overflow-hidden border-2 border-[var(--color-gold)] bg-[var(--color-cream)] aspect-square"
                >
                  {thumbUrls[img.id] && (
                    <button
                      onClick={() => setPreview(img)}
                      className="block w-full h-full"
                    >
                      <img
                        src={thumbUrls[img.id]}
                        alt={img.prompt}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-[rgba(42,24,16,0.85)] to-transparent">
                    <div className="text-[10px] text-[var(--color-cream)] uppercase tracking-wider opacity-90">
                      {img.style} · {img.model?.includes('flash') ? 'Flash' : 'Pro'}
                    </div>
                  </div>
                  {book?.coverImageId === img.id && (
                    <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-[var(--color-gold)] text-[var(--color-ink)] text-[10px] font-bold">
                      मुखपृष्ठ
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Preview / Action modal */}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title="चित्र"
        size="lg"
      >
        {preview && (
          <div className="space-y-3">
            {thumbUrls[preview.id] && (
              <img
                src={thumbUrls[preview.id]}
                alt={preview.prompt}
                className="w-full rounded-[10px] border border-[var(--color-gold)]"
              />
            )}
            <p className="text-sm text-[var(--color-ink-soft)] italic">
              “{preview.prompt}”
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
                संपादित करा
              </button>
              <button
                onClick={() => {
                  setCover(preview.id);
                  setPreview(null);
                }}
                className="btn btn-ghost"
              >
                <BookOpen size={18} />
                मुखपृष्ठ
              </button>
              <button
                onClick={() => downloadImage(preview)}
                className="btn btn-ghost"
              >
                <Download size={18} />
                डाउनलोड
              </button>
              <button
                onClick={() => {
                  setConfirmDelete(preview);
                  setPreview(null);
                }}
                className="btn"
                style={{ background: 'var(--color-rust)', color: 'var(--color-cream)' }}
              >
                <Trash2 size={18} />
                काढा
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Multi-turn edit modal */}
      <Modal
        open={!!editing}
        onClose={() => { setEditing(null); setEditInstr(''); }}
        title="चित्र संपादित करा"
        size="lg"
        footer={
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setEditing(null); setEditInstr(''); }}
              className="btn btn-ghost"
            >
              रद्द करा
            </button>
            <button
              onClick={handleEdit}
              disabled={busy || !editInstr.trim()}
              className="btn btn-primary disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  तयार होत आहे…
                </>
              ) : (
                <>
                  <Wand2 size={18} />
                  संपादित करा
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
                className="w-full rounded-[10px] border border-[var(--color-gold)]"
              />
            )}
            <label className="block">
              <span className="block text-sm font-medium text-[var(--color-ink-soft)] mb-1.5">
                काय बदलायचे?
              </span>
              <textarea
                rows={3}
                value={editInstr}
                onChange={(e) => setEditInstr(e.target.value)}
                className="textarea"
                placeholder="उदा. आकाशात पक्षी जोडा, संध्याकाळचा रंग करा"
                autoFocus
              />
            </label>
          </div>
        )}
      </Modal>

      {/* Confirm delete */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="चित्र काढायचे?"
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost">
              नाही
            </button>
            <button
              onClick={handleDelete}
              className="btn"
              style={{ background: 'var(--color-rust)', color: 'var(--color-cream)' }}
            >
              होय
            </button>
          </div>
        }
      >
        <p className="text-[var(--color-ink-soft)]">
          हे चित्र कायमचे नष्ट होईल.
        </p>
      </Modal>
    </PageTransition>
  );
}

function ModelChoice({ label, hint, icon: Icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={
        'p-3 rounded-[10px] border-2 transition-all text-left ' +
        (active
          ? 'bg-[var(--color-forest)] text-[var(--color-cream)] border-[var(--color-forest-light)]'
          : 'bg-[var(--color-cream)] text-[var(--color-ink)] border-[var(--color-gold)]')
      }
    >
      <div className="flex items-center gap-1.5 font-semibold">
        <Icon size={16} />
        {label}
      </div>
      <div className={'text-xs mt-0.5 ' + (active ? 'opacity-90' : 'text-[var(--color-ink-soft)]')}>
        {hint}
      </div>
    </button>
  );
}
