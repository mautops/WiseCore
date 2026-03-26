"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
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
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { showLeftSidebar, toggleLeftSidebar, user } = useAppShell();

  const [selected, setSelected] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
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

  // 处理从新建页面跳转回来的高亮（只执行一次）
  const highlightProcessed = useRef(false);
  const highlight = searchParams.get("highlight");

  useEffect(() => {
    if (highlight && listQuery.isSuccess && !highlightProcessed.current) {
      highlightProcessed.current = true;
      const exists = sorted.some((w) => w.filename === highlight);
      if (exists) {
        // 使用 setTimeout 避免在 effect 中直接 setState
        setTimeout(() => {
          setSelected(highlight);
          setSheetOpen(true);
        }, 0);
      }
      // 清除 URL 参数
      router.replace("/agent/workflows");
    }
  }, [highlight, listQuery.isSuccess, sorted, router]);

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

  const handleCreateClick = useCallback(() => {
    router.push("/agent/workflows/new");
  }, [router]);

  const onSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) setSelected(null);
  };

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
            onCreateClick={handleCreateClick}
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

      <WorkflowDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        filename={selected}
        deleteMutation={deleteMutation}
      />
    </div>
  );
}