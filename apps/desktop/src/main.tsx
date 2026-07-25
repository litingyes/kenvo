import { RouterProvider, createRouter, createHashHistory } from '@tanstack/react-router'
import ReactDOM from 'react-dom/client'

import { listen, IPC_CHANNELS } from '@/lib/electron/api'
import { initializeI18n } from '@/lib/i18n'
import { initErrorLogging } from '@/lib/logger'

import { routeTree } from './routeTree.gen'

import './root.css'

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  history: createHashHistory(),
})

listen(IPC_CHANNELS.NAVIGATE, ({ path }: { path: string }) => {
  router.navigate({ to: path }).catch(console.error)
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

async function bootstrap() {
  initErrorLogging()
  await initializeI18n()

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <RouterProvider router={router} />,
  )
}

bootstrap().catch(console.error)
