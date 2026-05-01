import { GoogleGenAI } from '@google/genai';
import { getSettings } from './db.js';
import { translate } from './i18n.js';

/**
 * Lekhak Gemini client.
 *  Text model:  gemini-3-pro          (reasoning, suggestions, grammar)
 *  Image Pro:   gemini-3-pro-image-preview     (Nano Banana Pro — quality)
 *  Image Flash: gemini-3.1-flash-image-preview (Nano Banana 2 — speed)
 *
 * Resolution priority for API key:
 *   1. user-saved key (IndexedDB settings)
 *   2. .env VITE_GEMINI_API_KEY
 */

const TEXT_MODEL = 'gemini-3-pro';
const IMAGE_PRO = 'gemini-3-pro-image-preview';
const IMAGE_FLASH = 'gemini-3.1-flash-image-preview';

let cachedClient = null;
let cachedKey = null;

async function resolveKey() {
  const s = await getSettings();
  return (s.apiKey && s.apiKey.trim()) || import.meta.env.VITE_GEMINI_API_KEY || '';
}

async function getClient() {
  const key = await resolveKey();
  if (!key) {
    const err = new Error('API key missing');
    err.code = 'NO_KEY';
    throw err;
  }
  if (cachedClient && cachedKey === key) return cachedClient;
  cachedClient = new GoogleGenAI({ apiKey: key });
  cachedKey = key;
  return cachedClient;
}

/**
 * Classify an error and stamp it with translation keys.
 * Consumers read `.i18nKey` (preferred) or `.marathiMessage` (legacy).
 */
function wrapError(err, fallbackKey = 'errors.fallback') {
  const e = err instanceof Error ? err : new Error(String(err));
  const msg = e.message || '';
  let key = fallbackKey;

  if (e.code === 'NO_KEY' || /api[_ ]?key|unauthorized|401/i.test(msg)) {
    key = 'errors.noKey';
  } else if (/quota|rate|429|resource_exhausted/i.test(msg)) {
    key = 'errors.quota';
  } else if (/network|fetch|offline|failed to fetch/i.test(msg)) {
    key = 'errors.network';
  } else if (/safety|blocked|harm/i.test(msg)) {
    key = 'errors.safety';
  } else if (/timeout|deadline/i.test(msg)) {
    key = 'errors.timeout';
  }

  e.i18nKey = key;
  // Legacy field kept so any older callers don't break — but consumers should
  // prefer `i18nKey` and translate at the UI layer.
  e.marathiMessage = translate('mr', key);
  return e;
}

/* ============================ TEXT ============================ */

/**
 * Generic text generation against Gemini 3 Pro.
 */
export async function generateText(prompt, { systemInstruction, temperature = 0.7 } = {}) {
  try {
    const ai = await getClient();
    const result = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        temperature,
      },
    });
    return result.text || '';
  } catch (err) {
    throw wrapError(err);
  }
}

/**
 * Continue / suggest the next paragraph given the existing chapter text.
 */
export async function suggestContinuation(chapterText, { tone = 'editorial', count = 1 } = {}) {
  const sys = `तू एक मराठी संपादक आणि कथाकार आहेस. लेखक भारतातील आदिवासी समाजावर पुस्तक लिहित आहे. तुझे काम म्हणजे लेखकाच्या शैलीशी सुसंगत, सांस्कृतिकदृष्ट्या आदरपूर्ण आणि भावनिकदृष्ट्या समृद्ध मराठी गद्य निर्माण करणे. फक्त मराठीत उत्तर दे. कोणतीही माहिती जोडू नकोस — फक्त पुढील ${count} परिच्छेद लिहा.`;
  const user = `येथे आत्तापर्यंतचा मजकूर आहे:\n\n"""\n${chapterText.slice(-3500)}\n"""\n\nपुढील ${count} परिच्छेद ${tone === 'editorial' ? 'संपादकीय शैलीत' : 'कथनशैलीत'} लिहा.`;
  return generateText(user, { systemInstruction: sys, temperature: 0.85 });
}

/**
 * Suggest 3 alternative phrasings for a selection.
 */
export async function suggestAlternatives(selection) {
  const sys =
    'तू मराठी भाषेचा तज्ज्ञ संपादक आहेस. तुला दिलेल्या वाक्याची तीन पर्यायी वाक्ये दे — एक काव्यात्मक, एक सरळ, एक संपादकीय. प्रत्येक पर्याय एकाच ओळीत. क्रमांकित यादी म्हणून फक्त मराठीत उत्तर दे. इतर काहीही लिहू नकोस.';
  return generateText(`वाक्य: "${selection}"`, { systemInstruction: sys, temperature: 0.9 });
}

/**
 * Grammar + spelling fix for a passage.
 */
export async function fixGrammar(text) {
  const sys =
    'तू मराठी व्याकरण आणि शुद्धलेखन तज्ज्ञ आहेस. दिलेल्या मजकुरातील व्याकरण, शुद्धलेखन आणि वाक्यरचनेच्या चुका दुरुस्त कर. लेखकाची शैली बदलू नकोस. फक्त दुरुस्त केलेला मजकूर परत दे — स्पष्टीकरण देऊ नकोस.';
  return generateText(text, { systemInstruction: sys, temperature: 0.2 });
}

/**
 * Summarize a chapter into a 2-3 sentence Marathi synopsis.
 */
