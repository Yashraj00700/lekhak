/**
 * BookEditor v2 — TipTap + Yjs + three input methods + word goal
 *
 * Architecture:
 *  - TipTap handles rich text (headings, bold, images, blockquote …)
 *  - Yjs (via useYjsEditor) persists every keystroke to IndexedDB automatically
 *  - InputMethodPicker handles मराठी / Roman→Devanagari / Voice tabs
 *  - VoiceRibbon shows interim speech text below the editor
 *  - WordGoalBar shows daily progress + streak
 *  - Chapter list accessible via drawer
 *  - AI Assist panel slides up from bottom
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, List as ListIcon, Sparkles,
  BookOpen, Plus, Trash2, X, BookOpenCheck, Camera,
} from 'lucide-react';
import PageTransition from '../components/PageTransition.jsx';
import LekhakEditor from '../components/editor/LekhakEditor.jsx';
import EditorToolbar from '../components/editor/EditorToolbar.jsx';
import InputMethodPicker from '../components/editor/InputMethodPicker.jsx';
import VoiceRibbon from '../components/editor/VoiceRibbon.jsx';
import WordGoalBar from '../components/book/WordGoalBar.jsx';
import Modal from '../components/Modal.jsx';
import { useYjsEditor } from '../hooks/useYjsEditor.js';
import { useWordGoal } from '../hooks/useWordGoal.js';
import { useLanguage } from '../hooks/useLanguage.jsx';
import { useToast } from '../hooks/useToast.jsx';
import {
  getBook, updateBook,
  listChapters, createChapter, updateChapter, deleteChapter, getSettings, saveSettings,
} from '../lib/db.js';
import { suggestContinuation, fixGrammar, suggestAlternatives } from '../lib/gemini.js';

/* ─── Font size value map ─────────────────────────────────────────── */
const FONT_SIZE_MAP = {
  small:  '1.1rem',
  medium: '1.25rem',
  large:  '1.375rem',
  xlarge: '1.625rem',
};

