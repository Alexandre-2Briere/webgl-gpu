import { useEffect, useState } from 'react'
import { fetchProjectMeta } from '@lib/services/fetchProjectMeta'
import { logger } from '../../webgpu/engine/utils'
import type { ProjectMeta } from '@lib/projects/types'
import ProjectCard from '@components/ProjectCard/ProjectCard'
import styles from './Home.module.css'

export default function Home() {
  const [projects, setProjects] = useState<ProjectMeta[]>([])

  useEffect(() => {
    fetchProjectMeta().then(setProjects).catch(e => logger.error(e))
  }, [])

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.siteTitle}>Alexandre Brière</h1>
        <p className={styles.siteSubtitle}>Interactive demos &amp; experiments</p>
      </header>
      <section className={styles.projectList}>
        {projects.map((project, index) => (
          <ProjectCard key={project.id} project={project} index={index} />
        ))}
      </section>
    </main>
  )
}
