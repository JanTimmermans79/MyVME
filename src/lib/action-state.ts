/** Client-veilige types/constanten voor server actions (geen server-only imports). */

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

export const IDLE: ActionState = { ok: false };
