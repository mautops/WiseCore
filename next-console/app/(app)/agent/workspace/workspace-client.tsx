"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConsoleMirrorScrollPadding } from "@/components/console-mirror";
import { agentConfigApi } from "@/lib/agent-config-api";
import { agentsRegistryApi } from "@/lib/agents-registry-api";
import { workspaceApi, type WorkingMdFile } from "@/lib/workspace-api";
import { useAppShell } from "../../app-shell";
import { WorkspaceFileEditor } from "./workspace-file-editor";
import { WorkspaceFileListPanel } from "./workspace-file-list-panel";
import { WorkspaceNewDialog } from "./workspace-new-dialog";
import { WorkspaceToolbar } from "./workspace-toolbar";
import {
  DEFAULT_NEW_MD_BODY,
  getParentDir,
  isDailyMemoryFilename,
  MAX_EDITOR_BYTES,
  MAX_ZIP_UPLOAD_BYTES,
  WORKSPACE_SELECTED_AGENT_STORAGE_KEY,
  qkWorkspaceFiles,
  qkWorkspaceMemoryFiles,
  qkWorkspaceSystemPrompt,
  sortFilesByEnabled,
  workspaceFileContentKey,
} from "./workspace-domain";

const QK_AGENTS_REGISTRY = ["core", "agents", "registry"] as const;

