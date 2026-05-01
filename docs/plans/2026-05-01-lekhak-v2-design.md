# Lekhak v2 — Complete Architecture Plan
**Date:** 2026-05-01  
**Status:** Approved & Building

---

## 1. Vision

A Marathi book-writing PWA that FEELS like writing in a physical book. The primary user is a 60+ year old author writing about India's tribal communities. The interface must be warm, trustworthy, bilingual (mr/en), and impossible to lose work in.

---

## 2. Confirmed Feature Set

### Core Editor
- [x] TipTap (ProseMirror) headless editor — replaces `<textarea>`
- [x] Yjs + y-indexeddb — replaces custom 30s autosave, every-keystroke persistence
- [x] Two-page spread mode (react-pageflip) + single-page toggle
- [x] Three-tab input: मराठी keyboard | English→मराठी transliteration | 🎤 voice
- [x] Voice: Chrome-first, interim ribbon below editor, tap-toggle, mr-IN
- [x] Inline image blocks with drag handles + react-easy-crop cropping
- [x] MS Word-level image layout: inline / wrap-left / wrap-right / full-page
- [x] Full formatting toolbar: bold/italic/heading/bullets/quote/align
- [x] Marathi font picker: Tiro Devanagari / Noto / Mukta / Eczar / Kalam / Rozha
- [x] Marathi spell check (nspell + Hunspell mr-IN dict)
- [x] Glossary auto-linking (TipTap extension marks)

### Themes
- [x] Parchment (warm paper, daytime) — default
- [x] Candlelight (warm amber, night) — easy on eyes
- [x] Dark (modern dark mode)

