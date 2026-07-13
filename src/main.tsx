import { RouterProvider, createRouter, createBrowserHistory } from '@tanstack/react-router'
import ReactDOM from 'react-dom/client'

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

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <RouterProvider router={router} />,
)
