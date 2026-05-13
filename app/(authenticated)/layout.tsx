import type { ReactNode } from "react";
import { WorkspaceLayout } from "@/components/Workspace";

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return <WorkspaceLayout>{children}</WorkspaceLayout>;
}
