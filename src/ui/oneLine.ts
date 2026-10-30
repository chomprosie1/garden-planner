// A name is one line. A box drops a pasted line break altogether, joining the words ("a" and "b" become "ab"), so a paste
// is put in by hand, with the breaks as spaces.

/** The most a name can be: enough for any bed or garden, and short enough to fit a card. */
export const NAME_LENGTH = 60;

export const asOneLine = (text: string) => text.replace(/\s*[\r\n]+\s*/g, ' ').trim();

/** For onPaste on a name's input. */
export function pasteOneLine(e: ClipboardEvent): void {
  const text = e.clipboardData?.getData('text');
  if (!text || !/[\r\n]/.test(text)) return;
  e.preventDefault();
  const input = e.currentTarget as HTMLInputElement;
  input.setRangeText(asOneLine(text), input.selectionStart ?? 0, input.selectionEnd ?? 0, 'end');
  input.value = input.value.slice(0, input.maxLength > 0 ? input.maxLength : undefined);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
