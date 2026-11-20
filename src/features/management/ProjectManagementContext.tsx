"use client";
import { createContext } from "react";
import type { useManagement } from "./use-management";

export const ProjectManagementContext = createContext<ReturnType<typeof useManagement> | null>(
  null,
);

export const PendingInvitationCountContext = createContext<((count: number) => void) | null>(null);
