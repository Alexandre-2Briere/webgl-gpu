import type { ProjectMeta } from '@lib/projects/types';
import styles from './ProjectCard.module.css';

interface Props {
  project: ProjectMeta
  index: number
}

export default function ProjectCard({ project, index }: Props) {
  const reversed = index % 2 !== 0;

  return (
    <article className={`${styles.card} ${reversed ? styles.reversed : ''}`}>
      <a href={project.demoUrl} className={styles.imageLink}>
        <img
          src={project.previewImage}
          alt={project.title}
          className={styles.image}
        />
      </a>
      <div className={styles.content}>
        <div className={styles.tags}>
          {project.tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
        <h2 className={styles.title}>
          <a href={project.demoUrl}>{project.title}</a>
        </h2>
        <p className={styles.description}>{project.shortDescription}</p>
        <a href={project.demoUrl} className={styles.cta}>
          Open demo →
        </a>
      </div>
    </article>
  );
}
