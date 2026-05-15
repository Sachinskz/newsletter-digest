import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  // Health check must respond at /api/health regardless of basePath,
  // because the BusiBox container health checker hits the raw port directly.
  if (request.nextUrl.pathname === "/api/health") {
    return NextResponse.json({ status: "healthy", timestamp: new Date().toISOString() });
  }

  const internalPort = process.env.DEV_INTERNAL_PORT || process.env.PORT;
  const proxyPort = process.env.DEV_PROXY_PORT;
  const host = request.headers.get("host") || "";
  const requestPort = request.nextUrl.port || host.split(":").pop() || "";

  if (
    process.env.NODE_ENV === "development" &&
    process.env.TEST_SESSION_JWT &&
    internalPort &&
    proxyPort &&
    request.headers.get("x-busibox-dev-proxy") !== "1" &&
    requestPort === internalPort
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.protocol = request.nextUrl.protocol;
    redirectUrl.hostname = request.nextUrl.hostname;
    redirectUrl.port = proxyPort;

    // "/home?reason=session_expired" is the most common internal-loop landing page.
    // Send it back to the public proxy root so the injected dev session can take over.
    if (redirectUrl.pathname === "/home") {
      redirectUrl.pathname = "/";
      redirectUrl.search = "";
    }

    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