### AI Features
- [x] Always-on chapter context for image generation
- [x] AI writing continuation (Gemini 3 Pro)
- [x] Grammar fix + alternatives + summary
- [x] Memory aid — AI tracks characters/places mentioned (idea #1)
- [x] Autocomplete for character names + glossary terms (idea #2)
- [x] AI story coach — pacing, arc, suggestions (idea #6)
- [x] Word goal + gentle daily streak (idea #8)

### Content & Navigation
- [x] Multi-book library (idea #9)
- [x] Book-wide search
- [x] Character profiles + AI portrait generation
- [x] Glossary with AI definitions
- [x] Undo/soft-delete with 10s toast recovery

### Export & Share
- [x] PDF via Vercel Functions + Puppeteer (pixel-perfect)
- [x] Browser fallback PDF (html2canvas)
- [x] WhatsApp share
- [x] Family read-only web microsite with pageflip (idea #10)
- [x] Pothi.com print integration

### Backup
- [x] Google Drive backup (OAuth via @googleworkspace/drive-picker-react)
- [x] Email backup (JSON export)

### UX & Onboarding
- [x] Shepherd.js onboarding tour (3 min first-run)
- [x] Bilingual help guide with real screenshots
- [x] Daily writing reminder (Web Push VAPID + 7pm Vercel Cron)
- [x] UpdateBanner for PWA updates

### Optional
- [ ] Cover designer with preset tribal templates (idea #5)

---

## 3. Library Choices

| Purpose | Library |
|---------|---------|
| Rich text editor | @tiptap/react + extensions |
| CRDTautosave | yjs + y-indexeddb |
| Page flip animation | react-pageflip |
| Image crop | react-easy-crop |
| Transliteration | @indic-transliteration/sanscript |
| Spell check | nspell + marathi_spell_check |
| Onboarding | shepherd.js |
| Google Drive | @googleworkspace/drive-picker-react |
| Pixel PDF | puppeteer (Vercel Function) |
| Map view | leaflet + react-leaflet |
| Notifications | web-push (VAPID) |

---

## 4. Component Architecture

```
src/
  routes/
    Home.jsx              ← multi-book library (v2)
    BookEditor.jsx        ← FULL REWRITE (TipTap + Yjs + themes)
    ImageStudio.jsx       ← + chapter context always-on
    Characters.jsx        ← + memory aid integration
    Glossary.jsx          ← + auto-linking
    Export.jsx            ← + Puppeteer PDF + Pothi
    Settings.jsx          ← + themes + fonts + Drive + notifications
    Share.jsx             ← NEW family microsite
    Help.jsx              ← NEW bilingual guide + screenshots
  components/
    editor/
      LekhakEditor.jsx    ← TipTap wrapper + Yjs provider
      EditorToolbar.jsx   ← formatting + font + theme controls
      InputMethodPicker.jsx ← 3-tab: मराठी | Roman | Voice
      VoiceRibbon.jsx     ← interim text ribbon below editor
      ImageBlock.jsx      ← TipTap node extension
      GlossaryMark.jsx    ← TipTap mark extension
    book/
      BookSpread.jsx      ← react-pageflip two-page wrapper
      ChapterList.jsx     ← slide-in drawer
      WordGoalBar.jsx     ← daily word count + streak
    ai/
      AIAssistPanel.jsx   ← (updated) + story coach
      MemoryAidPanel.jsx  ← character/place tracker
      AutocompleteDropdown.jsx ← name + term suggestions
    BottomNav.jsx         ← FIXED (useLocation)
    UpdateBanner.jsx      ← (exists, keep)
    Modal.jsx             ← (exists, keep)
    TribalDivider.jsx     ← (exists, keep)
  lib/
    db.js                 ← add wordGoal store
    gemini.js             ← (exists)
    i18n.js               ← (exists, extend strings)
    pdf.js                ← client fallback
    pdfServer.js          ← NEW Puppeteer API caller
    share.js              ← (exists)
    swUpdate.js           ← (exists)
    voice.js              ← Chrome-first rewrite
    spellcheck.js         ← NEW nspell wrapper
    notifications.js      ← NEW VAPID push helper
    driveBackup.js        ← NEW Drive API wrapper
  hooks/
    useYjsEditor.js       ← Yjs provider + awareness
    useAutosave.js        ← keep as fallback
    useSpellcheck.js      ← nspell hook
    useLanguage.jsx       ← (exists)
    useToast.jsx          ← (exists)
    useWordGoal.js        ← NEW daily streak hook
```

---

## 5. Data Model (Yjs + idb)

### IndexedDB stores (existing + additions)
- `books` — book metadata (id, title, coverImageId, theme, font, createdAt, updatedAt)
- `chapters` — **ydoc binary** stored here (replaces raw text)
- `characters` — character profiles + portraitImageId
- `images` — blob + mime + prompt + style + chapterId
- `glossary` — term + definition + etymology
- `settings` — apiKey, language, theme, fontSize, fontFamily, wordGoal, vapidSubscription
- `wordStats` — NEW: date + bookId + wordCount (for streak)

### Yjs document schema per chapter
```
ydoc.getText('content')  ← the chapter body (TipTap uses Y.XmlFragment)
ydoc.getMap('meta')      ← { title, lastSaved, wordCount }
```

---

## 6. Build Order

1. **Install dependencies** — all new packages
2. **Theme system** — CSS tokens for 3 themes
3. **BottomNav fix** — useLocation()
4. **i18n string extension** — add all v2 keys
5. **Yjs + TipTap editor** — LekhakEditor, EditorToolbar, InputMethodPicker
6. **Voice ribbon** — Chrome-first, interim display
7. **Inline images** — ImageBlock TipTap node
8. **Two-page spread** — BookSpread with react-pageflip
9. **Spell check** — nspell integration
10. **Memory aid** — AI character/place tracker
11. **Autocomplete** — inline dropdown
12. **Word goal + streak** — WordGoalBar
13. **AI story coach** — extended AIAssistPanel
14. **Book-wide search** — full-text across all chapters
15. **Settings v2** — themes, fonts, Drive, push notifications
16. **Google Drive backup** — via drive-picker-react
17. **Push notifications** — VAPID setup + Vercel Cron
18. **Onboarding tour** — Shepherd.js
19. **Help guide** — bilingual + screenshots
20. **Family microsite / Share** — web share route
21. **Pixel-perfect PDF** — Vercel Function + Puppeteer
22. **Vercel Cron** — daily 7pm reminder
23. **Final build + GitHub push + Vercel deploy**

---

## 7. API / Backend Routes (Vercel Functions)

```
api/
  pdf.js          ← POST { bookId, chapters[] } → Puppeteer PDF buffer
  push-subscribe.js ← POST { subscription } → store VAPID sub
  push-send.js    ← cron trigger → send daily reminder
```

---

## 8. Chrome MCP Tasks (autonomous)
1. Navigate `sanket` browser to Google Cloud Console
2. Create "Lekhak" project
3. Enable Google Drive API
4. Create OAuth 2.0 credentials (web app)
5. Add authorized origin: https://lekhak-chi.vercel.app
6. Copy client_id → VITE_GDRIVE_CLIENT_ID env var
7. Take screenshots for help guide (Home, Editor, ImageStudio, Settings)

---

## 9. Environment Variables

```
VITE_GEMINI_API_KEY=REDACTED_KEY
VITE_GDRIVE_CLIENT_ID=<from Chrome MCP step>
VITE_VAPID_PUBLIC_KEY=<generated>
VAPID_PRIVATE_KEY=<generated, server-only>
```
