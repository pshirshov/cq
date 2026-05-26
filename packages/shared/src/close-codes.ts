// WebSocket close codes per plan § 3.6.

export const NORMAL_CLOSURE = 1000 as const;
export const GOING_AWAY = 1001 as const;
export const POLICY_VIOLATION = 1008 as const;
export const INTERNAL_ERROR = 1011 as const;
export const SERVICE_RESTART = 1012 as const;
export const FRAME_VALIDATION_FAILED = 4000 as const;
export const SEQ_REPLAY_REJECTED = 4001 as const;
export const SESSION_SUPERSEDED = 4002 as const;

/**
 * Returns true if the WS close code indicates the client should reconnect.
 * Per plan § 3.6 [ws R7]: 4000 / 4002 / 1008 → not retriable;
 * 1001 / 1011 / 1012 / 4001 → retriable; 1000 → normal, no retry.
 */
export function isRetriable(code: number): boolean {
  switch (code) {
    case GOING_AWAY:
    case INTERNAL_ERROR:
    case SERVICE_RESTART:
    case SEQ_REPLAY_REJECTED:
      return true;
    default:
      return false;
  }
}
