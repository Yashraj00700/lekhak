/**
 * useYjsEditor — Yjs document lifecycle for a single chapter.
 *
 * Each chapter gets its own Y.Doc keyed by `chapter-{chapterId}`.
 * y-indexeddb persists every change automatically.
 * Returns the ydoc + provider so TipTap can bind via Collaboration extension.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

export function useYjsEditor(chapterId) {
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!chapterId) return;

    // Create a new Y.Doc for this chapter
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Persist to IndexedDB automatically
    const dbName = `lekhak-chapter-${chapterId}`;
    const provider = new IndexeddbPersistence(dbName, ydoc);
    providerRef.current = provider;

    provider.on('synced', () => {
      setSynced(true);
    });

    return () => {
      provider.destroy();
      ydoc.destroy();
      ydocRef.current = null;
      providerRef.current = null;
      setSynced(false);
    };
  }, [chapterId]);

  /**
   * Get current plain text from the Yjs doc (for word count, AI context, etc.)
   */
  const getPlainText = useCallback(() => {
    const ydoc = ydocRef.current;
    if (!ydoc) return '';
    const fragment = ydoc.getXmlFragment('default');
    // Walk XML fragment and collect text nodes
    const texts = [];
    const walk = (node) => {
      if (node.toString) {
        const str = node.toString();
        if (str) texts.push(str);
      }
      if (node._content) {
        for (const child of node._content) walk(child);
      }
    };
    // Simpler: just get text from the doc XML serialisation
    const xml = fragment.toJSON ? fragment.toJSON() : '';
    return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }, []);

  /**
   * Count words in plain text
   */
  const getWordCount = useCallback(() => {
    const text = getPlainText();
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  }, [getPlainText]);

  return {
    ydoc: ydocRef.current,
    provider: providerRef.current,
    synced,
    getPlainText,
    getWordCount,
    ydocRef,
  };
}
