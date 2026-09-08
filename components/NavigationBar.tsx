"use client";

import {
  useThemeMode,
  Dropdown,
  DropdownItem,
  Navbar,
  NavbarBrand,
  DropdownHeader,
  Avatar,
} from "flowbite-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type AccountInfo, InteractionRequiredAuthError } from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import { HiLogout } from "react-icons/hi";
import { HiChevronDown, HiMoon, HiSun } from "react-icons/hi2";
import { useEffect, useState } from "react";
import { red } from "next/dist/lib/picocolors";

interface SidebarFunctionProps {
  account: AccountInfo | null;
}

export function NavigationBar({ account }: SidebarFunctionProps) {
  const router = useRouter();
  const { instance } = useMsal();
  const { mode, toggleMode } = useThemeMode();
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfilePicture() {
      if (!account) return;

      const request = {
        scopes: ["User.Read"],
        account: account,
      };

      try {
        // 1. Get Access Token silently using the passed account prop
        const response = await instance.acquireTokenSilent(request);

        // 2. Fetch photo binary stream from Microsoft Graph API
        const graphResponse = await fetch(
          "https://graph.microsoft.com/v1.0/me/photo/$value",
          {
            headers: {
              Authorization: `Bearer ${response.accessToken}`,
            },
          }
        );

        if (graphResponse.ok) {
          // 3. Convert image Blob into a URL string
          const blob = await graphResponse.blob();
          const imageUrl = URL.createObjectURL(blob);
          setProfilePhoto(imageUrl);
        }
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect(request);
        } else {
          console.warn("User profile photo not found or unavailable:", error);
        }
      }
    }

    void fetchProfilePicture();
  }, [account, instance]);

  // Extract initials if photo is unavailable (e.g. "John Doe" -> "JD")
  const userInitials = account?.name
    ? account.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
    : "U";

  return (
    <Navbar
      fluid
      rounded
      className={
        "border-b border-gray-200 shadow-md shadow-gray-400/30 dark:border-gray-700 dark:bg-gray-800"
      }
    >
      <NavbarBrand
        onClick={() => {
          router.push("/");
        }}
        className="cursor-pointer"
      >
        <Image
          src="/acehub-logo.png"
          alt="Acehub Logo"
          width={32}
          height={32}
          className="mr-3 ml-1"
        />
        <span className="self-center text-xl font-semibold whitespace-nowrap dark:text-white">
          AceHub
        </span>
      </NavbarBrand>
      <div className="flex md:order-2">
        {/* --- User Dropdown --- */}
        <Dropdown
          dismissOnClick={false}
          renderTrigger={() => (
            <button className="flex items-center gap-2 rounded-full bg-gray-500/20 p-1.5 pr-3 text-sm font-medium text-gray-900 hover:bg-gray-500/30 dark:text-white">
              <Avatar
                img={profilePhoto || undefined}
                placeholderInitials={!profilePhoto ? userInitials : undefined}
                rounded
                size="sm"
              />
              <HiChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>
          )}
        >
          <DropdownHeader>
            <span className="block text-sm font-semibold">{account?.name || "User"}</span>
            <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
              {account?.username || "No email"}
            </span>
          </DropdownHeader>
          <DropdownItem onClick={toggleMode}>
            {mode === "light" ? (
              <HiSun className={`mr-2 h-5 w-5 text-gray-500 dark:text-gray-400`} />
            ) : (
              <HiMoon className={`mr-2 h-5 w-5 text-gray-500 dark:text-gray-400`} />
            )}
            Toggle Dark Mode
          </DropdownItem>
          <DropdownItem onClick={() => router.push("/logout")}>
            <HiLogout className="mr-2 h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400" />
            Sign out
          </DropdownItem>
        </Dropdown>
      </div>
    </Navbar>
  );
}