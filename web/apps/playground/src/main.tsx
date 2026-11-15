import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  TradingWidget,
  type Theme,
} from '@elkhanmursalov/crypto-trading-widget';
// Same import a Next.js app will use.
import '@elkhanmursalov/crypto-trading-widget/style.css';
import './playground.css';

function Playground() {
  const [theme, setTheme] = useState<Theme>('light');

  return (
    <main className="page" data-theme={theme}>
      <div className="controls">
        <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
          {theme === 'light' ? 'Dark' : 'Light'} theme
        </button>
      </div>
      <TradingWidget theme={theme} apiBaseUrl={import.meta.env.VITE_API_URL} />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Playground />
  </StrictMode>,
);
