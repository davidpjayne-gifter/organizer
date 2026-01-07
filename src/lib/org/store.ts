import { ensureOrgPayrollState } from "@/lib/payroll/store";

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  slug: string;
  settings: Record<string, never>;
}

export interface Membership {
  orgId: string;
  userId: string;
  userEmail: string;
  role: "admin" | "staff";
  createdAt: string;
}

export interface OrgState {
  organizations: Organization[];
  memberships: Membership[];
  selectedOrgIdByUser: Record<string, string>;
}

const STORAGE_KEY = "organizer_org_v1";

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `org-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const toSlug = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export const getCurrentUserKey = (user: { id?: string | null; email?: string | null }) => {
  return user.id ?? user.email ?? "";
};

export const loadOrgState = (): OrgState => {
  if (typeof window === "undefined") {
    return { organizations: [], memberships: [], selectedOrgIdByUser: {} };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const empty = { organizations: [], memberships: [], selectedOrgIdByUser: {} };
    saveOrgState(empty);
    return empty;
  }

  try {
    const parsed = JSON.parse(raw) as OrgState;
    if (!parsed.organizations || !parsed.memberships || !parsed.selectedOrgIdByUser) {
      const empty = { organizations: [], memberships: [], selectedOrgIdByUser: {} };
      saveOrgState(empty);
      return empty;
    }
    return parsed;
  } catch {
    const empty = { organizations: [], memberships: [], selectedOrgIdByUser: {} };
    saveOrgState(empty);
    return empty;
  }
};

export const saveOrgState = (state: OrgState) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const getSelectedOrgId = (user: { id?: string | null; email?: string | null }) => {
  const userKey = getCurrentUserKey(user);
  if (!userKey) return null;
  const state = loadOrgState();
  return state.selectedOrgIdByUser[userKey] ?? null;
};

export const setSelectedOrgId = (
  user: { id?: string | null; email?: string | null },
  orgId: string
) => {
  const userKey = getCurrentUserKey(user);
  if (!userKey) return;
  const state = loadOrgState();
  const next: OrgState = {
    ...state,
    selectedOrgIdByUser: {
      ...state.selectedOrgIdByUser,
      [userKey]: orgId,
    },
  };
  saveOrgState(next);
};

export const getUserOrgs = (user: { id?: string | null; email?: string | null }) => {
  const userKey = getCurrentUserKey(user);
  if (!userKey) return [];
  const state = loadOrgState();
  const orgIds = new Set(
    state.memberships
      .filter((membership) => membership.userId === userKey)
      .map((membership) => membership.orgId)
  );
  return state.organizations.filter((org) => orgIds.has(org.id));
};

export const createOrg = (
  input: { name: string },
  user: { id?: string | null; email?: string | null }
) => {
  const userKey = getCurrentUserKey(user);
  if (!userKey) {
    throw new Error("User required");
  }

  const state = loadOrgState();
  const now = new Date().toISOString();
  const org: Organization = {
    id: createId(),
    name: input.name.trim(),
    createdAt: now,
    createdBy: user.email ?? userKey,
    slug: toSlug(input.name),
    settings: {},
  };

  const membership: Membership = {
    orgId: org.id,
    userId: userKey,
    userEmail: user.email ?? "",
    role: "admin",
    createdAt: now,
  };

  const next: OrgState = {
    organizations: [org, ...state.organizations],
    memberships: [membership, ...state.memberships],
    selectedOrgIdByUser: {
      ...state.selectedOrgIdByUser,
      [userKey]: org.id,
    },
  };

  saveOrgState(next);
  ensureOrgPayrollState(org.id);
  return org;
};

export const ensureUserHasOrgOrNull = (user: { id?: string | null; email?: string | null }) => {
  const orgs = getUserOrgs(user);
  const selectedOrgId = getSelectedOrgId(user);
  return { selectedOrgId, orgs };
};
