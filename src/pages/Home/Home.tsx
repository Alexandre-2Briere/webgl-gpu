import { useEffect, useState } from 'react';
import { Typography } from '@mui/material';
import { fetchProjectMeta } from '@lib/services/fetchProjectMeta';
import { logger } from '../../webgpu/engine/utils';
import type { ProjectMeta } from '@lib/projects/types';
import ProjectCard from '@components/ProjectCard/ProjectCard';
import SocialLinks from '@components/SocialLinks/SocialLinks';
import styles from './Home.module.css';

export default function Home() {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);

  useEffect(() => {
    fetchProjectMeta().then(setProjects).catch(e => logger.error(e));
  }, []);

  return (
    <>
      <SocialLinks />
      <main className={styles.main}>
        <header className={styles.header}>
          <Typography variant="h3" component="h1" gutterBottom>Alexandre Brière</Typography>
          <Typography variant="subtitle1" color="text.secondary">Projects, experiments, work, and more</Typography>
        </header>
        <section className={styles.projectList}>
          {projects.map((project, index) => (
            <ProjectCard key={project.id} project={project} index={index} />
          ))}
        </section>
      </main>
    </>
  );
}
