/**
 * ============================================
 * Document Sharing for Busibox Apps
 * ============================================
 *
 * Reference implementation of app-level team sharing.
 * Uses @jazzmind/busibox-app sharing utilities.
 *
 * This file demonstrates app-level sharing (one team for the whole app).
 * For entity-level sharing (one team per entity, e.g. per campaign), create
 * the role with a unique entityName per entity:
 *   ensureTeamRole(ssoToken, APP_NAME, `campaign-${slug}`)
 *
 * Delete or modify this file when building your real app.
 */

import {
  ensureTeamRole,
  addRoleToDocuments,
  addRoleToLibrary,
  listTeamMembers,
  addTeamMember,
  removeTeamMember,
  searchUsers,
  resolveVisibilityMode,
  setDocumentVisibility,
  getSSOTokenFromRequest,
  type VisibilityMode,
  type TeamMember,
  type TeamRole,
  type SearchUser,
} from "@jazzmind/busibox-app/lib/data/sharing";
import { getDocumentRoles } from "@jazzmind/busibox-app";

export type { VisibilityMode, TeamMember, TeamRole, SearchUser };
export { getSSOTokenFromRequest };

const APP_NAME = process.env.APP_NAME || "newsletter-digest";

/**
 * Ensure the app-level team role exists.
 *
 * For app-level sharing, use a single entityName (e.g. "data").
 * For entity-level sharing, use unique entity names.
 */
export async function ensureAppTeamRole(
  ssoToken: string,
  entityName: string = "data",
): Promise<TeamRole> {
  return ensureTeamRole(ssoToken, APP_NAME, entityName);
}

/**
 * Get the current visibility mode for a document.
 */
export async function getVisibilitySettings(
  dataToken: string,
  ssoToken: string,
  documentId: string,
): Promise<{
  mode: VisibilityMode;
  roleId: string | null;
  members: TeamMember[];
}> {
  const teamRoleName = `app:${APP_NAME}:data-team`;
  const rolesInfo = await getDocumentRoles(dataToken, documentId);
  const mode = resolveVisibilityMode(
    rolesInfo.visibility,
    rolesInfo.roleIds,
    teamRoleName,
    rolesInfo.roles,
  );

  let members: TeamMember[] = [];
  let roleId: string | null = null;

  if (mode === "team") {
    const teamRole = rolesInfo.roles?.find(
      (r) => r.role_name === teamRoleName,
    );
    if (teamRole) {
      roleId = teamRole.role_id;
      members = await listTeamMembers(ssoToken, roleId);
    }
  }

  return { mode, roleId, members };
}

/**
 * Switch documents to a visibility mode.
 *
 * For team mode, creates/finds the team role and adds it to all documents.
 */
export async function setVisibility(
  dataToken: string,
  ssoToken: string,
  documentIds: string[],
  mode: VisibilityMode,
  entityName: string = "data",
): Promise<{ mode: VisibilityMode; roleId: string | null }> {
  if (mode === "team") {
    const role = await ensureAppTeamRole(ssoToken, entityName);
    await setDocumentVisibility(
      dataToken,
      documentIds,
      "team",
      role.roleId,
    );
    return { mode, roleId: role.roleId };
  }

  await setDocumentVisibility(dataToken, documentIds, mode);
  return { mode, roleId: null };
}

export {
  addRoleToDocuments,
  addRoleToLibrary,
  listTeamMembers,
  addTeamMember,
  removeTeamMember,
  searchUsers,
};
