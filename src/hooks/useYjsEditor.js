/**
 * useYjsEditor — Yjs document lifecycle for a single chapter.
 *
 * Each chapter gets its own Y.Doc keyed by `chapter-{chapterId}`.
 * y-indexeddb persists every change automatically.
 * Returns the ydoc + provider so TipTap can bind via Collaboration extension.
 */

import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

export function useYjsEditor(chapterId) {
  // Use state (not ref) so callers re-render when the ydoc becomes available
  const [ydoc, setYdoc]     = useState(null);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!chapterId) {
      setYdoc(null);
      setSynced(false);
      return;
    }

    const doc      = new Y.Doc();
    const dbName   = `lekhak-chapter-${chapterId}`;
    const provider = new IndexeddbPersistence(dbName, doc);

    // Fire once when IndexedDB content is loaded into the doc
    provider.on('synced', () => {
      setYdoc(doc);   // set AFTER sync so editor receives populated doc
      setSynced(true);
    });

    // Safety: if synced never fires (empty doc), resolve after 400 ms
    const fallback = setTimeout(() => {
      setYdoc(doc);
      setSynced(true);
    }, 400);

    return () => {
      clearTimeout(fallback);
      provider.destroy();
      doc.destroy();
      setYdoc(null);
      setSynced(false);
    };
  }, [chapterId]);

  return { ydoc, synced };
}
