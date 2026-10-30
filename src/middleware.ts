import { NextResponse, type NextRequest } from "next/server";
import { isLang, LANG_COOKIE } from "@/lib/i18n/dictionary";

// Public README links select a language before the existing cookie-based render.
export function middleware(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get("lang");
  if (!isLang(lang)) return NextResponse.next();

  const destination = request.nextUrl.clone();
  destination.searchParams.delete("lang");
  const response = NextResponse.redirect(destination);
  response.cookies.set(LANG_COOKIE, lang, {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: "/vision" };
