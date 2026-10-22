"use client";
import { useEffect, useRef, useState } from "react";
import type { ManagementHierarchy, ManagementProjects } from "@/lib/access/management-contracts";
import { managementApi, ManagementRequestError, type ManagementApi } from "./management-api";
export type ManagementStatus =
  "loading" | "ready" | "empty" | "forbidden" | "unavailable" | "expired" | "error";
type Snapshot = {
  key: string;
  status: ManagementStatus;
  discovery: ManagementProjects | null;
  data: ManagementHierarchy | null;
};
export function useManagement(projectId: string, api: ManagementApi = managementApi) {
  const [page, setPage] = useState(1);
  const [building, setBuilding] = useState({ projectId, ids: [] as string[] });
  const buildingIds = building.projectId === projectId ? building.ids : [];
  const [revision, setRevision] = useState(0);
  const [paused, setPaused] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    key: "",
    status: "loading",
    discovery: null,
    data: null,
  });
  const key = JSON.stringify([projectId, page, revision, paused]);
  const latestKey = useRef(key);
  latestKey.current = key;
  const activeRead = useRef<AbortController | null>(null);
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
    window.addEventListener("focus", refresh);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", visibility);
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", visibility);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    activeRead.current = controller;
    // Preserve the current project header while a background refresh is in flight.
    // Authorization failures still clear the snapshot in the catch branch.
    setSnapshot((previous) => ({
      key,
      status: "loading",
      discovery: previous.data?.id === projectId ? previous.discovery : null,
      data: previous.data?.id === projectId ? previous.data : null,
    }));
    if (!paused)
      void (async () => {
        let discovery: ManagementProjects | null = null;
        try {
          discovery = await api.projects(page, controller.signal);
          if (controller.signal.aborted) return;
          // Direct links are independent of the current discovery page.
          const data = projectId ? await api.hierarchy(projectId, controller.signal) : null;
          if (controller.signal.aborted) return;
          const status = !discovery.hasManagementAccess
            ? "forbidden"
            : !projectId && !discovery.projects.length
              ? "empty"
              : "ready";
          setSnapshot({ key, status, discovery, data: status === "ready" ? data : null });
        } catch (cause) {
          if (controller.signal.aborted) return;
          const code = cause instanceof ManagementRequestError ? cause.status : 0;
          const status =
            code === 401 ? "expired" : code === 403 || code === 404 ? "unavailable" : "error";
          // Only fresh discovery may survive a detail 404, allowing explicit navigation away.
          setSnapshot({
            key,
            status,
            discovery: status === "unavailable" ? discovery : null,
            data: null,
          });
        }
      })();
    return () => controller.abort();
  }, [api, projectId, page, key, paused]);
  const view: Snapshot =
    snapshot.key === key
      ? snapshot
      : {
          key,
          status: "loading",
          discovery: snapshot.data?.id === projectId ? snapshot.discovery : null,
          data: snapshot.data?.id === projectId ? snapshot.data : null,
        };
  // The authorized hierarchy already includes every accessible building. Filtering
  // it is local and must not restart project discovery or unmount the workspace.
  const unavailableBuilding =
    view.status === "ready" &&
    buildingIds.some((id) => !view.data?.buildings.some((building) => building.id === id));
  return {
    ...view,
    status: unavailableBuilding ? ("unavailable" as const) : view.status,
    data: unavailableBuilding ? null : view.data,
    selectedProjectId: projectId,
    buildingIds,
    onBuildingChange: (ids: string[]) => setBuilding({ projectId, ids }),
    onPageChange: setPage,
    onRefresh: () => setRevision((n) => n + 1),
    onAccessLost: (status: number) => {
      activeRead.current?.abort();
      setSnapshot({
        key: latestKey.current,
        status: status === 401 ? "expired" : "unavailable",
        discovery: null,
        data: null,
      });
    },
  };
}
