import { useMemo, useEffect } from 'react';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { StickyLetter } from './geometry';
import { useStickyNameGeometry } from './geometryContext';
import { useStickyNameStore } from './store';
import { useStickyNameUI } from './uiStore';
import { PreviewWarning } from '../../ui/PreviewWarning';
import { PreviewToggleButton } from '../../ui/PreviewToggleButton';
import { usePanelStore } from '../../ui/panelStore';

function Letter({ letter }: { letter: StickyLetter }) {
  const color = useStickyNameStore((s) => s.previewColor);
  const clearance = useStickyNameStore((s) => s.clearanceMm);
  const selected = useStickyNameUI((s) => s.selectedLetter === letter.index);
  const show = useStickyNameUI((s) => s.showMagnets);
  const select = useStickyNameUI((s) => s.select);
  const focus = usePanelStore((s) => s.focus);
  const smooth = useMemo(() => {
    const copy = letter.geometry.clone();
    copy.deleteAttribute('normal');
    const result = mergeVertices(copy, 0.00001);
    copy.dispose();
    result.computeVertexNormals();
    return result;
  }, [letter.geometry]);
  useEffect(() => () => smooth.dispose(), [smooth]);
  return <group position={[letter.x, 0, 0]}>
    <mesh name={`sticky-letter-${letter.index}`} geometry={smooth} castShadow receiveShadow onClick={(event) => { event.stopPropagation(); select(letter.index); focus('sticky-magnets'); }}>
      <meshStandardMaterial color={color} roughness={0.47} metalness={0} emissive={selected ? '#16333e' : '#000000'} emissiveIntensity={selected ? 0.16 : 0} />
    </mesh>
    {show && letter.magnets.map((magnet, i) => <mesh key={i} position={[magnet.position.x, magnet.position.y, magnet.heightMm + (magnet.thicknessMm + clearance) / 2]} rotation={[Math.PI / 2, 0, 0]} renderOrder={10}>
      <cylinderGeometry args={[(magnet.diameterMm + clearance) / 2, (magnet.diameterMm + clearance) / 2, magnet.thicknessMm + clearance, 48]} />
      <meshBasicMaterial color={magnet.valid ? '#2b789b' : '#e25145'} transparent opacity={0.65} depthTest={false} depthWrite={false} wireframe />
    </mesh>)}
  </group>;
}

export function StickyNameSceneContent() {
  const { result } = useStickyNameGeometry();
  return <group>{result?.letters.map((letter) => <Letter key={letter.index} letter={letter} />)}</group>;
}

export function StickyNameWarnings() {
  const { result } = useStickyNameGeometry();
  return result?.warnings.length ? <PreviewWarning message={result.warnings[0]} remedy={result.warnings.length > 1 ? `${result.warnings.length - 1} more notes in the magnet panel.` : undefined} /> : null;
}

export function StickyNameViewControls() {
  const show = useStickyNameUI((s) => s.showMagnets);
  const toggle = useStickyNameUI((s) => s.toggleMagnets);
  return <PreviewToggleButton onClick={toggle} active={show} label={show ? 'Hide magnet cavities' : 'Show magnet cavities'} title="Magnet cavity overlay (not exported)">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><path d="M5 4v10a7 7 0 0 0 14 0V4h-5v10a2 2 0 0 1-4 0V4Z" /><path d="M5 8h5m4 0h5" /></svg>
  </PreviewToggleButton>;
}
