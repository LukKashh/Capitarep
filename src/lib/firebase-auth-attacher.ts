import { createMiddleware } from "@tanstack/react-start";
import { auth } from "./firebase";

// Global client-side middleware for serverFn RPCs
export const attachFirebaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token: string | undefined;
    if (typeof window !== "undefined" && auth.currentUser) {
      try {
        token = await auth.currentUser.getIdToken();
      } catch {
        token = auth.currentUser.uid;
      }
    }
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
