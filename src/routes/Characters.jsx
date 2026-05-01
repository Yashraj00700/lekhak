import { useEffect, useState } from 'react';
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
  X,
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

const EMPTY = { name: '', description: '', traits: '', portraitId: null };

export default function Characters() {
  const { bookId: routeBookId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [bookId, setBookId] = useState(routeBookId || null);
  const [books, setBooks] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [portraitUrls, setPortraitUrls] = useState({});

  const [editor, setEditor] = useState(null); // { mode:'create'|'edit', data }
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genStyle, setGenStyle] = useState('realistic');

  useEffect(() => {
    (async () => {
      if (routeBookId) {
        const b = await getBook(routeBookId);
        if (!b) { navigate('/'); return; }
        setBookId(b.id);
      } else {
        const list = await listBooks();
        setBooks(list);
        if (list.length > 0) setBookId(list[0].id);
      }
    })();
  }, [routeBookId, navigate]);

  useEffect(() => {
    if (!bookId) return;
    refresh();
    return () => Object.values(portraitUrls).forEach((u) => URL.revokeObjectURL(u));
    // eslint-disable-next-line
  }, [bookId]);

  const refresh = async () => {
    const list = await listCharacters(bookId);
    setCharacters(list);
    const urls = {};
    for (const c of list) {
      if (c.portraitId) {
        const img = await getImage(c.portraitId);
        if (img?.blob) urls[c.id] = URL.createObjectURL(img.blob);
      }
    }
    setPortraitUrls((prev) => {
      Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
      return urls;
    });
  };

  const handleSave = async () => {
    if (!editor?.data?.name?.trim()) {
      toast.warning('कृपया पात्राचे नाव लिहा');
      return;
    }
    if (editor.mode === 'create') {
      await createCharacter(bookId, editor.data);
    } else {
      await updateCharacter(editor.data.id, editor.data);
    }
    setEditor(null);
    await refresh();
    toast.success('जतन केले');
  };

  const handleGeneratePortrait = async () => {
    const data = editor?.data;
    if (!data?.name?.trim() || !data?.description?.trim()) {
      toast.warning('आधी नाव आणि वर्णन भरा');
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
      setEditor({ ...editor, data: { ...data, portraitId: saved.id } });
      toast.success('चित्र तयार झाले');
    } catch (err) {
      toast.error(err.marathiMessage || 'चित्र तयार करता आले नाही');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteCharacter(confirmDelete.id);
    setConfirmDelete(null);
    await refresh();
    toast.success('काढले');
  };

  const portraitForEditor =
    editor?.data?.portraitId && portraitUrls[editor?.data?.id]
      ? portraitUrls[editor.data.id]
      : null;

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
              पात्रे
            </div>
            <h1 className="font-tiro text-[1.8rem] m-0 leading-tight">पात्र परिचय</h1>
          </div>
        </div>

        {!routeBookId && books.length > 1 && (
          <select
            value={bookId || ''}
            onChange={(e) => setBookId(e.target.value)}
            className="input mb-4"
          >
            {books.map((b) => (
              <option key={b.id} value={b.id}>{b.title}</option>
            ))}
          </select>
        )}

        <button
          onClick={() => setEditor({ mode: 'create', data: { ...EMPTY } })}
          className="btn btn-primary w-full mb-4"
          disabled={!bookId}
        >
          <Plus size={20} />
          नवीन पात्र जोडा
        </button>

        {characters.length === 0 ? (
          <div className="lekhak-card-paper p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[var(--color-parchment)] flex items-center justify-center border border-[var(--color-gold)]">
              <Users size={26} className="text-[var(--color-terracotta)]" />
            </div>
            <p className="text-[var(--color-ink-soft)]">अजून कोणतेही पात्र नाही</p>
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
                >
                  <div className="w-20 h-20 flex-shrink-0 rounded-[10px] overflow-hidden bg-[var(--color-parchment)] border border-[var(--color-gold)] flex items-center justify-center">
                    {portraitUrls[c.id] ? (
                      <img src={portraitUrls[c.id]} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <Users size={24} className="text-[var(--color-terracotta)] opacity-50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-tiro text-[1.25rem] m-0">{c.name}</h3>
                    {c.traits && (
                      <div className="text-xs text-[var(--color-clay)] italic mb-1">{c.traits}</div>
                    )}
                    <p className="text-sm text-[var(--color-ink-soft)] line-clamp-3 m-0">
                      {c.description}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => setEditor({ mode: 'edit', data: { ...c } })}
                      className="btn-icon rounded-[8px] text-[var(--color-ink-soft)] hover:text-[var(--color-terracotta)] hover:bg-[rgba(196,98,45,0.08)]"
                      aria-label="संपादित"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(c)}
                      className="btn-icon rounded-[8px] text-[var(--color-ink-soft)] hover:text-[var(--color-rust)] hover:bg-[rgba(160,66,26,0.08)]"
                      aria-label="काढा"
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

      {/* Editor */}
      <Modal
        open={!!editor}
        onClose={() => setEditor(null)}
        title={editor?.mode === 'create' ? 'नवीन पात्र' : 'पात्र संपादित करा'}
        size="lg"
        footer={
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditor(null)} className="btn btn-ghost">रद्द करा</button>
            <button onClick={handleSave} className="btn btn-primary">जतन करा</button>
          </div>
        }
      >
        {editor && (
          <div className="space-y-4">
            {/* Portrait section */}
            <div className="lekhak-card p-3 flex gap-3 items-center">
              <div className="w-24 h-24 flex-shrink-0 rounded-[10px] overflow-hidden bg-[var(--color-parchment)] border border-[var(--color-gold)] flex items-center justify-center">
                {portraitForEditor ? (
                  <img src={portraitForEditor} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Users size={28} className="text-[var(--color-terracotta)] opacity-50" />
                )}
              </div>
              <div className="flex-1">
                <select
                  value={genStyle}
                  onChange={(e) => setGenStyle(e.target.value)}
                  className="input mb-2 text-sm"
                >
                  {IMAGE_STYLES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
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
                      तयार होत आहे…
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      AI चित्र तयार करा
                    </>
                  )}
                </button>
              </div>
            </div>

            <label className="block">
              <span className="block text-sm font-medium text-[var(--color-ink-soft)] mb-1.5">
                नाव *
              </span>
              <input
                className="input"
                value={editor.data.name}
                onChange={(e) => setEditor({ ...editor, data: { ...editor.data, name: e.target.value } })}
                placeholder="पात्राचे नाव"
                autoFocus
              />
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-[var(--color-ink-soft)] mb-1.5">
                गुणधर्म
              </span>
              <input
                className="input"
                value={editor.data.traits}
                onChange={(e) => setEditor({ ...editor, data: { ...editor.data, traits: e.target.value } })}
                placeholder="उदा. वयस्कर, धीट, कारागीर"
              />
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-[var(--color-ink-soft)] mb-1.5">
                वर्णन
              </span>
              <textarea
                rows={5}
                className="textarea"
                value={editor.data.description}
                onChange={(e) => setEditor({ ...editor, data: { ...editor.data, description: e.target.value } })}
                placeholder="पात्र, त्याची पार्श्वभूमी, ओळख…"
              />
            </label>
          </div>
        )}
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="पात्र काढायचे?"
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost">नाही</button>
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
          “{confirmDelete?.name}” कायमचे काढून टाकले जाईल.
        </p>
      </Modal>
    </PageTransition>
  );
}
