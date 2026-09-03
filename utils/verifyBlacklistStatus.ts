import { redirect } from "next/navigation";
import { checkIsUserBlacklistedByEmail } from "@/app/actions/system";
import { useMsal } from "@azure/msal-react";
import { useEffect } from "react"; // update to your actual path

export async function VerifyBlacklistStatus(email:string) {
  const response = await checkIsUserBlacklistedByEmail(email);
  if (response.success && response.isBlacklisted) {
    redirect("/blacklisted");
  }
}
