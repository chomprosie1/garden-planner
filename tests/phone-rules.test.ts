// Release 57b: a rule for phones means nothing if a later general rule for the same thing undoes it. That's how a toast
// squeezed the whole page out of a phone's one column, from release 53, with every test passing.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/styles.css'), 'utf8');

/** Each small-screen declaration that a later top-level rule for the same selector changes. */
function overridden(source: string): string[] {
  const nodes = postcss.parse(source).nodes;
  const lost: string[] = [];
  nodes.forEach((node, i) => {
    if (node.type !== 'atrule' || node.name !== 'media' || !/max-width/.test(node.params)) return;
    node.walkRules((rule) =>
      rule.walkDecls((decl) => {
        for (const later of nodes.slice(i + 1)) {
          if (later.type !== 'rule' || !later.selectors.some((s) => rule.selectors.includes(s))) continue;
          later.walkDecls((e) => {
            if (e.prop === decl.prop && e.value !== decl.value) lost.push(`${rule.selector} ${decl.prop}: ${decl.value} is undone by ${e.value}`);
          });
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
});
