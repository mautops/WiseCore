"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ensureWorkflowMarkdownFilename,
  workflowApi,
  type WorkflowInfo,
} from "@/lib/workflow-api";
import {
  WORKFLOW_CHAT_EXEC_STORAGE_KEY,
  type WorkflowChatExecPayload,
} from "@/lib/workflow-chat-bridge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { scopeUserFromSessionUser } from "@/lib/workflow-username";
import { useAppShell } from "../../app-shell";
import {
  DEFAULT_NEW_WORKFLOW_MARKDOWN,
  WorkflowCreateDialog,
} from "./workflow-create-dialog";
import { WorkflowDeleteDialog } from "./workflow-delete-dialog";
import { WorkflowDetailSheet } from "./workflow-detail-sheet";
import {
  matchesWorkflowFilter,
  PAGE_SIZE,
  QK_LIST,
  qkDetail,
  workflowCatalogValue,
  workflowDisplayTitle,
  workflowsForCatalogTab,
} from "./workflow-domain";
import { WorkflowListContent } from "./workflow-list-content";
import { WorkflowPaginationFooter } from "./workflow-pagination-footer";
import { WorkflowSearchDialog } from "./workflow-search-dialog";
import { WorkflowToolbar } from "./workflow-toolbar";

function readModifierKeyPrefix(): string {
  return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? "⌘" : "Ctrl+";
}

