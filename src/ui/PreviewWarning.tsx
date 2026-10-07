interface PreviewWarningProps {
  message: string;
  remedy?: string;
}

/** A design warning in the preview's shared bottom-right warning area. */
export function PreviewWarning({ message, remedy }: PreviewWarningProps) {
  return (
    // Polite: these messages change while dragging and should not interrupt a screen reader.
    <div role="status" className="max-w-72 rounded-lg border border-amber-300 dark:border-amber-700/70 bg-amber-50/95 dark:bg-amber-950/90 px-3 py-2 text-left shadow-md backdrop-blur">
      <p className="flex items-start gap-2 text-xs font-medium text-amber-900 dark:text-amber-200">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="mt-px h-4 w-4 shrink-0">
          <path d="M10.3 3.9 1.8 18.4A2 2 0 0 0 3.5 21.4h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
        <span>{message}</span>
      </p>
      {remedy && <p className="mt-1 pl-6 text-xs text-amber-800/80 dark:text-amber-200/70">{remedy}</p>}
    </div>
  );
}
