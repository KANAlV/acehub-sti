"use client"

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
    updateFacultyLoad,
    updateOverloadMax,
    updatePrepLimits,
} from "@/app/actions/system";
import { HiCheck, HiInbox } from "react-icons/hi2";
import { useEffect, useState } from "react";
import { HiExclamation, HiX } from "react-icons/hi";
import { useMsal } from "@azure/msal-react";

export default function FacultyLoad() {
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const username = activeAccount?.username;
  const [isLoading, setLoading] = useState(true);

  // --- Teaching Load Form States --- //
  const [ftMaxLoad, setFtMaxLoad] = useState<number>(0);
  const [ptflMaxLoad, setPtflMaxLoad] = useState<number>(0);
  const [ptMaxLoad, setPtMaxLoad] = useState<number>(0);
  const [loadError, setLoadError] = useState("");

  // --- Prep Limits Form States --- //
  const [ftMaxSubjects, setFtMaxSubjects] = useState<number>(0);
  const [ptflMaxSubjects, setPtflMaxSubjects] = useState<number>(0);
  const [ptMaxSubjects, setPtMaxSubjects] = useState<number>(0);
  const [prepError, setPrepError] = useState("");

  // --- Overloading Form States --- //
  const [maxOverloadUnits, setMaxOverloadUnits] = useState<number>(0);
  const [overloadError, setOverloadError] = useState("");

  // --- Initial Baseline States (For Unchanged Detection) --- //
  const [initialLoad, setInitialLoad] = useState({ ft: 0, ptfl: 0, pt: 0 });
  const [initialPrep, setInitialPrep] = useState({ ft: 0, ptfl: 0, pt: 0 });
  const [initialOverload, setInitialOverload] = useState<number>(0);

  // --- Toast Constants --- //
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [showToastTimer, setShowToastTimer] = useState(false);
  const [progress, setProgress] = useState(0);

  // --- Computed Change Trackers --- //
  const isLoadUnchanged =
      Number(ftMaxLoad) === initialLoad.ft &&
      Number(ptflMaxLoad) === initialLoad.ptfl &&
      Number(ptMaxLoad) === initialLoad.pt;

  const isPrepUnchanged =
      Number(ftMaxSubjects) === initialPrep.ft &&
      Number(ptflMaxSubjects) === initialPrep.ptfl &&
      Number(ptMaxSubjects) === initialPrep.pt;

  const isOverloadUnchanged = Number(maxOverloadUnits) === initialOverload;

  /**************
   *  FUNCTIONS *
   **************/

  /** --- Validation Handlers --- **/

  const handleLoadChange = (
      rawValue: string,
      setter: (val: number) => void
  ) => {
      // Strip leading zeros unless it's just '0'
      const cleaned = rawValue.replace(/^0+(?=\d)/, "");
      const num = cleaned === "" ? 0 : Number(cleaned);

      setter(num);
      if (num < 1 || num > 30) {
          setLoadError("Values must be between 1 and 30.");
      } else {
          setLoadError("");
      }
  };

  const handlePrepChange = (
      rawValue: string,
      setter: (val: number) => void
  ) => {
      const cleaned = rawValue.replace(/^0+(?=\d)/, "");
      const num = cleaned === "" ? 0 : Number(cleaned);

      setter(num);
      if (num < 1 || num > 10) {
          setPrepError("Values must be between 1 and 10.");
      } else {
          setPrepError("");
      }
  };

  const handleOverloadChange = (rawValue: string) => {
      const cleaned = rawValue.replace(/^0+(?=\d)/, "");
      const num = cleaned === "" ? 0 : Number(cleaned);

      setMaxOverloadUnits(num);
      if (num < 0 || num > 10) {
          setOverloadError("Value must be between 0 and 10.");
      } else {
          setOverloadError("");
      }
  };

  /** --- CRUD / Server Actions --- **/

  async function getFacultyLoadConfig() {
      setLoading(true);

      const response = await fetchFacultyLoadConfig();

      if (response.success && response.data && response.data.length > 0) {
          const config = response.data[0];

          const ftL = config.faculty_load?.full_time ?? 0;
          const ptflL = config.faculty_load?.part_time_full_load ?? 0;
          const ptL = config.faculty_load?.part_time ?? 0;

          const ftP = config.prep_limits?.full_time ?? 0;
          const ptflP = config.prep_limits?.part_time_full_load ?? 0;
          const ptP = config.prep_limits?.part_time ?? 0;

          const ov = config.overload_max ?? 0;

          // Update current input fields
          setFtMaxLoad(ftL);
          setPtflMaxLoad(ptflL);
          setPtMaxLoad(ptL);

          setFtMaxSubjects(ftP);
          setPtflMaxSubjects(ptflP);
          setPtMaxSubjects(ptP);

          setMaxOverloadUnits(ov);

          // Save initial baseline state for change detection
          setInitialLoad({ ft: ftL, ptfl: ptflL, pt: ptL });
          setInitialPrep({ ft: ftP, ptfl: ptflP, pt: ptP });
          setInitialOverload(ov);

          console.log("[fetchFacultyLoadConfig]: fetched values successfully");
          setLoading(false);
      } else {
          setToastMessage(
              response?.error ??
              "[fetchFacultyLoadConfig]: An unexpected error occurred",
          );
          setToastType("error");
          setShowToast(true);
          setLoading(false);
      }
  }

  async function handleSaveLoadConfig() {
      if (loadError || isLoadUnchanged) return;

      const response = await updateFacultyLoad({
        userEmail: username ?? "",
        fullTime: Number(ftMaxLoad),
        partTimeFullLoad: Number(ptflMaxLoad),
        partTime: Number(ptMaxLoad),
      });

      if (response.success) {
          setInitialLoad({
              ft: Number(ftMaxLoad),
              ptfl: Number(ptflMaxLoad),
              pt: Number(ptMaxLoad),
          });
          setToastMessage("Teaching Load parameters saved successfully");
          setToastType("success");
          toastTimer();
      } else {
          setToastMessage(
              response?.error ?? "[UpdateLoadConfig]: An unexpected error occurred",
          );
          setToastType("error");
          setShowToast(true);
      }
  }

  async function handleSavePrepConfig() {
      if (prepError || isPrepUnchanged) return;

      const response = await updatePrepLimits({
        userEmail: username ?? "",
        fullTime: Number(ftMaxSubjects),
        partTimeFullLoad: Number(ptflMaxSubjects),
        partTime: Number(ptMaxSubjects),
      });

      if (response.success) {
          setInitialPrep({
              ft: Number(ftMaxSubjects),
              ptfl: Number(ptflMaxSubjects),
              pt: Number(ptMaxSubjects),
          });
          setToastMessage("Prep Limits configurations saved successfully");
          setToastType("success");
          toastTimer();
      } else {
          setToastMessage(
              response?.error ?? "[UpdatePrepConfig]: An unexpected error occurred",
          );
          setToastType("error");
          setShowToast(true);
      }
  }

  async function handleSaveOverloadConfig() {
      if (overloadError || isOverloadUnchanged) return;

      const response = await updateOverloadMax({
        userEmail: username ?? "",
        overloadMax: Number(maxOverloadUnits),
      });

      if (response.success) {
          setInitialOverload(Number(maxOverloadUnits));
          setToastMessage("Overloading parameters saved successfully");
          setToastType("success");
          toastTimer();
      } else {
          setToastMessage(
              response?.error ??
              "[UpdateOverloadConfig]: An unexpected error occurred",
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
      getFacultyLoadConfig();
  }, []);

  return (
      <>
          {/* --- Toast --- */}
          {showToast && (
              <div className="fixed right-5 bottom-5 z-50 rounded-lg border border-gray-500/30">
                  <Toast>
                      <div
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              toastType == "success"
                                  ? "bg-green-100 text-green-500 dark:bg-green-800 dark:text-green-200"
                                  : toastType == "warning"
                                      ? "bg-yellow-100 text-yellow-500 dark:bg-yellow-800 dark:text-yellow-200"
                                      : "bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-200"
                          }`}
                      >
                          {toastType == "success" && <HiCheck className="h-5 w-5" />}
                          {toastType == "warning" && (
                              <HiExclamation className="h-5 w-5" />
                          )}
                          {toastType == "error" && <HiX className="h-5 w-5" />}
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

          <div className="flex flex-row flex-wrap gap-6 items-start">
              {/* --- Teaching Load Parameters Card --- */}
              <Card
                  className={`${isLoading ? "pointer-events-none opacity-50" : ""} w-72`}
              >
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Teaching Load Parameters
                  </h3>
                  <form
                      className="flex flex-col gap-4"
                      onSubmit={(e) => e.preventDefault()}
                  >
                      <div>
                          <div className="mb-2 block">
                              <Label htmlFor="ft_max_load">
                                  Full-Time (FT) Max Load (Max: 30)
                              </Label>
                          </div>
                          <TextInput
                              id="ft_max_load"
                              type="number"
                              min={1}
                              max={30}
                              value={ftMaxLoad === 0 ? "" : ftMaxLoad}
                              onChange={(e) => handleLoadChange(e.target.value, setFtMaxLoad)}
                              color={loadError ? "failure" : "gray"}
                              required
                          />
                      </div>

                      <div>
                          <div className="mb-2 block">
                              <Label htmlFor="ptfl_max_load">
                                  Part-Time Full Load (PTFL) (Max: 30)
                              </Label>
                          </div>
                          <TextInput
                              id="ptfl_max_load"
                              type="number"
                              min={1}
                              max={30}
                              value={ptflMaxLoad === 0 ? "" : ptflMaxLoad}
                              onChange={(e) => handleLoadChange(e.target.value, setPtflMaxLoad)}
                              color={loadError ? "failure" : "gray"}
                              required
                          />
                      </div>

                      <div>
                          <div className="mb-2 block">
                              <Label htmlFor="pt_max_load">Part-Time (PT) (Max: 30)</Label>
                          </div>
                          <TextInput
                              id="pt_max_load"
                              type="number"
                              min={1}
                              max={30}
                              value={ptMaxLoad === 0 ? "" : ptMaxLoad}
                              onChange={(e) => handleLoadChange(e.target.value, setPtMaxLoad)}
                              color={loadError ? "failure" : "gray"}
                              required
                          />
                      </div>

                      {loadError && (
                          <p className="text-sm font-medium text-red-600">{loadError}</p>
                      )}

                      <div>
                          <Button
                              onClick={handleSaveLoadConfig}
                              disabled={Boolean(loadError) || isLoading || isLoadUnchanged}
                              className="w-full"
                          >
                              <HiInbox className="mr-2 h-5 w-5" />
                              Save Load Configuration
                          </Button>
                      </div>
                  </form>
              </Card>

              {/* --- Prep Limits (Number of Subjects) Card --- */}
              <Card
                  className={`${isLoading ? "pointer-events-none opacity-50" : ""} w-72`}
              >
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Prep Limits (Number of Subjects)
                  </h3>
                  <form
                      className="flex flex-col gap-4"
                      onSubmit={(e) => e.preventDefault()}
                  >
                      <div>
                          <div className="mb-2 block">
                              <Label htmlFor="ft_max_subjects">
                                  Full-Time (FT) Max Subjects (Max: 10)
                              </Label>
                          </div>
                          <TextInput
                              id="ft_max_subjects"
                              type="number"
                              min={1}
                              max={10}
                              value={ftMaxSubjects === 0 ? "" : ftMaxSubjects}
                              onChange={(e) => handlePrepChange(e.target.value, setFtMaxSubjects)}
                              color={prepError ? "failure" : "gray"}
                              required
                          />
                      </div>

                      <div>
                          <div className="mb-2 block">
                              <Label htmlFor="ptfl_max_subjects">
                                  Part-Time Full Load (PTFL) Max Subjects (Max: 10)
                              </Label>
                          </div>
                          <TextInput
                              id="ptfl_max_subjects"
                              type="number"
                              min={1}
                              max={10}
                              value={ptflMaxSubjects === 0 ? "" : ptflMaxSubjects}
                              onChange={(e) => handlePrepChange(e.target.value, setPtflMaxSubjects)}
                              color={prepError ? "failure" : "gray"}
                              required
                          />
                      </div>

                      <div>
                          <div className="mb-2 block">
                              <Label htmlFor="pt_max_subjects">
                                  Part-Time (PT) Max Subjects (Max: 10)
                              </Label>
                          </div>
                          <TextInput
                              id="pt_max_subjects"
                              type="number"
                              min={1}
                              max={10}
                              value={ptMaxSubjects === 0 ? "" : ptMaxSubjects}
                              onChange={(e) => handlePrepChange(e.target.value, setPtMaxSubjects)}
                              color={prepError ? "failure" : "gray"}
                              required
                          />
                      </div>

                      {prepError && (
                          <p className="text-sm font-medium text-red-600">{prepError}</p>
                      )}

                      <div>
                          <Button
                              onClick={handleSavePrepConfig}
                              disabled={Boolean(prepError) || isLoading || isPrepUnchanged}
                              className="w-full"
                          >
                              <HiInbox className="mr-2 h-5 w-5" />
                              Save Prep Configuration
                          </Button>
                      </div>
                  </form>
              </Card>

              {/* --- Overloading Parameters Card --- */}
              <Card
                  className={`${isLoading ? "pointer-events-none opacity-50" : ""} w-72`}
              >
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Overloading Parameters
                  </h3>
                  <form
                      className="flex flex-col gap-4"
                      onSubmit={(e) => e.preventDefault()}
                  >
                      <div>
                          <div className="mb-2 block">
                              <Label htmlFor="max_overload_units">
                                  Maximum Units Above Load Limit (Max: 10)
                              </Label>
                          </div>
                          <TextInput
                              id="max_overload_units"
                              type="number"
                              min={0}
                              max={10}
                              value={maxOverloadUnits === 0 ? "" : maxOverloadUnits}
                              onChange={(e) => handleOverloadChange(e.target.value)}
                              color={overloadError ? "failure" : "gray"}
                              required
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Maximum additional units a teacher can take beyond their
                              standard load limit
                          </p>
                      </div>

                      {overloadError && (
                          <p className="text-sm font-medium text-red-600">
                              {overloadError}
                          </p>
                      )}

                      <div>
                          <Button
                              onClick={handleSaveOverloadConfig}
                              disabled={
                                  Boolean(overloadError) || isLoading || isOverloadUnchanged
                              }
                              className="w-fit"
                          >
                              <HiInbox className="mr-2 h-5 w-5" />
                              Save Overload Configuration
                          </Button>
                      </div>
                  </form>
              </Card>
          </div>
      </>
  );
}