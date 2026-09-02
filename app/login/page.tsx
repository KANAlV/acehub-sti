"use client";

import { useMsal } from "@azure/msal-react";
import { DarkThemeToggle } from "flowbite-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { syncUserToDatabase } from "@/app/actions/user";
import Image from "next/image";

export default function LoginPage() {
  const { instance, accounts, inProgress } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];

  const router = useRouter();

  // Redirect to /dashboard as soon as authentication finishes and accounts exist
  useEffect(() => {
    async function syncUser() {
      await syncUserToDatabase(activeAccount.username!, activeAccount.name!);
    }

    if (inProgress === "none" && accounts.length > 0) {
      const activeAccount = instance.getActiveAccount() || accounts[0];

      //if (activeAccount.name!.includes("Student")) {
      //  router.push("/restricted_access");
      //}
      /*else*/ if (activeAccount.username!.includes("@alabang.sti.edu.ph")) {
        syncUser();
        router.push("/dashboard");
      } else {
        router.push("/restricted_access");
      }
    }
  }, [accounts, inProgress, router]);

  const handleLogin = () => {
    if (inProgress !== "none") return;

    try {
      instance.loginRedirect({
        scopes: ["User.Read"],
      });
    } catch (error) {
      console.error("Login redirect failed:", error);
    }
  };

  // Prevent showing the login form briefly if the user is already authenticated
  if (inProgress !== "none" || accounts.length > 0) {
    return null;
  }

  return (
    <div className="h-dvh w-dvw overflow-auto">
      <section className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto flex flex-col items-center justify-center px-6 py-8 md:h-screen lg:py-0">
          <div className="w-full rounded-xl bg-white shadow-lg sm:max-w-md md:mt-0 xl:p-0 dark:border dark:border-gray-700 dark:bg-gray-800">
            <div className="space-y-6 p-8">
              <div className={"flex justify-end"}>
                <DarkThemeToggle />
              </div>

              <div className="text-center">
                <Image
                  src={"/acehub-logo.png"}
                  alt={"Acehub Logo"}
                  height={0}
                  width={16}
                  className={"h-auto w-4"}
                />
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                  Acehub Login Portal
                </h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Please sign in with your organizational account to manage
                  faculty schedules.
                </p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleLogin}
                  disabled={inProgress !== "none"}
                  type="button"
                  className="hover:bg-100 inline-flex w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-900 transition-colors duration-200 hover:text-blue-700 focus:outline-none disabled:opacity-50"
                >
                  <svg className="mr-3 h-5 w-5" viewBox="0 0 23 23">
                    <path fill="#f35325" d="M1 1h10v10H1z" />
                    <path fill="#81bc06" d="M12 1h10v10H12z" />
                    <path fill="#05a6f0" d="M1 12h10v10H1z" />
                    <path fill="#ffba08" d="M12 12h10v10H12z" />
                  </svg>
                  {inProgress !== "none"
                    ? "Redirecting..."
                    : "Login with Microsoft 365"}
                </button>
              </div>

              <div className="text-center text-xs text-gray-400">
                Use your @alabang.sti.edu.ph account
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
