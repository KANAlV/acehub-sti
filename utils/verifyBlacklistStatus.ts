import { redirect } from "next/navigation";
import { checkIsUserBlacklistedByEmail } from "@/app/actions/system";

export async function VerifyBlacklistStatus(email:string) {
  const response = await checkIsUserBlacklistedByEmail(email);
  if (response.success && response.isBlacklisted) {
    redirect("/blacklisted");
  }
}
