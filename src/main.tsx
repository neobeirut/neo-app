import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../web/src/index.css'
import AdminPage from '../web/src/app/admin/page.jsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminPage />
  </StrictMode>,
)

