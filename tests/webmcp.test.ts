import { afterEach, describe, expect, it, vi } from "vitest";
import { detectUnregisterStrategy } from "../src/webmcp/shim.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WebMCP unregistration detection", () => {
  it("removes both registrations used by the AbortSignal probe", async () => {
    const registered = new Set<string>();
    const registerTool = vi.fn(
      async (tool: ModelContextTool, options?: ModelContextRegisterToolOptions) => {
        if (registered.has(tool.name)) throw new DOMException("duplicate", "InvalidStateError");
        registered.add(tool.name);
        options?.signal?.addEventListener("abort", () => registered.delete(tool.name), {
          once: true,
        });
      },
    );

    vi.stubGlobal("document", { modelContext: { registerTool } });
    vi.stubGlobal("navigator", {});

    await expect(detectUnregisterStrategy()).resolves.toBe("abort");
    expect(registerTool).toHaveBeenCalledTimes(2);
    expect(registered).toEqual(new Set());
  });
});
