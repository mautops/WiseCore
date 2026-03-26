import { apiRequest } from "./api-utils";

export interface ActiveHoursPayload {
  start: string;
  end: string;
}

/** Matches GET response (alias activeHours) and PUT body. */
export interface HeartbeatPayload {
  enabled: boolean;
  every: string;
  target: string;
  activeHours: ActiveHoursPayload | null;
}

export const heartbeatApi = {
  get: () => apiRequest<unknown>("/config/heartbeat"),

  put: (body: HeartbeatPayload) =>
    apiRequest<unknown>("/config/heartbeat", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};