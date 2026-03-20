import { projects } from '../projects/registry'
import type { ProjectMeta } from '../projects/types'

// Returns the project list. Currently static — swap the body for a fetch() call
// to load from an external API without changing any call sites.
export async function fetchProjectMeta(): Promise<ProjectMeta[]> {
  return projects
}
