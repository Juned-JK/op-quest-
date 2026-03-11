import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { WalletConnectProvider } from '@btc-vision/walletconnect';
import './index.css';
import App from './App';

// ── Cursor glow effect ────────────────────────────────────────────────────
// Uses transform: translate (GPU-accelerated) instead of updating gradient
// background-position, so the transition is smooth with zero React overhead.
let glowRaf: number | null = null;

document.addEventListener('mousemove', (e) => {
  document.body.classList.add('cursor-active');
  if (glowRaf !== null) cancelAnimationFrame(glowRaf);
  glowRaf = requestAnimationFrame(() => {
    document.documentElement.style.setProperty('--cursor-x', `${e.clientX}px`);
    document.documentElement.style.setProperty('--cursor-y', `${e.clientY}px`);
    glowRaf = null;
  });
});

document.addEventListener('mouseleave', () => {
  document.body.classList.remove('cursor-active');
});
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <WalletConnectProvider theme="dark">
        <App />
      </WalletConnectProvider>
    </HashRouter>
  </StrictMode>,
);
