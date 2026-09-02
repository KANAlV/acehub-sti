"use client";

import { useRouter } from "next/navigation";

export default function UnauthorizedAccess() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen min-w-screen flex-col items-center justify-center bg-gray-50 px-4 text-center dark:bg-gray-900">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <div className={"w-full text-left"}>
          <button
            className="inline-flex cursor-pointer select-none items-center border-none bg-transparent text-sm font-medium text-blue-600 transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            onClick={() => router.push("/dashboard")}
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
            Go Back
          </button>
        </div>
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
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
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            ></path>
          </svg>
        </div>
        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">
          Unauthorized Access
        </h1>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          Oops! You don`&apos;`t have permission to access this area. Please return to the dashboard or reach out to support if you need access.
        </p>
        <div className="mb-6 text-sm text-gray-500 italic dark:text-gray-500">
          Thank you for your understanding.
        </div>
      </div>
    </div>
  );
}