import { supabaseBrowser } from "@/lib/supabase/browser";
import type { Employee, PayrollChangeLog, PayrollProfile } from "@/lib/payroll/store";

type SupabaseClient = ReturnType<typeof supabaseBrowser>;

type PayrollProfileRow = {
  employee_id: string;
  org_id: string;
  pay_type: string;
  hourly_rate: number | string | null;
  salary_amount: number | string | null;
  pto_accrual_rate: number | string | null;
  stipend: number | string | null;
  notes: string | null;
  pay_periods_per_year: number | string | null;
  is_active: boolean | null;
  department_rates: unknown;
  effective_date: string | null;
};

type PayrollChangeRow = {
  id: string;
  org_id: string;
  employee_id: string | null;
  employee_name: string | null;
  actor_name: string | null;
  created_at: string | null;
  summary: string | null;
  fields_changed: string[] | null;
  change_type: string | null;
  note_before: string | null;
  note_after: string | null;
};

const normalizePayType = (value: string | null | undefined): PayrollProfile["payType"] =>
  value === "Salary" ? "Salary" : "Hourly";

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const blankProfile = (): PayrollProfile => ({
  payType: "Hourly",
  hourlyRate: 0,
  salaryAmount: 0,
  ptoAccrualRate: 0,
  stipend: 0,
  notes: "",
  payPeriodsPerYear: 26,
  isActive: true,
  departmentRates: [],
  effectiveDate: todayISO(),
});

const mapProfileRow = (row: PayrollProfileRow): PayrollProfile => ({
  payType: normalizePayType(row.pay_type),
  hourlyRate: toNumber(row.hourly_rate, 0),
  salaryAmount: toNumber(row.salary_amount, 0),
  ptoAccrualRate: toNumber(row.pto_accrual_rate, 0),
  stipend: toNumber(row.stipend, 0),
  notes: row.notes ?? "",
  payPeriodsPerYear: toNumber(row.pay_periods_per_year, 26),
  isActive: typeof row.is_active === "boolean" ? row.is_active : true,
  departmentRates: Array.isArray(row.department_rates)
    ? row.department_rates.filter(Boolean).map((item: any) => ({
        department: typeof item?.department === "string" ? item.department : "",
        hourlyRate: toNumber(item?.hourlyRate, 0),
      }))
    : [],
  effectiveDate: row.effective_date ?? todayISO(),
});

const mapChangeRow = (row: PayrollChangeRow): PayrollChangeLog => ({
  id: row.id,
  orgId: row.org_id,
  employeeId: row.employee_id ?? "",
  employeeName: row.employee_name ?? "",
  actorName: row.actor_name ?? "",
  createdAt: row.created_at ?? new Date().toISOString(),
  summary: row.summary ?? "",
  fieldsChanged: Array.isArray(row.fields_changed) ? row.fields_changed : [],
  changeType: row.change_type ?? undefined,
  noteBefore: row.note_before ?? undefined,
  noteAfter: row.note_after ?? undefined,
});

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
  if (JSON.stringify(prev.departmentRates) !== JSON.stringify(next.departmentRates)) {
    changes.push("Department rates");
  }
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

export const fetchEmployees = async (supabase: SupabaseClient, orgId: string) => {
  const { data, error } = await supabase
    .from("payroll_employees")
    .select("id, name, role, department, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load employees", error);
    return [] as Employee[];
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name ?? "") as string,
    role: (row.role ?? "") as string,
    department: (row.department ?? "") as string,
  }));
};

export const fetchPayrollProfile = async (
  supabase: SupabaseClient,
  orgId: string,
  employeeId: string
) => {
  const { data, error } = await supabase
    .from("payroll_profiles")
    .select("*")
    .eq("org_id", orgId)
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load payroll profile", error);
    return blankProfile();
  }

  if (!data) {
    return blankProfile();
  }

  return mapProfileRow(data as PayrollProfileRow);
};

