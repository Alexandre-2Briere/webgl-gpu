import { FaLinkedin, FaGithub } from 'react-icons/fa';
import styles from './SocialLinks.module.css';

export default function SocialLinks() {
  return (
    <nav className={styles.sidebar} aria-label="Social links">
      <ul className={styles.linkList}>
        <li>
          <a
            href="https://www.linkedin.com/in/alexandre-brière-7b6178198"
            className={styles.socialLink}
            aria-label="LinkedIn profile"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaLinkedin aria-hidden="true" focusable="false" />
          </a>
        </li>
        <li>
          <a
            href="https://github.com/Alexandre-2Briere/webgl-gpu"
            className={styles.socialLink}
            aria-label="GitHub profile"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaGithub aria-hidden="true" focusable="false" />
          </a>
        </li>
      </ul>
    </nav>
  );
}
