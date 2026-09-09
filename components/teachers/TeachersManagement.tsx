"use client";

import {
  Button,
  Card,
  HelperText,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Pagination,
  Progress,
  Select,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TextInput,
  Toast,
  ToastToggle,
  Tooltip,
} from "flowbite-react";
import { FaPlus, FaSortDown, FaSortUp } from "react-icons/fa6";
import { HiCheck } from "react-icons/hi2";
import { useEffect, useState } from "react";
import { HiExclamation, HiX, HiSearch, HiTrash } from "react-icons/hi";
import {
  filterAlpha,
  filterAlphaDashSpace,
  filterAlphaNoSpace,
  filterEmail,
  filterNumeric,
} from "@/utils/validation";
import { useMsal } from "@azure/msal-react";
import {
  createTeacher,
  fetchTeachers,
  fetchTeachersCount,
  updateTeacher,
  deleteTeacher,
  fetchMaqClusters,
  type MaqClusterRecord,
} from "@/app/actions/system";

export interface Teacher {
  teacher_id: string;
  pscs_id: string | null;
  email: string | null;
  f_name: string | null;
  m_name: string | null;
  surname: string | null;
  suffix: string | null;
  teacher_code: string | null;
  specialization: string | null;
  employment_type: string | null;
  availability?: unknown[] | Record<string, unknown> | null;
  preferences?: unknown[] | Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  is_archived?: boolean;
}

export interface AvailabilitySlot {
  day: string;
  startTime: string;
  endTime: string;
}

const DAYS_OF_WEEK = [
  { id: 1, name: "Monday" },
  { id: 2, name: "Tuesday" },
  { id: 3, name: "Wednesday" },
  { id: 4, name: "Thursday" },
  { id: 5, name: "Friday" },
  { id: 6, name: "Saturday" },
];

const DEFAULT_FULLTIME_AVAILABILITY: AvailabilitySlot[] = [
  {
    day: "[Mon - Fri]",
    startTime: "7:00 AM",
    endTime: "8:00 PM",
  },
];

