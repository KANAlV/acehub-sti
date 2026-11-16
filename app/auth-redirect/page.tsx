"use client";

import { useEffect } from "react";
import { broadcastResponseToMainFrame } from "@azure/msal-browser/redirect-bridge";

export default function AuthRedirectPage() {
  useEffect(() => {
    broadcastResponseToMainFrame().catch((error) => {
      console.error("Error broadcasting response to main frame:", error);
    });
  }, []);

  return "Processing authentication...";
}