export function WorkflowsClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showLeftSidebar, toggleLeftSidebar, user } = useAppShell();

  const [selected, setSelected] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState(DEFAULT_NEW_WORKFLOW_MARKDOWN);
  const [page, setPage] = useState(1);
  const [filterQuery, setFilterQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [catalogTab, setCatalogTab] = useState<string>("all");

  const modifierKeyPrefix = useSyncExternalStore(
    () => () => {},
    readModifierKeyPrefix,
    () => "Ctrl+",
  );

  const commandDialogMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        const t = e.target as HTMLElement | null;
        if (t?.closest("[data-skip-cmd-k]")) return;
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const listQuery = useQuery({
    queryKey: QK_LIST,
    queryFn: () => workflowApi.list().then((r) => r.workflows),
  });

  const detailQuery = useQuery({
    queryKey: selected ? qkDetail(selected) : ["core", "workflow", "__none__"],
    queryFn: () => workflowApi.get(selected!),
    enabled: Boolean(selected) && sheetOpen,
  });

  const sorted = useMemo(() => {
    const rows = listQuery.data ?? [];
    return [...rows].sort((a, b) => a.filename.localeCompare(b.filename));
  }, [listQuery.data]);

  const filtered = useMemo(
    () => sorted.filter((w) => matchesWorkflowFilter(w, filterQuery)),
    [sorted, filterQuery],
  );

  const dynamicCatalogTabs = useMemo(() => {
    const seen = new Set<string>();
    for (const w of filtered) {
      const s = workflowCatalogValue(w);
      if (s) seen.add(s);
    }
    return [...seen].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  }, [filtered]);

  const workflowCatalogTabValues = useMemo(
    () => ["all", ...dynamicCatalogTabs],
    [dynamicCatalogTabs],
  );

  const tabCounts = useMemo(() => {
    const c: Record<string, number> = { all: filtered.length };
    for (const w of filtered) {
      const s = workflowCatalogValue(w);
      if (s) c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [filtered]);

  const effectiveCatalogTab =
    catalogTab === "all" || dynamicCatalogTabs.includes(catalogTab)
      ? catalogTab
      : "all";

  const tabFiltered = useMemo(
    () => workflowsForCatalogTab(filtered, effectiveCatalogTab),
    [filtered, effectiveCatalogTab],
  );

  const totalPages = Math.max(1, Math.ceil(tabFiltered.length / PAGE_SIZE));
  const effectivePage = Math.min(Math.max(1, page), totalPages);

  const handleFilterQueryChange = useCallback((value: string) => {
    setFilterQuery(value);
    setPage(1);
  }, []);

  const handleCatalogTabChange = useCallback((tab: string) => {
    setCatalogTab(tab);
    setPage(1);
  }, []);

  const selectedMeta = useMemo(
    () => sorted.find((w) => w.filename === selected),
    [sorted, selected],
  );

  const invalidateList = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: QK_LIST });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: (body: { filename: string; content: string }) =>
      workflowApi.create({
        ...body,
        filename: ensureWorkflowMarkdownFilename(body.filename),
      }),
    onSuccess: async (_, vars) => {
      setCreateOpen(false);
      setNewName("");
      setNewContent(DEFAULT_NEW_WORKFLOW_MARKDOWN);
      await invalidateList();
      setSelected(vars.filename);
      setSheetOpen(true);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => workflowApi.delete(selected!),
    onSuccess: async () => {
      setDeleteOpen(false);
      setSheetOpen(false);
      setSelected(null);
      await invalidateList();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (body: { filename: string; content: string }) =>
      workflowApi.update(body.filename, body.content),
    onSuccess: async (_, vars) => {
      await queryClient.invalidateQueries({
        queryKey: qkDetail(vars.filename),
      });
      await invalidateList();
    },
  });

  const openSheet = (w: (typeof sorted)[number]) => {
    setSelected(w.filename);
    setSheetOpen(true);
    setSearchOpen(false);
  };

  const handleExecuteWorkflow = useCallback(
    async (w: WorkflowInfo) => {
      const userId = scopeUserFromSessionUser(user ?? {}) ?? "default";
      try {
        const detail = await workflowApi.get(w.filename);
        const payload: WorkflowChatExecPayload = {
          markdown: detail.raw,
          sessionTitle: workflowDisplayTitle(w),
          workflowFilename: w.filename,
          userId,
        };
        sessionStorage.setItem(
          WORKFLOW_CHAT_EXEC_STORAGE_KEY,
          JSON.stringify(payload),
        );
        router.push("/agent/chat?execWorkflow=1");
      } catch (err) {
        console.error(err);
      }
    },
    [router, user],
  );

  const onSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) setSelected(null);
  };

  const canCreate = newName.trim().length > 0;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-base">
      <WorkflowSearchDialog
        mounted={commandDialogMounted}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        filterQuery={filterQuery}
        onFilterQueryChange={handleFilterQueryChange}
        filtered={filtered}
        onPick={openSheet}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <ScrollArea className="min-h-0 flex-1">
          <WorkflowToolbar
            showLeftSidebar={showLeftSidebar}
            onToggleLeftSidebar={toggleLeftSidebar}
            filterQuery={filterQuery}
            onOpenSearch={() => setSearchOpen(true)}
            onCreateClick={() => {
              setNewName("");
              setNewContent(DEFAULT_NEW_WORKFLOW_MARKDOWN);
              setCreateOpen(true);
            }}
            modifierKeyPrefix={modifierKeyPrefix}
          />
          <WorkflowListContent
            listQuery={listQuery}
            sorted={sorted}
            filtered={filtered}
            tabValue={effectiveCatalogTab}
            onTabChange={handleCatalogTabChange}
            workflowCatalogTabValues={workflowCatalogTabValues}
            tabCounts={tabCounts}
            page={effectivePage}
            modifierKeyPrefix={modifierKeyPrefix}
            onOpenWorkflow={openSheet}
            onExecuteWorkflow={handleExecuteWorkflow}
          />
        </ScrollArea>

        <WorkflowPaginationFooter
          visible={tabFiltered.length > 0}
          page={effectivePage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>

      <WorkflowDetailSheet
        open={sheetOpen}
        onOpenChange={onSheetOpenChange}
        selectedFilename={selected}
        selectedMeta={selectedMeta}
        detailQuery={detailQuery}
        updateMutation={updateMutation}
        onRequestDelete={() => setDeleteOpen(true)}
      />

      <WorkflowCreateDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (open) {
            setNewName("");
            setNewContent(DEFAULT_NEW_WORKFLOW_MARKDOWN);
          }
        }}
        newName={newName}
        onNewNameChange={setNewName}
        newContent={newContent}
        onNewContentChange={setNewContent}
        canCreate={canCreate}
        createMutation={createMutation}
      />

      <WorkflowDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        filename={selected}
        deleteMutation={deleteMutation}
      />
    </div>
  );
}