export default function TeachersManagement() {
  const { instance, accounts } = useMsal();
  const activeAccount = instance.getActiveAccount() || accounts[0];
  const username = activeAccount?.username;
  const [isLoading, setLoading] = useState(true);

  // --- Table Constants --- //
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teachersCount, setTeachersCount] = useState(0);
  const [sortTeachersBy, setSortTeachersBy] = useState("surname");
  const [sortTeachersDir, setSortTeachersDir] = useState("ASC");
  const [searchTerm, setSearchTerm] = useState("");

  // --- Modal Constants --- //
  const [openAddTeacherModal, setOpenAddTeacherModal] = useState(false);
  const [openEditTeacherModal, setOpenEditTeacherModal] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);

  // --- Form Error States --- //
  const [rowID, setRowID] = useState("");
  const [pscsIdError, setPscsIdError] = useState("");
  const [teacherCodeError, setTeacherCodeError] = useState("");
  const [fNameError, setFNameError] = useState("");
  const [surnameError, setSurnameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [specializationError, setSpecializationError] = useState("");
  const [availError, setAvailError] = useState("");

  const [editPscsIdError, setEditPscsIdError] = useState("");
  const [editTeacherCodeError, setEditTeacherCodeError] = useState("");
  const [editFNameError, setEditFNameError] = useState("");
  const [editSurnameError, setEditSurnameError] = useState("");
  const [editEmailError, setEditEmailError] = useState("");
  const [editSpecializationError, setEditSpecializationError] = useState("");
  const [editAvailError, setEditAvailError] = useState("");

  // --- Cluster / Specialization States --- //
  const [allClusters, setAllClusters] = useState<string[]>([]);
  const [clusterOptions, setClusterOptions] = useState<string[]>([]);
  const [showAddClusterDropdown, setShowAddClusterDropdown] = useState(false);
  const [showEditClusterDropdown, setShowEditClusterDropdown] = useState(false);

  // --- Add Form State --- //
  const [inputPscsId, setInputPscsId] = useState("");
  const [inputEmail, setInputEmail] = useState("");
  const [inputFName, setInputFName] = useState("");
  const [inputMName, setInputMName] = useState("");
  const [inputSurname, setInputSurname] = useState("");
  const [inputSuffix, setInputSuffix] = useState("");
  const [inputTeacherCode, setInputTeacherCode] = useState("");
  const [inputSpecialization, setInputSpecialization] = useState("");
  const [inputEmploymentType, setInputEmploymentType] = useState("Full-Time");
  const [availabilityList, setAvailabilityList] = useState<AvailabilitySlot[]>(
    DEFAULT_FULLTIME_AVAILABILITY,
  );

  // Add Availability Temp Input State
  const [addAvailDay, setAddAvailDay] = useState<number>(1);
  const [addAvailStart, setAddAvailStart] = useState("07:00");
  const [addAvailEnd, setAddAvailEnd] = useState("17:00");

  // --- Edit Form State --- //
  const [newPscsId, editPscsId] = useState("");
  const [newEmail, editEmail] = useState("");
  const [newFName, editFName] = useState("");
  const [newMName, editMName] = useState("");
  const [newSurname, editSurname] = useState("");
  const [newSuffix, editSuffix] = useState("");
  const [newTeacherCode, editTeacherCode] = useState("");
  const [newSpecialization, editSpecialization] = useState("");
  const [newEmploymentType, editEmploymentType] = useState("Full-Time");
  const [editAvailabilityList, setEditAvailabilityList] = useState<
    AvailabilitySlot[]
  >([]);

  // Edit Availability Temp Input State
  const [editAvailDay, setEditAvailDay] = useState<number>(1);
  const [editAvailStart, setEditAvailStart] = useState("07:00");
  const [editAvailEnd, setEditAvailEnd] = useState("17:00");

  // --- Baseline Comparison State --- //
  const [basePscsId, setBasePscsId] = useState("");
  const [baseEmail, setBaseEmail] = useState("");
  const [baseFName, setBaseFName] = useState("");
  const [baseMName, setBaseMName] = useState("");
  const [baseSurname, setBaseSurname] = useState("");
  const [baseSuffix, setBaseSuffix] = useState("");
  const [baseTeacherCode, setBaseTeacherCode] = useState("");
  const [baseSpecialization, setBaseSpecialization] = useState("");
  const [baseEmploymentType, setBaseEmploymentType] = useState("Full-Time");
  const [baseAvailabilityList, setBaseAvailabilityList] = useState<
    AvailabilitySlot[]
  >([]);

  // --- Pagination Constants --- //
  const maxRowTeacher = 10;
  const [currentTeacherPage, setCurrentTeacherPage] = useState(1);
  const [pageChangingTeachers, setPageChangingTeachers] = useState(false);

  // --- Toast Constants --- //
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [showToastTimer, setShowToastTimer] = useState(false);
  const [progress, setProgress] = useState(0);

  /** --- Time Formatting Helper --- **/
  const formatTime12hr = (time24: string) => {
    if (!time24) return "";
    const [h, m] = time24.split(":");
    let hours = parseInt(h, 10);
    const suffix = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${m} ${suffix}`;
  };

  /** --- Availability Display Formatter --- **/
  const renderAvailability = (item: Teacher) => {
    const isPartTime =
      item.employment_type === "Part-Time" ||
      item.employment_type === "Part-Time Full Load";
    let avail: AvailabilitySlot[] = [];

    if (typeof item.availability === "string") {
      try {
        avail = JSON.parse(item.availability);
      } catch {
        avail = [];
      }
    } else if (Array.isArray(item.availability)) {
      avail = item.availability as AvailabilitySlot[];
    }

    if (!isPartTime) {
      return <span>[Mon - Fri] 7:00 AM - 8:00 PM</span>;
    }

    if (avail.length === 0) {
      return (
        <span className="font-medium text-yellow-500 dark:text-yellow-400">
          [No Preferred Time]
        </span>
      );
    }

    return (
      <div className="flex flex-col gap-0.5">
        {avail.map((slot, idx) => (
          <div key={idx} className="whitespace-nowrap">
            {slot.day}: {slot.startTime} - {slot.endTime}
          </div>
        ))}
      </div>
    );
  };

  /** --- Validation Utilities --- **/
  const validateEmailFormat = (email: string): boolean => {
    return email.toLowerCase().endsWith("@alabang.sti.edu.ph");
  };

  /** --- Initial Load: All MAQ Clusters --- **/
  useEffect(() => {
    async function loadAllClusters() {
      const response = await fetchMaqClusters("", 0);
      if (response?.success && response.data) {
        const names = response.data.map(
          (c: MaqClusterRecord) => c.cluster_name,
        );
        setAllClusters(names);
      }
    }
    void loadAllClusters();
  }, []);

  /** --- MAQ Cluster Search & Validation --- **/
  async function searchClusters(query: string) {
    const response = await fetchMaqClusters(query || null, 20, 1);
    if (response?.success && response.data) {
      const names = response.data.map((c: MaqClusterRecord) => c.cluster_name);
      setClusterOptions(names);
      return names;
    }
    setClusterOptions([]);
    return [];
  }

  const handleAddSpecializationChange = async (value: string) => {
    const val = filterAlphaDashSpace(value).slice(0, 80);
    setInputSpecialization(val);
    setShowAddClusterDropdown(true);

    if (!val.trim()) {
      setSpecializationError("");
      setClusterOptions([]);
      return;
    }

    const fetchedNames = await searchClusters(val);
    const hasMatch = fetchedNames.some(
      (name) => name.toLowerCase() === val.trim().toLowerCase(),
    );

    if (!hasMatch) {
      setSpecializationError(
        "Specialization must match an existing MAQ Cluster.",
      );
    } else {
      setSpecializationError("");
    }
  };

  const handleEditSpecializationChange = async (value: string) => {
    const val = filterAlphaDashSpace(value).slice(0, 80);
    editSpecialization(val);
    setShowEditClusterDropdown(true);

    if (!val.trim()) {
      setEditSpecializationError("");
      setClusterOptions([]);
      return;
    }

    const fetchedNames = await searchClusters(val);
    const hasMatch = fetchedNames.some(
      (name) => name.toLowerCase() === val.trim().toLowerCase(),
    );

    if (!hasMatch) {
      setEditSpecializationError(
        "Specialization must match an existing MAQ Cluster.",
      );
    } else {
      setEditSpecializationError("");
    }
  };

  /** --- Employment Type Switch Logic --- **/
  const handleAddEmploymentChange = (type: string) => {
    setInputEmploymentType(type);
    setAvailError("");
    if (type === "Part-Time") {
      setAvailabilityList([]);
    } else {
      setAvailabilityList(DEFAULT_FULLTIME_AVAILABILITY);
    }
  };

  const handleEditEmploymentChange = (type: string) => {
    editEmploymentType(type);
    setEditAvailError("");
    if (type === "Part-Time") {
      setEditAvailabilityList([]);
    } else {
      setEditAvailabilityList(DEFAULT_FULLTIME_AVAILABILITY);
    }
  };

  /** --- Add Availability Slot Actions --- **/
  const handleAddAvailabilitySlot = () => {
    if (!addAvailStart || !addAvailEnd) {
      setAvailError("Please specify both start and end times.");
      return;
    }
    if (addAvailStart >= addAvailEnd) {
      setAvailError("End time must be later than start time.");
      return;
    }

    const selectedDayName =
      DAYS_OF_WEEK.find((d) => d.id === addAvailDay)?.name || "Monday";

    const newSlot: AvailabilitySlot = {
      day: selectedDayName,
      startTime: formatTime12hr(addAvailStart),
      endTime: formatTime12hr(addAvailEnd),
    };

    setAvailabilityList((prev) => [...prev, newSlot]);
    setAvailError("");
  };

  const handleRemoveAvailabilitySlot = (index: number) => {
    setAvailabilityList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditAddAvailabilitySlot = () => {
    if (!editAvailStart || !editAvailEnd) {
      setEditAvailError("Please specify both start and end times.");
      return;
    }
    if (editAvailStart >= editAvailEnd) {
      setEditAvailError("End time must be later than start time.");
      return;
    }

    const selectedDayName =
      DAYS_OF_WEEK.find((d) => d.id === editAvailDay)?.name || "Monday";

    const newSlot: AvailabilitySlot = {
      day: selectedDayName,
      startTime: formatTime12hr(editAvailStart),
      endTime: formatTime12hr(editAvailEnd),
    };

    setEditAvailabilityList((prev) => [...prev, newSlot]);
    setEditAvailError("");
  };

  const handleEditRemoveAvailabilitySlot = (index: number) => {
    setEditAvailabilityList((prev) => prev.filter((_, i) => i !== index));
  };

  /** --- Table Functions --- **/
  function handleTeacherSorting(sortBy: string) {
    const newDir =
      sortBy === sortTeachersBy && sortTeachersDir === "ASC" ? "DESC" : "ASC";
    setSortTeachersBy(sortBy);
    setSortTeachersDir(newDir);
    setTeachers([]);
    setCurrentTeacherPage(1);
    void getTeachers(searchTerm, sortBy, newDir, maxRowTeacher, 1);
  }

  function onPageChangeTeachers(page: number) {
    if (pageChangingTeachers) return;

    setPageChangingTeachers(true);
    setTeachers([]);

    void getTeachers(
      searchTerm,
      sortTeachersBy,
      sortTeachersDir,
      maxRowTeacher,
      page,
    );

    setPageChangingTeachers(false);
    setCurrentTeacherPage(page);
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentTeacherPage(1);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setCurrentTeacherPage(1);
  };

  /** --- Input Handlers (Add Form) --- **/
  const handlePscsIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterNumeric(e.target.value).slice(0, 13);
    setInputPscsId(val);
    setPscsIdError(!val ? "PSCS ID is required." : "");
  };

  const handleTeacherCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterAlphaNoSpace(e.target.value).slice(0, 6);
    setInputTeacherCode(val);
    setTeacherCodeError(!val ? "Teacher code is required." : "");
  };

  const handleFNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterAlphaDashSpace(e.target.value).slice(0, 50);
    setInputFName(val);
    setFNameError(!val.trim() ? "First name is required." : "");
  };

  const handleSurnameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterAlphaDashSpace(e.target.value).slice(0, 50);
    setInputSurname(val);
    setSurnameError(!val.trim() ? "Surname is required." : "");
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterEmail(e.target.value).slice(0, 100);
    setInputEmail(val);

    if (!val) {
      setEmailError("Email is required.");
    } else if (!validateEmailFormat(val)) {
      setEmailError("Email must use the domain: @alabang.sti.edu.ph");
    } else {
      setEmailError("");
    }
  };

  /** --- Input Handlers (Edit Form) --- **/
  const handleNewPscsIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterNumeric(e.target.value).slice(0, 13);
    editPscsId(val);
    setEditPscsIdError(!val ? "PSCS ID is required." : "");
  };

  const handleNewTeacherCodeChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const val = filterAlphaNoSpace(e.target.value).slice(0, 6);
    editTeacherCode(val);
    setEditTeacherCodeError(!val ? "Teacher code is required." : "");
  };

  const handleNewFNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterAlphaDashSpace(e.target.value).slice(0, 50);
    editFName(val);
    setEditFNameError(!val.trim() ? "First name is required." : "");
  };

  const handleNewSurnameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterAlphaDashSpace(e.target.value).slice(0, 50);
    editSurname(val);
    setEditSurnameError(!val.trim() ? "Surname is required." : "");
  };

  const handleNewEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = filterEmail(e.target.value).slice(0, 100);
    editEmail(val);

    if (!val) {
      setEditEmailError("Email is required.");
    } else if (!validateEmailFormat(val)) {
      setEditEmailError("Email must use the domain: @alabang.sti.edu.ph");
    } else {
      setEditEmailError("");
    }
  };

  const handleCloseTeacherModals = () => {
    setRowID("");
    setPscsIdError("");
    setTeacherCodeError("");
    setFNameError("");
    setSurnameError("");
    setEmailError("");
    setSpecializationError("");
    setAvailError("");

    setEditPscsIdError("");
    setEditTeacherCodeError("");
    setEditFNameError("");
    setEditSurnameError("");
    setEditEmailError("");
    setEditSpecializationError("");
    setEditAvailError("");

    setShowAddClusterDropdown(false);
    setShowEditClusterDropdown(false);
    setOpenAddTeacherModal(false);
    setOpenEditTeacherModal(false);
    setOpenDeleteModal(false);

    setInputPscsId("");
    setInputEmail("");
    setInputFName("");
    setInputMName("");
    setInputSurname("");
    setInputSuffix("");
    setInputTeacherCode("");
    setInputSpecialization("");
    setInputEmploymentType("Full-Time");
    setAvailabilityList(DEFAULT_FULLTIME_AVAILABILITY);

    editPscsId("");
    editEmail("");
    editFName("");
    editMName("");
    editSurname("");
    editSuffix("");
    editTeacherCode("");
    editSpecialization("");
    editEmploymentType("Full-Time");
    setEditAvailabilityList([]);
  };

  function loadEditData(row_id: string) {
    setRowID(row_id);
    const selectedTeacher = teachers.find((item) => item.teacher_id === row_id);

    if (selectedTeacher) {
      const pscs = selectedTeacher.pscs_id ?? "";
      const emailVal = selectedTeacher.email ?? "";
      const fname = selectedTeacher.f_name ?? "";
      const mname = selectedTeacher.m_name ?? "";
      const sname = selectedTeacher.surname ?? "";
      const sfx = selectedTeacher.suffix ?? "";
      const code = selectedTeacher.teacher_code ?? "";
      const spec = selectedTeacher.specialization ?? "";
      const emp = selectedTeacher.employment_type ?? "Full-Time";

      let slots: AvailabilitySlot[] = [];
      if (Array.isArray(selectedTeacher.availability)) {
        slots = selectedTeacher.availability as AvailabilitySlot[];
      } else if (typeof selectedTeacher.availability === "string") {
        try {
          slots = JSON.parse(selectedTeacher.availability);
        } catch {
          slots = [];
        }
      }

      const avail =
        slots.length > 0
          ? slots
          : emp === "Part-Time"
            ? []
            : DEFAULT_FULLTIME_AVAILABILITY;

      setBasePscsId(pscs);
      setBaseEmail(emailVal);
      setBaseFName(fname);
      setBaseMName(mname);
      setBaseSurname(sname);
      setBaseSuffix(sfx);
      setBaseTeacherCode(code);
      setBaseSpecialization(spec);
      setBaseEmploymentType(emp);
      setBaseAvailabilityList(avail);

      editPscsId(pscs);
      editEmail(emailVal);
      editFName(fname);
      editMName(mname);
      editSurname(sname);
      editSuffix(sfx);
      editTeacherCode(code);
      editSpecialization(spec);
      editEmploymentType(emp);
      setEditAvailabilityList(avail);

      const isValid = allClusters.includes(spec);

      if (!isValid && spec !== "") {
        setEditSpecializationError("Invalid specialization code or cluster missing.");
      } else {
        setEditSpecializationError("");
      }

      setOpenEditTeacherModal(true);
    }
  }

  const isAddFormInvalid =
    !inputPscsId.trim() ||
    !inputTeacherCode.trim() ||
    !inputFName.trim() ||
    !inputSurname.trim() ||
    !inputEmail.trim() ||
    !!pscsIdError ||
    !!teacherCodeError ||
    !!fNameError ||
    !!surnameError ||
    !!emailError ||
    !!specializationError;

  const isEditFormInvalid =
    !newPscsId.trim() ||
    !newTeacherCode.trim() ||
    !newFName.trim() ||
    !newSurname.trim() ||
    !newEmail.trim() ||
    !!editPscsIdError ||
    !!editTeacherCodeError ||
    !!editFNameError ||
    !!editSurnameError ||
    !!editEmailError ||
    !!editSpecializationError;

  const isEditFormUnchanged =
    newPscsId === basePscsId &&
    newEmail === baseEmail &&
    newFName === baseFName &&
    newMName === baseMName &&
    newSurname === baseSurname &&
    newSuffix === baseSuffix &&
    newTeacherCode === baseTeacherCode &&
    newSpecialization === baseSpecialization &&
    newEmploymentType === baseEmploymentType &&
    JSON.stringify(editAvailabilityList) ===
      JSON.stringify(baseAvailabilityList);

  /** --- Database Integration --- **/
  async function getTeacherCount(search?: string | null) {
    const response = await fetchTeachersCount(search);

    if (response?.success) {
      setTeachersCount(response.count);
    } else {
      setToastMessage(
        response?.error ?? "[fetchTeachersCount]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
      setTeachersCount(0);
    }
  }

  async function getTeachers(
    search: string | null = searchTerm,
    sortby: string = sortTeachersBy,
    sortdir: string = sortTeachersDir,
    limit: number = maxRowTeacher,
    page: number = currentTeacherPage,
  ) {
    setLoading(true);

    const response = await fetchTeachers(search, sortby, sortdir, limit, page);

    if (response?.success && response.data) {
      setTeachers(response.data as Teacher[]);
    } else {
      setToastMessage(
        response?.error ?? "[fetchTeachers]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
      setTeachers([]);
    }

    setLoading(false);
    await getTeacherCount(search);
  }

  async function handleTeacherSubmit() {
    if (isAddFormInvalid) return;

    const payload = {
      pscs_id: inputPscsId.trim(),
      email: inputEmail.trim(),
      f_name: inputFName.trim(),
      m_name: inputMName.trim() || undefined,
      surname: inputSurname.trim(),
      suffix: inputSuffix.trim() || undefined,
      teacher_code: inputTeacherCode.trim(),
      specialization: inputSpecialization.trim() || undefined,
      employment_type: inputEmploymentType,
      availability: availabilityList,
    };

    const response = await createTeacher(username ?? "system", payload);

    if (response?.success) {
      setToastMessage("Instructor added successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
        response?.error ?? "[AddTeacher]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseTeacherModals();
    void getTeachers(
      searchTerm,
      sortTeachersBy,
      sortTeachersDir,
      maxRowTeacher,
      currentTeacherPage,
    );
  }

  async function handleTeacherUpdate() {
    if (isEditFormInvalid) return;

    const payload = {
      pscs_id: newPscsId.trim(),
      email: newEmail.trim(),
      f_name: newFName.trim(),
      m_name: newMName.trim() || undefined,
      surname: newSurname.trim(),
      suffix: newSuffix.trim() || undefined,
      teacher_code: newTeacherCode.trim(),
      specialization: newSpecialization.trim() || undefined,
      employment_type: newEmploymentType,
      availability: editAvailabilityList,
    };

    const response = await updateTeacher(username ?? "system", rowID, payload);

    if (response?.success) {
      setToastMessage("Instructor updated successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
        response?.error ?? "[UpdateTeacher]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseTeacherModals();
    void getTeachers(
      searchTerm,
      sortTeachersBy,
      sortTeachersDir,
      maxRowTeacher,
      currentTeacherPage,
    );
  }

  async function handleTeacherDelete() {
    const response = await deleteTeacher(username ?? "system", rowID);

    if (response?.success) {
      setToastMessage("Instructor record deleted successfully");
      setToastType("success");
      toastTimer();
    } else {
      setToastMessage(
        response?.error ?? "[DeleteTeacher]: An unexpected error occurred",
      );
      setToastType("error");
      setShowToast(true);
    }

    handleCloseTeacherModals();
    void getTeachers(
      searchTerm,
      sortTeachersBy,
      sortTeachersDir,
      maxRowTeacher,
      currentTeacherPage,
    );
  }

  /** --- Toast Utility --- **/
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

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      void getTeachers(
        searchTerm,
        sortTeachersBy,
        sortTeachersDir,
        maxRowTeacher,
        currentTeacherPage,
      );
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  return (
    <>
      {/* Toast Notification */}
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

      {/* Main Content Wrapper */}
      {/* Header Bar */}
      <div className="mb-4 flex-col justify-between gap-4 md:flex md:flex-row md:items-center">
        <div>
          <h2 className="mb-1 text-lg font-bold">Faculty Management</h2>
          <p className="text-gray-500">
            Manage instructors, specializations, and employment status.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative mr-4 w-full md:w-64">
            <TextInput
              id="search-teachers"
              type="text"
              placeholder="Search code, name, specialization..."
              value={searchTerm}
              onChange={handleSearchChange}
              icon={HiSearch}
              maxLength={100}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
              >
                <HiX className="h-4 w-4" />
              </button>
            )}
          </div>

          <Button
            className="whitespace-nowrap"
            onClick={() => setOpenAddTeacherModal(true)}
          >
            <FaPlus className="mr-2" />
            Add Instructor
          </Button>
        </div>
      </div>

      {/* Table Section */}
      <Card className="overflow-x-auto">
        <Table hoverable>
          <TableHead>
            <TableRow>
              <TableHeadCell
                onClick={() => handleTeacherSorting("teacher_code")}
              >
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Code
                  {sortTeachersBy === "teacher_code" &&
                    (sortTeachersDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    ))}
                </div>
              </TableHeadCell>

              <TableHeadCell onClick={() => handleTeacherSorting("surname")}>
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Instructor Name
                  {sortTeachersBy === "surname" &&
                    (sortTeachersDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    ))}
                </div>
              </TableHeadCell>

              <TableHeadCell onClick={() => handleTeacherSorting("email")}>
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Email
                  {sortTeachersBy === "email" &&
                    (sortTeachersDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    ))}
                </div>
              </TableHeadCell>

              <TableHeadCell
                onClick={() => handleTeacherSorting("specialization")}
              >
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Specialization
                  {sortTeachersBy === "specialization" &&
                    (sortTeachersDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    ))}
                </div>
              </TableHeadCell>

              <TableHeadCell
                onClick={() => handleTeacherSorting("employment_type")}
              >
                <div className="flex cursor-pointer text-blue-500 hover:text-blue-700 hover:underline dark:hover:text-blue-300">
                  Employment
                  {sortTeachersBy === "employment_type" &&
                    (sortTeachersDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    ))}
                </div>
              </TableHeadCell>

              {/* Availability Header */}
              <TableHeadCell>
                <span>Availability</span>
              </TableHeadCell>

              <TableHeadCell>
                <span className="sr-only">Actions</span>
              </TableHeadCell>
            </TableRow>
          </TableHead>

          <TableBody className="divide-y">
            {teachers.length > 0 ? (
              teachers.map((item) => {
                const fullName = [
                  item.surname ? `${item.surname},` : "",
                  item.f_name ?? "",
                  item.m_name ? `${item.m_name.charAt(0)}.` : "",
                  item.suffix ?? "",
                ]
                  .filter(Boolean)
                  .join(" ");

                const isSpecValid =
                  !item.specialization ||
                  allClusters.some(
                    (cluster) =>
                      cluster.toLowerCase() ===
                      item.specialization?.trim().toLowerCase(),
                  );

                return (
                  <TableRow
                    key={item.teacher_id}
                    className="bg-white dark:border-gray-700 dark:bg-gray-800"
                  >
                    <TableCell className="font-mono text-sm">
                      {item.teacher_code || "—"}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {fullName || "—"}
                    </TableCell>
                    <TableCell>{item.email || "—"}</TableCell>
                    <TableCell>
                      {!isSpecValid ? (
                        <Tooltip placement={"right"} content="Invalid specialization code or cluster missing">
                          <span className="cursor-pointer font-semibold text-red-600 dark:text-red-400">
                            {item.specialization || "—"}
                          </span>
                        </Tooltip>
                      ) : (
                        item.specialization || "—"
                      )}
                    </TableCell>
                    <TableCell>{item.employment_type || "—"}</TableCell>

                    {/* Availability Cell */}
                    <TableCell className="max-w-[220px]">
                      <div className="relative">
                        {/* Scrollable Container */}
                        <div className="h-12 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent overflow-y-auto [mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)] pr-1 pb-4 text-xs text-gray-700 dark:scrollbar-thumb-white dark:text-gray-300">
                          {renderAvailability(item)}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="flex items-center gap-3">
                      <a
                        onClick={() => loadEditData(item.teacher_id)}
                        className="text-primary-600 dark:text-primary-500 cursor-pointer font-medium hover:underline"
                      >
                        Edit
                      </a>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : isLoading ? (
              <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                <TableCell
                  colSpan={7}
                  className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                >
                  <div className="flex items-center justify-center">
                    <Spinner />
                    <span className="ml-4">Fetching faculty data...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow className="bg-white dark:border-gray-700 dark:bg-gray-800">
                <TableCell
                  colSpan={7}
                  className="py-6 text-center text-sm text-gray-500 italic dark:text-gray-400"
                >
                  {searchTerm
                    ? `No instructors matching "${searchTerm}" found.`
                    : "No faculty entries found."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination Container */}
      <div
        className={`mt-4 ${
          isLoading
            ? "pointer-events-none opacity-50 [&_a]:cursor-not-allowed [&_button]:cursor-not-allowed"
            : ""
        } flex w-full justify-center`}
      >
        <Pagination
          layout="pagination"
          currentPage={currentTeacherPage || 1}
          totalPages={Math.ceil(teachersCount / maxRowTeacher) || 1}
          onPageChange={onPageChangeTeachers}
          showIcons
        />
      </div>

      {/* Modal: Add Teacher */}
      <Modal
        show={openAddTeacherModal}
        onClose={handleCloseTeacherModals}
        size="2xl"
      >
        <ModalHeader>Add New Faculty Member</ModalHeader>
        <ModalBody>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pscs_id">PSCS ID *</Label>
              <TextInput
                id="pscs_id"
                placeholder="e.g. 1234567890123"
                value={inputPscsId}
                onChange={handlePscsIdChange}
                color={pscsIdError ? "failure" : "gray"}
                maxLength={13}
              />
              <div className="mt-1 flex items-center justify-between">
                {pscsIdError ? (
                  <HelperText color="failure">{pscsIdError}</HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {inputPscsId.length}/13
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="teacher_code">Teacher Code *</Label>
              <TextInput
                id="teacher_code"
                placeholder="e.g. T10452"
                value={inputTeacherCode}
                onChange={handleTeacherCodeChange}
                color={teacherCodeError ? "failure" : "gray"}
                maxLength={6}
              />
              <div className="mt-1 flex items-center justify-between">
                {teacherCodeError ? (
                  <HelperText color="failure">{teacherCodeError}</HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {inputTeacherCode.length}/6
                </span>
              </div>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="email">Email Address *</Label>
              <TextInput
                id="email"
                type="email"
                placeholder="e.g. instructor@alabang.sti.edu.ph"
                value={inputEmail}
                onChange={handleEmailChange}
                color={emailError ? "failure" : "gray"}
                maxLength={100}
              />
              <div className="mt-1 flex items-center justify-between">
                {emailError ? (
                  <HelperText color="failure">{emailError}</HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {inputEmail.length}/100
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="f_name">First Name *</Label>
              <TextInput
                id="f_name"
                value={inputFName}
                onChange={handleFNameChange}
                color={fNameError ? "failure" : "gray"}
                maxLength={50}
              />
              <div className="mt-1 flex items-center justify-between">
                {fNameError ? (
                  <HelperText color="failure">{fNameError}</HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {inputFName.length}/50
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="m_name">Middle Name</Label>
              <TextInput
                id="m_name"
                value={inputMName}
                onChange={(e) =>
                  setInputMName(
                    filterAlphaDashSpace(e.target.value).slice(0, 50),
                  )
                }
                maxLength={50}
              />
              <div className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
                {inputMName.length}/50
              </div>
            </div>

            <div>
              <Label htmlFor="surname">Surname *</Label>
              <TextInput
                id="surname"
                value={inputSurname}
                onChange={handleSurnameChange}
                color={surnameError ? "failure" : "gray"}
                maxLength={50}
              />
              <div className="mt-1 flex items-center justify-between">
                {surnameError ? (
                  <HelperText color="failure">{surnameError}</HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {inputSurname.length}/50
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="suffix">Suffix</Label>
              <TextInput
                id="suffix"
                placeholder="e.g. Jr., III"
                value={inputSuffix}
                onChange={(e) =>
                  setInputSuffix(filterAlpha(e.target.value).slice(0, 10))
                }
                maxLength={10}
              />
              <div className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
                {inputSuffix.length}/10
              </div>
            </div>

            <div className="relative">
              <Label htmlFor="specialization">Specialization</Label>
              <TextInput
                id="specialization"
                placeholder="Search MAQ cluster..."
                value={inputSpecialization}
                onChange={(e) => handleAddSpecializationChange(e.target.value)}
                onFocus={() => {
                  if (inputSpecialization) {
                    void searchClusters(inputSpecialization);
                    setShowAddClusterDropdown(true);
                  }
                }}
                color={specializationError ? "failure" : "gray"}
                maxLength={80}
              />

              {/* Suggestions Dropdown explicitly aligned to input box height */}
              {showAddClusterDropdown && clusterOptions.length > 0 && (
                <ul className="absolute top-[68px] z-20 max-h-40 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  {clusterOptions.map((name) => (
                    <li
                      key={name}
                      onClick={() => {
                        setInputSpecialization(name);
                        setSpecializationError("");
                        setShowAddClusterDropdown(false);
                      }}
                      className="cursor-pointer px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-1 flex items-center justify-between">
                {specializationError ? (
                  <HelperText color="failure">{specializationError}</HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {inputSpecialization.length}/80
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="employment_type">Employment Type</Label>
              <Select
                id="employment_type"
                value={inputEmploymentType}
                onChange={(e) => handleAddEmploymentChange(e.target.value)}
              >
                <option value="Full-Time">Full-Time</option>
                <option value="Part-Time Full Load">Part-Time Full Load</option>
                <option value="Part-Time">Part-Time</option>
              </Select>
            </div>

            {/* Part-Time Availability Configurator */}
            {(inputEmploymentType === "Part-Time" ||
              inputEmploymentType === "Part-Time Full Load") && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:col-span-2 dark:border-gray-700 dark:bg-gray-800">
                <Label className="mb-2 block font-semibold">
                  Part-Time Availability
                </Label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
                  {/* Day Selector */}
                  <div>
                    <Label
                      htmlFor="add_avail_day"
                      className="mb-1 block text-xs"
                    >
                      Day
                    </Label>
                    <Select
                      id="add_avail_day"
                      value={addAvailDay}
                      onChange={(e) => setAddAvailDay(Number(e.target.value))}
                    >
                      {DAYS_OF_WEEK.map((day) => (
                        <option key={day.id} value={day.id}>
                          {day.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {/* Start Time */}
                  <div>
                    <Label
                      htmlFor="add_avail_start"
                      className="mb-1 block text-xs"
                    >
                      Start Time
                    </Label>
                    <TextInput
                      id="add_avail_start"
                      type="time"
                      value={addAvailStart}
                      onChange={(e) => setAddAvailStart(e.target.value)}
                    />
                  </div>

                  {/* End Time */}
                  <div>
                    <Label
                      htmlFor="add_avail_end"
                      className="mb-1 block text-xs"
                    >
                      End Time
                    </Label>
                    <TextInput
                      id="add_avail_end"
                      type="time"
                      value={addAvailEnd}
                      onChange={(e) => setAddAvailEnd(e.target.value)}
                    />
                  </div>

                  {/* Add Slot Button */}
                  <Button
                    type="button"
                    color="blue"
                    onClick={handleAddAvailabilitySlot}
                  >
                    <FaPlus className="mr-1 h-3 w-3" />
                    Add
                  </Button>
                </div>

                {availError && (
                  <HelperText color="failure" className="mt-2">
                    {availError}
                  </HelperText>
                )}

                {/* Added Availability List Display */}
                {availabilityList.length > 0 && (
                  <div className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
                    <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                      Configured Schedules
                    </span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {availabilityList.map((slot, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        >
                          <span>
                            <strong>{slot.day}:</strong> {slot.startTime} –{" "}
                            {slot.endTime}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAvailabilitySlot(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <HiTrash className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button onClick={handleTeacherSubmit} disabled={isAddFormInvalid}>
            Create Record
          </Button>
          <Button color="alternative" onClick={handleCloseTeacherModals}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal: Edit Teacher */}
      <Modal
        show={openEditTeacherModal}
        onClose={handleCloseTeacherModals}
        size="2xl"
      >
        <ModalHeader>Update Faculty Member</ModalHeader>
        <ModalBody>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="edit_pscs_id">PSCS ID *</Label>
              <TextInput
                id="edit_pscs_id"
                value={newPscsId}
                onChange={handleNewPscsIdChange}
                color={editPscsIdError ? "failure" : "gray"}
                maxLength={13}
              />
              <div className="mt-1 flex items-center justify-between">
                {editPscsIdError ? (
                  <HelperText color="failure">{editPscsIdError}</HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {newPscsId.length}/13
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="edit_teacher_code">Teacher Code *</Label>
              <TextInput
                id="edit_teacher_code"
                value={newTeacherCode}
                onChange={handleNewTeacherCodeChange}
                color={editTeacherCodeError ? "failure" : "gray"}
                maxLength={6}
              />
              <div className="mt-1 flex items-center justify-between">
                {editTeacherCodeError ? (
                  <HelperText color="failure">
                    {editTeacherCodeError}
                  </HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {newTeacherCode.length}/6
                </span>
              </div>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="edit_email">Email Address *</Label>
              <TextInput
                id="edit_email"
                type="email"
                value={newEmail}
                onChange={handleNewEmailChange}
                color={editEmailError ? "failure" : "gray"}
                maxLength={100}
              />
              <div className="mt-1 flex items-center justify-between">
                {editEmailError ? (
                  <HelperText color="failure">{editEmailError}</HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {newEmail.length}/100
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="edit_f_name">First Name *</Label>
              <TextInput
                id="edit_f_name"
                value={newFName}
                onChange={handleNewFNameChange}
                color={editFNameError ? "failure" : "gray"}
                maxLength={50}
              />
              <div className="mt-1 flex items-center justify-between">
                {editFNameError ? (
                  <HelperText color="failure">{editFNameError}</HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {newFName.length}/50
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="edit_m_name">Middle Name</Label>
              <TextInput
                id="edit_m_name"
                value={newMName}
                onChange={(e) =>
                  editMName(filterAlphaDashSpace(e.target.value).slice(0, 50))
                }
                maxLength={50}
              />
              <div className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
                {newMName.length}/50
              </div>
            </div>

            <div>
              <Label htmlFor="edit_surname">Surname *</Label>
              <TextInput
                id="edit_surname"
                value={newSurname}
                onChange={handleNewSurnameChange}
                color={editSurnameError ? "failure" : "gray"}
                maxLength={50}
              />
              <div className="mt-1 flex items-center justify-between">
                {editSurnameError ? (
                  <HelperText color="failure">{editSurnameError}</HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {newSurname.length}/50
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="edit_suffix">Suffix</Label>
              <TextInput
                id="edit_suffix"
                value={newSuffix}
                onChange={(e) =>
                  editSuffix(filterAlpha(e.target.value).slice(0, 10))
                }
                maxLength={10}
              />
              <div className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
                {newSuffix.length}/10
              </div>
            </div>

            <div className="relative">
              <Label htmlFor="edit_specialization">Specialization</Label>
              <TextInput
                id="edit_specialization"
                placeholder="Search MAQ cluster..."
                value={newSpecialization}
                onChange={(e) => handleEditSpecializationChange(e.target.value)}
                onFocus={() => {
                  if (newSpecialization) {
                    void searchClusters(newSpecialization);
                    setShowEditClusterDropdown(true);
                  }
                }}
                color={editSpecializationError ? "failure" : "gray"}
                maxLength={80}
              />

              {/* Suggestions Dropdown explicitly aligned to input box height */}
              {showEditClusterDropdown && clusterOptions.length > 0 && (
                <ul className="absolute top-[68px] z-20 max-h-40 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  {clusterOptions.map((name) => (
                    <li
                      key={name}
                      onClick={() => {
                        editSpecialization(name);
                        setEditSpecializationError("");
                        setShowEditClusterDropdown(false);
                      }}
                      className="cursor-pointer px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-1 flex items-center justify-between">
                {editSpecializationError ? (
                  <HelperText color="failure">
                    {editSpecializationError}
                  </HelperText>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {newSpecialization.length}/80
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="edit_employment_type">Employment Type</Label>
              <Select
                id="edit_employment_type"
                value={newEmploymentType}
                onChange={(e) => handleEditEmploymentChange(e.target.value)}
              >
                <option value="Full-Time">Full-Time</option>
                <option value="Part-Time Full Load">Part-Time Full Load</option>
                <option value="Part-Time">Part-Time</option>
              </Select>
            </div>

            {/* Part-Time Availability Configurator (Edit Modal) */}
            {(newEmploymentType === "Part-Time" ||
              newEmploymentType === "Part-Time Full Load") && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:col-span-2 dark:border-gray-700 dark:bg-gray-800">
                <Label className="mb-2 block font-semibold">
                  Part-Time Availability
                </Label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
                  {/* Day Selector */}
                  <div>
                    <Label
                      htmlFor="edit_avail_day"
                      className="mb-1 block text-xs"
                    >
                      Day
                    </Label>
                    <Select
                      id="edit_avail_day"
                      value={editAvailDay}
                      onChange={(e) => setEditAvailDay(Number(e.target.value))}
                    >
                      {DAYS_OF_WEEK.map((day) => (
                        <option key={day.id} value={day.id}>
                          {day.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {/* Start Time */}
                  <div>
                    <Label
                      htmlFor="edit_avail_start"
                      className="mb-1 block text-xs"
                    >
                      Start Time
                    </Label>
                    <TextInput
                      id="edit_avail_start"
                      type="time"
                      value={editAvailStart}
                      onChange={(e) => setEditAvailStart(e.target.value)}
                    />
                  </div>

                  {/* End Time */}
                  <div>
                    <Label
                      htmlFor="edit_avail_end"
                      className="mb-1 block text-xs"
                    >
                      End Time
                    </Label>
                    <TextInput
                      id="edit_avail_end"
                      type="time"
                      value={editAvailEnd}
                      onChange={(e) => setEditAvailEnd(e.target.value)}
                    />
                  </div>

                  {/* Add Slot Button */}
                  <Button
                    type="button"
                    color="blue"
                    onClick={handleEditAddAvailabilitySlot}
                  >
                    <FaPlus className="mr-1 h-3 w-3" />
                    Add
                  </Button>
                </div>

                {editAvailError && (
                  <HelperText color="failure" className="mt-2">
                    {editAvailError}
                  </HelperText>
                )}

                {/* Added Availability List Display */}
                {editAvailabilityList.length > 0 && (
                  <div className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
                    <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                      Configured Schedules
                    </span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {editAvailabilityList.map((slot, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        >
                          <span>
                            <strong>{slot.day}:</strong> {slot.startTime} –{" "}
                            {slot.endTime}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleEditRemoveAvailabilitySlot(index)
                            }
                            className="text-red-500 hover:text-red-700"
                          >
                            <HiTrash className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter className="flex justify-between">
          <Button
            color="red"
            onClick={() => {
              setOpenEditTeacherModal(false);
              setOpenDeleteModal(true);
            }}
          >
            <HiTrash className="h-5 w-5" />
          </Button>

          <div className="flex gap-2">
            <Button
              onClick={handleTeacherUpdate}
              disabled={isEditFormUnchanged || isEditFormInvalid}
            >
              Save Changes
            </Button>
            <Button color="alternative" onClick={handleCloseTeacherModals}>
              Cancel
            </Button>
          </div>
        </ModalFooter>
      </Modal>

      {/* Modal: Delete Confirmation */}
      <Modal
        show={openDeleteModal}
        onClose={handleCloseTeacherModals}
        size="md"
      >
        <ModalHeader>Confirm Deletion</ModalHeader>
        <ModalBody>
          <div className="text-center">
            <HiExclamation className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to delete this instructor record?
            </h3>
          </div>
        </ModalBody>
        <ModalFooter className="justify-center">
          <Button color="red" onClick={handleTeacherDelete}>
            Yes, I&#39;m sure
          </Button>
          <Button color="alternative" onClick={handleCloseTeacherModals}>
            No, cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
