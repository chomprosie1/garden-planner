// A name is one line. A box drops a pasted line break altogether, joining the words ("a" and "b" become "ab"), so a paste
// is put in by hand, with the breaks as spaces.

export { NAME_LENGTH } from '../model/listLayout';

export const asOneLine = (text: string) => text.replace(/\s*[\r\n]+\s*/g, ' ').trim();

/** For onPaste on a name's input. */
export function pasteOneLine(e: ClipboardEvent): void {
  const text = e.clipboardData?.getData('text');
  if (!text || !/[\r\n]/.test(text)) return;
  e.preventDefault();
  const input = e.currentTarget as HTMLInputElement;
  const [from, to] = [input.selectionStart ?? 0, input.selectionEnd ?? 0];
  // What fits, as typing would: it's the paste that's cut short, not the name it's going into.
  const room = input.maxLength > 0 ? input.maxLength - (input.value.length - (to - from)) : Infinity;
  input.setRangeText(asOneLine(text).slice(0, Math.max(0, room)), from, to, 'end');
  // Some boxes save as you type, and some when you leave them.
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
