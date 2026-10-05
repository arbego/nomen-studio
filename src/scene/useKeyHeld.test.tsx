import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useKeyHeld } from './useKeyHeld';
import { installFakeWindow } from '../test-setup/fakeWindow';

let fake: ReturnType<typeof installFakeWindow> | null = null;

function fakeWindow() {
  fake = installFakeWindow();
  return fake;
}

afterEach(() => {
  fake?.remove();
  fake = null;
});

/** Reads the hook back out through the scene graph, `visible` standing in for "held". */
function Probe({ onRelease }: { onRelease?: () => void }) {
  const held = useKeyHeld('Control', onRelease);
  return <group visible={held} />;
}

async function renderProbe(onRelease?: () => void) {
  const renderer = await ReactThreeTestRenderer.create(<Probe onRelease={onRelease} />);
  return { renderer, held: () => (renderer.scene.children[0].instance as unknown as { visible: boolean }).visible };
}

describe('useKeyHeld', () => {
  it('is held between the key going down and coming back up', async () => {
    const window = fakeWindow();
    const { held } = await renderProbe();
    expect(held()).toBe(false);

    await window.fire('keydown', { key: 'Control' });
    expect(held()).toBe(true);

    await window.fire('keyup', { key: 'Control' });
    expect(held()).toBe(false);
  });

  it('ignores every other key', async () => {
    const window = fakeWindow();
    const { held } = await renderProbe();

    await window.fire('keydown', { key: 'Shift' });
    expect(held()).toBe(false);
  });

  it('lets go when the window does, rather than staying stuck down', async () => {
    // Releasing the key over another window never reaches this one, so the
    // modifier would otherwise still be held when you came back.
    const window = fakeWindow();
    const onRelease = vi.fn();
    const { held } = await renderProbe(onRelease);

    await window.fire('keydown', { key: 'Control' });
    await window.fire('blur');

    expect(held()).toBe(false);
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it('only says it was released if it was actually down, so nothing is cleared for no reason', async () => {
    const window = fakeWindow();
    const onRelease = vi.fn();
    await renderProbe(onRelease);

    await window.fire('blur');
    await window.fire('keyup', { key: 'Control' });

    expect(onRelease).not.toHaveBeenCalled();
  });

  it('takes its listeners back off when it goes away', async () => {
    const window = fakeWindow();
    const { renderer } = await renderProbe();
    expect(window.listenerCount()).toBeGreaterThan(0);

    await act(async () => {
      renderer.unmount();
    });
    expect(window.listenerCount()).toBe(0);
  });
});
