"use client";
import { createContext } from "react";
import type { useHouseholdWorkspace } from "./use-household-workspace";
export const HouseholdNavigationContext = createContext<ReturnType<
  typeof useHouseholdWorkspace
> | null>(null);
