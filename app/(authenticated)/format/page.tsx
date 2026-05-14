import { redirect } from "next/navigation";

export default function LegacyFormatRedirect() {
  redirect("/settings");
}
