import axios from "axios";

export type ApiErrorKind =
  "network" | "timeout" | "validation" | "unauthorized" | "forbidden" | "conflict" | "server" | "unknown";

/**
 * One error type for the whole UI. Components decide what to show based on
 * `kind` (translated) and may display `serverMessage` (from {"message": "..."}).
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  readonly serverMessage: string | undefined;

  constructor(kind: ApiErrorKind, status?: number, serverMessage?: string) {
    super(serverMessage ?? kind);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

function kindFromStatus(status: number): ApiErrorKind {
  if (status === 400 || status === 422) return "validation";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 409) return "conflict";
  if (status >= 500) return "server";
  return "unknown";
}

function readServerMessage(data: unknown): string | undefined {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return undefined;
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return new ApiError("timeout");
    if (!error.response) return new ApiError("network");
    const { status, data } = error.response;
    return new ApiError(kindFromStatus(status), status, readServerMessage(data));
  }

  return new ApiError("unknown");
}
