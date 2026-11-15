"use client";

import { createContext, useContext } from "react";

/** True when the page is rendered for an anonymous visitor inside the public shell. */
const PublicModeContext = createContext(false);

export const PublicModeProvider = PublicModeContext.Provider;

export function usePublicMode(): boolean {
  return useContext(PublicModeContext);
}
