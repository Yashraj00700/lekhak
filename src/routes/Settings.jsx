import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, KeyRound, Type, Save, Info, CheckCircle2, BookOpen } from 'lucide-react';
import PageTransition from '../components/PageTransition.jsx';
import TribalDivider from '../components/TribalDivider.jsx';
import { getSettings, saveSettings, exportAllData } from '../lib/db.js';
import { useToast } from '../hooks/useToast.jsx';

const FONT_OPTIONS = [
  { key: 'small', label: 'लहान', sample: '1rem' },
  { key: 'medium', label: 'मध्यम', sample: '1.15rem' },
  { key: 'large', label: 'मोठा', sample: '1.35rem' },
  { key: 'xlarge', label: 'खूप मोठा', sample: '1.6rem' },
];

export default function Settings() {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [keyDirty, setKeyDirty] = useState(false);

  useEffect(() => {
    (async () => setSettings(await getSettings()))();
  }, []);

  if (!settings) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-[var(--color-ink-soft)]">क्षणभर…</div>
        </div>
      </PageTransition>
    );
  }

  const update = (patch) => setSettings({ ...settings, ...patch });

  const persist = async (patch) => {
    const updated = await saveSettings(patch);
    setSettings(updated);
    toast.success('जतन केले');
  };

  const saveKey = async () => {
    await persist({ apiKey: settings.apiKey || '' });
    setKeyDirty(false);
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lekhak-backup-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('बॅकअप डाउनलोड केला');
  };

  const envKeyMasked = import.meta.env.VITE_GEMINI_API_KEY
    ? import.meta.env.VITE_GEMINI_API_KEY.slice(0, 6) + '••••••' + import.meta.env.VITE_GEMINI_API_KEY.slice(-4)
    : '';
  const usingEnvKey = !settings.apiKey?.trim() && !!import.meta.env.VITE_GEMINI_API_KEY;

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-4">
        <div className="text-center mb-3">
          <div className="text-[var(--color-terracotta)] text-xs font-semibold tracking-widest uppercase mb-1">
            सेटिंग्ज
          </div>
          <h1 className="font-tiro m-0 leading-tight">तुमच्या आवडीनुसार</h1>
        </div>

        <TribalDivider variant="warli" className="my-3" />

        {/* API key */}
        <Section icon={KeyRound} title="Gemini API की">
          <p className="text-sm text-[var(--color-ink-soft)] mb-3 leading-relaxed">
            AI सहाय्यक आणि चित्र निर्मितीसाठी Google Gemini API की आवश्यक आहे. की मिळवण्यासाठी{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-forest)] underline font-semibold"
            >
              aistudio.google.com/apikey
            </a>{' '}
            ला भेट द्या.
          </p>

          <div className="flex gap-2 mb-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={settings.apiKey || ''}
                onChange={(e) => {
                  update({ apiKey: e.target.value });
                  setKeyDirty(true);
                }}
                placeholder={usingEnvKey ? `मूलभूत: ${envKeyMasked}` : 'AIza…'}
                className="input pr-12 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 btn-icon h-9 w-9 text-[var(--color-ink-soft)]"
                aria-label={showKey ? 'लपवा' : 'दाखवा'}
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
              जतन
            </button>
          </div>

          {usingEnvKey && (
            <div className="flex items-start gap-2 text-xs text-[var(--color-forest)] bg-[rgba(45,80,22,0.06)] border border-[var(--color-forest-light)] rounded-[8px] p-2.5 mt-2">
              <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
              अनुप्रयोगाची मूलभूत की वापरली जात आहे. आपली स्वतःची की वापरण्यासाठी वर लिहा.
            </div>
          )}
        </Section>

        {/* Font size */}
        <Section icon={Type} title="अक्षरांचा आकार">
          <div className="grid grid-cols-2 gap-2">
            {FONT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => persist({ fontSize: opt.key })}
                className={
                  'p-3 rounded-[10px] border-2 transition-colors text-left ' +
                  (settings.fontSize === opt.key
                    ? 'bg-[var(--color-terracotta)] text-[var(--color-cream)] border-[var(--color-terracotta-dark)]'
                    : 'bg-[var(--color-cream)] text-[var(--color-ink)] border-[var(--color-gold)]')
                }
              >
                <div className="font-semibold mb-1">{opt.label}</div>
                <div style={{ fontSize: opt.sample }} className="leading-tight">
                  आदिवासी कथा
                </div>
              </button>
            ))}
          </div>
        </Section>

        {/* Default image quality */}
        <Section icon={BookOpen} title="मूलभूत चित्र गुणवत्ता">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => persist({ preferredImageModel: 'pro' })}
              className={
                'p-3 rounded-[10px] border-2 text-left transition-colors ' +
                (settings.preferredImageModel === 'pro'
                  ? 'bg-[var(--color-forest)] text-[var(--color-cream)] border-[var(--color-forest-light)]'
                  : 'bg-[var(--color-cream)] text-[var(--color-ink)] border-[var(--color-gold)]')
              }
            >
              <div className="font-semibold">उच्च गुणवत्ता</div>
              <div className="text-xs opacity-90 mt-0.5">Nano Banana Pro</div>
            </button>
            <button
              onClick={() => persist({ preferredImageModel: 'flash' })}
              className={
                'p-3 rounded-[10px] border-2 text-left transition-colors ' +
                (settings.preferredImageModel === 'flash'
                  ? 'bg-[var(--color-forest)] text-[var(--color-cream)] border-[var(--color-forest-light)]'
                  : 'bg-[var(--color-cream)] text-[var(--color-ink)] border-[var(--color-gold)]')
              }
            >
              <div className="font-semibold">जलद</div>
              <div className="text-xs opacity-90 mt-0.5">Nano Banana 2</div>
            </button>
          </div>
        </Section>

        {/* Backup */}
        <Section icon={Save} title="बॅकअप">
          <p className="text-sm text-[var(--color-ink-soft)] mb-3">
            तुमची सर्व पुस्तके, प्रकरणे आणि नोंदी एका JSON फायलीत डाउनलोड करा.
          </p>
          <button onClick={handleBackup} className="btn btn-ghost w-full">
            <Save size={18} />
            बॅकअप डाउनलोड करा
          </button>
        </Section>

        {/* About */}
        <Section icon={Info} title="विषयी">
          <div className="text-sm text-[var(--color-ink-soft)] space-y-2 leading-relaxed">
            <p>
              <strong className="text-[var(--color-ink)]">लेखक</strong> — आदिवासी
              कथांच्या जतनासाठी मराठी पुस्तक लेखन अनुप्रयोग.
            </p>
            <p>
              हा अनुप्रयोग पूर्णपणे ऑफलाइन काम करतो. तुमची सर्व माहिती तुमच्या
              फोनमध्येच राहते — कोणत्याही सर्व्हरवर पाठवली जात नाही.
            </p>
            <p className="text-xs text-[var(--color-clay)]">आवृत्ती १.०.०</p>
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
      <h2 className="font-tiro text-[1.3rem] m-0 mb-3 flex items-center gap-2 text-[var(--color-ink)]">
        <span className="w-8 h-8 rounded-full bg-[var(--color-terracotta)] text-[var(--color-cream)] flex items-center justify-center">
          <Icon size={16} />
        </span>
        {title}
      </h2>
      {children}
    </motion.section>
  );
}
