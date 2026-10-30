// Release 57b: a rule for phones means nothing if a later general rule for the same thing undoes it. That's how a toast
// squeezed the whole page out of a phone's one column, from release 53, with every test passing.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/styles.css'), 'utf8');

/**
 * Each small-screen declaration that doesn't survive to the end of the stylesheet: a later top-level rule, for the very
 * same selector and property, changes it, and no later rule at the same breakpoint sets it back. It doesn't work out
 * shorthands, or which of two different selectors wins.
 */
function overridden(source: string): string[] {
  const nodes = postcss.parse(source).nodes;
  const lost: string[] = [];
  nodes.forEach((node, i) => {
    if (node.type !== 'atrule' || node.name !== 'media' || !/max-width/.test(node.params)) return;
    node.walkRules((rule) =>
      rule.walkDecls((decl) => {
        for (const selector of rule.selectors) {
          // The last word: a general rule's undoes it, and one at the same breakpoint, whatever it says, is still a phone rule.
          let undoneBy: string | null = null;
          for (const later of nodes.slice(i + 1)) {
            const general = later.type === 'rule';
            const rules = general ? [later] : later.type === 'atrule' && later.params === node.params ? (later.nodes ?? []) : [];
            for (const r of rules) if (r.type === 'rule' && r.selectors.includes(selector)) r.walkDecls(decl.prop, (d) => void (undoneBy = general && d.value !== decl.value ? d.value : null));
          }
          if (undoneBy !== null) lost.push(`${selector} ${decl.prop}: ${decl.value} is undone by ${undoneBy}`);
        }
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

  it('set back at a narrower width, or undone again after that, doesn’t count', () => {
    expect(overridden('@media (max-width: 700px) { .x { order: 1; } } .x { order: 2; } @media (max-width: 520px) { .x { order: 1; } }')).toHaveLength(1);
    expect(overridden('@media (max-width: 700px) { .x { order: 1; } } .x { order: 2; } @media (max-width: 700px) { .x { order: 1; } } .x { order: 3; }')).not.toEqual([]);
  });

  it('a later rule at the same breakpoint may change it', () => {
    expect(overridden('@media (max-width: 700px) { .x { order: 1; } } @media (max-width: 700px) { .x { order: 2; } }')).toEqual([]);
  });
});
