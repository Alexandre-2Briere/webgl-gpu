import type { BindGroupLayouts } from '../types'

export function createCameraLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'camera-bgl',
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: { type: 'uniform' },
    }],
  })
}

export function createObjectLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'object-bgl',
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: 'uniform', hasDynamicOffset: false },
    }],
  })
}

export function createFbxMaterialLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'fbx-material-bgl',
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
    ],
  })
}

export function createLightsLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'lights-bgl',
    entries: [{
      binding:    0,
      visibility: GPUShaderStage.FRAGMENT,
      buffer:     { type: 'uniform' },
    }],
  })
}

export function createEmptyLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({ label: 'empty-bgl', entries: [] })
}

export function createGizmoLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'gizmo-bgl',
    entries: [{
      binding:    0,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer:     { type: 'uniform' },
    }],
  })
}

export function createEngineLayouts(device: GPUDevice): BindGroupLayouts {
  return {
    camera:      createCameraLayout(device),
    object:      createObjectLayout(device),
    fbxMaterial: createFbxMaterialLayout(device),
    lights:      createLightsLayout(device),
    empty:       createEmptyLayout(device),
    gizmo:       createGizmoLayout(device),
  }
}
