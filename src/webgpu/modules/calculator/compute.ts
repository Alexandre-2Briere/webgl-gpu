import { REBATE_COMPUTE_SHADER } from './shaders/computeShader';
import { LOWEST_COMPUTE_SHADER } from './shaders/lowestShader';
import { STRING_COMPUTE_SHADER, STRING_STRIDE } from './shaders/stringShader';

export interface NPVComputeResult {
    rebates: Float32Array;
    /** Wall-clock ms from queue.submit() to buffer readback completion. */
    gpuTimeMs: number;
}

export interface LowestComputeResult {
    eurPrices: Float32Array;
    /** Wall-clock ms from queue.submit() to buffer readback completion. */
    gpuTimeMs: number;
}

export interface StringComputeResult {
    /** Flat Uint32Array: STRING_STRIDE u32 slots per string, UTF-32 encoded. */
    processedChars: Uint32Array<ArrayBuffer>;
    gpuTimeMs: number;
}

/**
 * Wraps three WebGPU compute pipelines:
 *   runNPV    — 60-iteration NPV over 1 M prices (arithmetic-heavy)
 *   runLowest — single-pass rebate + CAD→EUR transform over 10 K prices
 *   runString — uppercase + append " MODEL" over 10 K strings (UTF-32)
 */
export class CalculatorCompute {
    private readonly device: GPUDevice;
    private readonly npvPipeline: GPUComputePipeline;
    private readonly lowestPipeline: GPUComputePipeline;
    private readonly stringPipeline: GPUComputePipeline;

    constructor(device: GPUDevice) {
        this.device = device;

        this.npvPipeline = device.createComputePipeline({
            label: 'npv-pipeline',
            layout: 'auto',
            compute: {
                module: device.createShaderModule({ label: 'npv-shader', code: REBATE_COMPUTE_SHADER }),
                entryPoint: 'main',
            },
        });

        this.lowestPipeline = device.createComputePipeline({
            label: 'lowest-pipeline',
            layout: 'auto',
            compute: {
                module: device.createShaderModule({ label: 'lowest-shader', code: LOWEST_COMPUTE_SHADER }),
                entryPoint: 'main',
            },
        });

        this.stringPipeline = device.createComputePipeline({
            label: 'string-pipeline',
            layout: 'auto',
            compute: {
                module: device.createShaderModule({ label: 'string-shader', code: STRING_COMPUTE_SHADER }),
                entryPoint: 'main',
            },
        });
    }

