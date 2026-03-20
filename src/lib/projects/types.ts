export interface ProjectMeta {
  id: string
  title: string
  shortDescription: string
  previewImage: string // path from public/, e.g. "/projects/webgpu-marching-cubes.jpg"
  demoUrl: string // e.g. "/demos/webgpu/"
  tags: string[]
  publishedAt: string // ISO date, e.g. "2026-03-20"
}
