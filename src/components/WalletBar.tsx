import { Link } from 'react-router-dom';
import { useWalletConnect, SupportedWallets } from '@btc-vision/walletconnect';
import { isAdminWallet } from '../config/admin';
import type { Theme } from '../hooks/useTheme';

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface WalletBarProps {
  avatar?: string;
  theme: Theme;
  onToggleTheme: () => void;
}

// Cycles dark → eye care → light → dark
const THEME_META: Record<Theme, { icon: string; next: string }> = {
  dark:  { icon: '🌿', next: 'Switch to Eye Care theme' },
  eye:   { icon: '☀',  next: 'Switch to Light theme'    },
  light: { icon: '🌙', next: 'Switch to Dark theme'     },
};

export function WalletBar({ avatar, theme, onToggleTheme }: WalletBarProps) {
  const { walletAddress, publicKey, connecting, connectToWallet, disconnect } =
    useWalletConnect();

  const isConnected = publicKey !== null;
  const isAdmin = isAdminWallet(walletAddress);

  const { icon: themeLabel, next: themeTitle } = THEME_META[theme];

  if (isConnected && walletAddress) {
    return (
      <div className="wallet-bar connected">
        {isAdmin && <span className="badge badge-admin">ADMIN</span>}

        <Link to="/profile" className="wallet-identity-link" title="View your profile">
          {avatar ? (
            <img className="wallet-avatar" src={avatar} alt="avatar" />
          ) : (
            <span className="wallet-dot" />
          )}
          <span className="wallet-address">{shortAddress(walletAddress)}</span>
        </Link>

        <div className="wallet-bar-divider" />

        <button className="wallet-disconnect-btn" onClick={disconnect} title="Disconnect wallet">
          Disconnect
        </button>

        <button className="theme-toggle" onClick={onToggleTheme} title={themeTitle} aria-label={themeTitle}>
          {themeLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-bar">
      <button
        className="btn btn-primary btn-connect"
        onClick={() => connectToWallet(SupportedWallets.OP_WALLET)}
        disabled={connecting}
      >
        <span className="btn-connect-icon">⚡</span>
        {connecting ? 'Connecting…' : 'Connect Wallet'}
      </button>

      <button className="theme-toggle" onClick={onToggleTheme} title={themeTitle} aria-label={themeTitle}>
        {themeLabel}
      </button>
    </div>
  );
}
