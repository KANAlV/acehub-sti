import {
  Button,
  DarkThemeToggle,
  Dropdown,
  DropdownItem,
  Navbar,
  NavbarBrand,
} from "flowbite-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AccountInfo } from "@azure/msal-common";
import { HiLogout } from "react-icons/hi";

interface SidebarFunctionProps {
  account: AccountInfo | null;
}

export function NavigationBar({ account }: SidebarFunctionProps) {
  const router = useRouter();

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
        <DarkThemeToggle className="mr-2 cursor-pointer" />

        {/* --- User Dropdown --- */}
        <Dropdown
          label={account?.name}
          dismissOnClick={false}
          className={"hidden md:block"}
        >
          <DropdownItem onClick={() => router.push("/logout")}>
            <HiLogout className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
            Sign out
          </DropdownItem>
        </Dropdown>

        <Dropdown dismissOnClick={false} className={"md:hidden"}>
          <DropdownItem>{account?.name}</DropdownItem>
          <DropdownItem onClick={() => router.push("/logout")}>
            <HiLogout className="h-6 w-6 shrink-0 text-gray-500 dark:text-gray-400" />
            Sign out
          </DropdownItem>
        </Dropdown>
      </div>
    </Navbar>
  );
}