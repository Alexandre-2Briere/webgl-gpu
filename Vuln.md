# Vuln.md — Known Vulnerabilities

Tracked security issues and memory risks in the WebGPU engine. Remove an entry here after its fix is confirmed (use `/fix-vuln <ID>`).

---

## VULN-03 · LOW — OBJ Parser Trusts Index Values Without Bounds Checking

**File:** `src/webgpu/engine/loaders/parseObj.ts:49-50`

Face indices are parsed with `parseInt(...) - 1` and used directly to index into `positions[]` / `normals[]` arrays. An out-of-range index (e.g. from a malformed OBJ: `f 999999999 1 1`) produces `undefined`, silently poisoning the vertex buffer with `NaN` floats.

**Fix:** After parsing each index assert `idx >= 0 && idx < array.length / stride`. Skip or throw on invalid faces.

---

## VULN-04 · LOW — Camera Uniform Buffer Leaked on `setCamera()` Replacement

**File:** `src/webgpu/engine/Engine.ts` (`setCamera`) & `src/webgpu/engine/core/Camera.ts` (~L47)

`Camera` allocates a `GPUBuffer` in its constructor. If `setCamera()` replaces the current camera without calling `oldCamera.destroy()`, the old GPU buffer is orphaned and never freed.

**Fix:** In `setCamera()`, call `this._camera?.destroy()` before assigning the new camera.

---

## VULN-05 · LOW — FBX Binary Parser Silently Suppresses Texture Decode Errors

**File:** `src/webgpu/engine/loaders/parseFbx.ts:418-423`

The `try { atob(...) } catch { bytes = null }` block swallows base64 decode errors for embedded textures without any logging. Textures silently fail to load with no indication of why.

**Fix:** Add `console.warn('parseFbx: failed to decode embedded texture data', e)` inside the catch block.

---

*All other checked areas are clean — see audit findings for full details.*
