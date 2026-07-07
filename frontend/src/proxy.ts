import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Público-primero: BBJobs es un portal público (home, /empleos, /login, /register, etc.).
// Sólo el panel autenticado y el onboarding requieren sesión.
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/onboarding(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
