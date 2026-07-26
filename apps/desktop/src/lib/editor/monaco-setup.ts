import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/editor/editor.worker?worker'
import 'monaco-editor/language/css/monaco.contribution'
import cssWorker from 'monaco-editor/language/css/css.worker?worker'
import 'monaco-editor/language/html/monaco.contribution'
import htmlWorker from 'monaco-editor/language/html/html.worker?worker'
import 'monaco-editor/language/json/monaco.contribution'
import jsonWorker from 'monaco-editor/language/json/json.worker?worker'
import {
  javascriptDefaults,
  typescriptDefaults,
} from 'monaco-editor/language/typescript/monaco.contribution'
import tsWorker from 'monaco-editor/language/typescript/ts.worker?worker'

const monacoSelf = self as unknown as Window & {
  MonacoEnvironment?: monaco.Environment
}

if (!monacoSelf.MonacoEnvironment) {
  monacoSelf.MonacoEnvironment = {
    getWorker(_, label) {
      if (label === 'json') {
        return new jsonWorker()
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return new cssWorker()
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new htmlWorker()
      }
      if (label === 'typescript' || label === 'javascript') {
        return new tsWorker()
      }
      return new editorWorker()
    },
  }

  typescriptDefaults.setEagerModelSync(true)
  javascriptDefaults.setEagerModelSync(true)
}

function cssVar(name: string, fallback = '#000000'): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function addAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const normalized =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')
  // Monaco theme colors only accept #RRGGBB or #RRGGBBAA, not rgba().
  return `#${normalized}${a}`
}

function buildKenvoTheme(dark: boolean): monaco.editor.IStandaloneThemeData {
  const bg = cssVar('--background')
  const fg = cssVar('--foreground')
  const muted = cssVar('--muted')
  const mutedFg = cssVar('--muted-foreground')
  const primary = cssVar('--primary')
  const accent = cssVar('--accent')
  const accentFg = cssVar('--accent-foreground')
  const border = cssVar('--border')
  const popover = cssVar('--popover')
  const popoverFg = cssVar('--popover-foreground')
  const input = cssVar('--input')
  const primaryFg = cssVar('--primary-foreground')
  const destructive = cssVar('--destructive')

  return {
    base: dark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: mutedFg.replace('#', '') },
      { token: 'keyword', foreground: primary.replace('#', '') },
      { token: 'string', foreground: accentFg.replace('#', '') },
      { token: 'number', foreground: destructive.replace('#', '') },
    ],
    colors: {
      'editor.background': bg,
      'editor.foreground': fg,

      'editorLineNumber.foreground': mutedFg,
      'editorLineNumber.activeForeground': fg,

      'editor.selectionBackground': addAlpha(primary, 0.25),
      'editor.inactiveSelectionBackground': addAlpha(primary, 0.15),
      'editor.selectionHighlightBackground': addAlpha(primary, 0.2),
      'editor.wordHighlightBackground': addAlpha(primary, 0.15),
      'editor.wordHighlightStrongBackground': addAlpha(primary, 0.25),

      'editor.lineHighlightBackground': addAlpha(muted, 0.4),
      'editorCursor.foreground': fg,
      'editorWhitespace.foreground': addAlpha(mutedFg, 0.4),
      'editorIndentGuide.background': border,
      'editorIndentGuide.activeBackground': primary,
      'editor.lineHighlightBorder': addAlpha(border, 0),

      'editor.findMatchBackground': addAlpha(primary, 0.4),
      'editor.findMatchHighlightBackground': addAlpha(primary, 0.25),
      'editor.findRangeHighlightBackground': addAlpha(primary, 0.15),

      'editorHoverWidget.background': popover,
      'editorHoverWidget.foreground': popoverFg,
      'editorHoverWidget.border': border,

      'editorSuggestWidget.background': popover,
      'editorSuggestWidget.foreground': popoverFg,
      'editorSuggestWidget.border': border,
      'editorSuggestWidget.highlightForeground': primary,
      'editorSuggestWidget.selectedBackground': accent,
      'editorSuggestWidget.selectedForeground': accentFg,
      'editorSuggestWidget.focusHighlightForeground': primary,

      'editorWidget.background': popover,
      'editorWidget.foreground': popoverFg,
      'editorWidget.border': border,

      'input.background': input,
      'input.foreground': fg,
      'input.border': border,
      'inputOption.activeBorder': primary,
      'inputOption.activeBackground': addAlpha(primary, 0.2),
      'inputOption.activeForeground': fg,

      'list.activeSelectionBackground': accent,
      'list.activeSelectionForeground': accentFg,
      'list.inactiveSelectionBackground': addAlpha(accent, 0.5),
      'list.hoverBackground': muted,
      'list.hoverForeground': fg,
      'list.focusBackground': accent,
      'list.focusForeground': accentFg,

      'badge.background': primary,
      'badge.foreground': primaryFg,

      'scrollbarSlider.background': addAlpha(mutedFg, 0.4),
      'scrollbarSlider.hoverBackground': addAlpha(mutedFg, 0.6),
      'scrollbarSlider.activeBackground': addAlpha(primary, 0.6),

      'minimap.background': addAlpha(muted, 0.3),

      'widget.shadow': addAlpha(fg, 0.08),
      focusBorder: primary,
      foreground: fg,
    },
  }
}

// Rebuild the theme from the live CSS variables on every call: the values
// differ between light and dark mode, and defineTheme captures them eagerly.
export function updateMonacoTheme(): void {
  const isDark = document.documentElement.classList.contains('dark')
  monaco.editor.defineTheme('kenvo', buildKenvoTheme(isDark))
  monaco.editor.setTheme('kenvo')
}

// next-themes applies the `dark` class to <html> inside a parent useEffect, so
// React effect ordering makes child effects (e.g. FileEditor) run before the
// class and CSS variables have actually updated. Observe the class attribute
// directly instead; by the time the mutation fires, the CSS variables are live.
new MutationObserver(() => updateMonacoTheme()).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['class'],
})

export { monaco }
