import type { Renderable, RenderableInitArgs } from '../../Renderable';
import type { Camera } from '../../../core/Camera';
import type { Vec3, Vec4 } from '../../../math/vec';
import type { TextOptions, FontFamily } from '../../../types';
import type { UniformPool, UniformSlot } from '../../../buffers/UniformPool';
import { TextHandle } from '../TextHandle';
import { COMMON } from '../../../shaders/common';
import { TEXT } from '../../../shaders/text';

const BYTES_PER_VERTEX    = 16; // vec2f position + vec2f uv
const OBJECT_UNIFORM_SIZE = 80; // mat4x4f (64) + vec4f tint (16)

// Canvas pixels per virtual unit for screen-space text.
const SCREEN_PIXELS_PER_UNIT = 4;
// Fixed canvas height in pixels for world-space text when height is a number.
const WORLD_CANVAS_HEIGHT_PX = 256;
// Pixels per world unit when at least one dimension is 'auto' in world-space text.
const WORLD_PIXELS_PER_UNIT  = 32;
// Multiplier applied to fontSize to derive line height in canvas pixels.
const LINE_HEIGHT_MULTIPLIER = 1.2;

// CCW quad: top-left, top-right, bottom-right, bottom-left
const SHARED_VERTICES = new Float32Array([
  -0.5,  0.5, 0.0, 0.0,
   0.5,  0.5, 1.0, 0.0,
   0.5, -0.5, 1.0, 1.0,
  -0.5, -0.5, 0.0, 1.0,
]);

const SHARED_INDICES = new Uint16Array([0, 1, 2, 2, 3, 0]);

interface TextSlot {
  active:           boolean;
  canvas:           OffscreenCanvas;
  context:          OffscreenCanvasRenderingContext2D;
  texture:          GPUTexture;
  textureView:      GPUTextureView;
  uniformSlot:      UniformSlot;
  objectData:       Float32Array;
  objectBindGroup:  GPUBindGroup;
  textureBindGroup: GPUBindGroup;
  content:          string;
  fontSize:         number;
  bold:             boolean;
  italic:           boolean;
  overflow:         'hidden' | 'visible';
  fontFamily:       FontFamily;
  visible:          boolean;
  position:         Vec3;
  width:            number | 'auto';
  height:           number | 'auto';
  resolvedWidth:    number;
  resolvedHeight:   number;
  debugBounds:      boolean;
}

/** @internal — manages all text objects for one render layer (screen or world). */
export class TextManager implements Renderable {
  readonly id:          symbol = Symbol();
  readonly layer:       'overlay' | 'world';
  readonly pipelineKey: string;
  visible = true;

  private readonly _isScreen:      boolean;
  private _device!:                GPUDevice;
  private _uniformPool!:           UniformPool;
  private _pipeline!:              GPURenderPipeline;
  private _vertexBuffer!:          GPUBuffer;
  private _indexBuffer!:           GPUBuffer;
  private _sampler!:               GPUSampler;
  private _textMaterialLayout!:    GPUBindGroupLayout;
  private _objectLayout!:          GPUBindGroupLayout;
  private _measureCanvas!:         OffscreenCanvas;
  private _measureCtx!:            OffscreenCanvasRenderingContext2D;
  private _slots:                  TextSlot[] = [];
  private _freeSlots:              number[]   = [];

  constructor(isScreen: boolean) {
    this._isScreen      = isScreen;
    this.layer          = isScreen ? 'overlay' : 'world';
    this.pipelineKey    = isScreen ? 'text-screen' : 'text-world';
  }

