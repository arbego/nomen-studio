/** A big slab initial with a script name laid across it. */
export function NameDisplayThumbnail() {
  return (
    <svg viewBox="0 0 120 80" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      {/* the background initial */}
      <path d="M38 64V20l22 26 22-26v44" opacity={0.45} />
      {/* the script name across it */}
      <path d="M14 48c3-9 5-10 6-3s3 8 5 1 4-7 5-1 2 8 5 2" />
      <path d="M40 46c4-5 7-3 5 2s-5 5-6 1 2-7 7-7" />
      <path d="M56 38c1 8 1 12 1 16" />
      <path d="M52 44h9" />
      <path d="M66 44c3-2 6 1 4 4s-5 3-6 0 3-5 6-3" />
      <path d="M78 34c1 10 1 15 1 18" />
      <path d="M86 44c3-2 7 0 6 3s-4 4-6 1 2-5 6-4" />
      <path d="M98 42c3-1 6 0 6 3s-3 4-5 2" />
    </svg>
  );
}
