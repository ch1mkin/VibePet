import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/press-start-2p'
import '../styles/global.css'
import { DuckApp } from '../components/DuckApp'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <DuckApp />
  </StrictMode>
)

console.log('VibeDuck duck renderer mounted')
