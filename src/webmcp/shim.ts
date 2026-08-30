/**
 * WebMCP feature detection and the unregistration fallback chain.
 *
 * Three moving parts we do not control:
 *   1. The getter moved Navigator -> Document (2026-05-27 draft). `navigator.modelContext`
 *      is deprecated as of Chromium 150 but still present in older runtimes.
 *   2. `AbortSignal`-based unregistration landed in Chrome 153. Older builds accept the
 *      signal and ignore it, so re-entering a room throws InvalidStateError on the
 *      duplicate name.
 *   3. Some builds expose a non-spec `unregisterTool(name)`.
 *
 * `unregister()` below tries these in order and reports which path it took, so the WebMCP
 * spike (PLAN.md step 3) can confirm the real behaviour instead of assuming it.
 */

export type UnregisterStrategy = "abort" | "unregisterTool" | "none";

export function mc(): ModelContext | undefined {
  return document.modelContext ?? navigator.modelContext;
}

export function hasWebMCP(): boolean {
  return typeof mc()?.registerTool === "function";
}

/** True when the deprecated Navigator location is the only one available. */
export function isLegacyLocation(): boolean {
  return !document.modelContext && !!navigator.modelContext;
}

/**
 * Probe how this runtime can drop tools. Cheap and side-effect-free apart from
 * registering and removing one throwaway tool.
 */
export async function detectUnregisterStrategy(): Promise<UnregisterStrategy> {
  const ctx = mc();
  if (!ctx) return "none";
  if (typeof ctx.unregisterTool === "function") return "unregisterTool";

  const probeName = `__df_probe_${Math.random().toString(36).slice(2, 8)}`;
  const controller = new AbortController();
  try {
    await ctx.registerTool(
      {
        name: probeName,
        description: "Internal capability probe. Ignore.",
        annotations: { readOnlyHint: true },
        execute: () => "probe",
      },
      { signal: controller.signal },
    );
    controller.abort();
    // If abort worked, the name is free and re-registering succeeds.
    const cleanupController = new AbortController();
    await ctx.registerTool(
      {
        name: probeName,
        description: "Internal capability probe. Ignore.",
        annotations: { readOnlyHint: true },
        execute: () => "probe",
      },
      { signal: cleanupController.signal },
    );
    // The second registration proves the name was released; release the proof as well.
    // Otherwise an internal __df_probe_* capability leaks into the real client's tool list.
    cleanupController.abort();
    return "abort";
  } catch {
    return "none";
  }
}

/**
 * Drop a set of tools. `controller.abort()` is the spec path; the rest is for runtimes
 * that predate it.
 */
export function unregister(
  names: string[],
  controller: AbortController,
  strategy: UnregisterStrategy,
): void {
  controller.abort();
  if (strategy === "unregisterTool") {
    const ctx = mc();
    for (const name of names) {
      try {
        ctx?.unregisterTool?.(name);
      } catch {
        // Already gone. Not worth failing a room transition over.
      }
    }
  }
}

/**
 * Last-resort name suffix for runtimes that expose WebMCP but cannot unregister at all.
 * Re-entering a room would otherwise throw on the duplicate name; a per-visit suffix keeps
 * the game playable at the cost of uglier tool names.
 *
 * Gated on `hasWebMCP()`: with no WebMCP there is nothing to collide with — the local
 * registry deletes its own entries cleanly — and suffixing there silently renamed every tool
 * out from under `callTool`, which broke the game in exactly the browsers used to develop it.
 */
export function visitSuffix(visit: number, strategy: UnregisterStrategy): string {
  return hasWebMCP() && strategy === "none" && visit > 1 ? `_v${visit}` : "";
}
