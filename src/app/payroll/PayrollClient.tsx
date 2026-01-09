"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Employee,
  PayrollProfile,
  loadPayrollState,
} from "@/lib/payroll/store";
import { supabaseBrowser } from "@/lib/supabase/browser";
import {
  createEmployeeProfile,
  deleteEmployeeProfile,
  fetchEmployees,
  fetchPayrollProfile,
  getBlankPayrollProfile,
  updatePayrollProfile,
} from "@/lib/payroll/supabase";
import { EmptyState } from "@/components/ui/EmptyState";
import { NativeMessage } from "@/components/ui/NativeMessage";

interface PayrollFormState {
  payType: "Hourly" | "Salary";
  hourlyRate: string;
  salaryAmount: string;
  ptoAccrualRate: string;
  stipend: string;
  notes: string;
  payPeriodsPerYear: string;
  isActive: boolean;
  departmentRates: { department: string; hourlyRate: string }[];
  effectiveDate: string;
}

const profileToForm = (profile: PayrollProfile): PayrollFormState => ({
  payType: profile.payType,
  hourlyRate: profile.hourlyRate.toString(),
  salaryAmount: profile.salaryAmount.toString(),
  ptoAccrualRate: profile.ptoAccrualRate.toString(),
  stipend: profile.stipend.toString(),
  notes: profile.notes,
  payPeriodsPerYear: profile.payPeriodsPerYear.toString(),
  isActive: profile.isActive ?? true,
  departmentRates:
    profile.departmentRates && profile.departmentRates.length > 0
      ? profile.departmentRates.map((item) => ({
          department: item.department,
          hourlyRate: item.hourlyRate.toString(),
        }))
      : [{ department: "", hourlyRate: profile.hourlyRate.toString() }],
  effectiveDate: profile.effectiveDate,
});

const formToProfile = (form: PayrollFormState): PayrollProfile => {
  const toNumber = (value: string) => (value.trim() === "" ? 0 : Number(value));
  const departmentRates = form.departmentRates
    .map((item) => ({
      department: item.department.trim(),
      hourlyRate: toNumber(item.hourlyRate),
    }))
    .filter((item) => item.department !== "" || item.hourlyRate !== 0);
  const primaryRate = departmentRates[0]?.hourlyRate ?? 0;
  return {
    payType: form.payType,
    hourlyRate: primaryRate || toNumber(form.hourlyRate),
    salaryAmount: toNumber(form.salaryAmount),
    ptoAccrualRate: toNumber(form.ptoAccrualRate),
    stipend: toNumber(form.stipend),
    notes: form.notes.trim(),
    payPeriodsPerYear: toNumber(form.payPeriodsPerYear),
    isActive: form.isActive,
    departmentRates,
    effectiveDate: form.effectiveDate,
  };
};

interface PayrollClientProps {
  orgId: string;
  orgName: string;
  actorName: string;
}

