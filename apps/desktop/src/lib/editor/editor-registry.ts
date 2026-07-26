import { api } from '@/lib/electron/api'

import { monaco } from './monaco-setup'

const editors = new Map<string, monaco.editor.IStandaloneCodeEditor>()
const models = new Map<string, monaco.editor.ITextModel>()
const originalContent = new Map<string, string>()

export function createFileEditorModel(
  tabId: string,
  filePath: string,
  content: string,
  language?: string,
): monaco.editor.ITextModel {
  disposeFileEditor(tabId)
  const model = monaco.editor.createModel(content, language, monaco.Uri.file(filePath))
  models.set(tabId, model)
  originalContent.set(tabId, content)
  return model
}

export function registerFileEditor(
  tabId: string,
  editor: monaco.editor.IStandaloneCodeEditor,
): void {
  editors.set(tabId, editor)
}

export function getFileEditor(tabId: string): monaco.editor.IStandaloneCodeEditor | undefined {
  return editors.get(tabId)
}

export function getFileEditorModel(tabId: string): monaco.editor.ITextModel | undefined {
  return models.get(tabId)
}

export function getFileEditorValue(tabId: string): string | undefined {
  return models.get(tabId)?.getValue()
}

export function setFileEditorValue(tabId: string, content: string): void {
  const model = models.get(tabId)
  if (!model) return
  model.setValue(content)
  originalContent.set(tabId, content)
}

export function isFileEditorDirty(tabId: string): boolean {
  const model = models.get(tabId)
  if (!model) return false
  return model.getValue() !== (originalContent.get(tabId) ?? '')
}

export function markFileEditorClean(tabId: string): void {
  const model = models.get(tabId)
  if (model) {
    originalContent.set(tabId, model.getValue())
  }
}

export async function saveFileEditor(tabId: string, filePath: string): Promise<void> {
  const value = getFileEditorValue(tabId)
  if (value === undefined) return
  await api.fs.writeTextFile(filePath, value)
  markFileEditorClean(tabId)
}

export function disposeFileEditor(tabId: string): void {
  const editor = editors.get(tabId)
  if (editor) {
    editor.dispose()
    editors.delete(tabId)
  }
  const model = models.get(tabId)
  if (model) {
    model.dispose()
    models.delete(tabId)
  }
  originalContent.delete(tabId)
}
