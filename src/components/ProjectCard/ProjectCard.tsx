import { Card, CardActionArea, Chip, Typography } from '@mui/material';
import type { ProjectMeta } from '@lib/projects/types';
import styles from './ProjectCard.module.css';

interface Props {
  project: ProjectMeta
  index: number
}

export default function ProjectCard({ project, index }: Props) {
  const reversed = index % 2 !== 0;

  return (
    <Card className={styles.cardNotLast}>
      <CardActionArea
        href={project.demoUrl}
        className={styles.actionArea}
        sx={{
          display: 'flex',
          flexDirection: reversed ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: '3rem',
          padding: '3rem',
        }}
      >
        <div className={styles.imageWrapper}>
          <img src={project.previewImage} alt="" className={styles.image} />
        </div>
        <div className={styles.content}>
          <div className={styles.tags}>
            {project.tags.map((tag) => (
              <Chip key={tag} label={tag} size="small" />
            ))}
          </div>
          <Typography variant="h5" component="h2">{project.title}</Typography>
          <Typography variant="body2" color="text.secondary">{project.shortDescription}</Typography>
          <Typography variant="body2" color="primary" className={styles.cta}>Open demo</Typography>
        </div>
      </CardActionArea>
    </Card>
  );
}
