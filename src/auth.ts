import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";
import { insforgeDb as db } from "@/lib/insforge";
import { encrypt } from "@/lib/crypto";

// Module augmentation — must live here alongside the NextAuth() call
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
  }
}

const config: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid email profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/drive.readonly",
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/documents",
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/presentations",
          ].join(" "),
          access_type: "offline",
          prompt: "consent", // REQUIRED on every login to receive refresh_token
        },
      },
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: { params: { scope: "read:user user:email" } },
    }),
  ],

  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    async signIn({ user, account }) {
      if (!account || !user.email) return false;

      try {
        const now = new Date().toISOString();
        const provider = account.provider; // "google" | "github"
        const providerAccountId = String(account.providerAccountId ?? "");

        // --- Identity resolution (provider-scoped, not email-only) --------------
        // 1. First, try to find an existing profile linked to this exact
        //    (provider, providerAccountId). That's the stable identity.
        // 2. If not found, try by email. If the email belongs to a profile
        //    that was created by a *different* provider account, REJECT the
        //    login to prevent cross-account data leakage (two different
        //    humans who happen to share an email address must not share
        //    a profile).
        // 3. Otherwise create a new profile and stamp the provider account ID.
        //
        // The profile's `username` column is (re)used to store the
        // provider-scoped identity: `{provider}:{providerAccountId}`. This
        // avoids a schema migration but gives us a stable, provider-scoped
        // unique key to look profiles up by.
        const providerKey = `${provider}:${providerAccountId}`;

        // 1. Lookup by provider key (stored in username column)
        const { data: byProvider } = await db
          .from("profiles")
          .select("id,email")
          .eq("username", providerKey)
          .maybeSingle();

        let resolvedProfileId: string | null = byProvider?.id ?? null;

        if (resolvedProfileId) {
          // Refresh display info
          await db
            .from("profiles")
            .update({
              email: user.email,
              display_name: user.name ?? undefined,
              avatar_url: user.image ?? undefined,
              updated_at: now,
            })
            .eq("id", resolvedProfileId);
        } else {
          // 2. Lookup by email
          const { data: byEmail } = await db
            .from("profiles")
            .select("id,username")
            .eq("email", user.email)
            .maybeSingle();

          if (byEmail) {
            const existingKey = (byEmail.username ?? "") as string;
            // If the stored profile has a DIFFERENT provider account id,
            // refuse to merge — that would be a cross-user data leak.
            if (existingKey.includes(":") && existingKey !== providerKey) {
              const storedProvider = existingKey.split(":")[0];
              console.warn(
                `[auth] REJECT cross-provider login: email ${user.email} already linked to ${storedProvider}`
              );
              // Returning a string redirects the user to an error page in NextAuth v5.
              return `/login?error=ProviderLinked&provider=${storedProvider}`;
            }
            // Legacy row (no provider key yet) — claim it for this provider.
            resolvedProfileId = byEmail.id as string;
            await db
              .from("profiles")
              .update({
                username: providerKey,
                display_name: user.name ?? undefined,
                avatar_url: user.image ?? undefined,
                updated_at: now,
              })
              .eq("id", resolvedProfileId);
          } else {
            // 3. Brand new profile
            const { data: inserted } = await db
              .from("profiles")
              .insert({
                email: user.email,
                display_name: user.name ?? "",
                avatar_url: user.image ?? "",
                username: providerKey,
                role: "user",
                account_status: "active",
                created_at: now,
                updated_at: now,
              })
              .select("id")
              .maybeSingle();
            resolvedProfileId = (inserted?.id as string) ?? null;
          }
        }

        // --- Persist OAuth tokens keyed by userId (not email) ------------------
        // Previously keyed by email which leaked credentials across users who
        // shared an email address. Now scoped to the resolved profile id.
        if (resolvedProfileId && account.access_token) {
          const tokenRow = {
            user_id: resolvedProfileId,
            email: user.email, // kept for display, NEVER used as a lookup key
            provider,
            access_token: encrypt(account.access_token),
            refresh_token: account.refresh_token ? encrypt(account.refresh_token) : null,
            expires_at: account.expires_at
              ? new Date((account.expires_at as number) * 1000).toISOString()
              : null,
            updated_at: now,
            created_at: now,
          };

          // Prefer upsert on (user_id, provider); if that constraint is not
          // configured in the DB yet, fall back to delete+insert for safety.
          const { error: upsertErr } = await db
            .from("connector_tokens")
            .upsert(tokenRow, { onConflict: "user_id,provider" });

          if (upsertErr) {
            try {
              await db
                .from("connector_tokens")
                .delete()
                .eq("user_id", resolvedProfileId)
                .eq("provider", provider);
              await db.from("connector_tokens").insert(tokenRow);
            } catch (fallbackErr) {
              console.error("[auth] connector token fallback insert failed:", fallbackErr);
            }
          }
        }
      } catch (err) {
        // Log but don't block login
        console.error("[auth] signIn callback error:", err);
      }

      return true;
    },

    async jwt({ token, user, account, trigger }) {
      // Populate userId on signIn via (provider, providerAccountId), never
      // by email alone — email lookup is what caused the cross-account leak.
      if (trigger === "signIn" && account && user?.email) {
        try {
          const providerKey = `${account.provider}:${String(account.providerAccountId ?? "")}`;
          const { data } = await db
            .from("profiles")
            .select("id")
            .eq("username", providerKey)
            .maybeSingle();
          if (data?.id) token.userId = data.id as string;
        } catch {
          // token.userId stays undefined
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId;
      }
      return session;
    },

    async authorized({ auth }) {
      return !!auth;
    },
  },
};

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth(config);
