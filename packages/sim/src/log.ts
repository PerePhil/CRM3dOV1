import type { EventPayloads, SimEvent, SimEventType } from "./events";

/** Append-only event log. Events can only be added, never mutated or removed. */
export interface EventLog {
  emit<K extends SimEventType>(
    tick: number,
    type: K,
    source: string,
    payload: EventPayloads[K],
  ): void;
  readonly events: readonly SimEvent[];
  /** Events of one type, typed. */
  ofType<K extends SimEventType>(type: K): Extract<SimEvent, { type: K }>[];
}

export function createEventLog(tickHz: number): EventLog {
  if (!(tickHz > 0)) throw new Error(`createEventLog: tickHz must be > 0, got ${tickHz}`);
  const events: SimEvent[] = [];
  let lastTick = 0;
  return {
    emit(tick, type, source, payload) {
      if (!Number.isInteger(tick) || tick < lastTick) {
        throw new Error(`EventLog: tick must be a non-decreasing integer (got ${tick} after ${lastTick})`);
      }
      lastTick = tick;
      const ev = Object.freeze({ seq: events.length, tick, t: tick / tickHz, type, source, payload });
      events.push(ev as SimEvent);
    },
    get events() {
      return events;
    },
    ofType<K extends SimEventType>(type: K) {
      return events.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);
    },
  };
}
