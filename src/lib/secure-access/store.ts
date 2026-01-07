export interface Vendor {
  id: string;
  name: string;
  website: string;
  password: string;
  accountNumber: string;
  contactPhone: string;
  contactEmail: string;
  lastUpdatedAt: string;
  lastUpdatedBy: string;
}

export interface VendorActivityEvent {
  id: string;
  vendorId: string;
  action: string;
  actorName: string;
  createdAt: string;
  fieldsChanged?: string[];
  note?: string;
}

interface SecureAccessState {
  vendors: Vendor[];
  activityByVendorId: Record<string, VendorActivityEvent[]>;
}

const STORAGE_KEY = "organizer_secure_access_v1";

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `v-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const getWebsiteDomain = (website: string) => {
  try {
    return new URL(website).host;
  } catch {
    return website.replace(/^https?:\/\//, "");
  }
};

const seedState = (): SecureAccessState => {
  const now = new Date();
  const vendors: Vendor[] = [
    {
      id: "v-001",
      name: "Northwind Facilities",
      website: "https://northwindfacilities.com",
      password: "BlueRiver-2025",
      accountNumber: "NW-30219",
      contactPhone: "+1 (212) 555-0144",
      contactEmail: "ops@northwindfacilities.com",
      lastUpdatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 3).toISOString(),
      lastUpdatedBy: "David",
    },
    {
      id: "v-002",
      name: "Atlas Security",
      website: "https://atlas-security.co",
      password: "Atlas#Vault9",
      accountNumber: "AT-88420",
      contactPhone: "+1 (646) 555-0191",
      contactEmail: "support@atlas-security.co",
      lastUpdatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 22).toISOString(),
      lastUpdatedBy: "Admin",
    },
    {
      id: "v-003",
      name: "Cedar HR Services",
      website: "https://cedarhr.com",
      password: "CedarAccess!",
      accountNumber: "CH-11002",
      contactPhone: "+1 (718) 555-0139",
      contactEmail: "team@cedarhr.com",
      lastUpdatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 30).toISOString(),
      lastUpdatedBy: "Samantha",
    },
  ];

  const activityByVendorId: Record<string, VendorActivityEvent[]> = {
    "v-001": [
      {
        id: createId(),
        vendorId: "v-001",
        action: "Vendor updated",
        actorName: "David",
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 3).toISOString(),
        fieldsChanged: ["Contact Phone"],
      },
      {
        id: createId(),
        vendorId: "v-001",
        action: "Vendor created",
        actorName: "Admin",
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 48).toISOString(),
      },
    ],
    "v-002": [
      {
        id: createId(),
        vendorId: "v-002",
        action: "Vendor created",
        actorName: "Admin",
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 72).toISOString(),
      },
    ],
    "v-003": [
      {
        id: createId(),
        vendorId: "v-003",
        action: "Vendor created",
        actorName: "Admin",
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 96).toISOString(),
      },
    ],
  };

  return { vendors, activityByVendorId };
};

export const loadState = (): SecureAccessState => {
  if (typeof window === "undefined") {
    return seedState();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedState();
    saveState(seeded);
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as SecureAccessState;
    if (!parsed.vendors || !parsed.activityByVendorId) {
      const seeded = seedState();
      saveState(seeded);
      return seeded;
    }
    return parsed;
  } catch {
    const seeded = seedState();
    saveState(seeded);
    return seeded;
  }
};

export const saveState = (state: SecureAccessState) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const createVendor = (input: Omit<Vendor, "id" | "lastUpdatedAt" | "lastUpdatedBy">) => {
  const state = loadState();
  const now = new Date().toISOString();
  const vendor: Vendor = {
    id: createId(),
    lastUpdatedAt: now,
    lastUpdatedBy: "Admin",
    ...input,
  };

  const nextState: SecureAccessState = {
    ...state,
    vendors: [vendor, ...state.vendors],
  };
  saveState(nextState);
  return vendor;
};

export const updateVendor = (
  vendorId: string,
  patch: Partial<Omit<Vendor, "id" | "lastUpdatedAt" | "lastUpdatedBy">>,
  actorName: string
) => {
  const state = loadState();
  const index = state.vendors.findIndex((vendor) => vendor.id === vendorId);
  if (index === -1) {
    throw new Error("Vendor not found");
  }

  const updated: Vendor = {
    ...state.vendors[index],
    ...patch,
    lastUpdatedAt: new Date().toISOString(),
    lastUpdatedBy: actorName,
  };

  const nextVendors = [...state.vendors];
  nextVendors[index] = updated;

  saveState({
    ...state,
    vendors: nextVendors,
  });

  return updated;
};

export const logVendorEvent = (
  vendorId: string,
  event: Omit<VendorActivityEvent, "id" | "vendorId" | "createdAt">
) => {
  const state = loadState();
  const nextEvent: VendorActivityEvent = {
    id: createId(),
    vendorId,
    createdAt: new Date().toISOString(),
    ...event,
  };

  const existing = state.activityByVendorId[vendorId] ?? [];
  const nextActivity = [nextEvent, ...existing];

  saveState({
    ...state,
    activityByVendorId: {
      ...state.activityByVendorId,
      [vendorId]: nextActivity,
    },
  });
};

export const getVendorById = (vendorId: string) => {
  const state = loadState();
  return state.vendors.find((vendor) => vendor.id === vendorId) ?? null;
};
