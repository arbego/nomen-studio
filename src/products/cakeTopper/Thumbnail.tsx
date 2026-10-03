/** A script word on picks, as it stands in the cake. */
export function CakeTopperThumbnail() {
  return (
    <svg viewBox="0 0 120 80" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      {/* the word */}
      <path d="M22 34c4-10 7-12 9-4s4 10 7 2 5-9 7-1 3 9 6 3" />
      <path d="M58 32c5-6 9-4 7 2s-6 7-8 3 2-9 8-9" />
      <path d="M78 22c2 10 2 16 1 22" />
      <path d="M72 30h12" />
      <path d="M92 28c4-2 7 1 5 5s-6 4-7 0 3-6 7-4" />
      {/* picks */}
      <path d="M44 42v26" />
      <path d="M80 42v26" />
    </svg>
  );
}
