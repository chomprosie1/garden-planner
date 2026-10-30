// Release 57b: a rule for phones means nothing if a later general rule for the same thing undoes it. That's how a toast
// squeezed the whole page out of a phone's one column, from release 53, with every test passing.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/styles.css'), 'utf8');

/**
 * Each small-screen declaration that a later top-level rule, for the very same selector and property, changes, unless a
 * later small-screen rule sets it back. It doesn't work out shorthands or which of two different selectors wins.
 */
function overridden(source: string): string[] {
  const nodes = postcss.parse(source).nodes;
  const sets = (node: (typeof nodes)[number], selectors: string[], prop: string): string | null => {
    let value: string | null = null;
    const rules = node.type === 'rule' ? [node] : [];
    if (node.type === 'atrule' && /max-width/.test(node.params)) node.walkRules((r) => void rules.push(r));
    for (const r of rules) if (r.selectors.some((s) => selectors.includes(s))) r.walkDecls(prop, (d) => void (value = d.value));
    return value;
  };
  const lost: string[] = [];
  nodes.forEach((node, i) => {
    if (node.type !== 'atrule' || node.name !== 'media' || !/max-width/.test(node.params)) return;
    node.walkRules((rule) =>
      rule.walkDecls((decl) => {
        const after = nodes.slice(i + 1);
        const undone = after.findIndex((n) => n.type === 'rule' && ![null, decl.value].includes(sets(n, rule.selectors, decl.prop)));
        if (undone < 0) return;
        const back = after.slice(undone + 1).some((n) => n.type === 'atrule' && sets(n, rule.selectors, decl.prop) === decl.value);
        if (!back) lost.push(`${rule.selector} ${decl.prop}: ${decl.value} is undone`);
      }),
    );
  });
  return lost;
}

describe('rules for small screens', () => {
  it('none is undone by a later general rule', () => {
    expect(overridden(css)).toEqual([]);
  });

  it('the check would have caught the toast', () => {
    expect(overridden('@media (max-width: 700px) { .toast { grid-column: 1; } } .toast { grid-column: 2; }')).toHaveLength(1);
    expect(overridden('.toast { grid-column: 2; } @media (max-width: 700px) { .toast { grid-column: 1; } }')).toEqual([]);
  });

  it('a phone rule set back after a general one is fine', () => {
    expect(overridden('@media (max-width: 700px) { .x { order: 1; } } .x { order: 2; } @media (max-width: 700px) { .x { order: 1; } }')).toEqual([]);
  });
});