export async function summarize(text) {
  const sys =
    'तू मराठी संपादक आहेस. खालील प्रकरणाचा २-३ वाक्यांत भावप्रधान सारांश लिहा. फक्त मराठीत उत्तर दे.';
  return generateText(text, { systemInstruction: sys, temperature: 0.6 });
}

/**
 * Define a tribal/cultural Marathi term.
 * Returns { definition, etymology } parsed from JSON.
 */
export async function defineTerm(term) {
  const sys = `तू भारतीय आदिवासी संस्कृती आणि भाषाशास्त्राचा अभ्यासक आहेस. दिलेल्या शब्दाची मराठी व्याख्या आणि शक्य असल्यास व्युत्पत्ती दे. JSON मध्ये उत्तर दे, या स्वरूपात:
{"definition":"...","etymology":"..."}
फक्त JSON, अन्य काही नको.`;
  const raw = await generateText(`शब्द: "${term}"`, { systemInstruction: sys, temperature: 0.3 });
  try {
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { definition: raw.trim(), etymology: '' };
  }
}

/* ============================ IMAGE ============================ */

const STYLE_PROMPTS = {
  warli:
    'Warli tribal art style: white figures on warm earth-brown background, geometric stick figures, circular suns, triangular hills, traditional Maharashtra tribal painting, hand-painted texture, no shading',
  gond:
    'Gond tribal art style from central India, intricate dot and line patterns, vibrant earthy colors, stylized animals and humans, decorative folk painting',
  madhubani:
    'Madhubani / Mithila art style, bold black outlines, vivid natural pigments (turmeric yellow, indigo, vermillion), flat 2D figures, ornate borders, fish and peacock motifs',
  realistic:
    'photorealistic, natural lighting, documentary style, rich earthy palette, dignified portrait of Indian tribal community life',
  watercolor:
    'soft watercolor illustration, warm earth tones, gentle washes, hand-painted feel, slightly imperfect edges, paper texture visible',
};

const STYLE_LABELS_MR = {
  warli: 'वारली',
  gond: 'गोंड',
  madhubani: 'मधुबनी',
  realistic: 'वास्तववादी',
  watercolor: 'जलरंग',
};

export const IMAGE_STYLES = Object.keys(STYLE_PROMPTS).map((key) => ({
  key,
  label: STYLE_LABELS_MR[key],
  prompt: STYLE_PROMPTS[key],
}));

function buildImagePrompt(userPrompt, style) {
  const styleClause = STYLE_PROMPTS[style] || STYLE_PROMPTS.realistic;
  return `${userPrompt}. Art direction: ${styleClause}. Highly detailed, culturally respectful representation of Indian tribal heritage, suitable for an editorial book about tribal communities of India.`;
}

/**
 * Decode the first inline image part from a Gemini image-model response.
 * Returns { base64, mime } or null.
 */
function extractInlineImage(response) {
  const candidates = response?.candidates || [];
  for (const c of candidates) {
    const parts = c?.content?.parts || [];
    for (const p of parts) {
      if (p?.inlineData?.data) {
        return {
          base64: p.inlineData.data,
          mime: p.inlineData.mimeType || 'image/png',
        };
      }
    }
  }
  return null;
}

async function blobFromBase64(b64, mime = 'image/png') {
  const res = await fetch(`data:${mime};base64,${b64}`);
  return res.blob();
}

/**
 * Generate a brand-new image from a text prompt + style.
 * model: 'pro' (quality) | 'flash' (speed)
 */
export async function generateImage({ prompt, style = 'realistic', model = 'pro' }) {
  try {
    const ai = await getClient();
    const modelId = model === 'flash' ? IMAGE_FLASH : IMAGE_PRO;
    const fullPrompt = buildImagePrompt(prompt, style);

    const response = await ai.models.generateContent({
      model: modelId,
      contents: fullPrompt,
    });

    const img = extractInlineImage(response);
    if (!img) throw new Error('No image returned by model');
    const blob = await blobFromBase64(img.base64, img.mime);
    return { blob, mime: img.mime, prompt: fullPrompt, model: modelId, style };
  } catch (err) {
    throw wrapError(err, 'errors.imageFailed');
  }
}

/**
 * Multi-turn image edit: feed previous image bytes + new instruction back to the same model.
 */
export async function editImage({ baseImageBlob, baseMime = 'image/png', instruction, model = 'pro' }) {
  try {
    const ai = await getClient();
    const modelId = model === 'flash' ? IMAGE_FLASH : IMAGE_PRO;

    // Convert blob to base64 (data URL)
    const base64 = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = reject;
      r.readAsDataURL(baseImageBlob);
    });

    const response = await ai.models.generateContent({
      model: modelId,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: base64, mimeType: baseMime } },
            { text: instruction },
          ],
        },
      ],
    });

    const img = extractInlineImage(response);
    if (!img) throw new Error('No edited image returned');
    const blob = await blobFromBase64(img.base64, img.mime);
    return { blob, mime: img.mime, prompt: instruction, model: modelId };
  } catch (err) {
    throw wrapError(err, 'errors.imageEditFailed');
  }
}

/**
 * Generate an AI character portrait from a description.
 */
export async function generateCharacterPortrait({ name, description, style = 'realistic', model = 'pro' }) {
  const prompt = `Portrait of ${name}, ${description}. Dignified, head-and-shoulders composition, warm natural lighting, indigenous Indian tribal heritage, respectful and authentic representation.`;
  return generateImage({ prompt, style, model });
}
