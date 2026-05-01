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
import { useLanguage } from '../hooks/useLanguage.jsx';

export default function ExportPage() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { t, formatNumber } = useLanguage();

  const [book, setBook] = useState(null);
  const [stats, setStats] = useState({
    chapters: 0,
    words: 0,
    characters: 0,
    glossary: 0,
    images: 0,
  });
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
      toast.success(t('export.success'));
    } catch (err) {
      console.error(err);
      toast.error(t('export.failed'));
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
    const shareText = t('export.shareMessage', {
      title: book.title,
      author: book.author ? ` — ${book.author}` : '',
    });
    const result = await sharePdf({
      blob: generatedPdf,
      filename: `${book.title}.pdf`,
      title: book.title,
      text: shareText,
    });
    if (result.method === 'download') {
      toast.info(t('export.downloaded'));
    }
  };

  const handleWhatsApp = () => {
    if (!book) return;
    const message = t('export.shareMessage', {
      title: `${book.title}${book.author ? ' — ' + book.author : ''}`,
    });
    window.open(whatsappShareUrl(message), '_blank', 'noopener,noreferrer');
  };

  const progressLabel = (() => {
    if (!progress) return '';
    if (progress.stage === 'cover') return t('export.progress.cover');
    if (progress.stage === 'chapter')
      return t('export.progress.chapter', { current: progress.current, total: progress.total });
    if (progress.stage === 'characters') return t('export.progress.characters');
    if (progress.stage === 'done') return t('export.progress.done');
    return t('export.generating');
  })();

  if (!book) {
    return (
      <PageTransition>
        <div
          className="flex items-center justify-center min-h-[40vh]"
          style={{ color: 'var(--theme-text-soft)' }}
        >
          <Loader2 className="animate-spin" size={28} />
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => navigate(`/book/${bookId}`)}
            className="btn-icon rounded-[10px]"
            style={{ color: 'var(--theme-text-soft)' }}
            aria-label={t('common.cancel')}
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1">
            <div
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: 'var(--theme-text-soft)' }}
            >
              {t('export.eyebrow')}
            </div>
            <h1
              className="font-tiro text-[1.8rem] m-0 leading-tight"
              style={{ color: 'var(--theme-text)' }}
            >
              {t('export.title')}
            </h1>
          </div>
        </div>

        {/* Book preview card */}
        <div
          className="rounded-2xl p-5 mb-4 text-center"
          style={{
            background: 'var(--theme-bg-card)',
            border: '1px solid var(--theme-border)',
          }}
        >
          <div
            className="text-xs uppercase tracking-widest mb-2"
            style={{ color: 'var(--theme-text-soft)' }}
          >
            {t('export.book')}
          </div>
          <h2
            className="font-tiro text-[1.7rem] m-0 leading-tight"
            style={{ color: 'var(--theme-text)' }}
          >
            {book.title}
          </h2>
          {book.author && (
            <div className="mt-1.5" style={{ color: 'var(--theme-text-soft)' }}>
              — {book.author}
            </div>
          )}
          <TribalDivider variant="warli" className="mt-3 mb-3" />
          <div className="grid grid-cols-2 gap-2 text-left">
            <Stat icon={BookOpen} label={t('export.statChapters')} value={formatNumber(stats.chapters)} />
            <Stat icon={Library}  label={t('export.statWords')}    value={formatNumber(stats.words)} />
            <Stat icon={Users}    label={t('export.statCharacters')} value={formatNumber(stats.characters)} />
            <Stat icon={ImageIcon} label={t('export.statImages')}  value={formatNumber(stats.images)} />
          </div>
        </div>

        {/* Generate button (shown until PDF is ready) */}
        {!generatedPdf && (
          <button
            onClick={generate}
            disabled={busy || stats.chapters === 0}
            className="btn btn-primary w-full text-lg disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 size={22} className="animate-spin" />
                {progressLabel || t('export.generating')}
              </>
            ) : (
              <>
                <FileDown size={22} />
                {t('export.generate')}
              </>
            )}
          </button>
        )}

        {/* Actions after PDF is ready */}
        {generatedPdf && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {/* Success banner */}
            <div
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{
                background: 'var(--theme-bg-card)',
                border: '1px solid var(--theme-border)',
              }}
            >
              <CheckCircle2
                size={28}
                className="flex-shrink-0"
                style={{ color: 'var(--theme-text)' }}
              />
              <div>
                <div
                  className="font-semibold"
                  style={{ color: 'var(--theme-text)' }}
                >
                  {t('export.success')}
                </div>
                <div
                  className="text-sm"
                  style={{ color: 'var(--theme-text-soft)' }}
                >
                  {t('export.successSub')}
                </div>
              </div>
            </div>

            {/* Download */}
            <button onClick={handleDownload} className="btn btn-primary w-full text-lg">
              <FileDown size={22} />
              {t('export.download')}
            </button>

            {/* Share */}
            <button onClick={handleShare} className="btn btn-secondary w-full text-lg">
              <Share2 size={22} />
              {t('export.share')}
            </button>

            {/* WhatsApp */}
            <button
              onClick={handleWhatsApp}
              className="btn btn-ghost w-full text-lg"
              style={{
                borderColor: '#25D366',
                color: '#1f7d4d',
                background: 'var(--theme-bg-input)',
              }}
            >
              <Share2 size={20} />
              {t('export.whatsapp')}
            </button>

            {/* Regenerate */}
            <button
              onClick={generate}
              disabled={busy}
              className="btn btn-ghost w-full"
              style={{ color: 'var(--theme-text-soft)' }}
            >
              {t('export.regenerate')}
            </button>
          </motion.div>
        )}

        {/* Empty-state hint */}
        {stats.chapters === 0 && (
          <p
            className="text-center text-sm mt-3"
            style={{ color: 'var(--theme-text-soft)' }}
          >
            {t('export.empty')}
          </p>
        )}
      </div>
    </PageTransition>
  );
}

/* ---------- Stat tile ---------- */

function Stat({ icon: Icon, label, value }) {
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-2 rounded-[10px]"
      style={{
        background: 'var(--theme-bg-input)',
        border: '1px solid var(--theme-border)',
      }}
    >
      <Icon
        size={18}
        className="flex-shrink-0"
        style={{ color: 'var(--theme-text-soft)' }}
      />
      <div className="min-w-0">
        <div
          className="text-xs leading-none"
          style={{ color: 'var(--theme-text-soft)' }}
        >
          {label}
        </div>
        <div
          className="font-semibold mt-0.5"
          style={{ color: 'var(--theme-text)' }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
