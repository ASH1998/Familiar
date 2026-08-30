/**
 * Ambient types for the WebMCP browser API.
 *
 * Spec: https://webmachinelearning.github.io/webmcp/
 * The getter moved from Navigator to Document in the 2026-05-27 draft;
 * `navigator.modelContext` is deprecated as of Chromium 150. We declare both so the
 * runtime fallback in shim.ts type-checks.
 */

interface ModelContextToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
}

interface ToolExecuteCallbackOptions {
  signal?: AbortSignal;
}

interface ModelContextTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: object;
  annotations?: ModelContextToolAnnotations;
  /**
   * Chrome's implementation documents a string return; the spec allows `any`.
   * We always return strings — it satisfies both.
   */
  execute: (
    input: Record<string, unknown>,
    options?: ToolExecuteCallbackOptions,
  ) => Promise<string> | string;
}

interface RegisteredTool {
  name: string;
  description: string;
  inputSchema?: object;
}

interface ModelContextRegisterToolOptions {
  signal?: AbortSignal;
}

interface ModelContext extends EventTarget {
  registerTool(
    tool: ModelContextTool,
    options?: ModelContextRegisterToolOptions,
  ): Promise<void>;
  /** Not in the spec IDL; present in some builds. shim.ts probes for it. */
  unregisterTool?(name: string): void;
  getTools(options?: { fromOrigins?: string[] }): Promise<RegisteredTool[]>;
  executeTool(
    tool: RegisteredTool,
    input?: object | string,
    options?: { signal?: AbortSignal },
  ): Promise<string>;
  ontoolchange: ((this: ModelContext, ev: Event) => unknown) | null;
}

interface Document {
  readonly modelContext?: ModelContext;
}

interface Navigator {
  /** @deprecated Chromium 150. Use `document.modelContext`. */
  readonly modelContext?: ModelContext;
}
