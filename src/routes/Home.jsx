import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, BookOpen, Trash2, Calendar } from 'lucide-react';
import PageTransition from '../components/PageTransition.jsx';
import TribalDivider from '../components/TribalDivider.jsx';
import Modal from '../components/Modal.jsx';
import { listBooks, createBook, deleteBook, getImage } from '../lib/db.js';
import { useToast } from '../hooks/useToast.jsx';

export default function Home() {
  const navigate = useNavigate();
  const toast = useToast();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({ title: '', author: '', dedication: '' });
  const [coverUrls, setCoverUrls] = useState({});

  const refresh = async () => {
    setLoading(true);
    const list = await listBooks();
    setBooks(list);
    // Resolve cover image blobs to object URLs
    const urls = {};
    for (const b of list) {
      if (b.coverImageId) {
        const img = await getImage(b.coverImageId);
        if (img?.blob) urls[b.id] = URL.createObjectURL(img.blob);
      }
    }
    setCoverUrls(urls);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    return () => Object.values(coverUrls).forEach((u) => URL.revokeObjectURL(u));
    // eslint-disable-next-line
  }, []);

  const handleCreate = async (e) => {
    e?.preventDefault();
    if (!form.title.trim()) {
      toast.warning('कृपया पुस्तकाचे शीर्षक लिहा');
      return;
    }
    const book = await createBook({
      title: form.title.trim(),
      author: form.author.trim(),
      dedication: form.dedication.trim(),
    });
    setCreateOpen(false);
    setForm({ title: '', author: '', dedication: '' });
    toast.success('पुस्तक तयार झाले');
    navigate(`/book/${book.id}`);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteBook(confirmDelete.id);
    setConfirmDelete(null);
    await refresh();
    toast.success('पुस्तक काढून टाकले');
  };

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-4">
        {/* Header */}
        <div className="text-center mb-2">
          <div className="inline-flex items-center gap-2 text-[var(--color-terracotta)] text-sm font-medium tracking-wider uppercase mb-1">
            <span className="h-px w-6 bg-[var(--color-gold)]" />
            लेखक
            <span className="h-px w-6 bg-[var(--color-gold)]" />
          </div>
          <h1 className="font-tiro text-[var(--color-ink)] text-balance">
            तुमची पुस्तके
          </h1>
          <p className="text-[var(--color-ink-soft)] mt-1 text-base">
            आदिवासी कथांचे आपले संग्रह
          </p>
        </div>

        <TribalDivider variant="warli" className="my-5" />

        {/* New book CTA */}
        <button
          onClick={() => setCreateOpen(true)}
          className="btn btn-primary w-full mb-6 text-lg"
        >
          <Plus size={22} />
          नवीन पुस्तक सुरू करा
        </button>

        {/* Books list */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="lekhak-card-paper h-28 shimmer rounded-[14px]" />
            ))}
          </div>
        ) : books.length === 0 ? (
          <EmptyState onCreate={() => setCreateOpen(true)} />
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
                <button
                  onClick={() => navigate(`/book/${b.id}`)}
                  className="w-full text-left p-4 flex items-stretch gap-4 active:bg-[rgba(201,151,58,0.08)] transition-colors"
                >
                  <div className="w-16 h-20 flex-shrink-0 rounded-[8px] overflow-hidden border border-[var(--color-gold)] bg-[var(--color-parchment)] flex items-center justify-center">
                    {coverUrls[b.id] ? (
                      <img
                        src={coverUrls[b.id]}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <BookOpen
                        size={28}
                        className="text-[var(--color-terracotta)] opacity-60"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-tiro text-[1.35rem] text-[var(--color-ink)] truncate m-0 leading-snug">
                      {b.title}
                    </h3>
                    {b.author && (
                      <p className="text-[var(--color-ink-soft)] text-sm m-0 mt-0.5 truncate">
                        — {b.author}
                      </p>
                    )}
                    <p className="text-[var(--color-clay)] text-xs m-0 mt-2 flex items-center gap-1.5">
                      <Calendar size={12} />
                      {formatDate(b.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(b);
                      }}
                      className="btn-icon text-[var(--color-ink-soft)] hover:text-[var(--color-rust)] rounded-[8px]"
                      aria-label="काढून टाका"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="नवीन पुस्तक"
        footer={
          <div className="flex gap-2 justify-end">
            <button onClick={() => setCreateOpen(false)} className="btn btn-ghost">
              रद्द करा
            </button>
            <button onClick={handleCreate} className="btn btn-primary">
              सुरू करा
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label="शीर्षक" required>
            <input
              autoFocus
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="उदा. आदिवासी कथा"
            />
          </Field>
          <Field label="लेखक">
            <input
              className="input"
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
              placeholder="आपले नाव"
            />
          </Field>
          <Field label="समर्पण (पर्यायी)">
            <textarea
              rows={2}
              className="textarea"
              value={form.dedication}
              onChange={(e) => setForm({ ...form, dedication: e.target.value })}
              placeholder="हे पुस्तक कोणाला अर्पण करायचे?"
            />
          </Field>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="पुस्तक काढून टाकायचे?"
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost">
              नाही
            </button>
            <button
              onClick={handleDelete}
              className="btn"
              style={{
                background: 'var(--color-rust)',
                color: 'var(--color-cream)',
                boxShadow: '0 3px 0 #6b2a10',
              }}
            >
              होय, काढून टाका
            </button>
          </div>
        }
      >
        <p className="text-[var(--color-ink-soft)]">
          “{confirmDelete?.title}” आणि त्यातील सर्व प्रकरणे, चित्रे आणि पात्रे
          कायमची नष्ट होतील. हे पुनर्संचयित करता येणार नाही.
        </p>
      </Modal>
    </PageTransition>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-[var(--color-ink-soft)] mb-1.5">
        {label}
        {required && <span className="text-[var(--color-terracotta)] ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="lekhak-card-paper p-8 text-center">
      <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[var(--color-parchment)] flex items-center justify-center border border-[var(--color-gold)]">
        <BookOpen size={28} className="text-[var(--color-terracotta)]" />
      </div>
      <h3 className="font-tiro text-[1.5rem] m-0 mb-2">अजून कोणतेही पुस्तक नाही</h3>
      <p className="text-[var(--color-ink-soft)] mb-4">
        आपली पहिली कथा लिहायला सुरुवात करा. प्रत्येक शब्द जतन होईल — ऑफलाइनही.
      </p>
      <button onClick={onCreate} className="btn btn-secondary">
        <Plus size={20} />
        पहिले पुस्तक तयार करा
      </button>
    </div>
  );
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return 'आज ' + d.toLocaleTimeString('mr-IN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('mr-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
