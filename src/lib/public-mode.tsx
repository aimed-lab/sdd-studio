"use client";

import { createContext, useContext } from "react";

/**
 * True when a page is rendered for an anonymous visitor. Since every page needs sign-in (2026-11-17) nothing
 * provides `true`; pages keep their anonymous variants in case a public view is ever reinstated.
 */
const PublicModeContext = createContext(false);

export const PublicModeProvider = PublicModeContext.Provider;

export function usePublicMode(): boolean {
  return useContext(PublicModeContext);
}
