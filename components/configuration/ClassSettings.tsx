"use client";

import {
  Button,
  Card,
  Label,
  Progress,
  TextInput,
  Toast,
  ToastToggle,
} from "flowbite-react";
import {
  fetchFacultyLoadConfig,
  updateEnrollmentConstraints,
} from "@/app/actions/system";
import { HiCheck, HiInbox } from "react-icons/hi2";
import { useEffect, useState } from "react";
import { HiExclamation, HiX } from "react-icons/hi";
import { useMsal } from "@azure/msal-react";

export default function ClassSettings() {
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const [isLoading, setLoading] = useState(true);

  // --- Form State --- //
  const [maxStudentsPerSection, setMaxStudentsPerSection] = useState<number>(0);
  const [sectionError, setSectionError] = useState("");

  // --- Initial Baseline State (For Unchanged Detection) --- //
  const [initialMaxStudents, setInitialMaxStudents] = useState<number>(0);

  // --- Toast States --- //
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [showToastTimer, setShowToastTimer] = useState(false);
  const [progress, setProgress] = useState(0);

  // --- Computed Change Tracker --- //
  const isSectionUnchanged =
    Number(maxStudentsPerSection) === initialMaxStudents;

  /**************
   *  FUNCTIONS *
   **************/

  /** --- Validation Handler --- **/

  const handleMaxStudentsChange = (rawValue: string) => {
    // Strip leading zeros unless single '0'
    const cleaned = rawValue.replace(/^0+(?=\d)/, "");
    const num = cleaned === "" ? 0 : Number(cleaned);

    setMaxStudentsPerSection(num);
    if (num < 1 || num > 50) {
      setSectionError("Value must be between 1 and 50.");
    } else {
      setSectionError("");
    }
  };

  /** --- CRUD / Server Actions --- **/

  async function getClassSettingsConfig() {
    setLoading(true);

    const response = await fetchFacultyLoadConfig();

    if (response.success && response.data && response.data.length > 0) {
      const config = response.data[0];
      const maxStudents = config.max_students ?? 0;

      setMaxStudentsPerSection(maxStudents);
      setInitialMaxStudents(maxStudents);

      console.log("[fetchClassSettingsConfig]: fetched values successfully");
      setLoading(false);
    } else {
      setToastMessage(
        response?.error ??
          "[fetchClassSettingsConfig]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
      setLoading(false);
    }
  }

  async function handleSaveEnrollmentConfig() {
    if (sectionError || isSectionUnchanged) return;

    const response = await updateEnrollmentConstraints({
      userEmail: activeAccount?.username ?? "",
      maxStudentsPerSection: Number(maxStudentsPerSection),
    });

    if (response.success) {
      setInitialMaxStudents(Number(maxStudentsPerSection));
      setToastMessage("Enrollment constraints saved successfully");
      setToastType("success");
      toastTimer();
    } else {
      console.log(response?.error ??
        "[UpdateEnrollmentConfig]: An unexpected error occurred",)
      setToastMessage(
        response?.error ??
          "[UpdateEnrollmentConfig]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }
  }

  /** --- Toast Related Functions --- **/

  function toastTimer() {
    setShowToastTimer(true);
    setShowToast(true);
    setProgress(0);

    const duration = 5000;
    const intervalTime = 50;
    const step = 100 / (duration / intervalTime);

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev + step >= 100) {
          clearInterval(timer);
          closeToast();
          return 100;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }

  function closeToast() {
    setShowToast(false);
    setToastType("");
    setToastMessage("");
    setShowToastTimer(false);
  }

  /** --- UseEffects --- **/

  useEffect(() => {
    getClassSettingsConfig();
  }, []);

  return (
    <>
      {/* --- Toast --- */}
      {showToast && (
        <div className="fixed right-5 bottom-5 z-50 rounded-lg border border-gray-500/30">
          <Toast>
            <div
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                toastType === "success"
                  ? "bg-green-100 text-green-500 dark:bg-green-800 dark:text-green-200"
                  : toastType === "warning"
                    ? "bg-yellow-100 text-yellow-500 dark:bg-yellow-800 dark:text-yellow-200"
                    : "bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-200"
              }`}
            >
              {toastType === "success" && <HiCheck className="h-5 w-5" />}
              {toastType === "warning" && <HiExclamation className="h-5 w-5" />}
              {toastType === "error" && <HiX className="h-5 w-5" />}
            </div>
            <div className="ml-3 text-sm font-normal">{toastMessage}</div>
            <ToastToggle onDismiss={() => closeToast()} />
          </Toast>
          <Progress
            progress={Math.min(Math.round(progress), 100)}
            size="sm"
            className={`${showToastTimer ? "" : "hidden"} ease-linear`}
          />
        </div>
      )}

      <div className="flex flex-row flex-wrap items-start gap-6">
        {/* --- Enrollment Constraints Card --- */}
        <Card
          className={`${isLoading ? "pointer-events-none opacity-50" : ""} w-72`}
        >
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Enrollment Constraints
          </h3>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => e.preventDefault()}
          >
            <div>
              <div className="mb-2 block">
                <Label htmlFor="max_students_per_section">
                  Max Students per Section (Max: 50)
                </Label>
              </div>
              <TextInput
                id="max_students_per_section"
                type="number"
                min={1}
                max={50}
                value={maxStudentsPerSection === 0 ? "" : maxStudentsPerSection}
                onChange={(e) => handleMaxStudentsChange(e.target.value)}
                color={sectionError ? "failure" : "gray"}
                required
              />
            </div>

            {sectionError && (
              <p className="text-sm font-medium text-red-600">{sectionError}</p>
            )}

            <div>
              <Button
                onClick={handleSaveEnrollmentConfig}
                disabled={
                  Boolean(sectionError) || isLoading || isSectionUnchanged
                }
                className="w-full"
              >
                <HiInbox className="mr-2 h-5 w-5" />
                Save Enrollment Configuration
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
