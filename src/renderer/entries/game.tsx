import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/press-start-2p'
import '../styles/global.css'
import { GameApp } from '../features/games/GameApp'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <GameApp />
  </StrictMode>
)

console.log('VibeDuck game renderer mounted')
