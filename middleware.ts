import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/_next/static", "/_next/image", "/favicon.ico"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

function unauthorized(): NextResponse {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Protected"',
    },
  });
}

export function middleware(request: NextRequest): NextResponse {
  const username = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;

  if (!username || !password) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Basic ")) {
    return unauthorized();
  }

  try {
    const base64Credentials = authHeader.slice("Basic ".length);
    const credentials = atob(base64Credentials);
    const separatorIndex = credentials.indexOf(":");

    if (separatorIndex === -1) {
      return unauthorized();
    }

    const inputUser = credentials.slice(0, separatorIndex);
    const inputPassword = credentials.slice(separatorIndex + 1);

    if (inputUser !== username || inputPassword !== password) {
      return unauthorized();
    }

    return NextResponse.next();
  } catch {
    return unauthorized();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
