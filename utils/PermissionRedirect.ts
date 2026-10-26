"use client";

interface UserPermissions {
  booking: boolean;
  personal_schedule: boolean;
  academic_qualification: boolean;
  schedules: boolean;
  courses: boolean;
  rooms: boolean;
  subjects: boolean;
  teachers: boolean;
  maq: boolean;
  fcce: boolean;
  help: boolean;
  config: boolean;
  superuser: boolean;
}

export default function PermissionRedirect(permissions: UserPermissions) {
  if (typeof window === "undefined") return;

  const { firstSegment } = getUrlSegments();
  const targetModule = firstSegment || "dashboard";

  let hasAccess = true;

  switch (targetModule) {
    case "schedules":
      hasAccess = permissions.schedules;
      break;
    case "room_reservation":
      hasAccess = permissions.booking;
      break;
    case "courses":
      hasAccess = permissions.courses;
      break;
    case "rooms":
      hasAccess = permissions.rooms;
      break;
    case "subjects":
      hasAccess = permissions.subjects;
      break;
    case "teachers":
      hasAccess = permissions.teachers;
      break;
    case "maq":
      hasAccess = permissions.maq;
      break;
    case "fcce":
      hasAccess = permissions.fcce;
      break;
    case "configurations":
    case "config":
      hasAccess = permissions.config;
      break;
    default:
      hasAccess = true;
      break;
  }

  if (!hasAccess) {
    return true;
  } else {
    return false;
  }
}

export function getUrlSegments() {
  if (typeof window === "undefined") {
    return { firstSegment: "", secondSegment: "" };
  }

  const cleanUrl = window.location.href.replace(/^https?:\/\//, "");
  const segments = cleanUrl.split("/").filter(Boolean);

  return {
    firstSegment: segments[1] || "",
    secondSegment: segments[2] || "",
  };
}
