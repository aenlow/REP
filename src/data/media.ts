import type { MediaManifestEntry } from '../types';
import { SEED_EXERCISES } from './exercises';

/**
 * Bundled media manifest. As of this release NO third-party demonstration
 * media is bundled — see MEDIA_AUDIT.md for the licensing investigation.
 * Every exercise uses REP's own movement diagram, labelled as such.
 *
 * To bundle a licensed asset later: put it in public/media/<exercise-id>.<ext>,
 * fill in the entry below (license, attribution, sourceUrl, verified: true).
 */
const NOT_BUNDLED_NOTE =
  'No licensed demonstration available to bundle. Showing REP movement diagram. You can attach your own media on the exercise page.';

export const MEDIA_MANIFEST: MediaManifestEntry[] = SEED_EXERCISES.map((e) => ({
  exerciseId: e.id,
  assetPath: null,
  format: null,
  attribution: null,
  license: null,
  sourceUrl: null,
  cachePolicy: 'none',
  fallback: 'movement-diagram',
  verified: false,
  status: 'not-bundled',
  note: NOT_BUNDLED_NOTE,
}));

export function manifestFor(exerciseId: string): MediaManifestEntry | undefined {
  return MEDIA_MANIFEST.find((m) => m.exerciseId === exerciseId);
}

const SAFE_ASSET = /^media\/[a-z0-9][a-z0-9-]{0,80}\.(mp4|webm|gif|webp|png|jpg)$/;

/**
 * Resolve a bundled asset path relative to the app. Rejects anything that
 * could escape the media directory (absolute URLs, `..`, protocols, query strings).
 */
export function resolveLocalAsset(path: unknown): string | null {
  if (typeof path !== 'string') return null;
  if (!SAFE_ASSET.test(path)) return null;
  return `./${path}`;
}