  init(args: RenderableInitArgs): void {
    const { device, queue, format, pipelineCache, layouts } = args;
    this._device             = device;
    this._uniformPool        = args.uniformPool;
    this._textMaterialLayout = layouts.textMaterial;
    this._objectLayout       = layouts.object;

    this._sampler = device.createSampler({
      label:        'text-sampler',
      magFilter:    'linear',
      minFilter:    'linear',
      mipmapFilter: 'linear',
    });

    this._measureCanvas = new OffscreenCanvas(1, 1);
    this._measureCtx    = this._measureCanvas.getContext('2d')!;

    this._vertexBuffer = device.createBuffer({
      label: 'text-shared-verts',
      size:  SHARED_VERTICES.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    queue.writeBuffer(this._vertexBuffer, 0, SHARED_VERTICES);

    this._indexBuffer = device.createBuffer({
      label: 'text-shared-idx',
      size:  SHARED_INDICES.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    queue.writeBuffer(this._indexBuffer, 0, SHARED_INDICES);

    const shaderModule = device.createShaderModule({
      label: `${this.pipelineKey}-shader`,
      code:  COMMON + '\n' + TEXT,
    });

    const pipelineDescriptor: GPURenderPipelineDescriptor = {
      label:  `${this.pipelineKey}-pipeline`,
      layout: device.createPipelineLayout({
        bindGroupLayouts: [layouts.camera, layouts.object, layouts.textMaterial],
      }),
      vertex: {
        module:     shaderModule,
        entryPoint: this._isScreen ? 'vs_screen' : 'vs_world',
        buffers: [{
          arrayStride: BYTES_PER_VERTEX,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' },
            { shaderLocation: 1, offset: 8, format: 'float32x2' },
          ],
        }],
      },
      fragment: {
        module:     shaderModule,
        entryPoint: 'fs',
        targets: [{
          format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one',       dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
    };

    if (!this._isScreen) {
      pipelineDescriptor.depthStencil = {
        format:             'depth24plus',
        depthWriteEnabled:  true,
        depthCompare:       'less',
      };
    }

    this._pipeline = pipelineCache.getOrCreateRender(this.pipelineKey, pipelineDescriptor);
  }

  spawn(opts: TextOptions): TextHandle {
    const slotIndex = this._allocateSlotIndex(opts);
    this._redrawCanvas(this._slots[slotIndex]);
    return new TextHandle(this, slotIndex);
  }

  encode(pass: GPURenderPassEncoder, _camera: Camera): void {
    let pipelineSet = false;
    for (const slot of this._slots) {
      if (!slot.active || !slot.visible) continue;
      if (!pipelineSet) {
        pass.setPipeline(this._pipeline);
        pass.setVertexBuffer(0, this._vertexBuffer);
        pass.setIndexBuffer(this._indexBuffer, 'uint16');
        pipelineSet = true;
      }
      pass.setBindGroup(1, slot.objectBindGroup);
      pass.setBindGroup(2, slot.textureBindGroup);
      pass.drawIndexed(6);
    }
  }

  // ── Handle callbacks ──────────────────────────────────────────────────────

  _setContent(slotIndex: number, content: string): void {
    const slot = this._slots[slotIndex];
    slot.content = content;
    this._redrawCanvas(slot);
  }

  _setFontSize(slotIndex: number, fontSize: number): void {
    const slot = this._slots[slotIndex];
    slot.fontSize = fontSize;
    this._redrawCanvas(slot);
  }

  _setBold(slotIndex: number, bold: boolean): void {
    const slot = this._slots[slotIndex];
    slot.bold = bold;
    this._redrawCanvas(slot);
  }

  _setItalic(slotIndex: number, italic: boolean): void {
    const slot = this._slots[slotIndex];
    slot.italic = italic;
    this._redrawCanvas(slot);
  }

  _setPosition(slotIndex: number, position: Vec3): void {
    const slot = this._slots[slotIndex];
    slot.position = [...position] as Vec3;
    this._uploadObjectMatrix(slot);
  }

  _getVisible(slotIndex: number): boolean {
    return this._slots[slotIndex].visible;
  }

  _setVisible(slotIndex: number, visible: boolean): void {
    this._slots[slotIndex].visible = visible;
  }

  _getDebugBounds(slotIndex: number): boolean {
    return this._slots[slotIndex].debugBounds;
  }

  _setDebugBounds(slotIndex: number, value: boolean): void {
    const slot = this._slots[slotIndex];
    slot.debugBounds = value;
    this._redrawCanvas(slot);
  }

  _destroySlot(slotIndex: number): void {
    const slot = this._slots[slotIndex];
    if (!slot.active) return;
    slot.active = false;
    this._uniformPool.free(slot.uniformSlot);
    slot.texture.destroy();
    this._freeSlots.push(slotIndex);
  }

  // ── Renderable no-ops ──────────────────────────────────────────────────────

  setPosition(_position: Vec3):                              void {}
  setQuaternion(_quaternion: Vec4):                          void {}
  setScale(_x: number, _y: number, _z: number):             void {}
  get color(): [number, number, number, number]              { return [0, 0, 0, 0]; }
  setColor(_r: number, _g: number, _b: number, _a: number): void {}
  clone(): Renderable { throw new Error('TextManager is not cloneable'); }

  destroy(): void {
    for (const slot of this._slots) {
      if (slot.active) {
        this._uniformPool.free(slot.uniformSlot);
        slot.texture.destroy();
      }
    }
    this._slots.length = 0;
    this._vertexBuffer.destroy();
    this._indexBuffer.destroy();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _buildFont(slot: TextSlot): string {
    const name   = slot.fontFamily === 'chivo-mono' ? 'ChivoMono Variable' : 'RedHatMono Variable';
    const weight = slot.bold   ? 700 : 400;
    const style  = slot.italic ? 'italic' : 'normal';
    return `${style} ${weight} ${slot.fontSize}px '${name}'`;
  }

  private _wrapWords(content: string, maxWidthPx: number): string[] {
    const words = content.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = current.length === 0 ? word : `${current} ${word}`;
      if (this._measureCtx.measureText(candidate).width <= maxWidthPx) {
        current = candidate;
      } else {
        if (current.length > 0) lines.push(current);
        current = word;
      }
    }
    if (current.length > 0) lines.push(current);
    return lines.length > 0 ? lines : [''];
  }

  private _findMinWidthPx(content: string, maxLines: number): number {
    const charWidthPx = this._measureCtx.measureText('M').width;
    const words       = content.split(' ');
    const maxWordLen  = words.reduce((maximum, word) => word.length > maximum ? word.length : maximum, 0);
    let low  = Math.ceil(maxWordLen * charWidthPx);
    let high = Math.ceil(this._measureCtx.measureText(content).width);
    while (low < high) {
      const mid = (low + high) >> 1;
      this._wrapWords(content, mid).length <= maxLines ? (high = mid) : (low = mid + 1);
    }
    return low < 1 ? 1 : low;
  }

  private _resolveLayout(slot: TextSlot): {
    canvasWidthPx:  number;
    canvasHeightPx: number;
    resolvedWidth:  number;
    resolvedHeight: number;
    lines:          string[];
  } {
    this._measureCtx.font = this._buildFont(slot);

    const lineHeightPx = slot.fontSize * LINE_HEIGHT_MULTIPLIER;
    const { width, height } = slot;

    // Bind pixel-density constants once — no isScreen ternary repeated below.
    let pixelsPerUnit: number;
    let fixedCanvasH:  number | null; // null when height is derived from layout
    if (this._isScreen) {
      pixelsPerUnit = SCREEN_PIXELS_PER_UNIT;
      fixedCanvasH  = null;
    } else {
      pixelsPerUnit = WORLD_PIXELS_PER_UNIT;
      fixedCanvasH  = WORLD_CANVAS_HEIGHT_PX;
    }

    // ── both auto: single line, exact fit ───────────────────────────────────
    if (width === 'auto' && height === 'auto') {
      const measured       = this._measureCtx.measureText(slot.content).width;
      const canvasWidthPx  = measured < 1 ? 1 : Math.ceil(measured);
      const canvasHeightPx = lineHeightPx < 1 ? 1 : Math.ceil(lineHeightPx);
      return {
        canvasWidthPx,
        canvasHeightPx,
        resolvedWidth:  canvasWidthPx  / pixelsPerUnit,
        resolvedHeight: canvasHeightPx / pixelsPerUnit,
        lines: [slot.content],
      };
    }

    // ── fixed width, auto height: wrap and grow down ─────────────────────────
    if (width !== 'auto' && height === 'auto') {
      const rawW       = Math.floor(width * pixelsPerUnit);
      const clampedW   = rawW < 1 ? 1 : rawW;
      const lines      = this._wrapWords(slot.content, clampedW);
      const rawH       = lines.length * lineHeightPx;
      const canvasHeightPx = rawH < 1 ? 1 : Math.ceil(rawH);
      return {
        canvasWidthPx:  clampedW,
        canvasHeightPx,
        resolvedWidth:  width,
        resolvedHeight: canvasHeightPx / pixelsPerUnit,
        lines,
      };
    }

    // ── auto width, fixed height: binary-search narrowest fit ────────────────
    if (width === 'auto' && height !== 'auto') {
      const canvasHeightPx = fixedCanvasH !== null
        ? fixedCanvasH
        : (height * pixelsPerUnit < 1 ? 1 : Math.floor(height * pixelsPerUnit));
      const effectivePpu   = fixedCanvasH !== null ? fixedCanvasH / height : pixelsPerUnit;
      const rawMaxLines    = Math.floor(canvasHeightPx / lineHeightPx);
      const maxLines       = rawMaxLines < 1 ? 1 : rawMaxLines;
      const canvasWidthPx  = this._findMinWidthPx(slot.content, maxLines);
      const lines          = this._wrapWords(slot.content, canvasWidthPx);
      return {
        canvasWidthPx,
        canvasHeightPx,
        resolvedWidth:  canvasWidthPx / effectivePpu,
        resolvedHeight: height,
        lines,
      };
    }

    // ── both fixed: existing behaviour, no wrapping ──────────────────────────
    const rawW = fixedCanvasH !== null
      ? Math.round(fixedCanvasH * (width as number) / (height as number))
      : Math.floor((width as number) * pixelsPerUnit);
    const rawH = fixedCanvasH !== null
      ? fixedCanvasH
      : Math.floor((height as number) * pixelsPerUnit);
    return {
      canvasWidthPx:  rawW < 1 ? 1 : rawW,
      canvasHeightPx: rawH < 1 ? 1 : rawH,
      resolvedWidth:  width  as number,
      resolvedHeight: height as number,
      lines: [slot.content],
    };
  }

  private _allocateSlotIndex(opts: TextOptions): number {
    const width      = opts.width      ?? 'auto';
    const height     = opts.height     ?? 'auto';
    const position   = (opts.position ?? [0, 0, 0]) as Vec3;
    const content    = opts.content    ?? '';
    const fontSize   = opts.fontSize;
    const bold       = opts.bold       ?? false;
    const italic     = opts.italic     ?? false;
    const overflow   = opts.overflow   ?? 'hidden';
    const fontFamily = opts.fontFamily ?? 'chivo-mono';
    const debugBounds = opts.debugBounds ?? false;

    // Shell slot used only for _resolveLayout measurement — GPU fields unused here.
    const layout = this._resolveLayout({
      content, fontSize, bold, italic, fontFamily, width, height,
    } as TextSlot);

    const canvasWidth  = layout.canvasWidthPx;
    const canvasHeight = layout.canvasHeightPx;

    const canvas  = new OffscreenCanvas(canvasWidth, canvasHeight);
    const context = canvas.getContext('2d')!;

    const texture = this._device.createTexture({
      label:  opts.label ? `${opts.label}:tex` : 'text:tex',
      size:   [canvasWidth, canvasHeight],
      format: 'rgba8unorm',
      usage:  GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const textureView = texture.createView({ label: opts.label ? `${opts.label}:view` : 'text:view' });

    const uniformSlot   = this._uniformPool.allocate(OBJECT_UNIFORM_SIZE);
    const objectData    = new Float32Array(20);
    objectData[16] = 1; objectData[17] = 1; objectData[18] = 1; objectData[19] = 1; // tint = white

    const objectBindGroup = this._device.createBindGroup({
      label:   opts.label ? `${opts.label}:obj` : 'text:obj',
      layout:  this._objectLayout,
      entries: [{
        binding:  0,
        resource: { buffer: uniformSlot.buffer, offset: uniformSlot.offset, size: OBJECT_UNIFORM_SIZE },
      }],
    });

    const textureBindGroup = this._device.createBindGroup({
      label:   opts.label ? `${opts.label}:mat` : 'text:mat',
      layout:  this._textMaterialLayout,
      entries: [
        { binding: 0, resource: textureView },
        { binding: 1, resource: this._sampler },
      ],
    });

    const slotData: TextSlot = {
      active: true, canvas, context, texture, textureView, uniformSlot, objectData,
      objectBindGroup, textureBindGroup, content, fontSize, bold, italic, overflow,
      fontFamily, visible: true, position: [...position] as Vec3, width, height,
      resolvedWidth:  layout.resolvedWidth,
      resolvedHeight: layout.resolvedHeight,
      debugBounds,
    };

    let slotIndex: number;
    if (this._freeSlots.length > 0) {
      slotIndex = this._freeSlots.pop()!;
      this._slots[slotIndex] = slotData;
    } else {
      slotIndex = this._slots.length;
      this._slots.push(slotData);
    }

    this._uploadObjectMatrix(this._slots[slotIndex]);
    return slotIndex;
  }

  private _redrawCanvas(slot: TextSlot): void {
    const layout       = this._resolveLayout(slot);
    const canvasWidth  = layout.canvasWidthPx;
    const canvasHeight = layout.canvasHeightPx;

    // ── resize if pixel dimensions changed ────────────────────────────────────
    if (slot.canvas.width !== canvasWidth || slot.canvas.height !== canvasHeight) {
      slot.texture.destroy();
      slot.canvas  = new OffscreenCanvas(canvasWidth, canvasHeight);
      slot.context = slot.canvas.getContext('2d')!;
      slot.texture = this._device.createTexture({
        size:   [canvasWidth, canvasHeight],
        format: 'rgba8unorm',
        usage:  GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });
      slot.textureView      = slot.texture.createView();
      slot.textureBindGroup = this._device.createBindGroup({
        layout:  this._textMaterialLayout,
        entries: [
          { binding: 0, resource: slot.textureView },
          { binding: 1, resource: this._sampler    },
        ],
      });
      slot.resolvedWidth  = layout.resolvedWidth;
      slot.resolvedHeight = layout.resolvedHeight;
      this._uploadObjectMatrix(slot);
    }

    const { context } = slot;
    const lineHeightPx = slot.fontSize * LINE_HEIGHT_MULTIPLIER;

    context.clearRect(0, 0, canvasWidth, canvasHeight);

    if (slot.overflow === 'hidden') {
      context.save();
      context.beginPath();
      context.rect(0, 0, canvasWidth, canvasHeight);
      context.clip();
    }

    context.font         = this._buildFont(slot);
    context.fillStyle    = 'white';
    context.textBaseline = 'top';
    for (let lineIndex = 0; lineIndex < layout.lines.length; lineIndex++) {
      context.fillText(layout.lines[lineIndex], 0, lineIndex * lineHeightPx);
    }

    if (slot.overflow === 'hidden') context.restore();

    // Debug border — drawn after restore so the clip path never hides any edge.
    if (slot.debugBounds) {
      context.strokeStyle = 'red';
      context.lineWidth   = 2;
      context.strokeRect(1, 1, canvasWidth - 2, canvasHeight - 2);
    }

    this._device.queue.copyExternalImageToTexture(
      { source: slot.canvas },
      { texture: slot.texture },
      [canvasWidth, canvasHeight],
    );
  }

  private _uploadObjectMatrix(slot: TextSlot): void {
    const out      = slot.objectData;
    const position = slot.position;
    const width    = slot.resolvedWidth;
    const height   = slot.resolvedHeight;

    if (this._isScreen) {
      const widthNdc  = width  / 250;
      const heightNdc = height / 250;
      const centerX   = (position[0] + width  / 2) / 250 - 1;
      const centerY   = 1 - (position[1] + height / 2) / 250;

      out[0]  = widthNdc; out[1]  = 0;          out[2]  = 0; out[3]  = 0;
      out[4]  = 0;        out[5]  = heightNdc;  out[6]  = 0; out[7]  = 0;
      out[8]  = 0;        out[9]  = 0;          out[10] = 1; out[11] = 0;
      out[12] = centerX;  out[13] = centerY;    out[14] = 0; out[15] = 1;
    } else {
      out[0]  = width;      out[1]  = 0;      out[2]  = 0; out[3]  = 0;
      out[4]  = 0;          out[5]  = height; out[6]  = 0; out[7]  = 0;
      out[8]  = 0;          out[9]  = 0;      out[10] = 1; out[11] = 0;
      out[12] = position[0]; out[13] = position[1]; out[14] = position[2]; out[15] = 1;
    }

    this._uniformPool.write(slot.uniformSlot, slot.objectData);
  }
}
