import assert from "node:assert/strict";
import test from "node:test";
import { auditSource } from "./ui-density-audit.mjs";

test("ui density audit finds decorative surfaces nested inside a parent surface", () => {
  const result = auditSource(`
    export function Example() {
      return (
        <section className="rounded-xl border border-black bg-surface-panel">
          <div className="rounded-lg border border-black bg-surface-card">Detalle</div>
        </section>
      );
    }
  `);

  assert.equal(result.surfaceCount, 2);
  assert.equal(result.maxSurfaceDepth, 2);
  assert.equal(result.nestedSurfaces.length, 1);
  assert.equal(result.nestedSurfaces[0].line, 5);
});

test("ui density audit preserves interactive, modal, and critical surfaces", () => {
  const result = auditSource(`
    export function Example() {
      return (
        <section className="rounded-xl border border-black bg-surface-panel">
          <button className="rounded-lg border border-black bg-surface-card">Acción</button>
          <div role="alert" className="rounded-lg border border-rose-900 bg-rose-950">Error crítico</div>
          <div role="dialog" className="fixed rounded-xl border border-black bg-surface-panel">Modal</div>
        </section>
      );
    }
  `);

  assert.equal(result.surfaceCount, 3);
  assert.equal(result.nestedSurfaces.length, 0);
});

test("ui density audit identifies long muted explanations but not alerts", () => {
  const result = auditSource(`
    export function Example() {
      return (
        <>
          <p className="text-sm text-slate-400">Esta explicación secundaria permanece visible aunque el usuario solo la necesite cuando tenga dudas.</p>
          <p role="alert" className="text-sm text-rose-200">Esta advertencia crítica debe continuar visible siempre.</p>
        </>
      );
    }
  `);

  assert.equal(result.secondaryCopy.length, 1);
  assert.match(result.secondaryCopy[0].text, /explicación secundaria/);
});
