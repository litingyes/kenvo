import React from 'react'
import ReactDOM from 'react-dom/client'

import { TooltipProvider } from '@/components/ui/tooltip'

import './root.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </React.StrictMode>,
)
