/**
 * LekhakEditor — TipTap rich-text editor with Yjs CRDT autosave.
 *
 * Key design decision:
 *  `onEditorReady(editorInstance)` is called whenever the TipTap editor
 *  is created/replaced. The parent (BookEditor) stores this in useState so
 *  EditorToolbar always gets a valid, stable reference — no ref-pull race.
 */

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import CharacterCount from '@tiptap/extension-character-count';
import ImageExtension from '@tiptap/extension-image';
import Collaboration from '@tiptap/extension-collaboration';
import { useLanguage } from '../../hooks/useLanguage.jsx';

const LekhakEditor = forwardRef(function LekhakEditor(
  {
    ydoc,
    synced,
    fontFamily,
    fontSize,
    onWordCount,
    onSelectionText,
    onEditorReady,   // ← called with the TipTap editor instance when ready
    className = '',
    readOnly = false,
  },
  ref
) {
  const { t } = useLanguage();

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          // Collaboration handles undo/redo history
          history: ydoc ? false : undefined,
        }),
        Placeholder.configure({
          placeholder: t('editor.bodyPlaceholder'),
          emptyEditorClass: 'is-editor-empty',
        }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Underline,
        TextStyle,
        CharacterCount,
        ImageExtension.configure({
          inline: false,
          allowBase64: true,
          HTMLAttributes: { class: 'lekhak-image' },
        }),
        // Only include Collaboration when ydoc is available
        ...(ydoc
          ? [Collaboration.configure({ document: ydoc, field: 'default' })]
          : []),
      ],
      editable: !readOnly,
      autofocus: !readOnly ? 'end' : false,
      editorProps: {
        attributes: {
          class: 'lekhak-editor ProseMirror',
          spellcheck: 'false',
          lang: 'mr',
        },
      },
      onUpdate({ editor: ed }) {
        if (onWordCount) {
          const words = ed.storage.characterCount?.words?.() ?? 0;
          onWordCount(words);
        }
      },
      onSelectionUpdate({ editor: ed }) {
        if (onSelectionText) {
          const { from, to } = ed.state.selection;
          const text = from === to ? '' : ed.state.doc.textBetween(from, to, ' ');
          onSelectionText(text);
        }
      },
    },
    // Recreate editor when ydoc changes (new chapter loaded or ydoc becomes available)
    [ydoc]
  );

  // Notify parent when editor is ready
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
    return () => {
      // Editor is being destroyed — clear the parent reference
      if (onEditorReady) onEditorReady(null);
    };
  }, [editor, onEditorReady]);

  // Expose imperative API via ref
  useImperativeHandle(ref, () => ({
    getEditor:   () => editor,
    insertText:  (text) => editor?.chain().focus().insertContent(text).run(),
    insertImage: (src, alt = '') => editor?.chain().focus().setImage({ src, alt }).run(),
    getPlainText: () => editor?.getText() ?? '',
    getWordCount: () => editor?.storage.characterCount?.words?.() ?? 0,
    focus:       () => editor?.commands.focus('end'),
  }), [editor]);

  // Apply font family to the editor DOM node
  useEffect(() => {
    const el = editor?.view?.dom;
    if (el && fontFamily) el.style.fontFamily = fontFamily;
  }, [editor, fontFamily]);

  // Apply font size to the editor DOM node
  useEffect(() => {
    const el = editor?.view?.dom;
    if (el && fontSize) el.style.fontSize = fontSize;
  }, [editor, fontSize]);

  // Show spinner while Yjs is syncing (only when a ydoc is expected)
  if (!synced) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-[var(--theme-text-soft)]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--color-terracotta)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-sm">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`lekhak-editor-wrap ${className}`}>
      <EditorContent editor={editor} />
    </div>
  );
});

export default LekhakEditor;
