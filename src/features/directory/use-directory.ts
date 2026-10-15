"use client";
import { useEffect, useRef, useState } from "react";
import type { DirectoryPage, DirectoryProject, DirectoryQuery } from "@/lib/access/contracts";
import { directoryApi, DirectoryRequestError, type DirectoryApi } from "./directory-api";
export type DirectoryStatus = "loading" | "ready" | "unlinked" | "error" | "expired" | "forbidden";
type Snapshot = {
  key: string;
  status: DirectoryStatus;
  projects: DirectoryProject[];
  selectedProjectId: string;
  data: DirectoryPage | null;
};
const initialQuery: DirectoryQuery = { query: "", buildingId: "", page: 1 };
export function useDirectory(api: DirectoryApi = directoryApi) {
  const initialProject = useRef("");
  const [projectId, setProjectId] = useState("");
  const [query, setQuery] = useState(initialQuery);
  const [revision, setRevision] = useState(0);
  const [paused, setPaused] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    key: "",
    status: "loading",
    projects: [],
    selectedProjectId: "",
    data: null,
  });
  const key = JSON.stringify([projectId, query, revision, paused]);
  useEffect(() => {
    const refresh = () => setRevision((n) => n + 1);
    const visibility = () => {
      setPaused(document.visibilityState === "hidden");
      refresh();
    };
    const hide = () => {
      setPaused(true);
      refresh();
    };
    const show = () => {
      setPaused(document.visibilityState === "hidden");
      refresh();
    };
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "hidden") refresh();
    }, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    // Discard resident values on every request, including hidden tabs and revalidation.
    setSnapshot((previous) => ({ ...previous, key, status: "loading", data: null }));
    if (paused) return () => controller.abort();
    const timer = window.setTimeout(async () => {
      let projects: DirectoryProject[] = [];
      try {
        projects = await api.projects(controller.signal);
        if (controller.signal.aborted) return;
        if (!projects.length) {
          setSnapshot({ key, status: "unlinked", projects: [], selectedProjectId: "", data: null });
          return;
        }
        const selected = projectId || initialProject.current || projects[0].id;
        if (!projects.some((p) => p.id === selected)) {
          setSnapshot({ key, status: "forbidden", projects, selectedProjectId: "", data: null });
          return;
        }
        const permittedProject = projects.find((p) => p.id === selected)!;
        if (
          query.buildingId &&
          !permittedProject.buildings.some((b) => b.id === query.buildingId)
        ) {
          setSnapshot({
            key,
            status: "loading",
            projects,
            selectedProjectId: selected,
            data: null,
          });
          setQuery((q) => ({ ...q, buildingId: "", page: 1 }));
          return;
        }
        initialProject.current = selected;
        const data = await api.residents(selected, query, controller.signal);
        if (!controller.signal.aborted)
          setSnapshot({ key, status: "ready", projects, selectedProjectId: selected, data });
      } catch (error) {
        if (controller.signal.aborted) return;
        const status = error instanceof DirectoryRequestError ? error.status : 0;
        setSnapshot({
          key,
          status:
            status === 401 ? "expired" : status === 403 || status === 404 ? "forbidden" : "error",
          projects: [],
          selectedProjectId: "",
          data: null,
        });
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [api, projectId, query, key, paused]);
  // A new filter invalidates the old list during render, before the effect begins.
  const view =
    snapshot.key === key ? snapshot : { ...snapshot, status: "loading" as const, data: null };
  return {
    ...view,
    selectedProjectId: projectId || view.selectedProjectId,
    query,
    onProjectChange: (id: string) => {
      setProjectId(id);
      setQuery(initialQuery);
    },
    onQueryChange: (value: string) => setQuery((q) => ({ ...q, query: value, page: 1 })),
    onBuildingChange: (id: string) => setQuery((q) => ({ ...q, buildingId: id, page: 1 })),
    onPageChange: (page: number) => setQuery((q) => ({ ...q, page })),
    onRefresh: () => setRevision((n) => n + 1),
  };
}
