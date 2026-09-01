import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'
import { Markdown } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'

/**
 * One schema for parsing, Visual editing, and future read-only rendering.
 * Markdown remains the persisted format; this array only defines the in-memory
 * document model used by Tiptap.
 */
export const markdownExtensions = [
  StarterKit.configure({ link: false }),
  Link.configure({ openOnClick: false }),
  Image.configure({ allowBase64: false }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TableKit,
  Markdown.configure({
    markedOptions: {
      gfm: true,
      breaks: false,
    },
  }),
]
