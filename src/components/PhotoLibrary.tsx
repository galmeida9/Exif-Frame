import { useState, useRef } from 'react';
import type Photo from '../core/drawing/Photo';

type Props = {
  photos: Photo[];
  selectedIndex: number | null;
  loading: boolean;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  onAdd: () => void;
  onFilesDropped: (files: File[]) => void;
  onOverride: (index: number) => void;
};

const IMAGE_TYPE_RE = /^image\//;

export default function PhotoLibrary({
  photos,
  selectedIndex,
  loading,
  onSelect,
  onRemove,
  onClear,
  onAdd,
  onFilesDropped,
  onOverride,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const dragCount = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCount.current++;
    setDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCount.current--;
    if (dragCount.current <= 0) setDragOver(false);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCount.current = 0;
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => IMAGE_TYPE_RE.test(f.type) || /\.(jpe?g|png|webp|tiff?|heic|heif|bmp)$/i.test(f.name));
    if (files.length > 0) onFilesDropped(files);
  };

  return (
    <div
      className="photo-library"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="header">
        <span>Photos</span>
        <span className="count">{photos.length}</span>
      </div>

      <div className="list">
        {photos.length === 0 ? (
          <div className={`empty${dragOver ? ' drag-over' : ''}`}>
            {loading ? 'Loading…' : <>Drag photos here<br />or click <b>Open</b></>}
          </div>
        ) : (
          photos.map((p, i) => (
            <div
              key={p.id}
              className={`item${i === selectedIndex ? ' selected' : ''}`}
              onClick={() => onSelect(i)}
              onContextMenu={(e) => {
                e.preventDefault();
                onOverride(i);
              }}
              title={`${p.file.name}\n${p.image.width}×${p.image.height}\nRight-click to override metadata`}
            >
              <img className="thumb" src={p.thumbnail} alt="" loading="lazy" />
              <div className="info">
                <div className="filename">{p.file.name}</div>
                <div className="meta">
                  {p.metadata.make || ''} {p.metadata.model || ''}
                  {p.metadata.iso ? ` · ${p.metadata.iso}` : ''}
                </div>
              </div>
              <button
                className="remove"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(i);
                }}
                title="Remove"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <div className="footer">
        <button onClick={onAdd} title="Add more photos">
          + Add
        </button>
        <button onClick={onClear} disabled={photos.length === 0} title="Remove all photos">
          Clear
        </button>
      </div>
    </div>
  );
}
