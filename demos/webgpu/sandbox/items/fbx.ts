import type { Engine, IGameObject } from '@engine';
import type { FbxSpawnContext } from './types';

// ── Catalog ───────────────────────────────────────────────────────────────────

const SUFFIX_MODIFIERS = new Set(['detail', 'empty', 'noSides']);

function formatFbxLabel(rawPath: string): string {
  const filename = rawPath.split('/').pop()!;
  const base = filename.replace(/^square_/, '').replace(/\.fbx$/i, '');
  const segments = base.split('_');

  const modifiers: string[] = [];
  while (segments.length > 0 && SUFFIX_MODIFIERS.has(segments[segments.length - 1])) {
    modifiers.unshift(segments.pop()!);
  }

  const expandSegment = (segment: string): string => {
    const words = segment.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ');
    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const mainLabel = segments.map(expandSegment).join(' ');
  const expandedModifiers = modifiers.map(expandSegment);

  return expandedModifiers.length > 0
    ? `${mainLabel} - ${expandedModifiers.join(' - ')}`
    : mainLabel;
}

const rawFbxUrls = import.meta.glob(
  '../../../../src/assets/fbx/*.fbx',
  { query: '?url', import: 'default', eager: true },
) as Record<string, string>;

export const FBX_CATALOG: { label: string; url: string }[] = Object.entries(rawFbxUrls)
  .map(([rawPath, url]) => ({ label: formatFbxLabel(rawPath), url }))
  .sort((a, b) => a.label.localeCompare(b.label));

// ── Spawn ─────────────────────────────────────────────────────────────────────

export function spawn(engine: Engine, context: FbxSpawnContext): IGameObject {
  return engine.createFbxModel({
    renderable: {
      asset: context.asset,
      tint:  [1, 1, 1, 1],
    },
    position:   [0, 0, 0],
    quaternion: [0, 0, 0, 1],
    scale:      [1, 1, 1],
    rigidbody:  context.rigidbody,
    hitbox:     context.hitbox,
  });
}
