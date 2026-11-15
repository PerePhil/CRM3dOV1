/**
 * Timeline validation against the catalog. Every registered timeline runs through this in
 * timelines/registry.test.ts, so a typo'd ID or an impossible link state fails CI instead of
 * silently doing nothing on screen.
 */
import { catalog } from "@ov1/catalog";
import { NODE_LAYOUT } from "../scene/layout";
import { compileTimeline, JUMP_TOLERANCE } from "./compile";
import { positionAt } from "./evaluate";
import type { MotionSegment, Place, Timeline } from "./types";
import { distance } from "./vec";

const EPS = 1e-9;

export function validateTimeline(tl: Timeline): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(`${tl.id || "<no id>"}: ${m}`);

  const nodes = new Set(catalog.nodes.map((n) => n.id));
  const links = new Map(catalog.links.map((l) => [l.id, l]));
  const threats = new Set(catalog.threats.map((t) => t.id));
  const scenarios = new Set(catalog.scenarios.map((s) => s.id));

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(tl.id)) err("id must be kebab-case");
  if (!tl.label.trim()) err("label is empty");
  if (!(Number.isFinite(tl.durationS) && tl.durationS > 0)) err("durationS must be > 0");
  if (tl.scenarioId !== undefined && !scenarios.has(tl.scenarioId)) {
    err(`unknown scenarioId ${tl.scenarioId}`);
  }

  const checkPlace = (p: Place, where: string) => {
    if (Array.isArray(p)) {
      if (!p.every(Number.isFinite)) err(`${where}: non-finite coordinates`);
    } else if (!nodes.has(p.node) || !(p.node in NODE_LAYOUT)) {
      err(`${where}: unknown node ${p.node}`);
    }
  };

  const checkSegment = (s: MotionSegment, where: string) => {
    if (s.kind !== "samples" && !(s.durationS > 0)) err(`${where}: durationS must be > 0`);
    switch (s.kind) {
      case "hold":
        if (s.at) checkPlace(s.at, where);
        break;
      case "flyTo":
        checkPlace(s.to, where);
        break;
      case "orbit":
        checkPlace(s.center, where);
        if (!(s.radius > 0)) err(`${where}: radius must be > 0`);
        if (!(s.periodS > 0)) err(`${where}: periodS must be > 0`);
        break;
      case "path":
        if (s.through.length === 0) err(`${where}: path needs at least one point`);
        s.through.forEach((p, i) => {
          checkPlace(p, `${where}.through[${i}]`);
        });
        break;
      case "samples": {
        if (s.samples.length < 2) err(`${where}: need at least two samples`);
        for (let i = 1; i < s.samples.length; i++) {
          const a = s.samples[i - 1];
          const b = s.samples[i];
          if (a && b && !(b.tS > a.tS)) err(`${where}: sample times must strictly increase`);
        }
        if ((s.samples[0]?.tS ?? 0) < 0) err(`${where}: sample times must be >= 0`);
        break;
      }
    }
  };

  for (const [id, track] of Object.entries(tl.actors ?? {})) {
    if (!nodes.has(id) || !(id in NODE_LAYOUT)) {
      err(`actor ${id} is not a catalog node with a layout position`);
      continue;
    }
    if (track.start) checkPlace(track.start, `actor ${id}.start`);
    track.segments.forEach((s, i) => {
      checkSegment(s, `actor ${id}.segments[${i}] (${s.kind})`);
    });
  }

  const checkKeys = (keys: readonly { tS: number }[], where: string) => {
    keys.forEach((k, i) => {
      if (!(k.tS >= 0 && k.tS <= tl.durationS + EPS)) err(`${where}[${i}]: tS outside timeline`);
      const prev = keys[i - 1];
      if (prev && k.tS < prev.tS) err(`${where}: keys must be sorted by tS`);
    });
  };

  for (const [id, keys] of Object.entries(tl.links ?? {})) {
    const link = links.get(id);
    if (!link) {
      err(`unknown link ${id}`);
      continue;
    }
    checkKeys(keys, `link ${id}`);
    for (const k of keys) {
      if (!link.states.includes(k.state)) err(`link ${id} cannot be "${k.state}"`);
    }
  }

  for (const [id, keys] of Object.entries(tl.threats ?? {})) {
    if (!threats.has(id)) err(`unknown threat ${id}`);
    checkKeys(keys, `threat ${id}`);
  }

  (tl.cues ?? []).forEach((c, i) => {
    const where = `cues[${i}] (${c.kind})`;
    if (!(c.tS >= 0 && c.tS <= tl.durationS + EPS)) err(`${where}: tS outside timeline`);
    if (c.durationS !== undefined && !(c.durationS > 0)) err(`${where}: durationS must be > 0`);
    if (!c.text.trim()) err(`${where}: empty text`);
    if (c.kind === "status" && !nodes.has(c.node)) err(`${where}: unknown node ${c.node}`);
  });

  (tl.steps ?? []).forEach((s, i) => {
    const where = `steps[${i}] (step ${s.n})`;
    if (!(s.tS >= 0 && s.tS <= tl.durationS + EPS)) err(`${where}: tS outside timeline`);
    const prev = tl.steps?.[i - 1];
    if (prev && !(s.tS > prev.tS)) err(`${where}: steps must have strictly increasing tS`);
    if (!s.title.trim()) err(`${where}: empty title`);
    if (s.watch?.some((w) => !w.trim())) err(`${where}: empty watch entry`);
  });

  // Structural checks passed: compile and check continuity.
  if (errors.length > 0) return errors;
  const ct = compileTimeline(tl);
  for (const m of ct.issues) err(m);
  for (const track of ct.tracks) {
    if (track.durationS > tl.durationS + EPS) {
      err(
        `actor ${track.nodeId} track runs ${track.durationS}s, past the ${tl.durationS}s timeline`,
      );
    }
    if (tl.loop) {
      const gap = distance(positionAt(track, 0), positionAt(track, tl.durationS));
      if (gap > JUMP_TOLERANCE) {
        err(`loop: actor ${track.nodeId} ends ${gap.toFixed(2)}u from its start; the loop jumps`);
      }
    }
  }
  return errors;
}
