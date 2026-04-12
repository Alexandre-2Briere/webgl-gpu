import type { ProjectMeta } from '@lib/projects/types';
import styles from './ProjectCard.module.css';

interface Props {
  project: ProjectMeta
  index: number
}

export default function ProjectCard({ project, index }: Props) {
  const reversed = index % 2 !== 0;

  return (
    <a
      href={project.demoUrl}
      className={`${styles.card} ${reversed ? styles.reversed : ''}`}
    >
      <div className={styles.imageWrapper}>
        <img src={project.previewImage} alt="" className={styles.image} />
      </div>
      <div className={styles.content}>
        <div className={styles.tags}>
          {project.tags.map((tag) => (
            <span key={tag} className={styles.tag}>{tag}</span>
          ))}
        </div>
        <h2 className={styles.title}>{project.title}</h2>
        <p className={styles.description}>{project.shortDescription}</p>
        <span className={styles.cta} aria-hidden="true">Open demo</span>
      </div>
    </a>
  );
}
