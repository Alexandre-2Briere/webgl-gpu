// WGSL compute shader: calculates the net-present-value of a 10% rebate paid
// in monthly instalments over 5 years at 5% annual interest.
// Each GPU thread processes one price; the inner loop runs 60 pow() calls —
// enough arithmetic to offset the PCIe round-trip at 1 M entries.
export const REBATE_COMPUTE_SHADER = /* wgsl */`

@group(0) @binding(0) var<storage, read>       prices  : array<f32>;
@group(0) @binding(1) var<storage, read_write> rebates : array<f32>;

const MONTHS      : u32 = 60u;
const MONTHLY_RATE: f32 = 0.05f / 12.0f;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x;
    if (i >= arrayLength(&prices)) { return; }
    let monthly = prices[i] * 0.1f / f32(MONTHS);
    var npv = 0.0f;
    for (var m = 0u; m < MONTHS; m++) {
        npv += monthly / pow(1.0f + MONTHLY_RATE, f32(m + 1u));
    }
    rebates[i] = npv;
}
`;
