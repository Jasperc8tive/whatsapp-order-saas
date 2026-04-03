import { toUserFacingError } from "./userFacingError";
import { INLINE_ERROR_MESSAGES } from "./inlineErrorMessages";

export type InlineErrorSetter = (value: string | null) => void;
export type AnalyticsInlineErrorKind = "load" | "liveKpis";

export function clearInlineError(setter: InlineErrorSetter): void {
  setter(null);
}

export function setInlineError(
  setter: InlineErrorSetter,
  error: unknown,
  fallback: string
): void {
  setter(toUserFacingError(error, fallback));
}

export function setInlineErrorMessage(
  setter: InlineErrorSetter,
  message: string
): void {
  setter(message);
}

export function setDashboardInlineError(
  setter: InlineErrorSetter,
  error: unknown
): void {
  setInlineError(setter, error, INLINE_ERROR_MESSAGES.dashboardRefresh);
}

export function setAnalyticsInlineError(
  setter: InlineErrorSetter,
  error: unknown,
  kind: AnalyticsInlineErrorKind = "load"
): void {
  const fallback =
    kind === "liveKpis"
      ? INLINE_ERROR_MESSAGES.analyticsLiveKpis
      : INLINE_ERROR_MESSAGES.analyticsLoad;
  setInlineError(setter, error, fallback);
}

export function setAnalyticsInlineErrorMessage(
  setter: InlineErrorSetter,
  kind: AnalyticsInlineErrorKind = "load"
): void {
  const message =
    kind === "liveKpis"
      ? INLINE_ERROR_MESSAGES.analyticsLiveKpis
      : INLINE_ERROR_MESSAGES.analyticsLoad;
  setInlineErrorMessage(setter, message);
}

export function setLoyaltyInlineError(
  setter: InlineErrorSetter,
  error: unknown
): void {
  setInlineError(setter, error, INLINE_ERROR_MESSAGES.loyaltyActivity);
}
