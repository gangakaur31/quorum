/** Output ceilings, not requested lengths or measured token savings. */
export const TASK_OUTPUT_BUDGETS: Record<string, number> = {
  generate: 8192, jury: 1600, discover: 4096, marketing: 1200,
  confidence: 1600, interview: 2048, knowledge: 2048, smoke: 256, preflight: 256,
};
export function taskOutputBudget(task?: string) { return TASK_OUTPUT_BUDGETS[task ?? ""] ?? 4096; }
