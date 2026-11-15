import { useThree } from "@react-three/fiber";
import { type RefObject, useMemo } from "react";

/**
 * A fixed DOM target for every drei <Html> in the scene. Pass it as `portal`.
 *
 * Without it, drei 10.7 mounts <Html> into the canvas parent, then switches its target to
 * `events.connected` once R3F connects events. The switch runs the old target's cleanup, which
 * unmounts the inner React root during the commit: React logs "Attempted to synchronously
 * unmount a root while React was already rendering" (dev builds) and the first content can come
 * back empty. Pinning the target means the root is created once and never torn down.
 */
export function useHtmlPortal(): RefObject<HTMLElement> {
  const gl = useThree((s) => s.gl);
  // The canvas is always mounted inside a wrapper div here, so parentElement is non-null.
  return useMemo(() => ({ current: gl.domElement.parentElement }), [gl]) as RefObject<HTMLElement>;
}
