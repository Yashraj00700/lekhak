import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Eye, EyeOff, KeyRound, Type, Save, Info, CheckCircle2,
  BookOpen, Palette, Target, Globe,
} from 'lucide-react';
import PageTransition from '../components/PageTransition.jsx';
import TribalDivider from '../components/TribalDivider.jsx';
import { getSettings, saveSettings, exportAllData } from '../lib/db.js';
import { useToast } from '../hooks/useToast.jsx';
import { useLanguage } from '../hooks/useLanguage.jsx';

const FONT_SIZES = [
  { key: 'small',  px: '1rem' },
  { key: 'medium', px: '1.2rem' },
  { key: 'large',  px: '1.375rem' },
  { key: 'xlarge', px: '1.625rem' },
];

const THEMES = [
  { key: 'parchment',   emoji: '📜', mr: 'पर्चमेंट',    en: 'Parchment'   },
  { key: 'candlelight', emoji: '🕯️',  mr: 'मेणबत्ती',   en: 'Candlelight' },
  { key: 'dark',        emoji: '🌙',  mr: 'डार्क',       en: 'Dark'        },
];

const WORD_GOALS = [100, 250, 500, 1000];

export default function Settings() {
  const toast             = useToast();
  const { t, setLang, isMarathi } = useLanguage();
  const [settings, setSettings]   = useState(null);
  const [showKey, setShowKey]     = useState(false);
  const [keyDirty, setKeyDirty]   = useState(false);

  useEffect(() => {
    (async () => setSettings(await getSettings()))();
  }, []);

  if (!settings) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-[var(--theme-text-soft)]">{t('common.loading')}</div>
        </div>
      </PageTransition>
    );
  }

  const update  = (patch) => setSettings((s) => ({ ...s, ...patch }));

  const persist = async (patch) => {
    const updated = await saveSettings(patch);
    setSettings(updated);
    toast.success(t('common.saved'));
  };

  const saveKey = async () => {
    await persist({ apiKey: settings.apiKey || '' });
    setKeyDirty(false);
  };

  const applyTheme = async (theme) => {
    await persist({ theme });
    document.documentElement.setAttribute('data-theme', theme);
    window.dispatchEvent(new CustomEvent('lekhak:theme-change', { detail: theme }));
  };

  const handleBackup = async () => {
    const data = await exportAllData();
    const json = JSON.stringify(
      data,
      (key, value) => {
        if (value instanceof Blob) return { __blob: true, type: value.type, size: value.size };
        return value;
      },
      2
    );
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `lekhak-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(t('settings.backupDone'));
  };

  const envKey       = import.meta.env.VITE_GEMINI_API_KEY;
  const envKeyMasked = envKey ? envKey.slice(0, 6) + '••••' + envKey.slice(-4) : '';
  const usingEnvKey  = !settings.apiKey?.trim() && !!envKey;

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-8">

        {/* Header */}
        <div className="text-center mb-3">
          <div className="text-[var(--color-terracotta)] text-xs font-semibold tracking-widest uppercase mb-1">
            {t('settings.eyebrow')}
          </div>
          <h1 className="m-0 leading-tight text-[var(--theme-text)]">{t('settings.title')}</h1>
        </div>

        <TribalDivider variant="warli" className="my-3" />

        {/* ── Language toggle ── */}
        <Section icon={Globe} title={t('settings.section.language')}>
          <p className="text-sm text-[var(--theme-text-soft)] mb-3 leading-relaxed">
            {t('settings.section.languageHint')}
          </p>
          <div className="flex gap-3">
            {['mr', 'en'].map((lang) => (
              <button
                key={lang}
                onClick={async () => {
                  setLang(lang);
                  await persist({ language: lang });
                }}
                className={
                  'flex-1 py-3 rounded-[10px] border-2 text-base font-semibold transition-colors ' +
                  ((settings.language || 'mr') === lang
                    ? 'bg-[var(--color-terracotta)] text-[var(--color-cream)] border-[var(--color-terracotta-dark)]'
                    : 'bg-[var(--theme-bg-input)] text-[var(--theme-text)] border-[var(--theme-border)]')
                }
              >
                {lang === 'mr' ? 'मराठी' : 'English'}
              </button>
            ))}
          </div>
        </Section>

        {/* ── Theme ── */}
        <Section icon={Palette} title={isMarathi ? 'थीम' : 'Theme'}>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((th) => (
              <button
                key={th.key}
                onClick={() => applyTheme(th.key)}
                className={
                  'py-4 rounded-[12px] border-2 flex flex-col items-center gap-1.5 transition-colors ' +
                  (settings.theme === th.key || (!settings.theme && th.key === 'parchment')
                    ? 'border-[var(--color-terracotta)] bg-[rgba(196,98,45,0.08)]'
                    : 'border-[var(--theme-border)] bg-[var(--theme-bg-input)] hover:border-[var(--color-gold)]')
                }
              >
                <span className="text-2xl">{th.emoji}</span>
                <span className="text-xs font-semibold text-[var(--theme-text)]">
                  {isMarathi ? th.mr : th.en}
                </span>
              </button>
            ))}
          </div>
        </Section>

        {/* ── Font size ── */}
        <Section icon={Type} title={t('settings.section.fontSize')}>
          <div className="grid grid-cols-2 gap-2">
            {FONT_SIZES.map((opt) => (
              <button
                key={opt.key}
                onClick={() => persist({ fontSize: opt.key })}
                className={
                  'p-3 rounded-[10px] border-2 transition-colors text-left ' +
                  (settings.fontSize === opt.key
                    ? 'bg-[var(--color-terracotta)] text-[var(--color-cream)] border-[var(--color-terracotta-dark)]'
                    : 'bg-[var(--theme-bg-input)] text-[var(--theme-text)] border-[var(--theme-border)]')
                }
              >
                <div className="font-semibold text-xs mb-1 opacity-80">
                  {t('settings.font' + opt.key.charAt(0).toUpperCase() + opt.key.slice(1))}
                </div>
                <div style={{ fontSize: opt.px }} className="leading-tight font-['Tiro_Devanagari_Marathi',serif]">
                  {t('settings.sample')}
                </div>
              </button>
            ))}
          </div>
        </Section>

        {/* ── Daily word goal ── */}
        <Section icon={Target} title={isMarathi ? 'दैनिक शब्द ध्येय' : 'Daily word goal'}>
          <p className="text-sm text-[var(--theme-text-soft)] mb-3">
            {isMarathi
              ? 'रोज किती शब्द लिहायचे? लेखणीत प्रगती दिसेल.'
              : 'Set a daily writing target. Progress shows in the editor.'}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {WORD_GOALS.map((g) => (
              <button
                key={g}
                onClick={() => persist({ wordGoal: g })}
                className={
                  'py-3 rounded-[10px] border-2 text-sm font-bold transition-colors ' +
                  ((settings.wordGoal ?? 500) === g
                    ? 'bg-[var(--color-forest)] text-[var(--color-cream)] border-[var(--color-forest-light)]'
                    : 'bg-[var(--theme-bg-input)] text-[var(--theme-text)] border-[var(--theme-border)]')
                }
              >
                {g}
              </button>
            ))}
          </div>
        </Section>

        {/* ── API key ── */}
        <Section icon={KeyRound} title={t('settings.section.apiKey')}>
          <p className="text-sm text-[var(--theme-text-soft)] mb-3 leading-relaxed">
            {t('settings.section.apiKeyHint', { link: '' })}
            {' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-forest)] underline font-semibold"
            >
              aistudio.google.com/apikey
            </a>
          </p>

          <div className="flex gap-2 mb-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={settings.apiKey || ''}
                onChange={(e) => { update({ apiKey: e.target.value }); setKeyDirty(true); }}
                placeholder={usingEnvKey ? `Default: ${envKeyMasked}` : 'AIza…'}
                className="input pr-12 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-[var(--theme-text-soft)]"
              >
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button
              onClick={saveKey}
              disabled={!keyDirty}
              className="btn btn-primary disabled:opacity-50"
            >
              <Save size={18} />
              {t('common.save')}
            </button>
          </div>

          {usingEnvKey && (
            <div className="flex items-start gap-2 text-xs text-[var(--color-forest)] bg-[rgba(45,80,22,0.08)] border border-[var(--color-forest-light)] rounded-[8px] p-2.5">
              <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
              {t('settings.apiKeyEnvActive')}
            </div>
          )}
        </Section>

        {/* ── Image quality ── */}
        <Section icon={BookOpen} title={t('settings.section.imageQuality')}>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'pro',   label: t('images.qualityHigh'), hint: t('images.qualityHighHint') },
              { key: 'flash', label: t('images.qualityFast'), hint: t('images.qualityFastHint') },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => persist({ preferredImageModel: opt.key })}
                className={
                  'p-3 rounded-[10px] border-2 text-left transition-colors ' +
                  ((settings.preferredImageModel ?? 'pro') === opt.key
                    ? 'bg-[var(--color-forest)] text-[var(--color-cream)] border-[var(--color-forest-light)]'
                    : 'bg-[var(--theme-bg-input)] text-[var(--theme-text)] border-[var(--theme-border)]')
                }
              >
                <div className="font-semibold">{opt.label}</div>
                <div className="text-xs opacity-75 mt-0.5">{opt.hint}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* ── Backup ── */}
        <Section icon={Save} title={t('settings.section.backup')}>
          <p className="text-sm text-[var(--theme-text-soft)] mb-3 leading-relaxed">
            {t('settings.backupHint')}
          </p>
          <button onClick={handleBackup} className="btn btn-ghost w-full">
            <Save size={18} />
            {t('settings.backupCta')}
          </button>
        </Section>

        {/* ── About ── */}
        <Section icon={Info} title={t('settings.section.about')}>
          <div className="text-sm text-[var(--theme-text-soft)] space-y-2 leading-relaxed">
            <p>
              <strong className="text-[var(--theme-text)]">
                {t('app.name')}
              </strong>
              {' — '}
              {t('settings.about.line1').replace('लेखक — ', '').replace('Lekhak — ', '')}
            </p>
            <p>{t('settings.about.line2')}</p>
            <p className="text-xs text-[var(--color-clay)]">{t('settings.about.version')}</p>
          </div>
        </Section>

      </div>
    </PageTransition>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className="lekhak-card-paper p-4 mb-3"
    >
      <h2 className="text-[1.2rem] m-0 mb-3 flex items-center gap-2 text-[var(--theme-text)] font-semibold">
        <span className="w-8 h-8 rounded-full bg-[var(--color-terracotta)] text-[var(--color-cream)] flex items-center justify-center flex-shrink-0">
          <Icon size={16} />
        </span>
        {title}
      </h2>
      {children}
    </motion.section>
  );
}
