import { apiRequest } from "./api-utils";

export type AudioMode = "auto" | "native";

export type TranscriptionProviderType =
  | "disabled"
  | "whisper_api"
  | "local_whisper";

export interface LocalWhisperStatus {
  available: boolean;
  ffmpeg_installed: boolean;
  whisper_installed: boolean;
}

export interface TranscriptionProviderOption {
  id: string;
  name: string;
  available: boolean;
}

export interface TranscriptionProvidersResponse {
  providers: TranscriptionProviderOption[];
  configured_provider_id: string;
}

export const voiceSettingsApi = {
  getAudioMode: () =>
    apiRequest<{ audio_mode: AudioMode }>("/agent/audio-mode"),
  putAudioMode: (audio_mode: AudioMode) =>
    apiRequest<{ audio_mode: AudioMode }>("/agent/audio-mode", {
      method: "PUT",
      body: JSON.stringify({ audio_mode }),
    }),
  getTranscriptionProviderType: () =>
    apiRequest<{ transcription_provider_type: TranscriptionProviderType }>(
      "/agent/transcription-provider-type",
    ),
  putTranscriptionProviderType: (
    transcription_provider_type: TranscriptionProviderType,
  ) =>
    apiRequest<{ transcription_provider_type: TranscriptionProviderType }>(
      "/agent/transcription-provider-type",
      {
        method: "PUT",
        body: JSON.stringify({ transcription_provider_type }),
      },
    ),
  getLocalWhisperStatus: () =>
    apiRequest<LocalWhisperStatus>("/agent/local-whisper-status"),
  getTranscriptionProviders: () =>
    apiRequest<TranscriptionProvidersResponse>(
      "/agent/transcription-providers",
    ),
  putTranscriptionProvider: (provider_id: string) =>
    apiRequest<{ provider_id: string }>("/agent/transcription-provider", {
      method: "PUT",
      body: JSON.stringify({ provider_id }),
    }),
};