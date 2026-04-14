import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.d.ts')) {
      const content = readFileSync(fullPath, 'utf8');
      if (content.trim() === '' || content.trim() === 'export {};') {
        rmSync(fullPath);
        console.log('removed empty declaration:', fullPath);
      }
    }
  }

  if (readdirSync(directory).length === 0) {
    rmSync(directory, { recursive: true });
    console.log('removed empty directory:', directory);
  }
}

walk('dist/engine');
