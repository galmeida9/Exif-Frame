import { useStore } from '../store';

type Props = {
  photoCount: number;
  selected: { width: number; height: number; filename: string } | null;
  statusKind: 'idle' | 'busy' | 'error';
  statusText: string;
};

export default function StatusBar({ photoCount, selected, statusKind, statusText }: Props) {
  const format = useStore((s) => s.format);
  const quality = useStore((s) => s.quality);
  const imageWidth = useStore((s) => s.imageWidth);
  const fixImageWidth = useStore((s) => s.fixImageWidth);

  const formatLabel = format === 'image/jpeg' ? 'JPEG' : format === 'image/png' ? 'PNG' : 'WebP';
  return (
    <div className="status-bar">
      <span>
        <span className={`status-dot ${statusKind}`} />
        {statusText}
      </span>
      <span style={{ color: 'var(--border-strong)' }}>·</span>
      <span>
        {photoCount} photo{photoCount === 1 ? '' : 's'}
      </span>
      {selected && (
        <>
          <span style={{ color: 'var(--border-strong)' }}>·</span>
          <span>
            {selected.filename} · {selected.width}×{selected.height}
          </span>
        </>
      )}
      <span className="spacer" />
      <span>
        {formatLabel} q{quality} · {fixImageWidth ? `${imageWidth}px wide` : 'original size'}
      </span>
    </div>
  );
}
