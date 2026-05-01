import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Library, Sparkles, Loader2, Trash2, Pencil } from 'lucide-react';
import PageTransition from '../components/PageTransition.jsx';
import Modal from '../components/Modal.jsx';
import {
  listBooks,
  getBook,
  listGlossary,
  createGlossaryEntry,
  updateGlossaryEntry,
  deleteGlossaryEntry,
} from '../lib/db.js';
import { defineTerm } from '../lib/gemini.js';
import { useToast } from '../hooks/useToast.jsx';

const EMPTY = { term: '', definition: '', etymology: '' };

export default function Glossary() {
  const { bookId: routeBookId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [bookId, setBookId] = useState(routeBookId || null);
  const [books, setBooks] = useState([]);
  const [entries, setEntries] = useState([]);
  const [editor, setEditor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [defining, setDefining] = useState(false);
  const [search, setSearch] = useState('');

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
    if (bookId) refresh();
    // eslint-disable-next-line
  }, [bookId]);

  const refresh = async () => {
    setEntries(await listGlossary(bookId));
  };

  const handleSave = async () => {
    if (!editor?.data?.term?.trim()) {
      toast.warning('शब्द लिहा');
      return;
    }
    if (editor.mode === 'create') {
      await createGlossaryEntry(bookId, editor.data);
    } else {
      await updateGlossaryEntry(editor.data.id, editor.data);
    }
    setEditor(null);
    await refresh();
    toast.success('जतन केले');
  };

  const handleAIDefine = async () => {
    if (!editor?.data?.term?.trim()) {
      toast.warning('आधी शब्द लिहा');
      return;
    }
    setDefining(true);
    try {
      const { definition, etymology } = await defineTerm(editor.data.term);
      setEditor({
        ...editor,
        data: {
          ...editor.data,
          definition: definition || editor.data.definition,
          etymology: etymology || editor.data.etymology,
        },
      });
      toast.success('व्याख्या तयार झाली');
    } catch (err) {
      toast.error(err.marathiMessage || 'व्याख्या तयार करता आली नाही');
    } finally {
      setDefining(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteGlossaryEntry(confirmDelete.id);
    setConfirmDelete(null);
    await refresh();
    toast.success('काढले');
  };

  const filtered = search.trim()
    ? entries.filter(
        (e) =>
          e.term.includes(search) ||
          e.definition.includes(search) ||
          (e.etymology || '').includes(search)
      )
    : entries;

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          {routeBookId && (
            <button
              onClick={() => navigate(`/book/${routeBookId}`)}
              className="btn-icon rounded-[10px] hover:bg-[rgba(201,151,58,0.12)]"
            >
              <ArrowLeft size={22} />
            </button>
          )}
          <div className="flex-1">
            <div className="text-[var(--color-terracotta)] text-xs font-semibold tracking-widest uppercase">
              शब्दसंग्रह
            </div>
            <h1 className="font-tiro text-[1.8rem] m-0 leading-tight">शब्दार्थ</h1>
          </div>
        </div>

        {!routeBookId && books.length > 1 && (
          <select
            value={bookId || ''}
            onChange={(e) => setBookId(e.target.value)}
            className="input mb-3"
          >
            {books.map((b) => (
              <option key={b.id} value={b.id}>{b.title}</option>
            ))}
          </select>
        )}

        <div className="flex gap-2 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="शब्द शोधा…"
            className="input flex-1"
          />
          <button
            onClick={() => setEditor({ mode: 'create', data: { ...EMPTY } })}
            className="btn btn-primary"
            disabled={!bookId}
          >
            <Plus size={20} />
            जोडा
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="lekhak-card-paper p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[var(--color-parchment)] flex items-center justify-center border border-[var(--color-gold)]">
              <Library size={26} className="text-[var(--color-terracotta)]" />
            </div>
            <p className="text-[var(--color-ink-soft)]">
              {search ? 'काहीही सापडले नाही' : 'अजून कोणतीही नोंद नाही'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence>
              {filtered.map((e, i) => (
                <motion.li
                  key={e.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, delay: i * 0.02 }}
                  className="lekhak-card-paper p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-tiro text-[1.4rem] m-0 text-[var(--color-forest)]">
                        {e.term}
                      </h3>
                      <p className="text-[var(--color-ink)] mt-1 m-0">{e.definition}</p>
                      {e.etymology && (
                        <p className="text-sm text-[var(--color-clay)] italic mt-1 m-0">
                          — {e.etymology}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setEditor({ mode: 'edit', data: { ...e } })}
                        className="btn-icon rounded-[8px] text-[var(--color-ink-soft)] hover:text-[var(--color-terracotta)]"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(e)}
                        className="btn-icon rounded-[8px] text-[var(--color-ink-soft)] hover:text-[var(--color-rust)]"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <Modal
        open={!!editor}
        onClose={() => setEditor(null)}
        title={editor?.mode === 'create' ? 'नवीन शब्द' : 'शब्द संपादित करा'}
        footer={
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditor(null)} className="btn btn-ghost">रद्द करा</button>
            <button onClick={handleSave} className="btn btn-primary">जतन</button>
          </div>
        }
      >
        {editor && (
          <div className="space-y-4">
            <label className="block">
              <span className="block text-sm font-medium text-[var(--color-ink-soft)] mb-1.5">शब्द *</span>
              <div className="flex gap-2">
                <input
                  autoFocus
                  className="input flex-1"
                  value={editor.data.term}
                  onChange={(e) => setEditor({ ...editor, data: { ...editor.data, term: e.target.value } })}
                />
                <button
                  onClick={handleAIDefine}
                  disabled={defining || !editor.data.term?.trim()}
                  className="btn btn-secondary disabled:opacity-50"
                >
                  {defining ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  AI
                </button>
              </div>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-[var(--color-ink-soft)] mb-1.5">व्याख्या</span>
              <textarea
                rows={4}
                className="textarea"
                value={editor.data.definition}
                onChange={(e) => setEditor({ ...editor, data: { ...editor.data, definition: e.target.value } })}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-[var(--color-ink-soft)] mb-1.5">व्युत्पत्ती</span>
              <input
                className="input"
                value={editor.data.etymology}
                onChange={(e) => setEditor({ ...editor, data: { ...editor.data, etymology: e.target.value } })}
              />
            </label>
          </div>
        )}
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="नोंद काढायची?"
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
          “{confirmDelete?.term}” ची नोंद काढून टाकली जाईल.
        </p>
      </Modal>
    </PageTransition>
  );
}
