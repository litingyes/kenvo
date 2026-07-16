import { ask } from '@tauri-apps/plugin-dialog'
import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'
import { toast } from 'sonner'

import i18n from '@/lib/i18n'

export async function checkForUpdate(options: { silent?: boolean } = {}): Promise<void> {
  const { silent = false } = options
  const t = i18n.t.bind(i18n)

  let update: Awaited<ReturnType<typeof check>>
  try {
    update = await check()
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

  const shouldDownload = await ask(t('updater.availableMessage', { version: update.version }), {
    title: t('updater.availableTitle'),
    kind: 'info',
    okLabel: t('updater.updateNow'),
    cancelLabel: t('updater.later'),
  })
  if (!shouldDownload) {
    return
  }

  const toastId = toast.loading(t('updater.downloading', { progress: 0 }))
  let downloaded = 0
  let total = 0

  try {
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          total = event.data.contentLength ?? 0
          break
        case 'Progress':
          downloaded += event.data.chunkLength
          if (total > 0) {
            const progress = Math.min(100, Math.round((downloaded / total) * 100))
            toast.loading(t('updater.downloading', { progress }), { id: toastId })
          }
          break
        case 'Finished':
          break
      }
    })
  } catch (error) {
    console.error('update install failed:', error)
    toast.error(t('updater.installFailed'), { id: toastId })
    return
  }

  toast.dismiss(toastId)
  const shouldRelaunch = await ask(t('updater.readyMessage'), {
    title: t('updater.readyTitle'),
    kind: 'info',
    okLabel: t('updater.restartNow'),
    cancelLabel: t('updater.later'),
  })
  if (shouldRelaunch) {
    await relaunch()
  }
}
