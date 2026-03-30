# Utils

## Role

Cross-cutting utilities that don't belong to a specific subsystem. Three concerns: safe asset fetching with size enforcement (`assetLoaders.ts`), GPU bind group layout creation (`bindGroupLayouts.ts`), and engine-wide logging (`logger.ts`).

## Key Concepts

- **fetchWithLimit**: Wraps `fetch()` with a 256 MB size cap, checked both from the `Content-Length` header and by accumulating streamed bytes. Returns an `ArrayBuffer`.
- **loadObjAsset / loadFbxAsset**: Orchestrate the full load pipeline: fetch → parse → GPU upload → return an asset handle. These are the implementation behind `engine.loadObj()` and `engine.loadFbx()`.
- **Bind group layouts**: Three `GPUBindGroupLayout` objects that define the binding slots expected by all shaders — camera (group 0), object (group 1), FBX material (group 2). Must match shader declarations exactly.
- **logger**: Wraps `console.*` with a log level filter. Level is set at compile time via a constant. Messages are prefixed with `[Engine][LEVEL]`.

## Invariants

- `fetchWithLimit` enforces the 256 MB limit in two ways: (1) before streaming via `Content-Length` header, (2) during streaming by accumulating the byte count. Both checks must pass.
- Bind group layouts are device-specific — they must be created after `Engine.create()` and cannot be shared across devices.
- The three layouts (camera, object, FBX material) must exactly match the `@group` and `@binding` declarations in the corresponding WGSL shaders. A mismatch causes a GPU pipeline creation error.
- `logger` level is a compile-time constant. There is no runtime API to change it. Changing the level requires editing the source and rebuilding.
- `loadObjAsset` / `loadFbxAsset` upload to GPU immediately on return. The caller does not need to trigger any additional upload step.

## Edge Cases

- **`Content-Length` header absent**: Some servers omit the `Content-Length` header. `fetchWithLimit` falls through to the streaming check only. Large files without a `Content-Length` will be accepted until they exceed 256 MB mid-stream.
- **`Content-Length` exceeds 256 MB**: The fetch is aborted before any bytes are downloaded. No partial data is received.
- **Server returns incorrect `Content-Length`**: If the header lies (smaller than actual), the streaming check will catch the overflow. If the header says larger than actual, the streaming check is the safety net.
- **Fetch failure (HTTP 4xx/5xx)**: `fetchWithLimit` throws with the HTTP status code. Callers (`loadObjAsset`, `loadFbxAsset`) do not catch this — it propagates to the user's `await engine.loadObj()` call.
- **Null `response.body`**: Throws immediately. This can happen in some non-standard environments where streaming is not supported.
- **Bind group layout group 0 visibility**: Camera layout is `VERTEX | FRAGMENT` visibility. If a future shader reads camera data in a different stage (e.g. compute), the layout will not expose it and a validation error will occur.
- **FBX material layout diffuse vs normal map order**: Binding 0 is diffuse, binding 1 is normal map. Swapping them is a silent error — the wrong texture is read by the shader, producing incorrect rendering with no GPU error.
- **logger at ERROR level**: Only `logger.error()` calls are emitted. All debug, info, and warning messages are silently dropped. This is the expected production configuration.
- **FBX asset with no meshes**: If the FBX file has no valid Geometry nodes, `loadFbxAsset` returns an `FbxAssetHandle` with an empty mesh array. Creating an `FbxModel` from it may produce a no-op draw or a crash depending on the implementation.

## Probable Failure Modes

| Mode | Visibility |
|------|-----------|
| `Content-Length` missing, file > 256 MB | Silent until streaming cap triggers |
| HTTP error (4xx/5xx) | Loud — throws with status code |
| Null `response.body` | Loud — throws immediately |
| Bind group layout mismatch with shader | GPU validation error at pipeline creation |
| FBX material binding order swapped | Silent — wrong texture rendered |
| LOG_LEVEL too high (no debug logs) | Silent — debug info unavailable |
| FBX with no geometry | Silent or crash at draw time |

## Test Scenarios

- **fetchWithLimit below cap**: fetch a resource known to be < 256 MB — verify it resolves with the `ArrayBuffer`.
- **fetchWithLimit at header limit**: mock a response with `Content-Length: 268435456` (exactly 256 MB) — verify it is accepted. One byte over — verify it throws.
- **fetchWithLimit streaming limit**: mock a response with no `Content-Length` header and stream 256 MB + 1 byte — verify it throws mid-stream.
- **fetchWithLimit HTTP 404**: mock a 404 response — verify `loadObjAsset` rejects with the HTTP status.
- **Bind group layout group/binding slots**: verify `createCameraLayout()` returns a layout with exactly one binding at slot 0, `VERTEX | FRAGMENT` visibility, type `uniform`.
- **Bind group layout object**: verify `createObjectLayout()` returns binding 0, `VERTEX` visibility only.
- **FBX material layout order**: verify binding 0 is a texture, binding 1 is a texture, binding 2 is a sampler.
- **logger DEBUG level**: set `LOG_LEVEL = 0`, call `logger.debug()` — verify `console.debug` is called.
- **logger above threshold**: set `LOG_LEVEL = 3` (ERROR), call `logger.debug()` and `logger.info()` — verify `console.debug` and `console.info` are NOT called.
- **logger prefix**: verify all messages are prefixed with `[Engine][`.
- **loadObjAsset returns reusable handle**: call `loadObjAsset` once, create two `Model3D` from the same handle — verify they share the same GPU vertex/index buffers.
