import { PublicClientApplication } from "@azure/msal-browser";

// lib/msal.ts
export const msalConfig = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || "",
    authority: `https://login.microsoftonline.com/organizations`,
    redirectUri: typeof window !== "undefined"
      ? window.location.origin + "/auth-redirect"
      : "http://localhost:3000/auth-redirect",
    navigateToLoginRequestUrl: false, // Prevents MSAL from forcing double navigations
  },
  system: {
    popupBridgeTimeout: 60000, // 60 seconds for popup communication
    iframeBridgeTimeout: 60000, // 60 seconds for silent token refresh
  },
  cache: {
    cacheLocation: "memoryStorage",
    storeAuthStateInCookie: false,
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);