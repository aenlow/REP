import { useEffect, useRef, useState } from 'react';
import type { Exercise, MovementPattern } from '../types';
import { manifestFor, resolveLocalAsset } from '../data/media';
import { useStore } from '../app/store';
import { Icon } from './Icon';

/** Direction-of-force glyphs for REP's own movement diagrams (not demonstrations). */
const GLYPH: Record<MovementPattern, string> = {
  hinge: 'M30 70 Q30 30 70 22 M64 14 L72 22 L62 28',
  'horizontal push': 'M24 48 H86 M76 38 L88 48 L76 58',
  'incline push': 'M28 70 L80 24 M66 22 L82 22 L80 38',
  'horizontal pull': 'M92 48 H32 M42 38 L30 48 L42 58',
  'vertical pull': 'M56 14 V74 M46 64 L56 76 L66 64',
  'face pull': 'M92 52 L36 34 M44 26 L32 33 L42 44',
  'knee extension': 'M34 70 Q34 30 74 30 M66 22 L76 30 L66 38',
  'knee flexion': 'M80 30 Q34 30 34 70 M26 62 L34 72 L42 62',
  squat: 'M56 14 V74 M46 26 L56 14 L66 26 M46 62 L56 74 L66 62',
  'elbow flexion': 'M40 72 Q40 34 74 26 M64 20 L76 26 L68 36',
  'elbow extension': 'M74 22 Q40 30 40 70 M32 62 L40 72 L48 62',
  'core stability': 'M22 48 H90 M34 38 L22 48 L34 58 M78 38 L90 48 L78 58',
};

function MovementDiagram({ exercise }: { exercise: Exercise }) {
  return (
    <svg viewBox="0 0 112 88" className="diagram" aria-hidden="true">
      <path d={GLYPH[exercise.movement] ?? GLYPH['core stability']} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
    </svg>
  );
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Exercise demonstration. Order: the user's own attached media → bundled
 * licensed media (none at present) → REP movement diagram, clearly labelled.
 */
export function ExerciseMedia({ exercise, size = 'large' }: { exercise: Exercise; size?: 'large' | 'small' }) {
  const { state, actions } = useStore();
  const mediaMeta = state.kind === 'ready' ? state.data.mediaIndex.find((m) => m.id === exercise.userMediaId) : undefined;
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(!prefersReducedMotion());
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    setFailed(false);
    setUrl(null);
    if (exercise.userMediaId) {
      actions
        .getMediaBlob(exercise.userMediaId)
        .then((blob) => {
          if (cancelled) return;
          if (!blob) return setFailed(true);
          revoked = URL.createObjectURL(blob);
          setUrl(revoked);
        })
        .catch(() => !cancelled && setFailed(true));
    } else {
      const bundled = resolveLocalAsset(manifestFor(exercise.id)?.assetPath);
      if (bundled) setUrl(bundled);
    }
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [exercise.id, exercise.userMediaId, actions]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) v.play().catch(() => setPlaying(false));
    else v.pause();
  }, [playing, url]);

  const isVideo = mediaMeta?.mimeType.startsWith('video/') ?? false;
  const isGif = mediaMeta?.mimeType === 'image/gif';

  if (url && !failed) {
    return (
      <figure className={`media media--${size}`}>
        {isVideo ? (
          <video
            ref={videoRef}
            src={url}
            muted
            loop
            playsInline
            preload="auto"
            autoPlay={playing}
            onError={() => setFailed(true)}
            aria-label={`${exercise.name} demonstration`}
          />
        ) : isGif && !playing ? (
          <button type="button" className="media__paused" onClick={() => setPlaying(true)}>
            <Icon name="play" />
            <span>Play animation</span>
          </button>
        ) : (
          <img src={url} alt={`${exercise.name} demonstration`} onError={() => setFailed(true)} decoding="async" />
        )}
        {(isVideo || isGif) && size === 'large' ? (
          <button type="button" className="media__toggle icon-btn" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause demonstration' : 'Play demonstration'}>
            <Icon name={playing ? 'pause' : 'play'} />
          </button>
        ) : null}
        {mediaMeta?.attribution && size === 'large' ? <figcaption>{mediaMeta.attribution}</figcaption> : null}
      </figure>
    );
  }

  return (
    <figure className={`media media--${size} media--fallback`}>
      <MovementDiagram exercise={exercise} />
      {size === 'large' ? (
        <figcaption>
          <span className="media__pattern">{exercise.movement}</span>
          <span className="media__note">
            {failed ? 'Your attached media could not be loaded. Re-attach it on the exercise page.' : 'No demonstration bundled. REP diagram shows direction of movement only.'}
          </span>
        </figcaption>
      ) : null}
    </figure>
  );
}
