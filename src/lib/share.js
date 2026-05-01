/**
 * Web Share API helpers, with WhatsApp deep-link fallback.
 */

export function canShareFiles() {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [new File([new Blob(['x'])], 'x.txt', { type: 'text/plain' })] })
  );
}

export async function sharePdf({ blob, filename, title, text }) {
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return { method: 'share' };
    } catch (e) {
      if (e?.name === 'AbortError') return { method: 'cancelled' };
      // Fall through to download
    }
  }

  // Fallback: trigger download
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
  return { method: 'download' };
}

export async function shareText({ title, text, url }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return { method: 'share' };
    } catch (e) {
      if (e?.name === 'AbortError') return { method: 'cancelled' };
    }
  }
  // WhatsApp fallback
  const message = encodeURIComponent(`${title ? title + '\n\n' : ''}${text || ''}${url ? '\n\n' + url : ''}`);
  window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener,noreferrer');
  return { method: 'whatsapp' };
}

export function whatsappShareUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