export function WorkspaceClient() {
  const queryClient = useQueryClient();
  const { showLeftSidebar, toggleLeftSidebar } = useAppShell();
  const zipInputRef = useRef<HTMLInputElement>(null);

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBody, setNewBody] = useState(DEFAULT_NEW_MD_BODY);
  const [zipBusy, setZipBusy] = useState(false);
  const [expandedMemory, setExpandedMemory] = useState(false);

  const agentsQuery = useQuery({
    queryKey: QK_AGENTS_REGISTRY,
    queryFn: () => agentsRegistryApi.list(),
  });

  const agents = agentsQuery.data?.agents ?? [];
  const sortedAgents = useMemo(() => {
    const copy = [...agents];
    copy.sort((a, b) =>
      a.name.localeCompare(b.name, "zh-Hans-CN", { sensitivity: "base" }),
    );
    return copy;
  }, [agents]);

  useEffect(() => {
    if (sortedAgents.length === 0) return;
    const valid =
      selectedAgentId != null &&
      selectedAgentId !== "" &&
      sortedAgents.some((a) => a.id === selectedAgentId);
    if (valid) return;
    let next: string | null = null;
    try {
      const s = localStorage.getItem(WORKSPACE_SELECTED_AGENT_STORAGE_KEY);
      if (s && sortedAgents.some((a) => a.id === s)) next = s;
    } catch {
      /* ignore */
    }
    if (!next) next = sortedAgents[0]!.id;
    setSelectedAgentId(next);
  }, [sortedAgents, selectedAgentId]);

  const systemPromptQuery = useQuery({
    queryKey:
      selectedAgentId != null
        ? qkWorkspaceSystemPrompt(selectedAgentId)
        : (["core", "workspace", "system-prompt", "none"] as const),
    queryFn: () => {
      if (!selectedAgentId) throw new Error("no agent");
      return agentConfigApi.getSystemPromptFiles(selectedAgentId);
    },
    enabled: Boolean(selectedAgentId),
  });

  const enabledFiles = systemPromptQuery.data ?? [];

  const listQuery = useQuery({
    queryKey:
      selectedAgentId != null
        ? qkWorkspaceFiles(selectedAgentId)
        : (["core", "workspace", "files", "none"] as const),
    queryFn: () => {
      if (!selectedAgentId) throw new Error("no agent");
      return workspaceApi.listWorkingFiles(selectedAgentId);
    },
    enabled: Boolean(selectedAgentId),
  });

  const rawFiles = listQuery.data ?? [];
  const sortedFiles = useMemo(
    () => sortFilesByEnabled(rawFiles, enabledFiles),
    [rawFiles, enabledFiles],
  );

  const workspacePath = useMemo(() => {
    if (!selectedAgentId) return null;
    if (listQuery.isLoading && !listQuery.data) return null;
    if (rawFiles.length === 0) return "";
    return getParentDir(rawFiles[0]!.path);
  }, [selectedAgentId, listQuery.isLoading, listQuery.data, rawFiles]);

  const memoryQuery = useQuery({
    queryKey:
      selectedAgentId != null
        ? qkWorkspaceMemoryFiles(selectedAgentId)
        : (["core", "workspace", "memory", "none"] as const),
    queryFn: () => {
      if (!selectedAgentId) throw new Error("no agent");
      return workspaceApi.listMemoryFiles(selectedAgentId);
    },
    enabled: Boolean(selectedAgentId) && expandedMemory,
  });

  const dailyMemories = memoryQuery.data ?? [];

  const selectedMeta = useMemo(
    () => sortedFiles.find((f) => f.filename === selected) ?? null,
    [sortedFiles, selected],
  );

  const memoryMeta = useMemo(
    () => dailyMemories.find((f) => f.filename === selected) ?? null,
    [dailyMemories, selected],
  );

  const activeMeta = useMemo((): WorkingMdFile | null => {
    if (!selected) return null;
    if (isDailyMemoryFilename(selected)) {
      return (
        memoryMeta ?? {
          filename: selected,
          path: `memory/${selected}`,
          size: 0,
          created_time: "",
          modified_time: "",
        }
      );
    }
    return selectedMeta;
  }, [selected, memoryMeta, selectedMeta]);

  const tooLarge = activeMeta != null && activeMeta.size > MAX_EDITOR_BYTES;

  const fileQuery = useQuery({
    queryKey:
      selectedAgentId != null
        ? workspaceFileContentKey(selectedAgentId, selected)
        : (["core", "workspace", "file", "none", ""] as const),
    queryFn: async () => {
      if (!selectedAgentId || !selected) throw new Error("no file");
      if (isDailyMemoryFilename(selected)) {
        return workspaceApi.getMemoryFile(selectedAgentId, selected);
      }
      return workspaceApi.getWorkingFile(selectedAgentId, selected);
    },
    enabled: Boolean(selectedAgentId) && Boolean(selected) && !tooLarge,
  });

  useEffect(() => {
    if (!selected || tooLarge) {
      setEditorContent("");
      setSavedContent("");
      return;
    }
    setEditorContent("");
    setSavedContent("");
  }, [selected, tooLarge, selectedAgentId]);

  useEffect(() => {
    if (!selected || tooLarge || !fileQuery.data) return;
    setEditorContent(fileQuery.data.content);
    setSavedContent(fileQuery.data.content);
  }, [selected, tooLarge, fileQuery.data]);

  const dirty = selected != null && !tooLarge && editorContent !== savedContent;

  const invalidateList = useCallback(() => {
    if (!selectedAgentId) return;
    void queryClient.invalidateQueries({
      queryKey: qkWorkspaceFiles(selectedAgentId),
    });
  }, [queryClient, selectedAgentId]);

  const saveMutation = useMutation({
    mutationFn: ({
      agentId,
      filename,
      content,
    }: {
      agentId: string;
      filename: string;
      content: string;
    }) =>
      isDailyMemoryFilename(filename)
        ? workspaceApi.saveMemoryFile(agentId, filename, content)
        : workspaceApi.saveWorkingFile(agentId, filename, content),
    onSuccess: async (_, vars) => {
      setSavedContent(vars.content);
      await queryClient.invalidateQueries({
        queryKey: qkWorkspaceFiles(vars.agentId),
      });
      await queryClient.invalidateQueries({
        queryKey: workspaceFileContentKey(vars.agentId, vars.filename),
      });
      if (isDailyMemoryFilename(vars.filename)) {
        await queryClient.invalidateQueries({
          queryKey: qkWorkspaceMemoryFiles(vars.agentId),
        });
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: ({
      agentId,
      filename,
      content,
    }: {
      agentId: string;
      filename: string;
      content: string;
    }) => workspaceApi.saveWorkingFile(agentId, filename, content),
    onSuccess: async (_, vars) => {
      setNewOpen(false);
      setNewName("");
      setNewBody(DEFAULT_NEW_MD_BODY);
      await queryClient.invalidateQueries({
        queryKey: qkWorkspaceFiles(vars.agentId),
      });
      setSelected(vars.filename);
    },
  });

  const updateSystemPromptMutation = useMutation({
    mutationFn: ({ agentId, files }: { agentId: string; files: string[] }) =>
      agentConfigApi.putSystemPromptFiles(files, agentId),
    onSuccess: async (_, vars) => {
      await queryClient.invalidateQueries({
        queryKey: qkWorkspaceSystemPrompt(vars.agentId),
      });
    },
  });

  const trySelect = useCallback(
    (filename: string) => {
      if (dirty && selected !== filename) {
        if (!window.confirm("当前文件有未保存修改, 确定切换?")) return;
      }
      setSelected(filename);
    },
    [dirty, selected],
  );

  const handleAgentChange = useCallback(
    (id: string) => {
      if (id === selectedAgentId) return;
      if (dirty) {
        if (!window.confirm("当前文件有未保存修改, 确定切换 Agent?")) {
          return;
        }
      }
      setSelectedAgentId(id);
      try {
        localStorage.setItem(WORKSPACE_SELECTED_AGENT_STORAGE_KEY, id);
      } catch {
        /* ignore */
      }
      setSelected(null);
      setExpandedMemory(false);
      setEditorContent("");
      setSavedContent("");
    },
    [selectedAgentId, dirty],
  );

  const handleFileClick = useCallback(
    (file: (typeof sortedFiles)[number]) => {
      if (file.filename === "MEMORY.md") {
        if (expandedMemory && selected === "MEMORY.md") {
          setExpandedMemory(false);
          return;
        }
        setExpandedMemory(true);
        if (selectedAgentId) {
          void queryClient.invalidateQueries({
            queryKey: qkWorkspaceMemoryFiles(selectedAgentId),
          });
        }
      }
      trySelect(file.filename);
    },
    [expandedMemory, selected, trySelect, queryClient, selectedAgentId],
  );

  const handleDailyMemoryClick = useCallback(
    (daily: (typeof dailyMemories)[number]) => {
      trySelect(daily.filename);
    },
    [trySelect],
  );

  const handleToggleEnabled = useCallback(
    (filename: string) => {
      if (!selectedAgentId) return;
      const enabling = !enabledFiles.includes(filename);
      if (enabling && filename === "MEMORY.md") {
        window.alert(
          "将 MEMORY.md 纳入系统提示可能显著增加 token 消耗, 请确认这是你想要的配置.",
        );
      }
      const next = enabling
        ? [...enabledFiles.filter((f) => f !== filename), filename]
        : enabledFiles.filter((f) => f !== filename);
      updateSystemPromptMutation.mutate({
        agentId: selectedAgentId,
        files: next,
      });
    },
    [enabledFiles, updateSystemPromptMutation, selectedAgentId],
  );

  const handleReorderEnabled = useCallback(
    (order: string[]) => {
      if (!selectedAgentId) return;
      updateSystemPromptMutation.mutate({
        agentId: selectedAgentId,
        files: order,
      });
    },
    [updateSystemPromptMutation, selectedAgentId],
  );

  const handleDownload = async () => {
    if (!selectedAgentId) return;
    try {
      setZipBusy(true);
      const { blob, filename } =
        await workspaceApi.downloadZip(selectedAgentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      window.alert((e as Error).message);
    } finally {
      setZipBusy(false);
    }
  };

  const handleUploadPick = () => zipInputRef.current?.click();

  const onZipSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedAgentId) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      window.alert("请上传 .zip 文件");
      return;
    }
    if (file.size > MAX_ZIP_UPLOAD_BYTES) {
      window.alert(`文件过大, 最大 ${MAX_ZIP_UPLOAD_BYTES / (1024 * 1024)} MB`);
      return;
    }
    try {
      setZipBusy(true);
      await workspaceApi.uploadZip(selectedAgentId, file);
      await invalidateList();
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setZipBusy(false);
    }
  };

  const refreshAll = useCallback(() => {
    void agentsQuery.refetch();
    void listQuery.refetch();
    void systemPromptQuery.refetch();
    if (expandedMemory) void memoryQuery.refetch();
  }, [agentsQuery, listQuery, systemPromptQuery, memoryQuery, expandedMemory]);

  const busy =
    zipBusy ||
    agentsQuery.isLoading ||
    listQuery.isLoading ||
    saveMutation.isPending ||
    createMutation.isPending ||
    updateSystemPromptMutation.isPending;

  const noAgents = !agentsQuery.isLoading && sortedAgents.length === 0;
  const actionsDisabled = sortedAgents.length === 0 || !selectedAgentId;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-base">
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={onZipSelected}
      />

      <WorkspaceToolbar
        showLeftSidebar={showLeftSidebar}
        onToggleLeftSidebar={toggleLeftSidebar}
        agents={sortedAgents.map((a) => ({ id: a.id, name: a.name }))}
        selectedAgentId={selectedAgentId}
        onAgentChange={handleAgentChange}
        agentsLoading={agentsQuery.isLoading}
        workspacePath={workspacePath}
        onNewClick={() => setNewOpen(true)}
        onDownloadClick={() => void handleDownload()}
        onUploadClick={handleUploadPick}
        busy={busy}
        actionsDisabled={actionsDisabled}
      />

      {noAgents ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
          <p className="m-0">当前没有可用 Agent.</p>
          <Link
            href="/settings/agents"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            前往 Agent 管理
          </Link>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 pt-4 pb-2 min-[900px]:flex-row min-[900px]:gap-4">
          <WorkspaceFileListPanel
            files={sortedFiles}
            selectedFilename={selected}
            dailyMemories={dailyMemories}
            expandedMemory={expandedMemory}
            enabledFilenames={enabledFiles}
            filterQuery={filterQuery}
            onFilterQueryChange={setFilterQuery}
            listLoading={listQuery.isLoading}
            listError={listQuery.error as Error | null}
            onRefresh={refreshAll}
            onFileClick={handleFileClick}
            onDailyMemoryClick={handleDailyMemoryClick}
            onToggleEnabled={handleToggleEnabled}
            onReorderEnabled={handleReorderEnabled}
          />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
            {saveMutation.isError ? (
              <p className="shrink-0 text-sm text-destructive">
                {(saveMutation.error as Error).message}
              </p>
            ) : null}
            {selected && tooLarge && activeMeta ? (
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 text-sm">
                <p className="m-0 font-mono font-medium">
                  {activeMeta.filename}
                </p>
                <p className="mt-2 text-muted-foreground">
                  该文件约 {(activeMeta.size / (1024 * 1024)).toFixed(2)} MB,
                  超过在线编辑上限 ({MAX_EDITOR_BYTES / 1024} KB).
                  请使用「下载」ZIP 在本地编辑后再上传.
                </p>
              </div>
            ) : (
              <>
                {fileQuery.isError && selected ? (
                  <p className="shrink-0 text-sm text-destructive">
                    {(fileQuery.error as Error).message}
                  </p>
                ) : null}
                <WorkspaceFileEditor
                  selectedFile={activeMeta}
                  fileContent={editorContent}
                  loading={saveMutation.isPending || fileQuery.isFetching}
                  hasChanges={dirty}
                  onContentChange={setEditorContent}
                  onSave={() => {
                    if (!selected || !selectedAgentId) return;
                    saveMutation.mutate({
                      agentId: selectedAgentId,
                      filename: selected,
                      content: editorContent,
                    });
                  }}
                  onReset={() => setEditorContent(savedContent)}
                />
              </>
            )}
          </div>
        </div>
      )}

      <ConsoleMirrorScrollPadding className="pb-3">
        <p className="m-0 text-right text-[11px] text-[#bbb] dark:text-white/20">
          工作区文件用于构建 Agent 系统提示; 与 legacy 控制台一致, 支持 ZIP
          导入导出与 MEMORY 日记忆文件. 切换工具栏中的 Agent
          可编辑不同实例的工作区.
        </p>
      </ConsoleMirrorScrollPadding>

      <WorkspaceNewDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        name={newName}
        onNameChange={setNewName}
        content={newBody}
        onContentChange={setNewBody}
        createMutation={createMutation}
        agentId={selectedAgentId}
      />
    </div>
  );
}
