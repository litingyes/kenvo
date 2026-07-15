import { RouterProvider, createRouter, createBrowserHistory } from '@tanstack/react-router'
import ReactDOM from 'react-dom/client'

import { initializeI18n } from '@/lib/i18n'

import { routeTree } from './routeTree.gen'

import './root.css'

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  history: createBrowserHistory(),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

async function bootstrap() {
  await initializeI18n()

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <RouterProvider router={router} />,
  )
}

bootstrap().catch(console.error)
