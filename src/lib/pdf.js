import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { listChapters, listCharacters, listGlossary, getImage } from './db.js';

/**
 * Build the full book as a PDF.
 *
 * Strategy: render each "page" as styled DOM nodes (no innerHTML — all user
 * content goes through textContent), snapshot via html2canvas, then add the
 * canvas image to a jsPDF page. This sidesteps jsPDF's incomplete Devanagari
 * shaping and is safe against XSS.
 */

/* ---------- DOM helpers (no innerHTML) ---------- */

function el(tag, { style = '', cls = '' } = {}, children = []) {
  const node = document.createElement(tag);
  if (style) node.style.cssText = style;
  if (cls) node.className = cls;
  for (const c of [].concat(children).filter(Boolean)) {
    if (typeof c === 'string') node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  }
  return node;
}

function text(tag, content, style = '') {
  return el(tag, { style }, [String(content ?? '')]);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/* ------------------------------------------------------- */

export async function exportBookToPdf(book, { onProgress } = {}) {
  const chapters = await listChapters(book.id);
  const characters = await listCharacters(book.id);
  const glossary = await listGlossary(book.id);

  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch { /* noop */ }
  }

  const pdf = new jsPDF({
    unit: 'pt',
    format: 'a5',
    orientation: 'portrait',
    compress: true,
  });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Hidden render stage (offscreen)
  const stage = document.createElement('div');
  stage.style.cssText = `position:fixed;left:-10000px;top:0;width:${pageW}pt;background:#FAF3E0;font-family:'Noto Serif Devanagari','Noto Sans Devanagari',serif;color:#2A1810;`;
  document.body.appendChild(stage);

  let pageCount = 0;

  const renderAndAdd = async (pageNode) => {
    while (stage.firstChild) stage.removeChild(stage.firstChild);
    stage.appendChild(pageNode);
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch { /* noop */ }
    }
    const canvas = await html2canvas(pageNode, {
      backgroundColor: '#FAF3E0',
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    if (pageCount > 0) pdf.addPage();
    pdf.addImage(dataUrl, 'JPEG', 0, 0, pageW, Math.min((canvas.height * pageW) / canvas.width, pageH));
    pageCount += 1;
  };

  const newPage = () =>
    el('div', {
      style: `width:${pageW}pt;min-height:${pageH}pt;padding:36pt 32pt;box-sizing:border-box;background:#FAF3E0;`,
    });

  /* ---------- Cover ---------- */
  onProgress?.({ stage: 'cover', current: 0, total: 0 });
  const coverPage = newPage();
  const coverInner = el('div', {
    style: `display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:${pageH - 80}pt;text-align:center;`,
  });
  if (book.coverImageId) {
    const cover = await getImage(book.coverImageId);
    if (cover?.blob) {
      const img = document.createElement('img');
      img.src = await blobToDataUrl(cover.blob);
      img.style.cssText = 'width:100%;max-height:300pt;object-fit:cover;border:2pt solid #C9973A;border-radius:6pt;margin-bottom:24pt;';
      coverInner.appendChild(img);
    }
  }
  coverInner.appendChild(text('div', book.title, `font-family:'Tiro Devanagari Marathi',serif;font-size:36pt;line-height:1.2;color:#2A1810;margin-bottom:16pt;`));
  coverInner.appendChild(el('div', { style: 'height:1.5pt;width:80pt;background:#C9973A;margin:8pt auto 16pt;' }));
  if (book.author) coverInner.appendChild(text('div', `— ${book.author}`, 'font-size:13pt;color:#4A3528;margin-bottom:8pt;'));
  if (book.dedication) coverInner.appendChild(text('div', book.dedication, 'font-style:italic;font-size:11pt;color:#4A3528;margin-top:24pt;max-width:280pt;'));
  coverPage.appendChild(coverInner);
  await renderAndAdd(coverPage);

  /* ---------- Table of contents ---------- */
  if (chapters.length > 0) {
    const tocPage = newPage();
    tocPage.appendChild(text('h2', 'अनुक्रमणिका', `font-family:'Tiro Devanagari Marathi',serif;font-size:24pt;color:#C4622D;border-bottom:1.5pt solid #C9973A;padding-bottom:6pt;margin-bottom:16pt;`));
    const list = el('ol', { style: 'list-style:none;padding-left:0;' });
    chapters.forEach((c, i) => {
      list.appendChild(text('li', `${i + 1}. ${c.title || `प्रकरण ${i + 1}`}`, 'margin-bottom:8pt;font-size:12pt;'));
    });
    tocPage.appendChild(list);
    await renderAndAdd(tocPage);
  }

  /* ---------- Chapters ---------- */
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    onProgress?.({ stage: 'chapter', current: i + 1, total: chapters.length });

    const paragraphs = (chapter.content || '')
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    const chunks = chunkByLength(paragraphs, 1800);

    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      const page = newPage();
      if (cIdx === 0) {
        page.appendChild(text('div', `प्रकरण ${i + 1}`, `font-family:'Tiro Devanagari Marathi',serif;color:#C4622D;font-size:13pt;letter-spacing:0.05em;margin-bottom:4pt;`));
        page.appendChild(text('h2', chapter.title || `प्रकरण ${i + 1}`, `font-family:'Tiro Devanagari Marathi',serif;font-size:22pt;line-height:1.25;color:#2A1810;margin:0 0 12pt;`));
        page.appendChild(el('div', { style: 'height:1pt;width:60pt;background:#C9973A;margin:0 0 18pt;' }));
      }
      for (const p of chunks[cIdx]) {
        const pNode = text('p', p, 'font-size:12.5pt;line-height:1.85;text-align:justify;margin:0 0 11pt;');
        // Convert single \n to <br>
        const textVal = pNode.textContent;
        if (textVal.includes('\n')) {
          pNode.textContent = '';
          textVal.split('\n').forEach((line, idx) => {
            if (idx > 0) pNode.appendChild(document.createElement('br'));
            pNode.appendChild(document.createTextNode(line));
          });
        }
        page.appendChild(pNode);
      }
      await renderAndAdd(page);
    }
  }

  /* ---------- Characters ---------- */
  if (characters.length > 0) {
    onProgress?.({ stage: 'characters', current: 0, total: characters.length });
    const page = newPage();
    page.appendChild(text('h2', 'पात्र परिचय', `font-family:'Tiro Devanagari Marathi',serif;font-size:24pt;color:#C4622D;border-bottom:1.5pt solid #C9973A;padding-bottom:6pt;margin-bottom:16pt;`));
    for (const ch of characters) {
      const card = el('div', { style: 'margin-bottom:18pt;clear:both;' });
      if (ch.portraitId) {
        const portrait = await getImage(ch.portraitId);
        if (portrait?.blob) {
          const img = document.createElement('img');
          img.src = await blobToDataUrl(portrait.blob);
          img.style.cssText = 'width:90pt;height:90pt;object-fit:cover;border:1.5pt solid #C9973A;border-radius:6pt;float:left;margin-right:12pt;';
          card.appendChild(img);
        }
      }
      const body = el('div', { style: 'overflow:hidden;' });
      body.appendChild(text('div', ch.name, `font-family:'Tiro Devanagari Marathi',serif;font-size:16pt;color:#2A1810;margin-bottom:4pt;`));
      if (ch.traits) body.appendChild(text('div', ch.traits, 'font-size:10.5pt;color:#8B4513;font-style:italic;margin-bottom:6pt;'));
      if (ch.description) body.appendChild(text('div', ch.description, 'font-size:11.5pt;line-height:1.6;'));
      card.appendChild(body);
      page.appendChild(card);
    }
    await renderAndAdd(page);
  }

  /* ---------- Glossary ---------- */
  if (glossary.length > 0) {
    const page = newPage();
    page.appendChild(text('h2', 'शब्दार्थ', `font-family:'Tiro Devanagari Marathi',serif;font-size:24pt;color:#C4622D;border-bottom:1.5pt solid #C9973A;padding-bottom:6pt;margin-bottom:16pt;`));
    for (const g of glossary) {
      const entry = el('div', { style: 'margin-bottom:14pt;page-break-inside:avoid;' });
      entry.appendChild(text('div', g.term, `font-family:'Tiro Devanagari Marathi',serif;font-size:14pt;color:#2D5016;`));
      if (g.definition) entry.appendChild(text('div', g.definition, 'font-size:11pt;line-height:1.55;margin-top:2pt;'));
      if (g.etymology) entry.appendChild(text('div', `— ${g.etymology}`, 'font-size:10pt;color:#8B4513;font-style:italic;margin-top:2pt;'));
      page.appendChild(entry);
    }
    await renderAndAdd(page);
  }

  /* ---------- Colophon ---------- */
  const colophon = newPage();
  const colInner = el('div', {
    style: `display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:${pageH - 80}pt;text-align:center;color:#4A3528;`,
  });
  colInner.appendChild(text('div', 'समाप्त', `font-family:'Tiro Devanagari Marathi',serif;font-size:18pt;color:#C4622D;margin-bottom:12pt;`));
  colInner.appendChild(el('div', { style: 'height:1pt;width:60pt;background:#C9973A;margin:0 0 18pt;' }));
  colInner.appendChild(text('div', `लेखक — ${book.author || 'अनाम'}`, 'font-size:10pt;'));
  colInner.appendChild(text('div', 'तयार केले: लेखक अनुप्रयोगाद्वारे', 'font-size:9pt;margin-top:6pt;'));
  colophon.appendChild(colInner);
  await renderAndAdd(colophon);

  document.body.removeChild(stage);
  onProgress?.({ stage: 'done', current: pageCount, total: pageCount });
  return pdf.output('blob');
}

function chunkByLength(paragraphs, maxChars) {
  const chunks = [];
  let cur = [];
  let len = 0;
  for (const p of paragraphs) {
    if (len + p.length > maxChars && cur.length > 0) {
      chunks.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(p);
    len += p.length;
  }
  if (cur.length > 0) chunks.push(cur);
  return chunks.length > 0 ? chunks : [['']];
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
