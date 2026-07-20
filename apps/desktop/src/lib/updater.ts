import { toast } from 'sonner'

import { api } from '@/lib/electron/api'
import i18n from '@/lib/i18n'

export async function checkForUpdate(options: { silent?: boolean } = {}): Promise<void> {
  const { silent = false } = options
  const t = i18n.t.bind(i18n)

  let update: { version: string } | null = null
  try {
    const result = (await api.updater.check()) as { updateInfo: { version: string } } | null
    update = result?.updateInfo ?? null
  } catch (error) {
    console.error('update check failed:', error)
    if (!silent) {
      toast.error(t('updater.checkFailed'))
    }
    return
  }

  if (!update) {
    if (!silent) {
      toast.success(t('updater.upToDate'))
    }
    return
  }

  const result = await api.dialog.showMessageBox({
    message: t('updater.availableMessage', { version: update.version }),
    title: t('updater.availableTitle'),
    type: 'info',
    buttons: [t('updater.updateNow'), t('updater.later')],
    defaultId: 0,
    cancelId: 1,
  })
  if (result.response !== 0) {
    return
  }

  const toastId = toast.loading(t('updater.downloading', { progress: 0 }))

  const unsubscribe = api.updater.onEvent((rawEvent) => {
    const event = rawEvent as { event: string; data?: unknown }
    if (event.event === 'progress') {
      const progress = event.data as { percent?: number }
      const percent = Math.min(100, Math.round(progress.percent ?? 0))
      toast.loading(t('updater.downloading', { progress: percent }), { id: toastId })
    }
  })

  try {
    await api.updater.downloadAndInstall()
  } catch (error) {
    console.error('update install failed:', error)
    unsubscribe()
    toast.error(t('updater.installFailed'), { id: toastId })
    return
  }

  unsubscribe()
  toast.dismiss(toastId)
  const restartResult = await api.dialog.showMessageBox({
    message: t('updater.readyMessage'),
    title: t('updater.readyTitle'),
    type: 'info',
    buttons: [t('updater.restartNow'), t('updater.later')],
    defaultId: 0,
    cancelId: 1,
  })
  if (restartResult.response === 0) {
    await api.app.relaunch()
  }
}
