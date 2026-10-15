"use client";
import { createAuthClient } from "better-auth/react";
// Same-origin requests: provider credentials and the auth secret never enter the browser bundle.
export const authClient = createAuthClient();
