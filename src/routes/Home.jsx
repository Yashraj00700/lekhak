import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, BookOpen, Trash2, Calendar, Languages } from 'lucide-react';
import PageTransition from '../components/PageTransition.jsx';
import TribalDivider from '../components/TribalDivider.jsx';
import Modal from '../components/Modal.jsx';
import { listBooks, createBook, deleteBook, getImage } from '../lib/db.js';
import { useToast } from '../hooks/useToast.jsx';
import { useLanguage } from '../hooks/useLanguage.jsx';

export default function Home() {
  const navigate           = useNavigate();
  const toast              = useToast();
  const { t, formatDate, isMarathi, setLang } = useLanguage();
  const [books, setBooks]  = useState([]);
  const [loading, setLoading]       = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm]    = useState({ title: '', author: '', dedication: '' });

  // Cover image URLs — tracked in a ref to avoid stale-closure leaks
  const coverUrlsRef = useRef({});
  const [coverUrls, setCoverUrls] = useState({});

  const revokePreviousUrls = () => {
    Object.values(coverUrlsRef.current).forEach((u) => URL.revokeObjectURL(u));
    coverUrlsRef.current = {};
  };

  const refresh = async () => {
    setLoading(true);
    const list = await listBooks();
    setBooks(list);

    // Revoke old object URLs before creating new ones
    revokePreviousUrls();
    const urls = {};
    for (const b of list) {
      if (b.coverImageId) {
        const img = await getImage(b.coverImageId);
        if (img?.blob) {
          const url = URL.createObjectURL(img.blob);
          urls[b.id] = url;
          coverUrlsRef.current[b.id] = url;
        }
      }
    }
    setCoverUrls(urls);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    return () => revokePreviousUrls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e) => {
    e?.preventDefault();
    if (!form.title.trim()) {
      toast.warning(t('bookForm.titleRequired'));
      return;
    }
    const book = await createBook({
      title:      form.title.trim(),
      author:     form.author.trim(),
      dedication: form.dedication.trim(),
    });
    setCreateOpen(false);
    setForm({ title: '', author: '', dedication: '' });
    toast.success(t('bookForm.created'));
    navigate(`/book/${book.id}`);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    // Revoke the cover URL for this book if any
    if (coverUrlsRef.current[confirmDelete.id]) {
      URL.revokeObjectURL(coverUrlsRef.current[confirmDelete.id]);
      delete coverUrlsRef.current[confirmDelete.id];
    }
    await deleteBook(confirmDelete.id);
    setConfirmDelete(null);
    await refresh();
    toast.success(t('bookForm.deleted'));
  };

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-4">

        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 text-center">
            <div className="inline-flex items-center gap-2 text-[var(--color-terracotta)] text-sm font-medium tracking-wider uppercase mb-1">
              <span className="h-px w-6 bg-[var(--color-gold)]" />
              {t('home.eyebrow')}
              <span className="h-px w-6 bg-[var(--color-gold)]" />
            </div>
            <h1 className="text-[var(--theme-text)] text-balance m-0 leading-tight">
              {t('home.title')}
            </h1>
            <p className="text-[var(--theme-text-soft)] mt-1 text-base">
              {t('home.subtitle')}
            </p>
          </div>

          {/* Language toggle — prominent for elderly user */}
          <button
            onClick={() => setLang(isMarathi ? 'en' : 'mr')}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 h-9 rounded-[9px] border border-[var(--theme-border)] text-sm font-medium text-[var(--theme-text)] hover:bg-[rgba(196,98,45,0.08)] mt-1"
            title={t('common.toggleLanguage')}
          >
            <Languages size={15} />
            {isMarathi ? 'EN' : 'मराठी'}
          </button>
        </div>

        <TribalDivider variant="warli" className="my-5" />

        {/* New book CTA */}
        <button
          onClick={() => setCreateOpen(true)}
          className="btn btn-primary w-full mb-6 text-lg"
        >
          <Plus size={22} />
          {t('home.newBook')}
        </button>

        {/* Books grid */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="lekhak-card-paper h-28 shimmer rounded-[14px]" />
            ))}
          </div>
        ) : books.length === 0 ? (
          <EmptyState onCreate={() => setCreateOpen(true)} t={t} />
        ) : (
          <ul className="space-y-3">
            {books.map((b, i) => (
              <motion.li
                key={b.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className="lekhak-card-paper p-0 overflow-hidden"
              >
                {/* Use div (not button) to avoid invalid nested-button HTML */}
                <div
                  onClick={() => navigate(`/book/${b.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/book/${b.id}`)}
                  className="w-full text-left p-4 flex items-stretch gap-4 hover:bg-[rgba(201,151,58,0.06)] transition-colors cursor-pointer"
                >
                  {/* Cover thumbnail */}
                  <div className="w-16 h-20 flex-shrink-0 rounded-[8px] overflow-hidden border border-[var(--theme-border)] bg-[var(--theme-bg)] flex items-center justify-center">
                    {coverUrls[b.id] ? (
                      <img src={coverUrls[b.id]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen size={28} className="text-[var(--color-terracotta)] opacity-60" />
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[1.3rem] text-[var(--theme-text)] truncate m-0 leading-snug font-['Tiro_Devanagari_Marathi',serif]">
                      {b.title}
                    </h3>
                    {b.author && (
                      <p className="text-[var(--theme-text-soft)] text-sm m-0 mt-0.5 truncate">
                        — {b.author}
                      </p>
                    )}
                    <p className="text-[var(--color-clay)] text-xs m-0 mt-2 flex items-center gap-1.5">
                      <Calendar size={12} />
                      {formatDate(b.updatedAt)}
                    </p>
                  </div>

                  {/* Delete */}
                  <div className="flex items-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(b); }}
                      className="w-10 h-10 flex items-center justify-center rounded-[8px] text-[var(--theme-text-soft)] hover:text-[var(--color-rust)] hover:bg-[rgba(160,66,26,0.08)]"
                      aria-label={t('common.delete')}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      {/* Create book modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('bookForm.title')}
        footer={
          <div className="flex gap-2 justify-end">
            <button onClick={() => setCreateOpen(false)} className="btn btn-ghost">
              {t('common.cancel')}
            </button>
            <button onClick={handleCreate} className="btn btn-primary">
              {t('bookForm.start')}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label={t('bookForm.fieldTitle')} required>
            <input
              autoFocus
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t('bookForm.placeholderTitle')}
            />
          </Field>
          <Field label={t('bookForm.fieldAuthor')}>
            <input
              className="input"
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
              placeholder={t('bookForm.placeholderAuthor')}
            />
          </Field>
          <Field label={`${t('bookForm.fieldDedication')} (${t('common.optional')})`}>
            <textarea
              rows={2}
              className="textarea"
              value={form.dedication}
              onChange={(e) => setForm({ ...form, dedication: e.target.value })}
              placeholder={t('bookForm.dedicationHint')}
            />
          </Field>
        </form>
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={t('bookForm.confirmDelete.title')}
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost">
              {t('common.cancel')}
            </button>
            <button
              onClick={handleDelete}
              className="btn h-11 px-5"
              style={{
                background: 'var(--color-rust)',
                color: 'var(--color-cream)',
                boxShadow: '0 3px 0 #6b2a10',
              }}
            >
              {t('bookForm.confirmDelete.confirm')}
            </button>
          </div>
        }
      >
        <p className="text-[var(--theme-text-soft)]">
          {t('bookForm.confirmDelete.body', { title: confirmDelete?.title ?? '' })}
        </p>
      </Modal>
    </PageTransition>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-[var(--theme-text-soft)] mb-1.5">
        {label}
        {required && <span className="text-[var(--color-terracotta)] ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}

function EmptyState({ onCreate, t }) {
  return (
    <div className="lekhak-card-paper p-8 text-center">
      <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[var(--theme-bg)] flex items-center justify-center border border-[var(--theme-border)]">
        <BookOpen size={28} className="text-[var(--color-terracotta)]" />
      </div>
      <h3 className="text-[1.5rem] m-0 mb-2 text-[var(--theme-text)]">
        {t('home.empty.title')}
      </h3>
      <p className="text-[var(--theme-text-soft)] mb-4 leading-relaxed">
        {t('home.empty.body')}
      </p>
      <button onClick={onCreate} className="btn btn-secondary">
        <Plus size={20} />
        {t('home.empty.cta')}
      </button>
    </div>
  );
}
