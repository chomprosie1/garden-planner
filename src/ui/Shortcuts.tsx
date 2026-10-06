import { useEffect, useRef } from 'preact/hooks';

const GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: 'Anywhere',
    keys: [
      ['Ctrl + Z', 'Undo'],
      ['Ctrl + Y', 'Redo'],
      ['?', 'This list'],
    ],
  },
  {
    title: 'On the plan',
    keys: [
      ['V', 'Select'],
      ['B', 'Draw the boundary'],
      ['R', 'Draw a bed'],
      ['P', 'Draw a path'],
      ['L', 'Draw a fence'],
      ['T', 'Draw a tree'],
      ['U', 'Draw a surface: lawn, gravel, paving and more'],
      ['G', 'Plant'],
      ['K', 'Sketch on the plan'],
      ['S', 'Sun and shade, and back'],
      ['H', 'Hide or show the photos'],
      ['0', 'Fit the garden to the screen'],
      ['+ / −', 'Zoom in or out'],
      ['Arrow keys', 'Nudge what’s selected by 10 mm (100 mm with Shift)'],
      ['Delete', 'Delete what’s selected'],
      ['Ctrl + D', 'Duplicate what’s selected'],
      ['Esc', 'Stop drawing, or clear the selection'],
    ],
  },
  {
    title: 'While drawing',
    keys: [
      ['Type a length, then Enter', 'An exact side, e.g. 3450 or 3.45m'],
      ['Enter', 'Finish the shape'],
      ['Backspace', 'Remove the last corner'],
      ['Alt', 'Turn snapping off while held'],
      ['Shift', 'Keep to 45° angles while held'],
    ],
  },
];

/** The keyboard shortcuts, in a dialog. */
export function Shortcuts({ close }: { close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} class="dialog shortcuts" aria-labelledby="shortcuts-title" onClose={close} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <div class="dialog-body">
        <header class="dialog-head">
          <h2 id="shortcuts-title">Keyboard shortcuts</h2>
          <button type="button" class="icon-btn" aria-label="Close" onClick={() => ref.current?.close()}>
            ✕
          </button>
        </header>
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h3>{g.title}</h3>
            <dl class="keys">
              {g.keys.map(([k, what]) => (
                <div key={k}>
                  <dt>
                    <kbd>{k}</kbd>
                  </dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </dialog>
  );
}
