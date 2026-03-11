import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react';
import { Avatar } from './Avatar';
import { resizeImageToDataUrl } from '../utils/image';

interface SettingsProps {
  isConnected: boolean;
  walletAddress: string | null;
  displayName: string;
  avatar: string;
  onSave: (name: string) => void;
  onClear: () => void;
  onSaveAvatar: (dataUrl: string) => void;
  onClearAvatar: () => void;
}

export function Settings({
  isConnected,
  walletAddress,
  displayName,
  avatar,
  onSave,
  onClear,
  onSaveAvatar,
  onClearAvatar,
}: SettingsProps) {
  const [nameInput, setNameInput] = useState(displayName);
  const [nameSaved, setNameSaved] = useState(false);

  const [preview, setPreview] = useState<string>('');   // selected but not yet saved
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync name input when wallet switches
  useEffect(() => {
    setNameInput(displayName);
    setPreview('');
    setUploadError('');
  }, [walletAddress, displayName]);

  if (!isConnected) return null;

  /* ── name helpers ── */
  const nameDirty = nameInput.trim() !== displayName;
  const canSaveName = nameDirty && nameInput.trim().length > 0;

  const handleNameSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSaveName) return;
    onSave(nameInput.trim());
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

  /* ── avatar helpers ── */
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
      setUploadError('Could not process image. Please try another file.');
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSaveAvatar = () => {
    if (!preview) return;
    onSaveAvatar(preview);
    setPreview('');
  };

  const handleCancelPreview = () => {
    setPreview('');
    setUploadError('');
  };

  const handleRemoveAvatar = () => {
    onClearAvatar();
    setPreview('');
  };

  const displayedAvatar = preview || avatar;
  const creatorName = displayName || 'You';

  return (
    <div className="settings-card">
      <div className="settings-header">
        <h3 className="settings-title">Your Profile</h3>
      </div>

      {/* ── Avatar section ── */}
      <div className="avatar-section">
        <div className="avatar-preview-wrap">
          <Avatar
            createdBy={walletAddress ?? ''}
            name={creatorName}
            avatarUrl={displayedAvatar || undefined}
            size="lg"
          />
          {preview && (
            <span className="avatar-preview-badge">Preview</span>
          )}
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
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSaveAvatar}
              >
                Save Photo
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleCancelPreview}
              >
                Cancel
              </button>
            </>
          )}

          {avatar && !preview && (
            <button
              type="button"
              className="btn btn-ghost btn-sm avatar-remove"
              onClick={handleRemoveAvatar}
            >
              Remove
            </button>
          )}
        </div>

        {uploadError && <p className="quest-error">{uploadError}</p>}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="avatar-file-input"
          onChange={handleFileChange}
        />
      </div>

      {/* ── Display name section ── */}
      <form className="settings-form" onSubmit={handleNameSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="display-name">
            Display Name
          </label>
          <input
            id="display-name"
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
              onClick={() => { onClear(); setNameInput(''); }}
            >
              Clear
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
