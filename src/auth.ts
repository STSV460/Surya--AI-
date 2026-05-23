import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";
import { createInsforgeAuthClient, insforgeDb as db } from "@/lib/insforge";
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

async function ensureEmailProfile({
  email,
  name,
  image,
  providerKey,
}: {
  email: string;
  name?: string | null;
  image?: string | null;
  providerKey: string;
}) {
  const now = new Date().toISOString();
  const { data: byEmail } = await db
    .from("profiles")
    .select("id,username")
    .eq("email", email)
    .maybeSingle();

  if (byEmail?.id) {
    const existingKeys = (byEmail.username ?? "")
      .split(",")
      .map((key: string) => key.trim())
      .filter(Boolean);
    if (!existingKeys.includes(providerKey)) existingKeys.push(providerKey);

    await db
      .from("profiles")
      .update({
        username: existingKeys.join(","),
        display_name: name ?? undefined,
        avatar_url: image ?? undefined,
        updated_at: now,
      })
      .eq("id", byEmail.id);

    return byEmail.id as string;
  }

  const { data: inserted } = await db
    .from("profiles")
    .insert({
      email,
      display_name: name ?? "",
      avatar_url: image ?? "",
      username: providerKey,
      role: "user",
      account_status: "active",
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .maybeSingle();

  return (inserted?.id as string | undefined) ?? null;
}

const config: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Basic scopes only at login — no sensitive/restricted scopes.
          // Gmail, Drive, Calendar etc. are requested separately when user
          // connects Google Workspace via Settings → Connectors.
          scope: "openid email profile",
          access_type: "offline",
          prompt: "select_account",
        },
      },
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: { params: { scope: "read:user user:email repo workflow" } },
    }),
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const { data, error } = await createInsforgeAuthClient().auth.signInWithPassword({
          email,
          password,
        });

        if (error || !data?.user?.email) {
          console.warn("[auth] REJECT email login:", error?.message ?? "missing user");
          return null;
        }

        const profileId = await ensureEmailProfile({
          email: data.user.email,
          name: data.user.profile?.name ?? data.user.email.split("@")[0],
          image: data.user.profile?.avatar_url ?? null,
          providerKey: `email:${data.user.id}`,
        });

        if (!profileId) return null;

        return {
          id: profileId,
          email: data.user.email,
          name: data.user.profile?.name ?? data.user.email.split("@")[0],
          image: data.user.profile?.avatar_url ?? null,
        };
      },
    }),
  ],

  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || !user.email) return false;
      if (account.provider === "credentials") return true;

      // --- Email verification gate (prevents account takeover) -----------------
      // OAuth providers can return unverified secondary emails. Without this
      // check, an attacker could add a victim's email as a secondary unverified
      // address on their own GitHub/Google account, then log into Surya as the
      // victim through email-based identity merge. Reject any login where the
      // returned email is not provably owned by the OAuth principal.
      if (account.provider === "google") {
        const verified = (profile as { email_verified?: boolean })?.email_verified;
        if (verified !== true) {
          console.warn("[auth] REJECT Google login: email_verified !== true", user.email);
          return false;
        }
      }
      if (account.provider === "github") {
        try {
          const r = await fetch("https://api.github.com/user/emails", {
            headers: {
              Authorization: `Bearer ${account.access_token}`,
              "User-Agent": "surya-ai-auth",
              Accept: "application/vnd.github+json",
            },
          });
          if (!r.ok) {
            console.warn("[auth] REJECT GitHub login: /user/emails fetch failed", r.status);
            return false;
          }
          const emails = (await r.json()) as Array<{
            email: string;
            verified: boolean;
            primary: boolean;
          }>;
          const ok = emails.some(
            (e) => e.email === user.email && e.verified === true && e.primary === true
          );
          if (!ok) {
            console.warn(
              "[auth] REJECT GitHub login: email not verified+primary on GitHub",
              user.email
            );
            return false;
          }
        } catch (err) {
          console.warn("[auth] REJECT GitHub login: email verification error", err);
          return false;
        }
      }

      try {
        const provider = account.provider; // "google" | "github"
        const providerAccountId = String(account.providerAccountId ?? "");

        // --- Identity resolution: EMAIL-BASED (ChatGPT-style) -------------------
        // Email is the primary identity. Multiple OAuth providers (Google, GitHub)
        // map to the same profile if email matches. The `username` field stores
        // comma-separated provider keys for tracking which providers are linked.
        //
        // Trade-off: if two humans share an email, they share a profile.
        // Acceptable because OAuth providers verify email ownership.
        const providerKey = `${provider}:${providerAccountId}`;

        const resolvedProfileId = await ensureEmailProfile({
          email: user.email,
          name: user.name,
          image: user.image,
          providerKey,
        });

        // --- Persist OAuth tokens keyed by userId (not email) ------------------
        // Previously keyed by email which leaked credentials across users who
        // shared an email address. Now scoped to the resolved profile id.
        if (resolvedProfileId && account.access_token) {
          const tokenRow = {
            user_id: resolvedProfileId,
            email: user.email, // kept for display, NEVER used as a lookup key
            provider,
            access_token: await encrypt(account.access_token),
            refresh_token: account.refresh_token ? await encrypt(account.refresh_token) : null,
            expires_at: account.expires_at
              ? new Date((account.expires_at as number) * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
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
      // Populate userId on signIn by EMAIL (ChatGPT-style identity).
      // Same email across providers = same profile.
      if (trigger === "signIn" && account && user?.email) {
        if (account.provider === "credentials" && user.id) {
          token.userId = user.id;
          return token;
        }

        try {
          const { data } = await db
            .from("profiles")
            .select("id")
            .eq("email", user.email)
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
