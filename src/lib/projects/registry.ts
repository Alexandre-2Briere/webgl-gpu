import type { ProjectMeta } from './types';

export const projects: ProjectMeta[] = [
  {
    id: 'webgpu-marching-cubes',
    title: 'WebGPU Marching Cubes Terrain',
    shortDescription:
      'First-person terrain exploration with real-time sculpting, physics, and procedurally generated chunks using WebGPU compute shaders.',
    previewImage: '/projects/webgpu-marching-cubes.jpg',
    demoUrl: '/demos/webgpu/',
    tags: ['WebGPU', 'TypeScript', '3D', 'Marching Cubes'],
    publishedAt: '2026-03-20',
  },
];
