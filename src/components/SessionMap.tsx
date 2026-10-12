import type { Session } from '../types';
import { entryFor } from '../lib/session';

/**
 * The 3×3 session map: one column per block, one row per exercise slot,
 * three ticks per cell for the rounds. Doubles as the progress indicator.
 * Works for non-3×3×3 templates too (columns = blocks, rows = max slots).
 */
export function SessionMap({ session, onJump }: { session: Session; onJump?: (block: number, slot: number) => void }) {
  const t = session.snapshot;
  const maxSlots = Math.max(1, ...t.blocks.map((b) => b.slots.length));
  const cur = session.cursor;
  return (
    <div className="map" style={{ gridTemplateColumns: `repeat(${t.blocks.length}, 1fr)` }} role="group" aria-label="Session map">
      {Array.from({ length: maxSlots }).flatMap((_, slot) =>
        t.blocks.map((b, block) => {
          const s = b.slots[slot];
          if (!s) return <span key={`${block}-${slot}`} className="map__cell map__cell--empty" />;
          const rounds = Array.from({ length: b.rounds }, (_, round) => entryFor(session, { block, round, slot }).status);
          const done = rounds.filter((r) => r !== 'pending').length;
          const isCur = cur.block === block && cur.slot === slot;
          const label = `Block ${block + 1}, exercise ${slot + 1}: ${done} of ${b.rounds} rounds logged${isCur ? ', current' : ''}`;
          const content = (
            <>
              {rounds.map((r, i) => (
                <i key={i} className={`map__tick map__tick--${r}${isCur && cur.round === i ? ' map__tick--current' : ''}`} />
              ))}
            </>
          );
          return onJump ? (
            <button
              type="button"
              key={`${block}-${slot}`}
              className={`map__cell${isCur ? ' map__cell--current' : ''}`}
              onClick={() => onJump(block, slot)}
              aria-label={label}
              aria-current={isCur ? 'step' : undefined}
            >
              {content}
            </button>
          ) : (
            <span key={`${block}-${slot}`} className={`map__cell${isCur ? ' map__cell--current' : ''}`} role="img" aria-label={label}>
              {content}
            </span>
          );
        }),
      )}
    </div>
  );
}
