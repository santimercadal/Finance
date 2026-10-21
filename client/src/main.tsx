import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import PrefsProvider from './components/PrefsProvider'
import { registerSW } from 'virtual:pwa-register'

// Installs the service worker; after a deploy the new version takes over and
// the page reloads once so it never mixes old and new code.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PrefsProvider>
        <App />
      </PrefsProvider>
    </BrowserRouter>
  </StrictMode>,
)