    async runNPV(prices: Float32Array<ArrayBuffer>): Promise<NPVComputeResult> {
        const { device, npvPipeline: pipeline } = this;
        const count    = prices.length;
        const byteSize = count * Float32Array.BYTES_PER_ELEMENT;

        const inputBuffer = device.createBuffer({
            label: 'npv-prices-input',
            size: byteSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(inputBuffer, 0, prices);

        const outputBuffer = device.createBuffer({
            label: 'npv-rebates-output',
            size: byteSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        const stagingBuffer = device.createBuffer({
            label: 'npv-staging',
            size: byteSize,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        const bindGroup = device.createBindGroup({
            label: 'npv-bindgroup',
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: inputBuffer } },
                { binding: 1, resource: { buffer: outputBuffer } },
            ],
        });

        const encoder = device.createCommandEncoder({ label: 'npv-encoder' });
        const pass = encoder.beginComputePass({ label: 'npv-pass' });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.ceil(count / 64));
        pass.end();
        encoder.copyBufferToBuffer(outputBuffer, 0, stagingBuffer, 0, byteSize);

        const t0 = performance.now();
        device.queue.submit([encoder.finish()]);
        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const gpuTimeMs = performance.now() - t0;

        const rebates = new Float32Array(stagingBuffer.getMappedRange().slice(0));
        stagingBuffer.unmap();

        inputBuffer.destroy();
        outputBuffer.destroy();
        stagingBuffer.destroy();

        return { rebates, gpuTimeMs };
    }

    async runLowest(
        prices: Float32Array<ArrayBuffer>,
        rebateRate: number,
        cadToEur: number,
        months: number,
    ): Promise<LowestComputeResult> {
        const { device, lowestPipeline: pipeline } = this;
        const count    = prices.length;
        const byteSize = count * Float32Array.BYTES_PER_ELEMENT;

        const inputBuffer = device.createBuffer({
            label: 'lowest-prices-input',
            size: byteSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(inputBuffer, 0, prices);

        const outputBuffer = device.createBuffer({
            label: 'lowest-results-output',
            size: byteSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        const stagingBuffer = device.createBuffer({
            label: 'lowest-staging',
            size: byteSize,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        // Uniform: [rebateRate f32, cadToEur f32, months f32, _pad f32] — 16 bytes.
        const paramsBuffer = device.createBuffer({
            label: 'lowest-params',
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(paramsBuffer, 0, new Float32Array([rebateRate, cadToEur, months, 0]));

        const bindGroup = device.createBindGroup({
            label: 'lowest-bindgroup',
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: inputBuffer } },
                { binding: 1, resource: { buffer: outputBuffer } },
                { binding: 2, resource: { buffer: paramsBuffer } },
            ],
        });

        const encoder = device.createCommandEncoder({ label: 'lowest-encoder' });
        const pass = encoder.beginComputePass({ label: 'lowest-pass' });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.ceil(count / 64));
        pass.end();
        encoder.copyBufferToBuffer(outputBuffer, 0, stagingBuffer, 0, byteSize);

        const t0 = performance.now();
        device.queue.submit([encoder.finish()]);
        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const gpuTimeMs = performance.now() - t0;

        const eurPrices = new Float32Array(stagingBuffer.getMappedRange().slice(0));
        stagingBuffer.unmap();

        inputBuffer.destroy();
        outputBuffer.destroy();
        stagingBuffer.destroy();
        paramsBuffer.destroy();

        return { eurPrices, gpuTimeMs };
    }

    /**
     * Uppercases each string and appends " MODEL".
     * charBuf — flat Uint32Array: STRING_STRIDE u32 slots per string, UTF-32 encoded.
     * One GPU thread handles one string.
     */
    async runString(charBuf: Uint32Array<ArrayBuffer>): Promise<StringComputeResult> {
        const { device, stringPipeline: pipeline } = this;
        const byteSize    = charBuf.byteLength;
        const stringCount = charBuf.length / STRING_STRIDE;

        const inputBuffer = device.createBuffer({
            label: 'string-chars-input',
            size: byteSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(inputBuffer, 0, charBuf);

        // Output is the same size — same stride, different buffer (zero-initialised by WebGPU).
        const outputBuffer = device.createBuffer({
            label: 'string-chars-output',
            size: byteSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        const stagingBuffer = device.createBuffer({
            label: 'string-staging',
            size: byteSize,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        const bindGroup = device.createBindGroup({
            label: 'string-bindgroup',
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: inputBuffer } },
                { binding: 1, resource: { buffer: outputBuffer } },
            ],
        });

        const encoder = device.createCommandEncoder({ label: 'string-encoder' });
        const pass = encoder.beginComputePass({ label: 'string-pass' });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.ceil(stringCount / 64));
        pass.end();
        encoder.copyBufferToBuffer(outputBuffer, 0, stagingBuffer, 0, byteSize);

        const t0 = performance.now();
        device.queue.submit([encoder.finish()]);
        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const gpuTimeMs = performance.now() - t0;

        const processedChars = new Uint32Array(stagingBuffer.getMappedRange().slice(0));
        stagingBuffer.unmap();

        inputBuffer.destroy();
        outputBuffer.destroy();
        stagingBuffer.destroy();

        return { processedChars, gpuTimeMs };
    }
}
