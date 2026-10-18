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
  const [building, setBuilding] = useState({ projectId, id: "" });
  const buildingId = building.projectId === projectId ? building.id : "";
  const [revision, setRevision] = useState(0);
  const [paused, setPaused] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    key: "",
    status: "loading",
    discovery: null,
    data: null,
  });
  const key = JSON.stringify([projectId, buildingId, page, revision, paused]);
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
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "hidden") refresh();
    }, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", visibility);
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", visibility);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    activeRead.current = controller;
    setSnapshot({ key, status: "loading", discovery: null, data: null });
    if (!paused)
      void (async () => {
        let discovery: ManagementProjects | null = null;
        try {
          discovery = await api.projects(page, controller.signal);
          if (controller.signal.aborted) return;
          // Direct links are independent of the current discovery page.
          const data = projectId ? await api.hierarchy(projectId, controller.signal) : null;
          if (controller.signal.aborted) return;
          const status =
            buildingId && !data?.buildings.some((b) => b.id === buildingId)
              ? "unavailable"
              : !discovery.hasManagementAccess
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
  }, [api, projectId, buildingId, page, key, paused]);
  const view: Snapshot =
    snapshot.key === key ? snapshot : { key, status: "loading", discovery: null, data: null };
  return {
    ...view,
    selectedProjectId: projectId,
    buildingId,
    onBuildingChange: (id: string) => setBuilding({ projectId, id }),
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