export default function PayrollClient({ orgId, orgName, actorName }: PayrollClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<PayrollFormState | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    role: "",
    department: "",
  });
  const [saveNotice, setSaveNotice] = useState("");
  const [errorNotice, setErrorNotice] = useState("");
  const [migrationReady, setMigrationReady] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle"
  );
  const [deleteCandidate, setDeleteCandidate] = useState<Employee | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setErrorNotice("");
      const loadedEmployees = await fetchEmployees(supabase, orgId);
      if (!isMounted) return;
      const initialEmployeeId = loadedEmployees[0]?.id ?? "";
      if (initialEmployeeId) {
        const profile = await fetchPayrollProfile(supabase, orgId, initialEmployeeId);
        if (!isMounted) return;
        setForm(profileToForm(profile));
        setIsCreatingNew(false);
      } else {
        setIsCreatingNew(true);
        setNewEmployee({ name: "", role: "", department: "" });
        const blankProfile = getBlankPayrollProfile();
        setForm(profileToForm(blankProfile));
      }

      setEmployees(loadedEmployees);
      setSelectedEmployeeId(initialEmployeeId);

      const localState = loadPayrollState();
      const localEmployees = localState.employeesByOrgId?.[orgId] ?? [];
      const migratedFlag = window.localStorage.getItem(`organizer_payroll_migrated_${orgId}`);
      if (!migratedFlag && loadedEmployees.length === 0 && localEmployees.length > 0) {
        setMigrationReady(true);
      } else {
        setMigrationReady(false);
      }
    }

    load().catch((error) => {
      console.error(error);
      setErrorNotice("Unable to load payroll data.");
    });

    return () => {
      isMounted = false;
    };
  }, [orgId, supabase]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((employee) => {
      const haystack = `${employee.name} ${employee.role} ${employee.department}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [employees, search]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId]
  );

  useEffect(() => {
    if (!selectedEmployee || isCreatingNew) return;
    const employeeId = selectedEmployee.id;
    let isMounted = true;
    async function loadProfile() {
      const profile = await fetchPayrollProfile(supabase, orgId, employeeId);
      if (!isMounted) return;
      setForm(profileToForm(profile));
    }
    loadProfile().catch((error) => {
      console.error(error);
      setErrorNotice("Unable to load payroll details.");
    });
    return () => {
      isMounted = false;
    };
  }, [orgId, selectedEmployee, isCreatingNew, supabase]);

  useEffect(() => {
    if (!form || !isCreatingNew) return;
    if (form.departmentRates.length === 0) return;
    if (form.departmentRates[0].department || !newEmployee.department.trim()) return;
    setForm((prev) =>
      prev
        ? {
            ...prev,
            departmentRates: prev.departmentRates.map((item, index) =>
              index === 0 ? { ...item, department: newEmployee.department.trim() } : item
            ),
          }
        : prev
    );
  }, [form, isCreatingNew, newEmployee.department]);

  function addDepartmentRate() {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            departmentRates: [...prev.departmentRates, { department: "", hourlyRate: "" }],
          }
        : prev
    );
  }

  function updateDepartmentRate(
    index: number,
    patch: Partial<{ department: string; hourlyRate: string }>
  ) {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            departmentRates: prev.departmentRates.map((item, idx) =>
              idx === index ? { ...item, ...patch } : item
            ),
          }
        : prev
    );
  }

  const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null);
  const [showRateEdit, setShowRateEdit] = useState(false);

  function removeDepartmentRate(index: number) {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            departmentRates: prev.departmentRates.filter((_, idx) => idx !== index),
          }
        : prev
    );
    setPendingRemoveIndex(null);
  }

  function handleSelectEmployee(employeeId: string) {
    if (isCreatingNew) {
      setIsCreatingNew(false);
      setNewEmployee({ name: "", role: "", department: "" });
    }
    setSelectedEmployeeId(employeeId);
  }

  function handleCancel() {
    if (isCreatingNew) {
      setIsCreatingNew(false);
      setNewEmployee({ name: "", role: "", department: "" });
      const fallbackId = employees[0]?.id ?? "";
      if (fallbackId) {
        setSelectedEmployeeId(fallbackId);
        fetchPayrollProfile(supabase, orgId, fallbackId)
          .then((profile) => setForm(profileToForm(profile)))
          .catch((error) => {
            console.error(error);
            setErrorNotice("Unable to load payroll details.");
          });
      }
      return;
    }
    if (!selectedEmployee) return;
    fetchPayrollProfile(supabase, orgId, selectedEmployee.id)
      .then((profile) => setForm(profileToForm(profile)))
      .catch((error) => {
        console.error(error);
        setErrorNotice("Unable to load payroll details.");
      });
  }

  async function handleSave() {
    if (!form) return;
    setErrorNotice("");
    if (isCreatingNew) {
      const trimmed = {
        name: newEmployee.name.trim(),
        role: newEmployee.role.trim(),
        department: newEmployee.department.trim(),
      };
      if (!trimmed.name || !trimmed.role || !trimmed.department) {
        return;
      }
      const nextProfile = formToProfile(form);
      try {
        const created = await createEmployeeProfile(
          supabase,
          orgId,
          trimmed,
          nextProfile,
          actorName
        );
        const refreshedEmployees = await fetchEmployees(supabase, orgId);
        setEmployees(refreshedEmployees);
        setSelectedEmployeeId(created.id);
        setIsCreatingNew(false);
        setNewEmployee({ name: "", role: "", department: "" });
        const refreshed = await fetchPayrollProfile(supabase, orgId, created.id);
        setForm(profileToForm(refreshed));
        setSaveNotice("Profile created and saved.");
      } catch (error) {
        console.error(error);
        setErrorNotice("Unable to save the profile.");
      }
      return;
    }
    if (!selectedEmployee) return;
    try {
      const prevProfile = await fetchPayrollProfile(supabase, orgId, selectedEmployee.id);
      const nextProfile = formToProfile(form);

      await updatePayrollProfile(
        supabase,
        orgId,
        selectedEmployee,
        prevProfile,
        nextProfile,
        actorName
      );
      const refreshed = await fetchPayrollProfile(supabase, orgId, selectedEmployee.id);
      setForm(profileToForm(refreshed));
      setSaveNotice("Changes saved.");
    } catch (error) {
      console.error(error);
      setErrorNotice("Unable to save changes.");
    }
  }

  useEffect(() => {
    if (!saveNotice) return;
    const timeout = setTimeout(() => setSaveNotice(""), 5000);
    return () => clearTimeout(timeout);
  }, [saveNotice]);

  function handleCreateProfile() {
    setIsCreatingNew(true);
    setNewEmployee({ name: "", role: "", department: "" });
    setSelectedEmployeeId("");
    const blankProfile = getBlankPayrollProfile();
    setForm(profileToForm(blankProfile));
  }

  async function handleConfirmDelete() {
    if (!deleteCandidate) return;
    setErrorNotice("");
    try {
      await deleteEmployeeProfile(supabase, orgId, deleteCandidate.id);
      const refreshedEmployees = await fetchEmployees(supabase, orgId);
      setEmployees(refreshedEmployees);
      setDeleteCandidate(null);
      const fallbackId = refreshedEmployees[0]?.id ?? "";
      if (fallbackId) {
        setSelectedEmployeeId(fallbackId);
        const profile = await fetchPayrollProfile(supabase, orgId, fallbackId);
        setForm(profileToForm(profile));
      } else {
        setSelectedEmployeeId("");
        setForm(null);
      }
    } catch (error) {
      console.error(error);
      setErrorNotice("Unable to delete the employee.");
    }
  }

  async function handleMigrateLocal() {
    setMigrationStatus("running");
    setErrorNotice("");
    try {
      const localState = loadPayrollState();
      const localEmployees = localState.employeesByOrgId?.[orgId] ?? [];
      const localProfiles = localState.payrollByOrgId?.[orgId] ?? {};
      const localLogs = localState.payrollChangeLogByOrgId?.[orgId] ?? [];

      if (localEmployees.length === 0) {
        setMigrationReady(false);
        setMigrationStatus("done");
        return;
      }

      const idMap = new Map<string, string>();
      for (const employee of localEmployees) {
        const { data, error } = await supabase
          .from("payroll_employees")
          .insert({
            org_id: orgId,
            name: employee.name,
            role: employee.role,
            department: employee.department,
          })
          .select("id")
          .single();

        if (error || !data) {
          throw error ?? new Error("Unable to migrate employee.");
        }

        const newId = data.id as string;
        idMap.set(employee.id, newId);
        const profile = localProfiles[employee.id] ?? getBlankPayrollProfile();

        const { error: profileError } = await supabase.from("payroll_profiles").insert({
          employee_id: newId,
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
        });

        if (profileError) {
          throw profileError;
        }
      }

      const logRows = localLogs.map((log) => ({
        org_id: orgId,
        employee_id: idMap.get(log.employeeId) ?? null,
        employee_name: log.employeeName,
        actor_name: log.actorName,
        created_at: log.createdAt,
        summary: log.summary || "Updated payroll fields",
        fields_changed: log.fieldsChanged ?? [],
        change_type: log.changeType ?? null,
        note_before: log.noteBefore ?? null,
        note_after: log.noteAfter ?? null,
      }));

      if (logRows.length > 0) {
        const { error: logError } = await supabase.from("payroll_change_logs").insert(logRows);
        if (logError) {
          throw logError;
        }
      }

      window.localStorage.setItem(`organizer_payroll_migrated_${orgId}`, "true");
      const refreshedEmployees = await fetchEmployees(supabase, orgId);
      setEmployees(refreshedEmployees);
      setMigrationReady(false);
      setMigrationStatus("done");
      setSaveNotice("Local payroll data backed up to Supabase.");
    } catch (error) {
      console.error(error);
      setMigrationStatus("error");
      setErrorNotice("Unable to back up local payroll data.");
    }
  }

  return (
    <main className="min-h-screen p-6">
      <div className="mb-6 text-center">
        <div className="text-2xl font-semibold">Payroll</div>
        <div className="text-sm opacity-70">ORG: {orgName}</div>
        <button
          className="mt-3 text-sm underline opacity-80 hover:opacity-100"
          type="button"
          onClick={() => router.push("/dashboard")}
        >
          Back to dashboard
        </button>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <section className="lg:w-1/3 rounded-2xl border p-6 space-y-4">
          <div>
            <div className="text-lg font-semibold">Profiles at a glance</div>
            <div className="text-sm opacity-80">Select an employee to edit payroll.</div>
          </div>
          {migrationReady ? (
            <NativeMessage
              title="Local payroll data found"
              body="Back it up to Supabase so it’s available across devices."
              actions={
                <button
                  className="btn btn-sm"
                  type="button"
                  onClick={handleMigrateLocal}
                  disabled={migrationStatus === "running"}
                >
                  {migrationStatus === "running" ? "Backing up…" : "Back up local data"}
                </button>
              }
            />
          ) : null}
          <input
            className="w-full rounded-xl border px-3 py-2"
            placeholder="Search employees…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button className="btn btn-sm w-full" type="button" onClick={handleCreateProfile}>
            Create Profile
          </button>
          <div className="max-h-[420px] overflow-y-auto rounded-2xl border divide-y">
            {filteredEmployees.length === 0 ? (
              <div className="p-6">
                <EmptyState title="No employees found" body="Try a different search term." />
              </div>
            ) : (
              filteredEmployees.map((employee) => {
                const isActive = employee.id === selectedEmployeeId;
                return (
                  <div
                    key={employee.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectEmployee(employee.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        handleSelectEmployee(employee.id);
                      }
                    }}
                    className={`w-full text-left p-4 transition ${
                      isActive ? "bg-black/10" : "hover:bg-black/5"
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-semibold">{employee.name}</div>
                        <div className="text-xs opacity-70">
                          {employee.role} · {employee.department}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="btn btn-sm"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleSelectEmployee(employee.id);
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="lg:flex-1 rounded-2xl border p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Payroll Details</div>
              {selectedEmployee || isCreatingNew ? (
                <button
                  className="btn btn-sm"
                  type="button"
                  onClick={() => {
                    setSelectedEmployeeId("");
                    setForm(null);
                    setIsCreatingNew(false);
                  }}
                  aria-label="Close payroll details"
                >
                  ✕
                </button>
              ) : null}
            </div>
            {isCreatingNew ? (
              <div className="text-sm opacity-80 mt-1">Creating a new employee profile.</div>
            ) : selectedEmployee ? (
              <div className="text-sm opacity-80 mt-1">
                {selectedEmployee.name} · {selectedEmployee.role}
              </div>
            ) : null}
          </div>

          {!form ? (
            <NativeMessage
              title="Select an employee"
              body="Choose a profile from the list to view or edit details."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
            {isCreatingNew ? (
              <>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-xs uppercase tracking-wide opacity-70">Employee name</label>
                  <input
                    className="w-full rounded-xl border px-3 py-2"
                    value={newEmployee.name}
                    onChange={(event) =>
                      setNewEmployee((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="Ava Morales"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide opacity-70">Role</label>
                  <input
                    className="w-full rounded-xl border px-3 py-2"
                    value={newEmployee.role}
                    onChange={(event) =>
                      setNewEmployee((prev) => ({ ...prev, role: event.target.value }))
                    }
                    placeholder="HR Manager"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide opacity-70">Department</label>
                  <input
                    className="w-full rounded-xl border px-3 py-2"
                    value={newEmployee.department}
                    onChange={(event) =>
                      setNewEmployee((prev) => ({ ...prev, department: event.target.value }))
                    }
                    placeholder="People"
                  />
                </div>
              </>
            ) : null}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide opacity-70">Pay type</label>
              <select
                className="w-full rounded-xl border px-3 py-2"
                value={form.payType}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, payType: event.target.value as "Hourly" | "Salary" } : prev
                  )
                }
              >
                <option value="Hourly">Hourly</option>
                <option value="Salary">Salary</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide opacity-70">
                Pay periods per year
              </label>
              <input
                className="w-full rounded-xl border px-3 py-2"
                type="number"
                step="1"
                min="1"
                value={form.payPeriodsPerYear}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, payPeriodsPerYear: event.target.value } : prev
                  )
                }
              />
            </div>
            {form.payType === "Salary" ? (
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide opacity-70">Salary amount</label>
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  type="number"
                  step="0.01"
                  value={form.salaryAmount}
                  onChange={(event) =>
                    setForm((prev) => (prev ? { ...prev, salaryAmount: event.target.value } : prev))
                  }
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide opacity-70">PTO accrual rate</label>
              <input
                className="w-full rounded-xl border px-3 py-2"
                type="number"
                step="0.1"
                value={form.ptoAccrualRate}
                onChange={(event) =>
                  setForm((prev) => (prev ? { ...prev, ptoAccrualRate: event.target.value } : prev))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide opacity-70">Stipend</label>
              <input
                className="w-full rounded-xl border px-3 py-2"
                type="number"
                step="0.01"
                value={form.stipend}
                onChange={(event) =>
                  setForm((prev) => (prev ? { ...prev, stipend: event.target.value } : prev))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs uppercase tracking-wide opacity-70">
                Departments & hourly rates {form.payType === "Salary" ? "(optional)" : ""}
              </label>
              <div className="space-y-2">
                {form.departmentRates.map((item, index) => (
                  <div key={index} className="flex flex-col gap-2 sm:flex-row">
                    <input
                      className="w-full rounded-xl border px-3 py-2"
                      placeholder="Department"
                      value={item.department}
                      onChange={(event) =>
                        updateDepartmentRate(index, { department: event.target.value })
                      }
                    />
                    <input
                      className="w-full rounded-xl border px-3 py-2"
                      placeholder="Hourly rate"
                      type="number"
                      step="0.01"
                      value={item.hourlyRate}
                      onChange={(event) =>
                        updateDepartmentRate(index, { hourlyRate: event.target.value })
                      }
                    />
                    {showRateEdit && form.departmentRates.length > 1 ? (
                      <button
                        className="btn btn-sm px-2"
                        type="button"
                        onClick={() => setPendingRemoveIndex(index)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                <button className="btn btn-sm" type="button" onClick={addDepartmentRate}>
                  Add department
                </button>
                <button
                  className="btn btn-sm"
                  type="button"
                  onClick={() => setShowRateEdit((prev) => !prev)}
                >
                  {showRateEdit ? "Done" : "Edit"}
                </button>
              </div>
              {pendingRemoveIndex !== null ? (
                <div className="mt-3 text-center">
                  <NativeMessage
                    title="Are you sure?"
                    body="Remove this department rate?"
                    tone="warning"
                    actions={
                      <div className="flex w-full flex-col items-center gap-2 sm:flex-row sm:justify-center">
                        <button
                          className="btn btn-sm"
                          type="button"
                          onClick={() => removeDepartmentRate(pendingRemoveIndex)}
                        >
                          Yes, remove
                        </button>
                        <button
                          className="btn btn-sm"
                          type="button"
                          onClick={() => setPendingRemoveIndex(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    }
                  />
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide opacity-70">Effective date</label>
              <input
                className="w-full rounded-xl border px-3 py-2"
                type="date"
                value={form.effectiveDate}
                onChange={(event) =>
                  setForm((prev) => (prev ? { ...prev, effectiveDate: event.target.value } : prev))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide opacity-70">Status</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`btn btn-sm w-full ${
                    form.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""
                  }`}
                  onClick={() => setForm((prev) => (prev ? { ...prev, isActive: true } : prev))}
                >
                  Active
                </button>
                <button
                  type="button"
                  className={`btn btn-sm w-full ${
                    !form.isActive ? "border-red-200 bg-red-50 text-red-700" : ""
                  }`}
                  onClick={() => setForm((prev) => (prev ? { ...prev, isActive: false } : prev))}
                >
                  Inactive
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  className="btn btn-sm border-red-200 bg-red-50 text-red-700"
                  type="button"
                  disabled={!selectedEmployee}
                  onClick={() => {
                    if (!selectedEmployee) return;
                    setDeleteCandidate(selectedEmployee);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs uppercase tracking-wide opacity-70">Notes</label>
              <textarea
                className="w-full rounded-xl border px-3 py-2 min-h-[120px]"
                value={form.notes}
                onChange={(event) =>
                  setForm((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                }
              />
            </div>
          </div>
          )}

          {form ? (
            <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="btn btn-primary w-full"
              type="button"
              onClick={handleSave}
              disabled={
                isCreatingNew
                  ? !newEmployee.name.trim() ||
                    !newEmployee.role.trim() ||
                    !newEmployee.department.trim()
                  : !selectedEmployee
              }
            >
              Save changes
            </button>
            <button
              className="btn w-full"
              type="button"
              onClick={handleCancel}
              disabled={!selectedEmployee}
            >
              Cancel
            </button>
            </div>
          ) : null}
          {deleteCandidate ? (
            <div className="mt-3">
              <NativeMessage
                title="Are you sure?"
                body={`Delete ${deleteCandidate.name} from the database?`}
                tone="warning"
                actions={
                  <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                    <button
                      className="btn btn-sm border-red-200 bg-red-50 text-red-700"
                      type="button"
                      onClick={handleConfirmDelete}
                    >
                      Yes, delete
                    </button>
                    <button
                      className="btn btn-sm"
                      type="button"
                      onClick={() => setDeleteCandidate(null)}
                    >
                      Cancel
                    </button>
                  </div>
                }
              />
            </div>
          ) : null}
          {errorNotice ? (
            <div className="mt-2">
              <NativeMessage title={errorNotice} tone="danger" />
            </div>
          ) : null}
          {saveNotice ? (
            <div className="mt-2">
              <NativeMessage title={saveNotice} tone="success" />
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
