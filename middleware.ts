import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Rotas públicas (sempre permitidas)
    const publicPaths = ["/login", "/register"];
    const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

    if (isPublicPath) {
        return NextResponse.next();
    }

    // Obter token JWT do NextAuth
    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
    });

    // Se não há token válido, redireciona para login
    if (!token) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Token válido, permite acesso
    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Protege todas as rotas exceto:
         * - /api/auth/* (rotas do NextAuth)
         * - /_next/* (arquivos estáticos do Next.js)
         * - /favicon.ico, /robots.txt, etc
         */
        "/((?!api/auth|_next|favicon.ico|robots.txt).*)",
    ],
};
