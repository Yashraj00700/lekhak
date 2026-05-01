/**
 * EditorToolbar — TipTap formatting toolbar.
 *
 * Provides: Bold, Italic, Underline, Headings (H1/H2/H3),
 * Blockquote, Bullet list, Numbered list, Align, Undo/Redo.
 * Adapts to the current theme automatically via CSS variables.
 */

import {
  Bold, Italic, UnderlineIcon, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, AlignLeft, AlignCenter, AlignRight,
  Undo2, Redo2, Image as ImageIcon,
} from 'lucide-react';

function ToolBtn({ onClick, active, disabled, title, children }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick?.(); }}
      disabled={disabled}
      title={title}
      className={
        'w-9 h-9 flex items-center justify-center rounded-[7px] transition-colors flex-shrink-0 ' +
        (active
          ? 'bg-[var(--color-terracotta)] text-[var(--color-cream)]'
          : 'text-[var(--theme-text)] hover:bg-[rgba(196,98,45,0.12)] disabled:opacity-30')
      }
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-[var(--theme-border)] mx-0.5 flex-shrink-0" />;
}

const FONT_OPTIONS = [
  { label: 'Tiro', value: "'Tiro Devanagari Marathi', serif" },
  { label: 'Noto', value: "'Noto Serif Devanagari', serif" },
  { label: 'Mukta', value: "'Mukta', sans-serif" },
  { label: 'Eczar', value: "'Eczar', serif" },
  { label: 'Kalam', value: "'Kalam', cursive" },
  { label: 'Rozha', value: "'Rozha One', serif" },
  { label: 'Hind', value: "'Hind', sans-serif" },
];

export default function EditorToolbar({ editor, fontFamily, onFontChange, onInsertImage }) {
  if (!editor) return null;

  return (
    <div className="editor-toolbar flex items-center gap-0.5 px-2 py-1.5 overflow-x-auto no-scrollbar flex-wrap">
      {/* Undo / Redo */}
      <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Undo" disabled={!editor.can().undo()}>
        <Undo2 size={16} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Redo" disabled={!editor.can().redo()}>
        <Redo2 size={16} />
      </ToolBtn>

      <Divider />

      {/* Headings */}
      <ToolBtn
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <Heading1 size={16} />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <Heading2 size={16} />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        <Heading3 size={16} />
      </ToolBtn>

      <Divider />

      {/* Text style */}
      <ToolBtn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold"
      >
        <Bold size={16} />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic"
      >
        <Italic size={16} />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        title="Underline"
      >
        <UnderlineIcon size={16} />
      </ToolBtn>

      <Divider />

      {/* Lists */}
      <ToolBtn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Bullet list"
      >
        <List size={16} />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Numbered list"
      >
        <ListOrdered size={16} />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Quote"
      >
        <Quote size={16} />
      </ToolBtn>

      <Divider />

      {/* Alignment */}
      <ToolBtn
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        active={editor.isActive({ textAlign: 'left' })}
        title="Align left"
      >
        <AlignLeft size={16} />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        active={editor.isActive({ textAlign: 'center' })}
        title="Centre"
      >
        <AlignCenter size={16} />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        active={editor.isActive({ textAlign: 'right' })}
        title="Align right"
      >
        <AlignRight size={16} />
      </ToolBtn>

      <Divider />

      {/* Insert image */}
      {onInsertImage && (
        <ToolBtn onClick={onInsertImage} title="Insert image">
          <ImageIcon size={16} />
        </ToolBtn>
      )}

      {/* Font picker */}
      <div className="flex-shrink-0 ml-1">
        <select
          value={fontFamily || FONT_OPTIONS[0].value}
          onChange={(e) => onFontChange?.(e.target.value)}
          className="h-8 px-2 text-xs rounded-[7px] border border-[var(--theme-border)] bg-[var(--theme-bg-input)] text-[var(--theme-text)] cursor-pointer"
          title="Font family"
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.label} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
