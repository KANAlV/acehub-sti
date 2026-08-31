import {
  Button,
  useThemeMode,
  Dropdown,
  DropdownItem,
  Navbar,
  NavbarBrand,
  DropdownHeader,
} from "flowbite-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AccountInfo } from "@azure/msal-common";
import { HiLogout } from "react-icons/hi";
import {HiChevronDown, HiMoon, HiSun} from "react-icons/hi2";

interface SidebarFunctionProps {
  account: AccountInfo | null;
}

export function NavigationBar({ account }: SidebarFunctionProps) {
  const router = useRouter();
  const { mode, toggleMode } = useThemeMode();

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
        <Dropdown dismissOnClick={false}
                  renderTrigger={() => (
                      <button className="flex w-full items-center justify-between px-3 py-3 rounded-4xl bg-gray-500/30 text-sm font-medium text-gray-900 dark:text-white">
                        <HiChevronDown className="" />
                      </button>
                  )}
        >
          <DropdownHeader>
            <span className="block text-sm">{account?.name}</span>
            <span className="block truncate text-sm font-medium">{account?.username}</span>
          </DropdownHeader>
          <DropdownItem onClick={toggleMode}>
            {mode === "light" ? (
              <HiSun className={`mr-4 text-gray-500 dark:text-gray-400`} />
            ) : (
              <HiMoon className={`mr-4 text-gray-500 dark:text-gray-400`} />
            )}
            Toggle Dark Mode
          </DropdownItem>
          <DropdownItem onClick={() => router.push("/logout")}>
            <HiLogout className="mr-2 h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
            Sign out
          </DropdownItem>
        </Dropdown>
      </div>
    </Navbar>
  );
}