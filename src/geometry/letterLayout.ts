import * as THREE from 'three';
import type { LetterGeometry, TextBlock, Offset2D } from './types';

/** A letter can't be dragged closer than this to its (fixed) left neighbor — keeps a drag from crossing/inverting letters or collapsing them to nothing. */
const MIN_LETTER_GAP_MM = 1;

/**
 * Coerces a (possibly stale — e.g. momentarily out of sync right after the word
 * text changes but before the store's reset lands) gap array to the length a
 * given letter count actually needs, padding with 0 or truncating as needed.
 */
export function normalizedLetterGaps(letterCount: number, letterGapsMm: number[]): number[] {
  const expectedLength = Math.max(letterCount - 1, 0);
  if (letterGapsMm.length === expectedLength) {
    return letterGapsMm;
  }
  const normalized = letterGapsMm.slice(0, expectedLength);
  while (normalized.length < expectedLength) {
    normalized.push(0);
  }
  return normalized;
}

/** Cumulative gap sum before each letter: index i = sum of letterGapsMm[0..i-1]. Always starts at 0 (the first letter has no gap before it to adjust). */
export function cumulativeGaps(letterGapsMm: number[]): number[] {
  const result: number[] = [0];
  let sum = 0;
  for (const gap of letterGapsMm) {
    sum += gap;
    result.push(sum);
  }
  return result;
}

/** Every letter's current rendered x (mm), combining its natural (font-kerning) position with the cumulative effect of every gap override before it. */
export function letterPositionsMm(naturalXsMm: number[], letterGapsMm: number[]): number[] {
  const cumulative = cumulativeGaps(letterGapsMm);
  return naturalXsMm.map((naturalX, i) => naturalX + cumulative[i]);
}

/**
 * Solves for the new value of the gap immediately before letter `index` (i.e.
 * letterGapsMm[index - 1]) so that letter ends up at `desiredXMm`. Only that one
 * gap changes — every letter before `index` is unaffected, and every letter
 * after it cascades automatically because positions are a running sum.
 * `index` must be >= 1 (the first letter has no gap before it to adjust).
 */
export function gapForDesiredPosition(index: number, desiredXMm: number, naturalXsMm: number[], letterGapsMm: number[]): number {
  const cumulativeBeforeThisGap = cumulativeGaps(letterGapsMm)[index - 1];
  return desiredXMm - naturalXsMm[index] - cumulativeBeforeThisGap;
}

/** Keeps a dragged letter's desired position from crossing its (non-moving) left neighbor. */
export function clampDesiredLetterPosition(index: number, desiredXMm: number, naturalXsMm: number[], letterGapsMm: number[]): number {
  const leftNeighborX = letterPositionsMm(naturalXsMm, letterGapsMm)[index - 1];
  return Math.max(desiredXMm, leftNeighborX + MIN_LETTER_GAP_MM);
}

/** The combined bounding box of every letter at its current (gap-adjusted) position — the line-wide bounds sticks are clamped against. */
export function combinedLetterBounds(letters: LetterGeometry[], letterGapsMm: number[]): THREE.Box3 {
  const cumulative = cumulativeGaps(normalizedLetterGaps(letters.length, letterGapsMm));
  const box = new THREE.Box3();
  letters.forEach((letter, i) => {
    letter.geometry.computeBoundingBox();
    const lb = letter.geometry.boundingBox!;
    const dx = cumulative[i];
    box.union(new THREE.Box3(new THREE.Vector3(lb.min.x + dx, lb.min.y, lb.min.z), new THREE.Vector3(lb.max.x + dx, lb.max.y, lb.max.z)));
  });
  return box;
}

/** The combined bounding box of every line of a block, each at its own current
 * (gap-adjusted, then line-offset-shifted) position — the whole-piece bounds
 * sticks are clamped against, since a block can now have more than one line. */
export function combinedBlockBounds(block: TextBlock, letterGapsMm: number[][], lineOffsets: Offset2D[]): THREE.Box3 {
  const box = new THREE.Box3();
  block.lines.forEach((line, i) => {
    const lineBox = combinedLetterBounds(line.letters, letterGapsMm[i] ?? []);
    const offset = lineOffsets[i] ?? { x: 0, y: 0 };
    box.union(new THREE.Box3(new THREE.Vector3(lineBox.min.x + offset.x, lineBox.min.y + offset.y, lineBox.min.z), new THREE.Vector3(lineBox.max.x + offset.x, lineBox.max.y + offset.y, lineBox.max.z)));
  });
  return box;
}
