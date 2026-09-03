"use client";

import { useRouter } from "next/navigation";

export default function Blacklisted() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen min-w-screen flex-col items-center justify-center bg-gray-50 px-4 text-center dark:bg-gray-900">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <div className="w-full text-left">
          <button
            className="inline-flex cursor-pointer items-center border-none bg-transparent text-sm font-medium text-blue-600 transition-colors select-none hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            onClick={() => router.push("/login")}
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              ></path>
            </svg>
            Back to Login
          </button>
        </div>

        <div className="mt-4 mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {/* User Slash Icon */}
          <svg
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            ></path>
          </svg>
        </div>

        <h1 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">
          Account Access Restricted
        </h1>

        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          Your email address has been blacklisted and blocked from accessing
          this system. If you believe this is an error, please contact your
          administrator.
        </p>
      </div>
    </div>
  );
}
