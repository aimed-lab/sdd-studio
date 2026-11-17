"use client";

import { useEffect } from "react";

/** Pages render after the sign-in check, so the browser's own jump to #section misses; do it once mounted. */
export function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);
  return null;
}
