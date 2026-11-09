// Until server-side sign-in (#32) exists, the API cannot tell who is calling,
// so nothing reachable from the browser may grant, remove or suspend these roles.
export const ELEVATED_ROLES = ["Owner", "Admin", "TechSupport"] as const;

export const isElevatedRole = (role: string | null | undefined): boolean =>
  !!role && (ELEVATED_ROLES as readonly string[]).includes(role);

export const ELEVATED_LOCK_MESSAGE =
  "Granting or changing Owner, Admin and TechSupport roles is temporarily disabled until SDD single sign-on is enabled. Ask the platform owner to make this change directly in the database.";
