# लेखक — Lekhak

A warm, offline-first PWA for writing Marathi books about the tribal communities of India.

> Built for an elderly author. Big text, simple navigation, never loses a word.

## Features

- ✍️ **Chapter editor** with Devanagari typography, autosave every 30 seconds to IndexedDB
- 🎙️ **Voice-to-text** in Marathi (`mr-IN`) via the Web Speech API
- ✨ **AI writing assistant** powered by Gemini 3 Pro — continue, fix grammar, suggest alternatives, summarize
- 🎨 **AI image studio** — Nano Banana Pro (`gemini-3-pro-image-preview`) for quality, Nano Banana 2 (`gemini-3.1-flash-image-preview`) for speed
- 🖼️ Five tribal art styles: **Warli, Gond, Madhubani, Realistic, Watercolor**
- 🔁 **Multi-turn image editing** — refine an image with follow-up instructions
- 👥 **Character profiles** with AI-generated portraits
- 📖 **Tribal glossary** with AI-generated Marathi definitions and etymologies
- 📕 **PDF export** with proper Devanagari shaping (html2canvas → jsPDF), embedded images, cover, TOC, characters, glossary
- 📲 **WhatsApp share** via Web Share API (with deep-link fallback)
- 📱 **Installable to iPhone Home Screen** via Safari (manifest + apple-touch-icon + iOS meta)
- 🔌 **Fully offline** — Workbox service worker caches everything
- ⚙️ Settings page for API key + font size (small / medium / large / xlarge)
- 💾 Backup all data as JSON

## Stack

- React 19 + Vite 8
- Tailwind CSS v4 (CSS-first config via `@theme`)
- vite-plugin-pwa (Workbox)
- @google/genai SDK
- idb (IndexedDB)
- jsPDF + html2canvas
- framer-motion, react-router-dom, lucide-react

## Design

Earthy editorial palette — terracotta `#C4622D`, parchment `#F5EDD6`, forest green `#2D5016`, gold `#C9973A`. Tiro Devanagari Marathi for headings, Noto Sans/Serif Devanagari for body. Hand-drawn Warli/Gond SVG dividers, paper-grain background, warm shadows. Minimum 48 px touch targets. No purple gradients, no harsh whites.

## Setup

```sh
npm install --legacy-peer-deps
cp .env.example .env
# add your Gemini API key
npm run build
```

Get a Gemini API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Users can also paste their own key into the in-app Settings page.

## Deploy

This app is deployed on Vercel.

```sh
vercel --prod
```

Set `VITE_GEMINI_API_KEY` in the Vercel project's environment variables.

## License

MIT — for the author and her readers.
