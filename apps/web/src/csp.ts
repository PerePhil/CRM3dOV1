import { config } from "zod";

/**
 * Must be the first import in main.tsx. Zod v4 probes `new Function("")` to decide whether to
 * JIT-compile parsers. Our CSP has no 'unsafe-eval', so that probe raises a CSP violation.
 * jitless mode skips the probe; the only cost is slightly slower parsing of the small catalog.
 */
config({ jitless: true });
