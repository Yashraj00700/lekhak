/**
 * LekhakEditor — TipTap rich-text editor with Yjs CRDT autosave.
 *
 * Features:
 * - Full Marathi/Devanagari text support
 * - Inline image blocks with drag & drop
 * - Heading, bold, italic, underline, blockquote, lists
 * - Character count via TipTap extension
 * - Yjs collaboration provider for bulletproof autosave
 * - Placeholder text in Marathi / English
 * - Custom font family support
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
    className = '',
    readOnly = false,
  },
  ref
) {
  const { t } = useLanguage();
  const editorRef = useRef(null);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          // Disable history — Yjs handles undo/redo
          history: false,
        }),
        Placeholder.configure({
          placeholder: t('editor.bodyPlaceholder'),
          emptyEditorClass: 'is-editor-empty',
        }),
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        Underline,
        TextStyle,
        CharacterCount,
        ImageExtension.configure({
          inline: false,
          allowBase64: true,
          HTMLAttributes: {
            class: 'lekhak-image',
          },
        }),
        // Yjs collaboration — binds the editor to the Y.XmlFragment
        ...(ydoc
          ? [
              Collaboration.configure({
                document: ydoc,
                field: 'default',
              }),
            ]
          : []),
      ],
      editable: !readOnly,
      autofocus: !readOnly ? 'end' : false,
      editorProps: {
        attributes: {
          class: 'lekhak-editor ProseMirror',
          spellcheck: 'false', // we handle spellcheck ourselves
          lang: 'mr',
        },
      },
      onUpdate({ editor }) {
        if (onWordCount) {
          const words = editor.storage.characterCount?.words?.() ?? 0;
          onWordCount(words);
        }
      },
      onSelectionUpdate({ editor }) {
        if (onSelectionText) {
          const { from, to } = editor.state.selection;
          const text = from === to ? '' : editor.state.doc.textBetween(from, to, ' ');
          onSelectionText(text);
        }
      },
    },
    // Re-create editor when ydoc changes (new chapter)
    [ydoc]
  );

  editorRef.current = editor;

  // Expose editor instance to parent via ref
  useImperativeHandle(ref, () => ({
    getEditor: () => editorRef.current,
    insertText: (text) => {
      const ed = editorRef.current;
      if (!ed) return;
      ed.chain().focus().insertContent(text).run();
    },
    insertImage: (src, alt = '') => {
      const ed = editorRef.current;
      if (!ed) return;
      ed.chain().focus().setImage({ src, alt }).run();
    },
    getPlainText: () => {
      const ed = editorRef.current;
      if (!ed) return '';
      return ed.getText();
    },
    getWordCount: () => {
      const ed = editorRef.current;
      if (!ed) return 0;
      return ed.storage.characterCount?.words?.() ?? 0;
    },
    focus: () => editorRef.current?.commands.focus('end'),
  }));

  // Apply font family CSS to the editor element
  useEffect(() => {
    if (!editor) return;
    const el = editor.view?.dom;
    if (el && fontFamily) {
      el.style.fontFamily = fontFamily;
    }
  }, [editor, fontFamily]);

  // Apply font size
  useEffect(() => {
    if (!editor) return;
    const el = editor.view?.dom;
    if (el && fontSize) {
      el.style.fontSize = fontSize;
    }
  }, [editor, fontSize]);

  if (!synced && ydoc) {
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
