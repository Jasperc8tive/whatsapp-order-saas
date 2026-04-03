type ErrorLike = {
  message?: string;
  code?: string;
  status?: number;
};

function rawMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as ErrorLike).message;
    if (typeof msg === "string") return msg;
  }
  return "";
}

/**
 * Convert technical/server errors into polished user-facing copy.
 */
export function toUserFacingError(error: unknown, fallback: string): string {
  const message = rawMessage(error).trim();
  const lowered = message.toLowerCase();
  const status = (error as ErrorLike | undefined)?.status;
  const code = (error as ErrorLike | undefined)?.code;

  if (code === "RATE_LIMITED" || status === 429 || lowered.includes("too many requests")) {
    return "Too many requests right now. Please wait a few seconds and try again.";
  }

  if (status === 401 || lowered.includes("unauthorized") || lowered.includes("not authenticated")) {
    return "Your session has expired. Please sign in again.";
  }

  if (status === 403 || lowered.includes("forbidden")) {
    return "You do not have permission to perform this action.";
  }

  if (status === 404 || lowered.includes("not found")) {
    return "The requested item could not be found.";
  }

  if (status === 409 || lowered.includes("duplicate") || lowered.includes("already exists")) {
    return "This item already exists. Please check your input and try again.";
  }

  if (lowered.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }

  if (lowered.includes("email not confirmed")) {
    return "Please confirm your email address before signing in.";
  }

  if (lowered.includes("network") || lowered.includes("failed to fetch") || lowered.includes("timeout")) {
    return "Network issue detected. Check your internet connection and try again.";
  }

  if (lowered.startsWith("request failed:")) {
    return fallback;
  }

  if (!message) return fallback;
  return message;
}
