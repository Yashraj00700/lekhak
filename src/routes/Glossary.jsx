import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Library, Sparkles, Loader2, Trash2, Pencil } from 'lucide-react';
import PageTransition from '../components/PageTransition.jsx';
import TribalDivider from '../components/TribalDivider.jsx';
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
import { useLanguage } from '../hooks/useLanguage.jsx';

const EMPTY = { term: '', definition: '', etymology: '' };

export default function Glossary() {
  const { bookId: routeBookId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useLanguage();

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
      toast.warning(t('glossary.termRequired'));
      return;
    }
    if (editor.mode === 'create') {
      await createGlossaryEntry(bookId, editor.data);
    } else {
      await updateGlossaryEntry(editor.data.id, editor.data);
    }
    setEditor(null);
    await refresh();
    toast.success(t('common.saved'));
  };

  const handleAIDefine = async () => {
    if (!editor?.data?.term?.trim()) {
      toast.warning(t('glossary.aiNeedTerm'));
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
      toast.success(t('glossary.aiSuccess'));
    } catch (err) {
      toast.error(err.marathiMessage || t('glossary.aiFailed'));
    } finally {
      setDefining(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteGlossaryEntry(confirmDelete.id);
    setConfirmDelete(null);
    await refresh();
    toast.success(t('common.delete'));
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
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          {routeBookId && (
            <button
              onClick={() => navigate(`/book/${routeBookId}`)}
              className="btn-icon rounded-[10px] hover:bg-[rgba(201,151,58,0.12)]"
              aria-label={t('common.back')}
            >
              <ArrowLeft size={22} />
            </button>
          )}
          <div className="flex-1">
            <div className="text-[var(--color-terracotta)] text-xs font-semibold tracking-widest uppercase">
              {t('glossary.eyebrow')}
            </div>
            <h1 className="font-tiro text-[1.8rem] m-0 leading-tight text-[var(--theme-text)]">
              {t('glossary.title')}
            </h1>
          </div>
        </div>

        <TribalDivider variant="gond" className="opacity-40 mb-2" />

        {/* Book selector (when not in a specific book context) */}
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

        {/* Search + Add */}
        <div className="flex gap-2 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('glossary.search')}
            className="input flex-1"
          />
          <button
            onClick={() => setEditor({ mode: 'create', data: { ...EMPTY } })}
            className="btn btn-primary"
            disabled={!bookId}
          >
            <Plus size={20} />
            {t('common.add')}
          </button>
        </div>

        {/* Entry list / empty state */}
        {filtered.length === 0 ? (
          <div className="lekhak-card-paper p-8 text-center">
            <div
              className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center border"
              style={{
                background: 'var(--theme-bg)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <Library size={26} className="text-[var(--color-terracotta)]" />
            </div>
            <p className="text-[var(--theme-text-soft)]">
              {search ? t('glossary.noResults') : t('glossary.empty')}
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
                      <p className="text-[var(--theme-text)] mt-1 m-0">{e.definition}</p>
                      {e.etymology && (
                        <p className="text-sm text-[var(--theme-text-soft)] italic mt-1 m-0">
                          — {e.etymology}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setEditor({ mode: 'edit', data: { ...e } })}
                        className="btn-icon rounded-[8px] text-[var(--theme-text-soft)] hover:text-[var(--color-terracotta)]"
                        aria-label={t('common.edit')}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(e)}
                        className="btn-icon rounded-[8px] text-[var(--theme-text-soft)] hover:text-[var(--color-rust)]"
                        aria-label={t('common.delete')}
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

      {/* Create / Edit modal */}
      <Modal
        open={!!editor}
        onClose={() => setEditor(null)}
        title={editor?.mode === 'create' ? t('glossary.modalNew') : t('glossary.modalEdit')}
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
            {/* Term field */}
            <label className="block">
              <span className="block text-sm font-medium text-[var(--theme-text-soft)] mb-1.5">
                {t('glossary.fieldTerm')} *
              </span>
              <div className="flex gap-2">
                <input
                  autoFocus
                  className="input flex-1"
                  value={editor.data.term}
                  onChange={(e) =>
                    setEditor({ ...editor, data: { ...editor.data, term: e.target.value } })
                  }
                />
                <button
                  onClick={handleAIDefine}
                  disabled={defining || !editor.data.term?.trim()}
                  className="btn btn-secondary disabled:opacity-50"
                  title={t('glossary.aiDefine')}
                >
                  {defining
                    ? <Loader2 size={18} className="animate-spin" />
                    : <Sparkles size={18} />
                  }
                  {defining ? t('common.loading') : t('glossary.aiDefine')}
                </button>
              </div>
            </label>

            {/* Definition field */}
            <label className="block">
              <span className="block text-sm font-medium text-[var(--theme-text-soft)] mb-1.5">
                {t('glossary.fieldDefinition')}
              </span>
              <textarea
                rows={4}
                className="textarea"
                value={editor.data.definition}
                onChange={(e) =>
                  setEditor({ ...editor, data: { ...editor.data, definition: e.target.value } })
                }
              />
            </label>

            {/* Etymology field */}
            <label className="block">
              <span className="block text-sm font-medium text-[var(--theme-text-soft)] mb-1.5">
                {t('glossary.fieldEtymology')}
              </span>
              <input
                className="input"
                value={editor.data.etymology}
                onChange={(e) =>
                  setEditor({ ...editor, data: { ...editor.data, etymology: e.target.value } })
                }
              />
            </label>
          </div>
        )}
      </Modal>

      {/* Confirm delete modal */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={t('glossary.confirmDelete.title')}
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost">
              {t('common.cancel')}
            </button>
            <button
              onClick={handleDelete}
              className="btn"
              style={{ background: 'var(--color-rust)', color: 'var(--theme-bg)' }}
            >
              {t('common.delete')}
            </button>
          </div>
        }
      >
        <p className="text-[var(--theme-text-soft)]">
          {t('glossary.confirmDelete.body', { term: confirmDelete?.term ?? '' })}
        </p>
      </Modal>
    </PageTransition>
  );
}
