import { PublicClientApplication } from "@azure/msal-browser";

// lib/msal.ts
export const msalConfig = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || "",
    authority: `https://login.microsoftonline.com/organizations`,
    redirectUri: "http://localhost:3000",
    navigateToLoginRequestUrl: false, // Prevents MSAL from forcing double navigations
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: true,
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);