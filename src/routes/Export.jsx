import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  FileDown,
  Share2,
  Loader2,
  CheckCircle2,
  BookOpen,
  Users,
  Library,
  Image as ImageIcon,
} from 'lucide-react';
import PageTransition from '../components/PageTransition.jsx';
import TribalDivider from '../components/TribalDivider.jsx';
import {
  getBook,
  listChapters,
  listCharacters,
  listGlossary,
  listImages,
} from '../lib/db.js';
import { exportBookToPdf, downloadBlob } from '../lib/pdf.js';
import { sharePdf, whatsappShareUrl } from '../lib/share.js';
import { useToast } from '../hooks/useToast.jsx';

export default function ExportPage() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [book, setBook] = useState(null);
  const [stats, setStats] = useState({ chapters: 0, words: 0, characters: 0, glossary: 0, images: 0 });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [generatedPdf, setGeneratedPdf] = useState(null);

  useEffect(() => {
    (async () => {
      if (!bookId) { navigate('/'); return; }
      const b = await getBook(bookId);
      if (!b) { navigate('/'); return; }
      setBook(b);
      const [chapters, characters, glossary, images] = await Promise.all([
        listChapters(bookId),
        listCharacters(bookId),
        listGlossary(bookId),
        listImages(bookId),
      ]);
      const words = chapters.reduce(
        (sum, c) => sum + (c.content || '').trim().split(/\s+/).filter(Boolean).length,
        0
      );
      setStats({
        chapters: chapters.length,
        words,
        characters: characters.length,
        glossary: glossary.length,
        images: images.length,
      });
    })();
  }, [bookId, navigate]);

  const generate = async () => {
    setBusy(true);
    setGeneratedPdf(null);
    try {
      const blob = await exportBookToPdf(book, {
        onProgress: (p) => setProgress(p),
      });
      setGeneratedPdf(blob);
      toast.success('PDF तयार झाली');
    } catch (err) {
      console.error(err);
      toast.error('PDF तयार करता आली नाही');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const handleDownload = () => {
    if (!generatedPdf || !book) return;
    downloadBlob(generatedPdf, `${book.title || 'lekhak'}.pdf`);
  };

  const handleShare = async () => {
    if (!generatedPdf || !book) return;
    const result = await sharePdf({
      blob: generatedPdf,
      filename: `${book.title}.pdf`,
      title: book.title,
      text: `${book.title}${book.author ? ' — ' + book.author : ''}\n\nलेखक अनुप्रयोगाद्वारे तयार केले`,
    });
    if (result.method === 'download') {
      toast.info('PDF डाउनलोड झाली. WhatsApp उघडून पाठवा.');
    }
  };

  const handleWhatsApp = () => {
    const message = `${book?.title}${book?.author ? ' — ' + book.author : ''}\n\nहे माझे पुस्तक — लेखक अनुप्रयोगाद्वारे तयार केले`;
    window.open(whatsappShareUrl(message), '_blank', 'noopener,noreferrer');
  };

  if (!book) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="animate-spin text-[var(--color-terracotta)]" size={28} />
        </div>
      </PageTransition>
    );
  }

  const progressLabel = (() => {
    if (!progress) return '';
    if (progress.stage === 'cover') return 'मुखपृष्ठ तयार करत आहे…';
    if (progress.stage === 'chapter') return `प्रकरण ${progress.current} / ${progress.total} जोडत आहे…`;
    if (progress.stage === 'characters') return 'पात्रे जोडत आहे…';
    if (progress.stage === 'done') return 'तयार!';
    return 'तयार होत आहे…';
  })();

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => navigate(`/book/${bookId}`)}
            className="btn-icon rounded-[10px] hover:bg-[rgba(201,151,58,0.12)]"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1">
            <div className="text-[var(--color-terracotta)] text-xs font-semibold tracking-widest uppercase">
              निर्यात
            </div>
            <h1 className="font-tiro text-[1.8rem] m-0 leading-tight">PDF आणि शेअर</h1>
          </div>
        </div>

        {/* Book preview card */}
        <div className="lekhak-card-paper p-5 mb-4 text-center">
          <div className="text-[var(--color-terracotta)] text-xs uppercase tracking-widest mb-2">
            पुस्तक
          </div>
          <h2 className="font-tiro text-[1.7rem] m-0 leading-tight">{book.title}</h2>
          {book.author && (
            <div className="text-[var(--color-ink-soft)] mt-1.5">— {book.author}</div>
          )}
          <TribalDivider variant="warli" className="mt-3 mb-3" />
          <div className="grid grid-cols-2 gap-2 text-left">
            <Stat icon={BookOpen} label="प्रकरणे" value={stats.chapters} />
            <Stat icon={Library} label="शब्द" value={stats.words.toLocaleString('mr-IN')} />
            <Stat icon={Users} label="पात्रे" value={stats.characters} />
            <Stat icon={ImageIcon} label="चित्रे" value={stats.images} />
          </div>
        </div>

        {/* Generate */}
        {!generatedPdf && (
          <button
            onClick={generate}
            disabled={busy || stats.chapters === 0}
            className="btn btn-primary w-full text-lg disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 size={22} className="animate-spin" />
                {progressLabel || 'तयार होत आहे…'}
              </>
            ) : (
              <>
                <FileDown size={22} />
                PDF तयार करा
              </>
            )}
          </button>
        )}

        {generatedPdf && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="lekhak-card-paper p-4 flex items-center gap-3">
              <CheckCircle2 size={28} className="text-[var(--color-forest)] flex-shrink-0" />
              <div>
                <div className="font-semibold text-[var(--color-ink)]">PDF तयार आहे!</div>
                <div className="text-sm text-[var(--color-ink-soft)]">
                  आता डाउनलोड करा किंवा WhatsApp वर पाठवा
                </div>
              </div>
            </div>

            <button onClick={handleDownload} className="btn btn-primary w-full text-lg">
              <FileDown size={22} />
              PDF डाउनलोड करा
            </button>

            <button onClick={handleShare} className="btn btn-secondary w-full text-lg">
              <Share2 size={22} />
              शेअर करा
            </button>

            <button
              onClick={handleWhatsApp}
              className="btn btn-ghost w-full text-lg"
              style={{ borderColor: '#25D366', color: '#1f7d4d' }}
            >
              <Share2 size={20} />
              WhatsApp वर संदेश पाठवा
            </button>

            <button
              onClick={generate}
              disabled={busy}
              className="btn btn-ghost w-full"
            >
              पुन्हा तयार करा
            </button>
          </motion.div>
        )}

        {stats.chapters === 0 && (
          <p className="text-center text-[var(--color-ink-soft)] text-sm mt-3">
            निर्यात करण्यासाठी आधी एक प्रकरण लिहा.
          </p>
        )}
      </div>
    </PageTransition>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-[10px] bg-[var(--color-cream-warm)] border border-[rgba(201,151,58,0.4)]">
      <Icon size={18} className="text-[var(--color-terracotta)] flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-[var(--color-ink-soft)] leading-none">{label}</div>
        <div className="font-semibold text-[var(--color-ink)] mt-0.5">{value}</div>
      </div>
    </div>
  );
}
