/**
 * Authentication middleware for Newsletter Digest.
 *
 * Keeps the standard Busibox Zero Trust token exchange pattern and exposes the
 * authenticated user id because OAuth token encryption is user-owned.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getTokenFromRequest,
  getUserIdFromToken,
  getUserRolesFromToken,
} from "@jazzmind/busibox-app/lib/authz";
import { decodeJwt } from "jose";
import { getApiToken } from "./authz-client";

const DEFAULT_AUDIENCE = (process.env.DEFAULT_API_AUDIENCE ||
  "data-api") as "agent-api" | "data-api" | "search-api";

export interface AuthenticatedRequest {
  ssoToken: string | null;
  apiToken: string;
  userId: string;
  roles: string[];
  isTestUser?: boolean;
}

export async function requireAuthWithTokenExchange(
  request: NextRequest,
  audience?: "agent-api" | "data-api" | "search-api",
  scopes?: string[],
): Promise<AuthenticatedRequest | NextResponse> {
  try {
    const ssoToken = getTokenFromRequest(request);
    const targetAudience = audience || DEFAULT_AUDIENCE;
    const resourceId = getAppResourceId(request);

    if (!ssoToken) {
      const testSessionJwt = process.env.TEST_SESSION_JWT;
      if (testSessionJwt) {
        const apiToken = await getApiToken(testSessionJwt, targetAudience, scopes, resourceId);
        return buildAuthResult(testSessionJwt, apiToken, true);
      }

      return NextResponse.json(
        {
          error: "Authentication required",
          message:
            "Please log in through the Busibox Portal and try again. For local testing, set TEST_SESSION_JWT to a valid session JWT.",
        },
        { status: 401 },
      );
    }

    const apiToken = await getApiToken(ssoToken, targetAudience, scopes, resourceId);
    return buildAuthResult(ssoToken, apiToken, false);
  } catch (error: unknown) {
    console.error("[AUTH] Token exchange failed:", error);
    return NextResponse.json(
      {
        error: "Authentication failed",
        message:
          "Failed to authenticate with the backend service. Please return to the Busibox Portal and log in again.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 401 },
    );
  }
}

function buildAuthResult(
  ssoToken: string,
  apiToken: string,
  isTestUser: boolean,
): AuthenticatedRequest {
  return {
    ssoToken,
    apiToken,
    userId: extractUserId(apiToken) || extractUserId(ssoToken) || "unknown",
    roles: extractRoles(apiToken) || extractRoles(ssoToken) || [],
    isTestUser,
  };
}

function extractUserId(token: string): string | null {
  try {
    const userId = getUserIdFromToken(token);
    if (userId) return userId;
    const payload = decodeJwt(token);
    return (
      (typeof payload.sub === "string" ? payload.sub : null) ||
      (typeof payload.user_id === "string" ? payload.user_id : null)
    );
  } catch {
    return null;
  }
}

function extractRoles(token: string): string[] | null {
  try {
    const roles = getUserRolesFromToken(token);
    return roles && roles.length > 0 ? roles : null;
  } catch {
    return null;
  }
}

export function getAppResourceId(request: NextRequest): string | null {
  try {
    const token = getTokenFromRequest(request);
    if (!token) return null;
    const payload = decodeJwt(token);
    return (payload.app_id as string) || null;
  } catch {
    return null;
  }
}

export async function optionalAuth(
  request: NextRequest,
  audience?: "agent-api" | "data-api" | "search-api",
  scopes?: string[],
): Promise<AuthenticatedRequest | null> {
  try {
    const ssoToken = getTokenFromRequest(request);
    const targetAudience = audience || DEFAULT_AUDIENCE;
    const resourceId = getAppResourceId(request);

    if (!ssoToken) {
      const testSessionJwt = process.env.TEST_SESSION_JWT;
      if (!testSessionJwt) return null;
      const apiToken = await getApiToken(testSessionJwt, targetAudience, scopes, resourceId);
      return buildAuthResult(testSessionJwt, apiToken, true);
    }

    const apiToken = await getApiToken(ssoToken, targetAudience, scopes, resourceId);
    return buildAuthResult(ssoToken, apiToken, false);
  } catch (error: unknown) {
    console.error("[AUTH] Optional auth failed:", error);
    return null;
  }
}
