export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
}

export interface PayrollProfile {
  payType: "Hourly" | "Salary";
  hourlyRate: number;
  salaryAmount: number;
  ptoAccrualRate: number;
  stipend: number;
  notes: string;
  payPeriodsPerYear: number;
  isActive: boolean;
  effectiveDate: string;
}

export interface PayrollChangeLog {
  id: string;
  orgId: string;
  employeeId: string;
  employeeName: string;
  actorName: string;
  createdAt: string;
  summary: string;
  fieldsChanged: string[];
  changeType?: string;
  noteBefore?: string;
  noteAfter?: string;
}

interface PayrollState {
  employeesByOrgId: Record<string, Employee[]>;
  payrollByOrgId: Record<string, Record<string, PayrollProfile>>;
  payrollChangeLogByOrgId: Record<string, PayrollChangeLog[]>;
}

const STORAGE_KEY = "organizer_payroll_v1";

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pay-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const emptyState = (): PayrollState => ({
  employeesByOrgId: {},
  payrollByOrgId: {},
  payrollChangeLogByOrgId: {},
});

const seedEmployees = (): Employee[] => [
  { id: createId(), name: "Ava Morales", role: "HR Manager", department: "People" },
  { id: createId(), name: "Ethan Park", role: "Staff Engineer", department: "Product" },
  { id: createId(), name: "Maya Singh", role: "Operations Lead", department: "Operations" },
  { id: createId(), name: "Jordan Blake", role: "Finance Analyst", department: "Finance" },
];

const defaultProfileFor = (employee: Employee): PayrollProfile => {
  if (employee.role.toLowerCase().includes("engineer")) {
    return {
      payType: "Salary",
      hourlyRate: 0,
      salaryAmount: 135000,
      ptoAccrualRate: 6,
      stipend: 150,
      notes: "",
      payPeriodsPerYear: 26,
      isActive: true,
      effectiveDate: new Date().toISOString().slice(0, 10),
    };
  }

  return {
    payType: "Hourly",
    hourlyRate: 42,
    salaryAmount: 0,
    ptoAccrualRate: 4,
    stipend: 100,
    notes: "",
    payPeriodsPerYear: 26,
    isActive: true,
    effectiveDate: new Date().toISOString().slice(0, 10),
  };
};

const ensureOrgInitialized = (orgId: string, state: PayrollState) => {
  let nextState = state;
  if (!nextState.employeesByOrgId[orgId]) {
    const employees = seedEmployees();
    const payrollProfiles: Record<string, PayrollProfile> = {};
    employees.forEach((employee) => {
      payrollProfiles[employee.id] = defaultProfileFor(employee);
    });

    nextState = {
      ...nextState,
      employeesByOrgId: {
        ...nextState.employeesByOrgId,
        [orgId]: employees,
      },
      payrollByOrgId: {
        ...nextState.payrollByOrgId,
        [orgId]: payrollProfiles,
      },
    };
  }

  if (!nextState.payrollChangeLogByOrgId[orgId]) {
    nextState = {
      ...nextState,
      payrollChangeLogByOrgId: {
        ...nextState.payrollChangeLogByOrgId,
        [orgId]: [],
      },
    };
  }

  if (nextState !== state) {
    savePayrollState(nextState);
  }

  return nextState;
};

export const loadPayrollState = (): PayrollState => {
  if (typeof window === "undefined") {
    return emptyState();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const empty = emptyState();
    savePayrollState(empty);
    return empty;
  }

  try {
    const parsed = JSON.parse(raw) as PayrollState;
    if (!parsed.employeesByOrgId || !parsed.payrollByOrgId || !parsed.payrollChangeLogByOrgId) {
      const empty = emptyState();
      savePayrollState(empty);
      return empty;
    }
    return parsed;
  } catch {
    const empty = emptyState();
    savePayrollState(empty);
    return empty;
  }
};

export const savePayrollState = (state: PayrollState) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const ensureOrgPayrollState = (orgId: string) => {
  const state = loadPayrollState();
  ensureOrgInitialized(orgId, state);
};

export const getEmployees = (orgId: string) => {
  const state = ensureOrgInitialized(orgId, loadPayrollState());
  return state.employeesByOrgId[orgId] ?? [];
};

