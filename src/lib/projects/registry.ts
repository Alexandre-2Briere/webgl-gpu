import type { ProjectMeta } from './types';

export const projects: ProjectMeta[] = [
  {
    id: 'webgpu-game-engine',
    title: 'WebGPU Game Engine',
    shortDescription:
      'GUI for a WebGPU-based game engine, showcasing various rendering techniques and optimizations and allowing for import and export of scene. Canvas based so it will fail accessibility tests.',
    previewImage: '/projects/gameEngine.png',
    demoUrl: '/sandbox',
    tags: ['WebGPU', 'TypeScript', '3D', 'Game Engine', 'Shaders'],
    publishedAt: '2026-03-20',
  },
  {
    id: 'bombardier',
    title: 'Bombardier',
    shortDescription:
      'Web development at Bombardier involving redesign, analytics, and multi-framework front-end work.',
    previewImage: '/projects/bombardier.png',
    demoUrl: 'https://bombardier.com/en',
    tags: ['CMS', 'PHP', 'Angular', 'Alpine.js', 'Analytics', 'Redesign'],
    publishedAt: '2026-01-01',
  },
  {
    id: 'stellantis',
    title: 'Stellantis — Jeep Canada',
    shortDescription:
      'Web platform development for Stellantis brands in Canada, with cookie law compliance, analytics, and multi-framework front-end work.',
    previewImage: '/projects/stellantis.png',
    demoUrl: 'https://www.jeep.ca/en',
    tags: ['CMS', 'Java', 'Angular', 'Vue', 'Analytics', 'Cookie Compliance'],
    publishedAt: '2025-06-01',
  },
];
