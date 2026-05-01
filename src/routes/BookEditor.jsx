import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  ImageIcon,
  Users,
  Library,
  FileDown,
  Sparkles,
  Trash2,
  CheckCircle2,
  Loader2,
  CircleDot,
  Settings as Cog,
  BookOpen,
  Pencil,
} from 'lucide-react';
import PageTransition from '../components/PageTransition.jsx';
import VoiceButton from '../components/VoiceButton.jsx';
import AIAssistPanel from '../components/AIAssistPanel.jsx';
import Modal from '../components/Modal.jsx';
import TribalDivider from '../components/TribalDivider.jsx';
import {
  getBook,
  updateBook,
  listChapters,
  createChapter,
  updateChapter,
  deleteChapter,
} from '../lib/db.js';
import useAutosave from '../hooks/useAutosave.js';
import { useToast } from '../hooks/useToast.jsx';

const FONT_SIZES = {
  small: '1.05rem',
  medium: '1.2rem',
  large: '1.375rem',
  xlarge: '1.6rem',
};

export default function BookEditor() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [content, setContent] = useState('');
  const [titleEdit, setTitleEdit] = useState('');
  const [interim, setInterim] = useState('');
  const [showChapterList, setShowChapterList] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showBookMeta, setShowBookMeta] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [selection, setSelection] = useState('');
  const [fontSize, setFontSize] = useState('large');

  const editorRef = useRef(null);

  /* ---------- Load ---------- */
  useEffect(() => {
    (async () => {
      const b = await getBook(bookId);
      if (!b) { navigate('/'); return; }
      setBook(b);
      const list = await listChapters(bookId);
      setChapters(list);
      const firstId = list[0]?.id || (await createChapter(bookId)).id;
      const refreshed = list.length > 0 ? list : await listChapters(bookId);
      setChapters(refreshed);
      setCurrentId(firstId);

      // Load font size pref
      const { getSettings } = await import('../lib/db.js');
      const s = await getSettings();
      setFontSize(s.fontSize || 'large');
    })();
  }, [bookId, navigate]);

  /* ---------- Switch chapter ---------- */
  useEffect(() => {
    if (!currentId) return;
    const ch = chapters.find((c) => c.id === currentId);
    if (ch) {
      setContent(ch.content || '');
      setTitleEdit(ch.title || '');
    }
  }, [currentId, chapters]);

  /* ---------- Autosave content ---------- */
  const { status: saveStatus, flush: flushSave } = useAutosave(
    content,
    async (val) => {
      if (!currentId) return;
      await updateChapter(currentId, { content: val });
    },
    { interval: 30_000 }
  );

  /* ---------- Autosave title (debounced shorter) ---------- */
  useEffect(() => {
    if (!currentId) return;
    const t = setTimeout(async () => {
      const ch = chapters.find((c) => c.id === currentId);
      if (ch && ch.title !== titleEdit) {
        const updated = await updateChapter(currentId, { title: titleEdit });
        if (updated) {
          setChapters((cs) => cs.map((c) => (c.id === updated.id ? updated : c)));
        }
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [titleEdit, currentId]);

  /* ---------- Voice transcripts ---------- */
  const appendVoice = (text) => {
    if (!text) return;
    setContent((prev) => {
      const sep = prev && !prev.endsWith(' ') && !prev.endsWith('\n') ? ' ' : '';
      return prev + sep + text;
    });
    setInterim('');
  };

  /* ---------- Selection capture ---------- */
  const onSelect = () => {
    const ta = editorRef.current;
    if (!ta) return;
    const sel = ta.value.substring(ta.selectionStart, ta.selectionEnd);
    setSelection(sel);
  };

  /* ---------- Chapter ops ---------- */
  const addChapter = async () => {
    await flushSave();
    const ch = await createChapter(bookId);
    const list = await listChapters(bookId);
    setChapters(list);
    setCurrentId(ch.id);
    toast.success('नवीन प्रकरण जोडले');
  };

  const removeChapter = async () => {
    if (!confirmDelete) return;
    const idx = chapters.findIndex((c) => c.id === confirmDelete.id);
    await deleteChapter(confirmDelete.id);
    const list = await listChapters(bookId);
    if (list.length === 0) {
      const fresh = await createChapter(bookId);
      setChapters([fresh]);
      setCurrentId(fresh.id);
    } else {
      setChapters(list);
      setCurrentId(list[Math.min(idx, list.length - 1)].id);
    }
    setConfirmDelete(null);
    toast.success('प्रकरण काढले');
  };

  const switchTo = async (id) => {
    if (id === currentId) return;
    await flushSave();
    setCurrentId(id);
    setShowChapterList(false);
    setShowAI(false);
  };

  const idx = chapters.findIndex((c) => c.id === currentId);
  const prevId = idx > 0 ? chapters[idx - 1].id : null;
  const nextId = idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1].id : null;

  const wordCount = useMemo(() => {
    if (!content) return 0;
    return content.trim().split(/\s+/).filter(Boolean).length;
  }, [content]);

  /* ---------- AI integration ---------- */
  const aiAccept = (text) => {
    setContent((prev) => prev + (prev.endsWith('\n') ? '' : '\n\n') + text);
    setShowAI(false);
    toast.success('जोडले');
  };
  const aiReplace = (text) => {
    if (selection) {
      setContent((prev) => prev.replace(selection, text));
    } else {
      setContent(text);
    }
    setShowAI(false);
    toast.success('बदलले');
  };

  if (!book || !currentId) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="animate-spin text-[var(--color-terracotta)]" size={32} />
        </div>
      </PageTransition>
    );
  }

  const currentChapter = chapters.find((c) => c.id === currentId);

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto px-3 pt-3 pb-4">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-3 sticky top-0 z-30 bg-[var(--color-parchment)]/95 backdrop-blur-md py-2 -mx-3 px-3 border-b border-[rgba(201,151,58,0.3)]">
          <button
            onClick={() => navigate('/')}
            className="btn-icon rounded-[10px] text-[var(--color-ink)] hover:bg-[rgba(201,151,58,0.12)]"
            aria-label="मुख्य पृष्ठ"
          >
            <ArrowLeft size={22} />
          </button>

          <button
            onClick={() => setShowBookMeta(true)}
            className="flex flex-col items-center min-w-0 max-w-[60%] hover:bg-[rgba(201,151,58,0.08)] rounded-[8px] px-3 py-1 transition-colors"
          >
            <div className="font-tiro text-[1.1rem] text-[var(--color-ink)] truncate w-full text-center leading-tight">
              {book.title}
            </div>
            <div className="text-[11px] text-[var(--color-ink-soft)] mt-0.5">
              प्रकरण {idx + 1} / {chapters.length}
            </div>
          </button>

          <SaveIndicator status={saveStatus} />
        </div>

        {/* Action shortcuts row */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mb-3 -mx-3 px-3">
          <ShortcutChip icon={BookOpen} label="प्रकरणे" onClick={() => setShowChapterList(true)} />
          <ShortcutChip
            icon={Sparkles}
            label="AI सहाय्यक"
            onClick={() => setShowAI((v) => !v)}
            active={showAI}
          />
          <ShortcutChip
            icon={ImageIcon}
            label="चित्रे"
            onClick={() => navigate(`/book/${bookId}/images`)}
          />
          <ShortcutChip
            icon={Users}
            label="पात्रे"
            onClick={() => navigate(`/book/${bookId}/characters`)}
          />
          <ShortcutChip
            icon={Library}
            label="शब्दार्थ"
            onClick={() => navigate(`/book/${bookId}/glossary`)}
          />
          <ShortcutChip
            icon={FileDown}
            label="निर्यात"
            onClick={() => navigate(`/book/${bookId}/export`)}
          />
        </div>

        {/* Chapter title */}
        <div className="lekhak-card-paper p-4 mb-3">
          <div className="flex items-center gap-2 text-[var(--color-terracotta)] text-xs font-semibold tracking-widest uppercase mb-1.5">
            <CircleDot size={10} />
            प्रकरण {idx + 1}
          </div>
          <input
            value={titleEdit}
            onChange={(e) => setTitleEdit(e.target.value)}
            placeholder={`प्रकरणाचे नाव लिहा…`}
            className="w-full bg-transparent border-0 outline-none font-tiro text-[1.65rem] leading-tight text-[var(--color-ink)] placeholder-[rgba(74,53,40,0.4)] p-0"
          />
          <TribalDivider variant="warli" className="mt-3 mb-0" />
        </div>

        {/* Main editor */}
        <div className="lekhak-card-paper p-0 overflow-hidden mb-3">
          <textarea
            ref={editorRef}
            value={content + (interim ? ' ' + interim : '')}
            onChange={(e) => {
              setContent(e.target.value);
              setInterim('');
            }}
            onSelect={onSelect}
            onMouseUp={onSelect}
            onKeyUp={onSelect}
            placeholder="येथून कथा सुरू करा. लिहिल्या लिहिल्या आपोआप जतन होईल — काळजी करू नका."
            spellCheck={false}
            className="lekhak-editor w-full min-h-[55vh] p-5 bg-transparent border-0 outline-none resize-none"
            style={{ fontSize: FONT_SIZES[fontSize] || FONT_SIZES.large }}
          />
          <div className="flex items-center justify-between px-4 py-2 border-t border-[rgba(201,151,58,0.35)] bg-[rgba(245,237,214,0.5)]">
            <div className="text-xs text-[var(--color-ink-soft)]">
              {wordCount} शब्द
            </div>
            <div className="flex items-center gap-2">
              <VoiceButton
                onTranscript={appendVoice}
                onInterim={(t) => setInterim(t)}
              />
            </div>
          </div>
        </div>

        {/* AI assist panel */}
        <AnimatePresence>
          {showAI && (
            <div className="mb-3">
              <AIAssistPanel
                chapterText={content}
                selection={selection}
                onAccept={aiAccept}
                onReplace={aiReplace}
                onClose={() => setShowAI(false)}
              />
            </div>
          )}
        </AnimatePresence>

        {/* Prev / next */}
        <div className="flex items-center justify-between gap-2">
          <button
            disabled={!prevId}
            onClick={() => switchTo(prevId)}
            className="btn btn-ghost flex-1 disabled:opacity-40"
          >
            <ChevronLeft size={20} />
            मागील
          </button>
          {nextId ? (
            <button onClick={() => switchTo(nextId)} className="btn btn-ghost flex-1">
              पुढील
              <ChevronRight size={20} />
            </button>
          ) : (
            <button onClick={addChapter} className="btn btn-secondary flex-1">
              <Plus size={20} />
              नवीन प्रकरण
            </button>
          )}
        </div>
      </div>

      {/* Chapter list drawer */}
      <Modal
        open={showChapterList}
        onClose={() => setShowChapterList(false)}
        title="प्रकरणे"
        footer={
          <button onClick={addChapter} className="btn btn-primary w-full">
            <Plus size={20} />
            नवीन प्रकरण जोडा
          </button>
        }
      >
        <ul className="space-y-2">
          {chapters.map((c, i) => (
            <li key={c.id}>
              <button
                onClick={() => switchTo(c.id)}
                className={
                  'w-full text-left p-3 rounded-[10px] flex items-center gap-3 transition-colors ' +
                  (c.id === currentId
                    ? 'bg-[var(--color-terracotta)] text-[var(--color-cream)]'
                    : 'bg-[var(--color-cream)] hover:bg-[rgba(201,151,58,0.12)] border border-[var(--color-gold)]')
                }
              >
                <span
                  className={
                    'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ' +
                    (c.id === currentId
                      ? 'bg-[var(--color-cream)] text-[var(--color-terracotta)]'
                      : 'bg-[var(--color-parchment)] text-[var(--color-ink)] border border-[var(--color-gold)]')
                  }
                >
                  {i + 1}
                </span>
                <span className="flex-1 truncate font-tiro text-[1.1rem]">
                  {c.title || `प्रकरण ${i + 1}`}
                </span>
                {chapters.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(c);
                    }}
                    className="btn-icon -mr-1 text-current opacity-70 hover:opacity-100"
                    aria-label="प्रकरण काढा"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      {/* Book metadata edit */}
      <Modal
        open={showBookMeta}
        onClose={() => setShowBookMeta(false)}
        title="पुस्तकाची माहिती"
        footer={
          <button
            onClick={async () => {
              const updated = await updateBook(book.id, book);
              setBook(updated);
              setShowBookMeta(false);
              toast.success('बदल जतन केले');
            }}
            className="btn btn-primary w-full"
          >
            जतन करा
          </button>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-[var(--color-ink-soft)] mb-1.5">शीर्षक</span>
            <input
              className="input"
              value={book.title}
              onChange={(e) => setBook({ ...book, title: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-[var(--color-ink-soft)] mb-1.5">लेखक</span>
            <input
              className="input"
              value={book.author || ''}
              onChange={(e) => setBook({ ...book, author: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-[var(--color-ink-soft)] mb-1.5">समर्पण</span>
            <textarea
              rows={2}
              className="textarea"
              value={book.dedication || ''}
              onChange={(e) => setBook({ ...book, dedication: e.target.value })}
            />
          </label>
        </div>
      </Modal>

      {/* Confirm delete chapter */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="प्रकरण काढायचे?"
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost">
              नाही
            </button>
            <button
              onClick={removeChapter}
              className="btn"
              style={{ background: 'var(--color-rust)', color: 'var(--color-cream)' }}
            >
              होय
            </button>
          </div>
        }
      >
        <p className="text-[var(--color-ink-soft)]">
          “{confirmDelete?.title}” कायमचे काढून टाकले जाईल.
        </p>
      </Modal>
    </PageTransition>
  );
}

function SaveIndicator({ status }) {
  if (status === 'saving') {
    return (
      <div className="flex items-center gap-1.5 text-[var(--color-clay)] text-xs font-medium px-2">
        <Loader2 size={14} className="animate-spin" />
        जतन
      </div>
    );
  }
  if (status === 'saved') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-1.5 text-[var(--color-forest)] text-xs font-medium px-2"
      >
        <CheckCircle2 size={14} />
        जतन केले
      </motion.div>
    );
  }
  if (status === 'error') {
    return (
      <div className="text-[var(--color-rust)] text-xs font-medium px-2">
        जतन झाले नाही
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-[var(--color-ink-soft)] text-xs px-2 opacity-60">
      <CircleDot size={10} />
      सुरक्षित
    </div>
  );
}

function ShortcutChip({ icon: Icon, label, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={
        'flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 h-10 rounded-[10px] border text-sm font-medium transition-colors ' +
        (active
          ? 'bg-[var(--color-terracotta)] text-[var(--color-cream)] border-[var(--color-terracotta-dark)]'
          : 'bg-[var(--color-cream)] text-[var(--color-ink)] border-[var(--color-gold)] hover:bg-[rgba(201,151,58,0.12)]')
      }
    >
      <Icon size={16} />
      {label}
    </button>
  );
}
