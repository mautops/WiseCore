"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { workspaceApi } from "@/lib/workspace-api";
import { useAppShell } from "../../app-shell";
import { WorkspaceNewDialog } from "./workspace-new-dialog";
import {
  DEFAULT_NEW_MD_BODY,
  formatWorkspaceTime,
  matchesWorkspaceFilter,
  MAX_EDITOR_BYTES,
  MAX_ZIP_UPLOAD_BYTES,
  QK_WORKSPACE_FILES,
} from "./workspace-domain";
import { WorkspaceToolbar } from "./workspace-toolbar";
import { Loader2Icon, RotateCcwIcon, SaveIcon } from "lucide-react";

function fileQueryKey(filename: string | null) {
  return [...QK_WORKSPACE_FILES, "file", filename ?? ""] as const;
}

export function WorkspaceClient() {
  const queryClient = useQueryClient();
  const { showLeftSidebar, toggleLeftSidebar } = useAppShell();
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBody, setNewBody] = useState(DEFAULT_NEW_MD_BODY);
  const [zipBusy, setZipBusy] = useState(false);

  const listQuery = useQuery({
    queryKey: QK_WORKSPACE_FILES,
    queryFn: () => workspaceApi.listWorkingFiles(),
  });

  const files = listQuery.data ?? [];
  const sorted = useMemo(
    () => [...files].sort((a, b) => a.filename.localeCompare(b.filename)),
    [files],
  );
  const filtered = useMemo(
    () => sorted.filter((f) => matchesWorkspaceFilter(f, filterQuery)),
    [sorted, filterQuery],
  );

  const selectedMeta = useMemo(
    () => sorted.find((f) => f.filename === selected) ?? null,
    [sorted, selected],
  );

  const tooLarge = selectedMeta != null && selectedMeta.size > MAX_EDITOR_BYTES;

  const fileQuery = useQuery({
    queryKey: fileQueryKey(selected),
    queryFn: () => workspaceApi.getWorkingFile(selected!),
    enabled: Boolean(selected) && !tooLarge,
  });

  useEffect(() => {
    if (!selected || tooLarge) {
      setEditorContent("");
      setSavedContent("");
      return;
    }
    setEditorContent("");
    setSavedContent("");
  }, [selected, tooLarge]);

  useEffect(() => {
    if (!selected || tooLarge || !fileQuery.data) return;
    setEditorContent(fileQuery.data.content);
    setSavedContent(fileQuery.data.content);
  }, [selected, tooLarge, fileQuery.data]);

  const dirty = selected != null && !tooLarge && editorContent !== savedContent;

  const invalidateList = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: QK_WORKSPACE_FILES });
  }, [queryClient]);

  const saveMutation = useMutation({
    mutationFn: ({
      filename,
      content,
    }: {
      filename: string;
      content: string;
    }) => workspaceApi.saveWorkingFile(filename, content),
    onSuccess: async (_, vars) => {
      setSavedContent(vars.content);
      await invalidateList();
      await queryClient.invalidateQueries({
        queryKey: fileQueryKey(vars.filename),
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: ({
      filename,
      content,
    }: {
      filename: string;
      content: string;
    }) => workspaceApi.saveWorkingFile(filename, content),
    onSuccess: async (_, vars) => {
      setNewOpen(false);
      setNewName("");
      setNewBody(DEFAULT_NEW_MD_BODY);
      await invalidateList();
      setSelected(vars.filename);
    },
  });

  const pickFile = (fn: string) => {
    if (dirty) {
      if (!window.confirm("当前文件有未保存修改, 确定切换?")) return;
    }
    setSelected(fn);
  };

  const handleDownload = async () => {
    try {
      setZipBusy(true);
      const { blob, filename } = await workspaceApi.downloadZip();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert((e as Error).message);
    } finally {
      setZipBusy(false);
    }
  };

  const handleUploadPick = () => zipInputRef.current?.click();

  const onZipSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      alert("请上传 .zip 文件");
      return;
    }
    if (file.size > MAX_ZIP_UPLOAD_BYTES) {
      alert(`文件过大, 最大 ${MAX_ZIP_UPLOAD_BYTES / (1024 * 1024)} MB`);
      return;
    }
    try {
      setZipBusy(true);
      await workspaceApi.uploadZip(file);
      await invalidateList();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setZipBusy(false);
    }
  };

  const busy =
    zipBusy ||
    listQuery.isLoading ||
    saveMutation.isPending ||
    createMutation.isPending;

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
        filterQuery={filterQuery}
        onFilterQueryChange={setFilterQuery}
        onNewClick={() => setNewOpen(true)}
        onDownloadClick={handleDownload}
        onUploadClick={handleUploadPick}
        busy={busy}
      />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card/30">
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-2">
              {listQuery.isError && (
                <p className="p-2 text-sm text-destructive">
                  {(listQuery.error as Error).message}
                </p>
              )}
              {listQuery.isLoading && (
                <div className="flex justify-center py-8">
                  <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {!listQuery.isLoading &&
                sorted.length === 0 &&
                !listQuery.isError && (
                  <p className="p-3 text-sm text-muted-foreground">
                    根目录暂无 .md 文件, 可新建或上传 ZIP.
                  </p>
                )}
              <ul className="space-y-0.5">
                {filtered.map((f) => (
                  <li key={f.filename}>
                    <button
                      type="button"
                      onClick={() => pickFile(f.filename)}
                      className={`w-full rounded-md px-2 py-2 text-left text-sm transition-colors ${
                        selected === f.filename
                          ? "bg-accent font-medium text-accent-foreground"
                          : "hover:bg-muted/60"
                      }`}
                    >
                      <span className="block truncate font-mono">
                        {f.filename}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatWorkspaceTime(f.modified_time)} ·{" "}
                        {(f.size / 1024).toFixed(1)} KB
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollArea>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {!selected && (
            <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-muted-foreground">
              选择左侧文件进行编辑, 或新建 Markdown.
            </div>
          )}
          {selected && tooLarge && (
            <div className="m-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
              该文件约 {(selectedMeta!.size / (1024 * 1024)).toFixed(2)} MB,
              超过在线编辑上限 ({MAX_EDITOR_BYTES / 1024} KB). 请使用「下载
              ZIP」在本地编辑后再上传合并.
            </div>
          )}
          {selected && !tooLarge && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-sm font-medium">
                  {selected}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!dirty || saveMutation.isPending}
                  onClick={() => setEditorContent(savedContent)}
                >
                  <RotateCcwIcon className="size-4" />
                  撤销
                </Button>
                <Button
                  size="sm"
                  disabled={!dirty || saveMutation.isPending}
                  onClick={() =>
                    saveMutation.mutate({
                      filename: selected,
                      content: editorContent,
                    })
                  }
                >
                  {saveMutation.isPending && (
                    <Loader2Icon className="animate-spin" />
                  )}
                  <SaveIcon className="size-4" />
                  保存
                </Button>
              </div>
              {saveMutation.isError && (
                <p className="px-3 py-1 text-sm text-destructive">
                  {(saveMutation.error as Error).message}
                </p>
              )}
              {fileQuery.isError && (
                <p className="p-3 text-destructive">
                  {(fileQuery.error as Error).message}
                </p>
              )}
              {fileQuery.isLoading && (
                <div className="flex flex-1 items-center justify-center">
                  <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
                </div>
              )}
              {fileQuery.isSuccess && (
                <div className="min-h-0 flex-1 overflow-auto">
                  <Textarea
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                    spellCheck={false}
                    className="min-h-[min(70vh,720px)] w-full resize-y rounded-none border-0 font-mono text-sm focus-visible:ring-0"
                  />
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <WorkspaceNewDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        name={newName}
        onNameChange={setNewName}
        content={newBody}
        onContentChange={setNewBody}
        createMutation={createMutation}
      />
    </div>
  );
}
