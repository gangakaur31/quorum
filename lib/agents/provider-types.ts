export type ProviderId = "anthropic" | "groq" | "gemini";

export type ProviderErrorCategory =
  | "configuration" | "authentication" | "billing" | "rate_limit"
  | "network" | "timeout" | "provider_unavailable" | "unsupported_model"
  | "context_limit" | "invalid_output" | "truncated_output" | "schema_validation" | "refusal" | "cancelled" | "unknown";

export type PublicProviderError = {
  category: ProviderErrorCategory;
  message: string;
  retryable: boolean;
  provider?: ProviderId;
  model?: string;
  status?: number;
  requestId?: string;
};

export type ProviderUsage = { inputTokens?: number; outputTokens?: number; totalTokens?: number; cacheReadInputTokens?: number; cacheCreationInputTokens?: number };
export type ProviderAttempt = {
  provider: ProviderId;
  model: string;
  attempt: number;
  latencyMs: number;
  outcome: "completed" | "failed";
  category?: ProviderErrorCategory;
  usage?: ProviderUsage;
  validationStatus?: "passed" | "failed" | "not-run";
};

export type ProviderMetadata = {
  provider: ProviderId;
  model: string;
  task?: string;
  requestId?: string;
  latencyMs: number;
  attempts: number;
  fallbackUsed: boolean;
  usage?: ProviderUsage;
  completedAt: string;
  history: ProviderAttempt[];
  retryCount?: number;
  validationStatus?: "passed";
  fallbackReason?: ProviderErrorCategory;
  cacheRequested?: boolean;
};

export type ProviderOptions<T> = {
  task?: string;
  provider?: ProviderId;
  model?: string;
  signal?: AbortSignal;
  validate?: (value: unknown) => T;
  /** Opt out of the central Claude -> Groq recovery policy (e.g. explicit probes). */
  fallback?: boolean;
  timeoutMs?: number;
  deadlineMs?: number;
  maxRetries?: number;
  maxTokens?: number;
  maxRepairs?: number;
  /** Stable system prefix only; never put private project records in this field. */
  cachePrefix?: string;
  onMetadata?: (metadata: ProviderMetadata) => void;
  onStatus?: (status: { state: "running" | "retrying" | "fallback"; provider: ProviderId; model: string; attempt: number }) => void;
};
