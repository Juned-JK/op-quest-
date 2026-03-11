import { useRef, useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { resizeImageToDataUrl } from '../utils/image';
import type { Quest } from '../types/quest';

interface ProfilePageProps {
  walletAddress: string | null;
  isConnected: boolean;
  displayName: string;
  avatar: string;
  quests: Quest[];
  isCompleted: (questId: string, walletAddress: string | null) => boolean;
  onSaveName: (name: string) => void;
  onClearName: () => void;
  onSaveAvatar: (dataUrl: string) => void;
  onClearAvatar: () => void;
}

function shortAddress(addr: string) {
  return `${addr.slice(0, 10)}…${addr.slice(-8)}`;
}

export function ProfilePage({
  walletAddress,
  isConnected,
  displayName,
  avatar,
  quests,
  isCompleted,
  onSaveName,
  onClearName,
  onSaveAvatar,
  onClearAvatar,
}: ProfilePageProps) {
  const navigate = useNavigate();

  // Redirect to home if wallet disconnects while on this page
  useEffect(() => {
    if (!isConnected) navigate('/', { replace: true });
  }, [isConnected, navigate]);

  /* ── name state ── */
  const [nameInput, setNameInput] = useState(displayName);
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => {
    setNameInput(displayName);
  }, [walletAddress, displayName]);

  const nameDirty = nameInput.trim() !== displayName;
  const canSaveName = nameDirty && nameInput.trim().length > 0;

  const handleNameSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSaveName) return;
    onSaveName(nameInput.trim());
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

  /* ── avatar state ── */
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    setPreview('');
    setUploadError('');
  }, [walletAddress]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file.');
      return;
    }
    setUploadError('');
    setUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 256, 0.82);
      setPreview(dataUrl);
    } catch {
      setUploadError('Could not process image. Try another file.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSaveAvatar = () => {
    if (!preview) return;
    onSaveAvatar(preview);
    setPreview('');
  };

  /* ── copy address ── */
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  /* ── stats ── */
  const questsCreated = quests.filter((q) => q.createdBy === walletAddress).length;
  const questsCompleted = quests.filter((q) => isCompleted(q.id, walletAddress)).length;

  if (!walletAddress) return null;

  const displayedName = displayName || shortAddress(walletAddress);
  const displayedAvatar = preview || avatar;

  return (
    <main className="app-main">
      <Link to="/" className="back-link">← Back to Home</Link>

      {/* ── Profile hero ── */}
      <div className="profile-hero">
        <div className="profile-avatar-wrap">
          <Avatar
            createdBy={walletAddress}
            name={displayedName}
            avatarUrl={displayedAvatar || undefined}
            size="xl"
          />
          {preview && <span className="avatar-preview-badge">Preview</span>}
          <button
            className="avatar-edit-trigger"
            onClick={() => fileRef.current?.click()}
            title="Change profile photo"
            disabled={uploading}
          >
            ✏
          </button>
        </div>

        <div className="profile-identity">
          <h1 className="profile-name">{displayedName}</h1>
          <div className="profile-wallet-row">
            <code className="profile-wallet-address">{walletAddress}</code>
            <button className="btn-copy" onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="profile-stats">
        <div className="profile-stat-card">
          <span className="profile-stat-value">{questsCreated}</span>
          <span className="profile-stat-label">Quests Created</span>
        </div>
        <div className="profile-stat-card">
          <span className="profile-stat-value">{questsCompleted}</span>
          <span className="profile-stat-label">Quests Completed</span>
        </div>
        <div className="profile-stat-card">
          <span className="profile-stat-value">{quests.length}</span>
          <span className="profile-stat-label">Total Quests</span>
        </div>
      </div>

      <div className="profile-divider" />

      {/* ── Edit grid ── */}
      <div className="profile-edit-grid">

        {/* Avatar card */}
        <div className="profile-edit-card">
          <h2 className="profile-edit-title">Profile Photo</h2>

          <div className="avatar-section">
            <div className="avatar-preview-wrap">
              <Avatar
                createdBy={walletAddress}
                name={displayedName}
                avatarUrl={displayedAvatar || undefined}
                size="lg"
              />
              {preview && <span className="avatar-preview-badge">Preview</span>}
            </div>

            <div className="avatar-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Processing…' : avatar ? 'Change Photo' : 'Upload Photo'}
              </button>

              {preview && (
                <>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveAvatar}>
                    Save Photo
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setPreview(''); setUploadError(''); }}
                  >
                    Cancel
                  </button>
                </>
              )}

              {avatar && !preview && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm avatar-remove"
                  onClick={() => { onClearAvatar(); setPreview(''); }}
                >
                  Remove
                </button>
              )}
            </div>

            {uploadError && <p className="quest-error">{uploadError}</p>}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="avatar-file-input"
            onChange={handleFileChange}
          />
        </div>

        {/* Name card */}
        <div className="profile-edit-card">
          <h2 className="profile-edit-title">Display Name</h2>
          <p className="profile-edit-sub">
            This name appears on your quests and creator page.
          </p>

          <form className="settings-form" onSubmit={handleNameSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="profile-name-input">
                Name
              </label>
              <input
                id="profile-name-input"
                className="form-input"
                type="text"
                placeholder="e.g. John"
                value={nameInput}
                onChange={(e) => { setNameInput(e.target.value); setNameSaved(false); }}
                maxLength={32}
                autoComplete="off"
              />
            </div>

            <div className="settings-actions">
              <button
                type="submit"
                className="btn btn-primary btn-sm settings-save"
                disabled={!canSaveName}
              >
                {nameSaved ? '✓ Saved!' : 'Save Name'}
              </button>
              {displayName && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => { onClearName(); setNameInput(''); }}
                >
                  Clear
                </button>
              )}
            </div>
          </form>
        </div>

      </div>
    </main>
  );
}
