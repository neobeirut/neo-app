import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css'
import HomePage from '@/app/page.jsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HomePage />
  </StrictMode>,
)
