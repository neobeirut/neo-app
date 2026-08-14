import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../web/src/index.css'
import HomePage from '../web/src/app/page.jsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HomePage />
  </StrictMode>,
)
