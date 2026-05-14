import { redirect } from "next/navigation";

export default function LegacyNewslettersRedirect() {
  redirect("/library");
}
