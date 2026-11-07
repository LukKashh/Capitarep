import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "./firebase";

export const requireFirebaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      const parts = token.split(".");
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
          userId = payload.user_id || payload.sub || null;
        } catch {
          try {
            const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
            userId = payload.user_id || payload.sub || null;
          } catch {
            userId = null;
          }
        }
      } else if (token.length > 0 && token.length <= 128) {
        userId = token;
      }
    }

    if (!userId && auth.currentUser) {
      userId = auth.currentUser.uid;
    }

    if (!userId) {
      throw new Error("Unauthorized: Please sign in with Firebase to continue");
    }

    return next({
      context: {
        userId,
      },
    });
  },
);
