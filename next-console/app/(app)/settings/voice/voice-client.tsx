"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ConsoleMirrorScrollPadding,
  ConsoleMirrorSectionHeader,
} from "@/components/console-mirror";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AudioMode,
  TranscriptionProviderType,
} from "@/lib/voice-settings-api";
import { voiceSettingsApi } from "@/lib/voice-settings-api";
import { useAppShell } from "../../app-shell";
import { VoiceToolbar } from "./voice-toolbar";
import {
  QK_AUDIO_MODE,
  QK_LOCAL_WHISPER,
  QK_TRANSCRIPTION_PROVIDERS,
  QK_TRANSCRIPTION_TYPE,
} from "./voice-domain";
import { Loader2Icon } from "lucide-react";

export function VoiceClient() {
  const queryClient = useQueryClient();
  const { showLeftSidebar, toggleLeftSidebar } = useAppShell();

  const audioQuery = useQuery({
    queryKey: QK_AUDIO_MODE,
    queryFn: () => voiceSettingsApi.getAudioMode(),
  });
  const typeQuery = useQuery({
    queryKey: QK_TRANSCRIPTION_TYPE,
    queryFn: () => voiceSettingsApi.getTranscriptionProviderType(),
  });
  const localQuery = useQuery({
    queryKey: QK_LOCAL_WHISPER,
    queryFn: () => voiceSettingsApi.getLocalWhisperStatus(),
  });
  const providersQuery = useQuery({
    queryKey: QK_TRANSCRIPTION_PROVIDERS,
    queryFn: () => voiceSettingsApi.getTranscriptionProviders(),
  });

  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: QK_AUDIO_MODE });
    void queryClient.invalidateQueries({ queryKey: QK_TRANSCRIPTION_TYPE });
    void queryClient.invalidateQueries({ queryKey: QK_LOCAL_WHISPER });
    void queryClient.invalidateQueries({
      queryKey: QK_TRANSCRIPTION_PROVIDERS,
    });
  }, [queryClient]);

  const fetching =
    audioQuery.isFetching ||
    typeQuery.isFetching ||
    localQuery.isFetching ||
    providersQuery.isFetching;

  const putAudio = useMutation({
    mutationFn: (audio_mode: AudioMode) =>
      voiceSettingsApi.putAudioMode(audio_mode),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QK_AUDIO_MODE });
    },
  });

  const putType = useMutation({
    mutationFn: (transcription_provider_type: TranscriptionProviderType) =>
      voiceSettingsApi.putTranscriptionProviderType(
        transcription_provider_type,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QK_TRANSCRIPTION_TYPE });
    },
  });

  const putProvider = useMutation({
    mutationFn: (provider_id: string) =>
      voiceSettingsApi.putTranscriptionProvider(provider_id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: QK_TRANSCRIPTION_PROVIDERS,
      });
    },
  });

  const audioMode = audioQuery.data?.audio_mode;
  const providerType = typeQuery.data?.transcription_provider_type;
  const providers = providersQuery.data?.providers ?? [];
  const configuredId = providersQuery.data?.configured_provider_id ?? "";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-base">
      <VoiceToolbar
        showLeftSidebar={showLeftSidebar}
        onToggleLeftSidebar={toggleLeftSidebar}
        onRefresh={invalidateAll}
        refreshing={fetching}
      />

      <ScrollArea className="min-h-0 flex-1">
        <ConsoleMirrorScrollPadding className="space-y-4">
          <ConsoleMirrorSectionHeader
            title="语音转写"
            description="配置入站语音消息的转写方式与音频处理模式, 与模型侧能力及已配置的 Provider 相关."
          />

          {audioQuery.isError || typeQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>加载配置失败</AlertTitle>
              <AlertDescription>
                {audioQuery.error instanceof Error
                  ? audioQuery.error.message
                  : typeQuery.error instanceof Error
                    ? typeQuery.error.message
                    : "未知错误"}
              </AlertDescription>
            </Alert>
          ) : null}

          <Card className="transition-all duration-200 hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">转写后端</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {typeQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" />
                  加载中...
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium leading-none text-foreground">
                    transcription_provider_type
                  </span>
                  <Select
                    value={providerType}
                    disabled={putType.isPending}
                    onValueChange={(v) =>
                      putType.mutate(v as TranscriptionProviderType)
                    }
                  >
                    <SelectTrigger className="max-w-md transition-all duration-150 hover:border-primary/50 focus:ring-primary/30">
                      <SelectValue placeholder="选择" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="disabled">disabled</SelectItem>
                      <SelectItem value="whisper_api">whisper_api</SelectItem>
                      <SelectItem value="local_whisper">
                        local_whisper
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {putType.isError ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        {putType.error instanceof Error
                          ? putType.error.message
                          : "保存失败"}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="transition-all duration-200 hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">音频消息模式</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {audioQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" />
                  加载中...
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    auto: 尽量转写; native: 直接送模型 (可能依赖 ffmpeg).
                  </p>
                  <Select
                    value={audioMode}
                    disabled={putAudio.isPending}
                    onValueChange={(v) => putAudio.mutate(v as AudioMode)}
                  >
                    <SelectTrigger className="max-w-md transition-all duration-150 hover:border-primary/50 focus:ring-primary/30">
                      <SelectValue placeholder="选择" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">auto</SelectItem>
                      <SelectItem value="native">native</SelectItem>
                    </SelectContent>
                  </Select>
                  {putAudio.isError ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        {putAudio.error instanceof Error
                          ? putAudio.error.message
                          : "保存失败"}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          {providerType === "whisper_api" ? (
            <Card className="transition-all duration-200 hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground">
                  Whisper API Provider
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {providersQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2Icon className="size-4 animate-spin" />
                    加载中...
                  </div>
                ) : providers.length === 0 ? (
                  <Alert>
                    <AlertTitle>无可用 Provider</AlertTitle>
                    <AlertDescription>
                      请在「模型」设置中添加带有效凭据的 OpenAI 兼容或 Ollama
                      端点后再选择.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <span className="text-sm font-medium leading-none text-foreground">
                      transcription_provider_id
                    </span>
                    <Select
                      value={configuredId || "__unset__"}
                      disabled={putProvider.isPending}
                      onValueChange={(v) =>
                        putProvider.mutate(v === "__unset__" ? "" : v)
                      }
                    >
                      <SelectTrigger className="max-w-md transition-all duration-150 hover:border-primary/50 focus:ring-primary/30">
                        <SelectValue placeholder="未设置" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unset__">(未设置)</SelectItem>
                        {providers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {putProvider.isError ? (
                      <Alert variant="destructive">
                        <AlertDescription>
                          {putProvider.error instanceof Error
                            ? putProvider.error.message
                            : "保存失败"}
                        </AlertDescription>
                      </Alert>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          {providerType === "local_whisper" ? (
            <Card className="transition-all duration-200 hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground">本机 Whisper 环境</CardTitle>
              </CardHeader>
              <CardContent>
                {localQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2Icon className="size-4 animate-spin" />
                    检测中...
                  </div>
                ) : localQuery.isError ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {localQuery.error instanceof Error
                        ? localQuery.error.message
                        : "检测失败"}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="text-muted-foreground">可用:</span>
                      {localQuery.data?.available ? (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          是
                        </span>
                      ) : (
                        <span className="font-medium text-amber-600 dark:text-amber-400">否</span>
                      )}
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-muted-foreground">ffmpeg:</span>
                      <span className={localQuery.data?.ffmpeg_installed ? "text-foreground" : "text-muted-foreground"}>
                        {localQuery.data?.ffmpeg_installed ? "已安装" : "未安装"}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-muted-foreground">openai-whisper:</span>
                      <span className={localQuery.data?.whisper_installed ? "text-foreground" : "text-muted-foreground"}>
                        {localQuery.data?.whisper_installed ? "已安装" : "未安装"}
                      </span>
                    </li>
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
        </ConsoleMirrorScrollPadding>
      </ScrollArea>
    </div>
  );
}
