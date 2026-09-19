import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

export default function SaveThemeDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState('');
  const saveCurrentTheme = useStore((s) => s.saveCurrentTheme);

  useEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="modal save-theme-dialog"
      aria-labelledby="save-theme-title"
      onCancel={onClose}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          saveCurrentTheme(name);
          onClose();
        }}
      >
        <div className="modal-header">
          <span id="save-theme-title">Save new theme</span>
          <button type="button" className="close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-body">
          <label htmlFor="saved-theme-name">Theme name</label>
          <input
            id="saved-theme-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My custom theme"
            required
            autoFocus
          />
        </div>
        <div className="modal-footer">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={!name.trim()}>Save</button>
        </div>
      </form>
    </dialog>
  );
}
