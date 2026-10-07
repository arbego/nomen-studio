import { PreviewToggleButton } from '../../ui/PreviewToggleButton';
import { useNameDisplayStore } from './store';

export function LidPreviewButton() {
  const hollowEnabled = useNameDisplayStore((state) => state.hollowEnabled);
  const lidTransparent = useNameDisplayStore((state) => state.lidTransparent);
  const setLidTransparent = useNameDisplayStore((state) => state.setLidTransparent);
  if (!hollowEnabled) return null;

  return (
    <PreviewToggleButton active={lidTransparent} onClick={() => setLidTransparent(!lidTransparent)}
      label={lidTransparent ? 'Make lid opaque' : 'Make lid 90% transparent'}
      title={lidTransparent ? 'Lid 90% transparent' : 'Lid opaque'}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="m3 8 9-4 9 4-9 4-9-4Z" strokeDasharray={lidTransparent ? '2 2' : undefined} />
        <path d="M3 13v4l9 4 9-4v-4M12 16v5" />
      </svg>
    </PreviewToggleButton>
  );
}
