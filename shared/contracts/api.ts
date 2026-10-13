export interface ApiErrorBody {
  code: string;
  messageKey: string;
  retryable: boolean;
  revision?: number;
}

export interface SessionResponse {
  memberId: string;
  deviceId: string;
  expiresAt: string;
}