export default function BookEditor() {
  const { bookId } = useParams();
  const navigate   = useNavigate();
  const { t }      = useLanguage();
  const toast      = useToast();
  const editorRef  = useRef(null);

  /* ─── Book & chapter state ─────────────────────────────────────── */
  const [book, setBook]               = useState(null);
  const [chapters, setChapters]       = useState([]);
  const [chapterIdx, setChapterIdx]   = useState(0);
  const [chapterTitle, setChapterTitle] = useState('');
  const [settings, setSettings]       = useState({});

  /* ─── UI state ─────────────────────────────────────────────────── */
  const [showChapters, setShowChapters]         = useState(false);
  const [showAI, setShowAI]                     = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [inputTab, setInputTab]                 = useState('marathi');
  const [voiceInterim, setVoiceInterim]         = useState('');
  const [isListening, setIsListening]           = useState(false);
  const [wordCount, setWordCount]               = useState(0);
  const [selectionText, setSelectionText]       = useState('');
  const [fontFamily, setFontFamily]             = useState("'Tiro Devanagari Marathi', serif");

  /* ─── TipTap editor instance (state-driven, not ref-pulled) ─────── */
  const [tiptapEditor, setTiptapEditor] = useState(null);
  // Stable callback — won't cause LekhakEditor to re-render on every BookEditor render
  const handleEditorReady = useCallback((ed) => setTiptapEditor(ed), []);

  /* ─── AI state ─────────────────────────────────────────────────── */
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult]   = useState('');
  const [aiMode, setAiMode]       = useState('continue');

  const currentChapter = chapters[chapterIdx] ?? null;

  /* ─── Yjs autosave for current chapter ─────────────────────────── */
  const { ydoc, synced } = useYjsEditor(currentChapter?.id ?? null);

  /* ─── Word goal tracker ─────────────────────────────────────────── */
  const { goal, todayCount, streak, percent, met, updateWordCount } =
    useWordGoal(bookId);

  /* ─── Load book + chapters + settings on mount ───────────────────── */
  useEffect(() => {
    if (!bookId) return;
    (async () => {
      const [b, chs, s] = await Promise.all([
        getBook(bookId),
        listChapters(bookId),
        getSettings(),
      ]);
      if (!b) { navigate('/'); return; }
      setBook(b);
      setSettings(s);
      setFontFamily(s.fontFamily || "'Tiro Devanagari Marathi', serif");

      let list = chs;
      if (list.length === 0) {
        const first = await createChapter(bookId, {
          title: t('editor.defaultChapterTitle', { n: 1 }),
        });
        list = [first];
      }
      setChapters(list);
      setChapterTitle(list[0]?.title ?? '');
    })();
  }, [bookId, navigate, t]);

  /* ─── Sync chapter title when switching chapters ─────────────────── */
  useEffect(() => {
    setChapterTitle(currentChapter?.title ?? '');
    setAiResult('');
    setSelectionText('');
  }, [currentChapter?.id]);

  /* ─── Persist chapter title on blur ─────────────────────────────── */
  const saveTitle = useCallback(async () => {
    if (!currentChapter || chapterTitle === currentChapter.title) return;
    const updated = await updateChapter(currentChapter.id, { title: chapterTitle });
    setChapters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }, [currentChapter, chapterTitle]);

  /* ─── Word count → word goal tracker ────────────────────────────── */
  const handleWordCount = useCallback(
    (n) => { setWordCount(n); updateWordCount(n); },
    [updateWordCount]
  );

  /* ─── Chapter navigation ─────────────────────────────────────────── */
  const goToChapter = useCallback((idx) => {
    setChapterIdx(Math.max(0, Math.min(idx, chapters.length - 1)));
    setShowChapters(false);
    setAiResult('');
  }, [chapters.length]);

  const addChapter = useCallback(async () => {
    const n = chapters.length + 1;
    const ch = await createChapter(bookId, {
      title: t('editor.defaultChapterTitle', { n }),
    });
    const updated = [...chapters, ch];
    setChapters(updated);
    setChapterIdx(updated.length - 1);
    setShowChapters(false);
    toast.success(t('editor.chapterAdded'));
  }, [bookId, chapters, t, toast]);

  const removeChapter = useCallback(async () => {
    if (!currentChapter || chapters.length <= 1) return;
    await deleteChapter(currentChapter.id);
    const remaining = chapters.filter((c) => c.id !== currentChapter.id);
    setChapters(remaining);
    setChapterIdx(Math.min(chapterIdx, remaining.length - 1));
    setShowDeleteConfirm(false);
    toast.success(t('editor.chapterRemoved'));
  }, [currentChapter, chapters, chapterIdx, t, toast]);

  /* ─── Insert text from InputMethodPicker ─────────────────────────── */
  const handleInsertText = useCallback((text) => {
    editorRef.current?.insertText(text);
  }, []);

  /* ─── Insert image from camera / gallery ─────────────────────────── */
  const fileInputRef = useRef(null);
  const handleInsertImage = useCallback(() => fileInputRef.current?.click(), []);
  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    editorRef.current?.insertImage(url, file.name);
    e.target.value = '';
    // Note: URL is managed by TipTap/Yjs — cleaned up when content is cleared
  }, []);

  /* ─── Font family change (persist) ──────────────────────────────── */
  const handleFontChange = useCallback(async (f) => {
    setFontFamily(f);
    await saveSettings({ fontFamily: f });
  }, []);

  /* ─── AI actions ─────────────────────────────────────────────────── */
  const runAI = useCallback(async (mode) => {
    const text = tiptapEditor?.getText() ?? editorRef.current?.getPlainText() ?? '';
    if (!text && mode !== 'alternatives') {
      toast.info(t('ai.chapterEmpty'));
      return;
    }
    if (mode === 'alternatives' && !selectionText) {
      toast.info(t('ai.selectFirst'));
      return;
    }
    setAiMode(mode);
    setAiLoading(true);
    setAiResult('');
    setShowAI(true);
    try {
      let result = '';
      if (mode === 'continue')          result = await suggestContinuation(text);
      else if (mode === 'fix')          result = await fixGrammar(text);
      else if (mode === 'alternatives') result = await suggestAlternatives(selectionText);
      setAiResult(result);
    } catch (err) {
      toast.showError(err);
      setShowAI(false);
    } finally {
      setAiLoading(false);
    }
  }, [selectionText, t, toast]);

  const applyAI = useCallback(() => {
    if (!aiResult) return;
    if (aiMode === 'fix') {
      tiptapEditor?.commands.setContent(aiResult);
      toast.success(t('ai.replaced'));
    } else {
      tiptapEditor?.chain().focus().insertContent('\n\n' + aiResult).run();
      toast.success(t('ai.added'));
    }
    setShowAI(false);
    setAiResult('');
  }, [aiResult, aiMode, t, toast, tiptapEditor]);

  /* ─── Loading state ─────────────────────────────────────────────── */
  if (!book) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <div className="w-8 h-8 border-2 border-[var(--color-terracotta)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const fontSize = FONT_SIZE_MAP[settings.fontSize || 'large'];

  return (
    <PageTransition>
      <div className="flex flex-col min-h-[100dvh] bg-[var(--theme-bg)]">

        {/* Hidden file input for photo/gallery image insertion */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* ══════════════════ TOP BAR ══════════════════ */}
        <header
          className="sticky top-0 z-40 flex items-center gap-2 px-3 py-2 bg-[var(--theme-toolbar-bg)] border-b border-[var(--theme-border)] shadow-sm"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}
        >
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center w-10 h-10 rounded-[10px] text-[var(--theme-text)] hover:bg-[rgba(196,98,45,0.1)] flex-shrink-0"
            aria-label={t('common.back')}
          >
            <ChevronLeft size={22} />
          </button>

          <div className="flex-1 min-w-0">
            <div className="text-xs text-[var(--theme-text-soft)] truncate leading-none mb-0.5">
              {book.title}
            </div>
            <input
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
              placeholder={t('editor.chapterTitlePlaceholder')}
              className="w-full text-sm font-semibold bg-transparent border-none outline-none text-[var(--theme-text)] placeholder:text-[var(--theme-text-soft)] placeholder:opacity-50"
            />
          </div>

          <div className="flex-shrink-0 text-xs text-[var(--theme-text-soft)] hidden sm:block">
            {t('editor.wordCount', { n: wordCount })}
          </div>

          <button
            onClick={() => setShowChapters(true)}
            className="flex items-center justify-center w-10 h-10 rounded-[10px] text-[var(--theme-text)] hover:bg-[rgba(196,98,45,0.1)] flex-shrink-0"
            aria-label={t('editor.chapters')}
          >
            <ListIcon size={20} />
          </button>

          <button
            onClick={() => runAI('continue')}
            className="flex items-center justify-center w-10 h-10 rounded-[10px] text-[var(--color-terracotta)] hover:bg-[rgba(196,98,45,0.1)] flex-shrink-0"
            aria-label={t('ai.continue')}
          >
            <Sparkles size={20} />
          </button>
        </header>

        {/* ══════════════════ FORMATTING TOOLBAR ══════════════════ */}
        <EditorToolbar
          editor={tiptapEditor}
          fontFamily={fontFamily}
          onFontChange={handleFontChange}
          onInsertImage={handleInsertImage}
        />

        {/* ══════════════════ WORD GOAL BAR ══════════════════ */}
        <WordGoalBar
          todayCount={todayCount}
          goal={goal}
          percent={percent}
          met={met}
          streak={streak}
        />

        {/* ══════════════════ CHAPTER NAV STRIP ══════════════════ */}
        <div className="flex items-center justify-between px-4 py-1 bg-[var(--theme-bg)] border-b border-[var(--theme-border)]">
          <button
            onClick={() => goToChapter(chapterIdx - 1)}
            disabled={chapterIdx === 0}
            className="flex items-center gap-1 text-xs text-[var(--theme-text-soft)] disabled:opacity-30 py-1"
          >
            <ChevronLeft size={14} />
            {t('editor.previous')}
          </button>
          <span className="text-xs text-[var(--theme-text-soft)]">
            {t('editor.chapterCount', { current: chapterIdx + 1, total: chapters.length })}
          </span>
          <button
            onClick={() => goToChapter(chapterIdx + 1)}
            disabled={chapterIdx >= chapters.length - 1}
            className="flex items-center gap-1 text-xs text-[var(--theme-text-soft)] disabled:opacity-30 py-1"
          >
            {t('editor.next')}
            <ChevronRight size={14} />
          </button>
        </div>

        {/* ══════════════════ EDITOR AREA ══════════════════ */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-1 pb-6">
            {currentChapter && (
              <LekhakEditor
                ref={editorRef}
                ydoc={ydoc}
                synced={synced}
                fontFamily={fontFamily}
                fontSize={fontSize}
                onWordCount={handleWordCount}
                onSelectionText={setSelectionText}
                onEditorReady={handleEditorReady}
                className="min-h-[60vh]"
              />
            )}
          </div>
        </div>

        {/* ══════════════════ BOTTOM INPUT AREA ══════════════════ */}
        <div
          className="sticky bottom-0 z-30 border-t border-[var(--theme-border)]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Voice interim ribbon */}
          <VoiceRibbon interimText={voiceInterim} isListening={isListening} />

          {/* Input method tabs + Roman input box */}
          <InputMethodPicker
            activeTab={inputTab}
            onTabChange={setInputTab}
            onInsertText={handleInsertText}
            onVoiceInterim={(text) => { setVoiceInterim(text); setIsListening(true); }}
            onVoiceStop={() => { setVoiceInterim(''); setIsListening(false); setInputTab('marathi'); }}
            editorRef={editorRef}
          />

          {/* Quick action row */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--theme-toolbar-bg)]">
            <button
              onClick={() => runAI('continue')}
              className="flex items-center gap-1.5 px-3 h-8 rounded-[7px] text-xs font-medium text-[var(--color-terracotta)] border border-[rgba(196,98,45,0.35)] hover:bg-[rgba(196,98,45,0.08)]"
            >
              <Sparkles size={13} />
              {t('ai.continue')}
            </button>
            <button
              onClick={() => runAI('fix')}
              className="flex items-center gap-1.5 px-3 h-8 rounded-[7px] text-xs font-medium text-[var(--theme-text)] border border-[var(--theme-border)] hover:bg-[rgba(196,98,45,0.08)]"
            >
              {t('ai.fix')}
            </button>
            {selectionText && (
              <button
                onClick={() => runAI('alternatives')}
                className="flex items-center gap-1.5 px-3 h-8 rounded-[7px] text-xs font-medium text-[var(--theme-text)] border border-[var(--theme-border)] hover:bg-[rgba(196,98,45,0.08)]"
              >
                {t('ai.alternatives')}
              </button>
            )}
            <button
              onClick={handleInsertImage}
              className="ml-auto flex items-center justify-center w-8 h-8 rounded-[7px] text-[var(--theme-text-soft)] hover:bg-[rgba(196,98,45,0.08)]"
              title="Insert image"
            >
              <Camera size={16} />
            </button>
          </div>
        </div>

        {/* ══════════════════ CHAPTER DRAWER ══════════════════ */}
        <AnimatePresence>
          {showChapters && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 z-50"
                onClick={() => setShowChapters(false)}
              />
              <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                className="fixed top-0 right-0 bottom-0 z-50 w-[min(320px,85vw)] bg-[var(--theme-bg-card)] border-l border-[var(--theme-border)] flex flex-col"
                style={{ paddingTop: 'env(safe-area-inset-top)' }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--theme-border)]">
                  <div className="flex items-center gap-2">
                    <BookOpen size={18} className="text-[var(--color-terracotta)]" />
                    <span className="font-semibold text-[var(--theme-text)]">
                      {t('editor.chapters')}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowChapters(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--theme-text-soft)]"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto py-1">
                  {chapters.map((ch, idx) => (
                    <button
                      key={ch.id}
                      onClick={() => goToChapter(idx)}
                      className={
                        'w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ' +
                        (idx === chapterIdx
                          ? 'bg-[rgba(196,98,45,0.12)] text-[var(--color-terracotta)]'
                          : 'text-[var(--theme-text)] hover:bg-[rgba(196,98,45,0.06)]')
                      }
                    >
                      <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-[rgba(196,98,45,0.1)] text-xs font-bold text-[var(--color-terracotta)]">
                        {idx + 1}
                      </span>
                      <span className="flex-1 min-w-0 text-sm font-medium truncate">
                        {ch.title}
                      </span>
                      {idx === chapterIdx && (
                        <BookOpenCheck size={15} className="flex-shrink-0 opacity-60" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="px-4 py-3 border-t border-[var(--theme-border)] flex gap-2"
                  style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
                  <button onClick={addChapter} className="flex-1 btn btn-primary h-11 text-sm gap-1.5">
                    <Plus size={16} />
                    {t('editor.addChapter')}
                  </button>
                  {chapters.length > 1 && (
                    <button
                      onClick={() => { setShowDeleteConfirm(true); setShowChapters(false); }}
                      className="w-11 h-11 flex items-center justify-center rounded-[10px] text-[var(--color-rust)] border border-[rgba(160,66,26,0.35)] hover:bg-[rgba(160,66,26,0.08)]"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* ══════════════════ AI RESULT SHEET ══════════════════ */}
        <AnimatePresence>
          {showAI && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/30 z-50"
                onClick={() => { setShowAI(false); setAiResult(''); }}
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--theme-bg-card)] rounded-t-[20px] border-t border-[var(--theme-border)]"
                style={{ maxHeight: '72vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
              >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-[var(--theme-border)]" />
                </div>

                <div className="flex items-center justify-between px-4 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-[var(--color-terracotta)]" />
                    <span className="font-semibold text-[var(--theme-text)]">
                      {aiMode === 'continue' ? t('ai.continue')
                        : aiMode === 'fix'   ? t('ai.fix')
                        :                      t('ai.alternatives')}
                    </span>
                  </div>
                  <button
                    onClick={() => { setShowAI(false); setAiResult(''); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--theme-text-soft)]"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="px-4 pb-4 overflow-y-auto" style={{ maxHeight: '50vh' }}>
                  {aiLoading ? (
                    <div className="flex flex-col items-center gap-3 py-10">
                      <div className="w-8 h-8 border-2 border-[var(--color-terracotta)] border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-[var(--theme-text-soft)]">
                        {t('ai.thinking')}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="text-base leading-relaxed whitespace-pre-wrap text-[var(--theme-text)] mb-4 font-[var(--font-noto-serif)]">
                        {aiResult}
                      </div>
                      {aiResult && (
                        <div className="flex gap-2 sticky bottom-0 bg-[var(--theme-bg-card)] pt-2">
                          <button onClick={applyAI} className="btn btn-primary flex-1 h-11">
                            {aiMode === 'fix' ? t('ai.replace') : t('ai.add')}
                          </button>
                          <button
                            onClick={() => runAI(aiMode)}
                            className="btn btn-ghost h-11 px-5 text-lg"
                          >
                            ↻
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ══════════════════ DELETE CHAPTER MODAL ══════════════════ */}
        <Modal
          open={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title={t('editor.confirmDeleteChapter.title')}
        >
          <p className="text-[var(--theme-text)] mb-6">
            {t('editor.confirmDeleteChapter.body', { title: currentChapter?.title ?? '' })}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="btn btn-ghost flex-1"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={removeChapter}
              className="flex-1 h-11 rounded-[10px] bg-[var(--color-rust)] text-[var(--color-cream)] font-semibold hover:bg-[var(--color-terracotta-dark)]"
            >
              {t('common.delete')}
            </button>
          </div>
        </Modal>

      </div>
    </PageTransition>
  );
}