export const createEmployeeProfile = async (
  supabase: SupabaseClient,
  orgId: string,
  employeeInput: Omit<Employee, "id">,
  profile: PayrollProfile,
  actorName: string
) => {
  const { data: employeeData, error: employeeError } = await supabase
    .from("payroll_employees")
    .insert({
      org_id: orgId,
      name: employeeInput.name.trim(),
      role: employeeInput.role.trim(),
      department: employeeInput.department.trim(),
    })
    .select("id, name, role, department")
    .single();

  if (employeeError || !employeeData) {
    console.error("Failed to create employee", employeeError);
    throw employeeError ?? new Error("Failed to create employee");
  }

  const employeeId = employeeData.id as string;

  const profilePayload = {
    employee_id: employeeId,
    org_id: orgId,
    pay_type: profile.payType,
    hourly_rate: profile.hourlyRate,
    salary_amount: profile.salaryAmount,
    pto_accrual_rate: profile.ptoAccrualRate,
    stipend: profile.stipend,
    notes: profile.notes,
    pay_periods_per_year: profile.payPeriodsPerYear,
    is_active: profile.isActive,
    department_rates: profile.departmentRates,
    effective_date: profile.effectiveDate,
  };

  const { error: profileError } = await supabase.from("payroll_profiles").insert(profilePayload);
  if (profileError) {
    console.error("Failed to create payroll profile", profileError);
    throw profileError;
  }

  const noteText = profile.notes.trim();
  const fieldsChanged = noteText ? ["Profile created", "Notes"] : ["Profile created"];

  const { error: logError } = await supabase.from("payroll_change_logs").insert({
    org_id: orgId,
    employee_id: employeeId,
    employee_name: employeeData.name,
    actor_name: actorName,
    summary: "Profile created",
    fields_changed: fieldsChanged,
    change_type: "General",
    note_before: noteText ? "" : null,
    note_after: noteText ? profile.notes : null,
  });

  if (logError) {
    console.error("Failed to create payroll change log", logError);
  }

  return {
    id: employeeId,
    name: employeeData.name as string,
    role: employeeData.role as string,
    department: employeeData.department as string,
  } as Employee;
};

export const updatePayrollProfile = async (
  supabase: SupabaseClient,
  orgId: string,
  employee: Employee,
  prevProfile: PayrollProfile,
  nextProfile: PayrollProfile,
  actorName: string
) => {
  const { error: updateError } = await supabase
    .from("payroll_profiles")
    .upsert(
      {
        employee_id: employee.id,
        org_id: orgId,
        pay_type: nextProfile.payType,
        hourly_rate: nextProfile.hourlyRate,
        salary_amount: nextProfile.salaryAmount,
        pto_accrual_rate: nextProfile.ptoAccrualRate,
        stipend: nextProfile.stipend,
        notes: nextProfile.notes,
        pay_periods_per_year: nextProfile.payPeriodsPerYear,
        is_active: nextProfile.isActive,
        department_rates: nextProfile.departmentRates,
        effective_date: nextProfile.effectiveDate,
      },
      { onConflict: "employee_id" }
    );

  if (updateError) {
    console.error("Failed to update payroll profile", updateError);
    throw updateError;
  }

  const fieldsChanged = diffFields(prevProfile, nextProfile);
  if (fieldsChanged.length === 0) {
    return { fieldsChanged };
  }

  const notesChanged = prevProfile.notes !== nextProfile.notes;
  const { error: logError } = await supabase.from("payroll_change_logs").insert({
    org_id: orgId,
    employee_id: employee.id,
    employee_name: employee.name,
    actor_name: actorName,
    summary: "Updated payroll fields",
    fields_changed: fieldsChanged,
    change_type: changeTypeFor(fieldsChanged),
    note_before: notesChanged ? prevProfile.notes : null,
    note_after: notesChanged ? nextProfile.notes : null,
  });

  if (logError) {
    console.error("Failed to create payroll change log", logError);
  }

  return { fieldsChanged };
};

export const deleteEmployeeProfile = async (
  supabase: SupabaseClient,
  orgId: string,
  employeeId: string
) => {
  const { error } = await supabase
    .from("payroll_employees")
    .delete()
    .eq("org_id", orgId)
    .eq("id", employeeId);

  if (error) {
    console.error("Failed to delete employee", error);
    throw error;
  }
};

export const fetchPayrollLogs = async (
  supabase: SupabaseClient,
  orgId: string,
  limit = 10
) => {
  const { data, error } = await supabase
    .from("payroll_change_logs")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to load payroll logs", error);
    return [] as PayrollChangeLog[];
  }

  return (data ?? []).map((row) => mapChangeRow(row as PayrollChangeRow));
};

export const fetchPayrollLogsSince = async (
  supabase: SupabaseClient,
  orgId: string,
  sinceIso: string
) => {
  const { data, error } = await supabase
    .from("payroll_change_logs")
    .select("*")
    .eq("org_id", orgId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load payroll logs", error);
    return [] as PayrollChangeLog[];
  }

  return (data ?? []).map((row) => mapChangeRow(row as PayrollChangeRow));
};

export const getBlankPayrollProfile = () => blankProfile();