export const getPayrollProfile = (orgId: string, employeeId: string) => {
  const state = ensureOrgInitialized(orgId, loadPayrollState());
  const profile = state.payrollByOrgId[orgId]?.[employeeId];
  if (profile) {
    return {
      ...profile,
      payPeriodsPerYear:
        Number.isFinite(profile.payPeriodsPerYear) && profile.payPeriodsPerYear > 0
          ? profile.payPeriodsPerYear
          : 26,
      isActive: typeof profile.isActive === "boolean" ? profile.isActive : true,
      notes: profile.notes ?? "",
    };
  }
  return {
    payType: "Hourly",
    hourlyRate: 0,
    salaryAmount: 0,
    ptoAccrualRate: 0,
    stipend: 0,
    notes: "",
    payPeriodsPerYear: 26,
    isActive: true,
    effectiveDate: new Date().toISOString().slice(0, 10),
  };
};

const diffFields = (prev: PayrollProfile, next: PayrollProfile) => {
  const changes: string[] = [];
  if (prev.payType !== next.payType) changes.push("Pay type");
  if (prev.hourlyRate !== next.hourlyRate) changes.push("Hourly rate");
  if (prev.salaryAmount !== next.salaryAmount) changes.push("Salary amount");
  if (prev.ptoAccrualRate !== next.ptoAccrualRate) changes.push("PTO accrual rate");
  if (prev.stipend !== next.stipend) changes.push("Stipend");
  if (prev.notes !== next.notes) changes.push("Notes");
  if (prev.payPeriodsPerYear !== next.payPeriodsPerYear) changes.push("Pay periods per year");
  if (prev.isActive !== next.isActive) changes.push("Employment status");
  if (prev.effectiveDate !== next.effectiveDate) changes.push("Effective date");
  return changes;
};

const changeTypeFor = (fields: string[]) => {
  const buckets = new Set<string>();
  if (fields.some((field) => ["Pay type", "Hourly rate", "Salary amount"].includes(field))) {
    buckets.add("Compensation");
  }
  if (fields.includes("PTO accrual rate")) {
    buckets.add("PTO");
  }
  if (fields.includes("Stipend")) {
    buckets.add("Stipend");
  }
  if (fields.includes("Notes") || fields.includes("Effective date")) {
    buckets.add("General");
  }

  if (buckets.size === 0) return undefined;
  if (buckets.size === 1) return Array.from(buckets)[0];
  return "Multiple";
};

export const updatePayrollProfile = (
  orgId: string,
  employee: Employee,
  prevProfile: PayrollProfile,
  nextProfile: PayrollProfile,
  actorName: string
) => {
  const state = ensureOrgInitialized(orgId, loadPayrollState());
  const fieldsChanged = diffFields(prevProfile, nextProfile);

  const nextPayrollByOrg = {
    ...state.payrollByOrgId,
    [orgId]: {
      ...state.payrollByOrgId[orgId],
      [employee.id]: nextProfile,
    },
  };

  let nextLogByOrg = state.payrollChangeLogByOrgId;
  if (fieldsChanged.length > 0) {
    const notesChanged = prevProfile.notes !== nextProfile.notes;
    const log: PayrollChangeLog = {
      id: createId(),
      orgId,
      employeeId: employee.id,
      employeeName: employee.name,
      actorName,
      createdAt: new Date().toISOString(),
      summary: "Updated payroll fields",
      fieldsChanged,
      changeType: changeTypeFor(fieldsChanged),
      noteBefore: notesChanged ? prevProfile.notes : undefined,
      noteAfter: notesChanged ? nextProfile.notes : undefined,
    };

    const existing = state.payrollChangeLogByOrgId[orgId] ?? [];
    nextLogByOrg = {
      ...state.payrollChangeLogByOrgId,
      [orgId]: [log, ...existing],
    };
  }

  const nextState: PayrollState = {
    ...state,
    payrollByOrgId: nextPayrollByOrg,
    payrollChangeLogByOrgId: nextLogByOrg,
  };

  savePayrollState(nextState);
  return { fieldsChanged };
};

export const createEmployeeProfile = (
  orgId: string,
  employeeInput: Omit<Employee, "id">,
  profile: PayrollProfile
) => {
  const state = ensureOrgInitialized(orgId, loadPayrollState());
  const employee: Employee = {
    id: createId(),
    name: employeeInput.name.trim(),
    role: employeeInput.role.trim(),
    department: employeeInput.department.trim(),
  };

  const nextEmployees = [...(state.employeesByOrgId[orgId] ?? []), employee];
  const nextPayrollByOrg = {
    ...state.payrollByOrgId,
    [orgId]: {
      ...state.payrollByOrgId[orgId],
      [employee.id]: profile,
    },
  };

  const nextState: PayrollState = {
    ...state,
    employeesByOrgId: {
      ...state.employeesByOrgId,
      [orgId]: nextEmployees,
    },
    payrollByOrgId: nextPayrollByOrg,
  };

  savePayrollState(nextState);
  return employee;
};
