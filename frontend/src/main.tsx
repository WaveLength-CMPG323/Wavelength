import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { DataProvider } from './data/DataContext.tsx'
import { AuthProvider } from './data/AuthContext.tsx'
import { ChatProvider } from './data/ChatContext.tsx'
import { CosmeticsProvider } from './data/CosmeticsContext.tsx'
import { ThemeProvider } from './data/ThemeContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <DataProvider>
            <ChatProvider>
              <CosmeticsProvider>
                <App />
              </CosmeticsProvider>
            </ChatProvider>
          </DataProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
