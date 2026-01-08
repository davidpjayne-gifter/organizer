"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Employee,
  createEmployeeProfile,
  deleteEmployeeProfile,
  getEmployees,
  getPayrollProfile,
  PayrollProfile,
  updatePayrollProfile,
} from "@/lib/payroll/store";
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
  effectiveDate: profile.effectiveDate,
});

const formToProfile = (form: PayrollFormState): PayrollProfile => {
  const toNumber = (value: string) => (value.trim() === "" ? 0 : Number(value));
  return {
    payType: form.payType,
    hourlyRate: toNumber(form.hourlyRate),
    salaryAmount: toNumber(form.salaryAmount),
    ptoAccrualRate: toNumber(form.ptoAccrualRate),
    stipend: toNumber(form.stipend),
    notes: form.notes.trim(),
    payPeriodsPerYear: toNumber(form.payPeriodsPerYear),
    isActive: form.isActive,
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
  const [deleteCandidate, setDeleteCandidate] = useState<Employee | null>(null);

  useEffect(() => {
    const loadedEmployees = getEmployees(orgId);
    const initialEmployeeId = loadedEmployees[0]?.id ?? "";
    if (initialEmployeeId) {
      const profile = getPayrollProfile(orgId, initialEmployeeId);
      setForm(profileToForm(profile));
      setIsCreatingNew(false);
    } else {
      setIsCreatingNew(true);
      setNewEmployee({ name: "", role: "", department: "" });
      const blankProfile = getPayrollProfile(orgId, "__new__");
      setForm(profileToForm(blankProfile));
    }

    setEmployees(loadedEmployees);
    setSelectedEmployeeId(initialEmployeeId);
  }, [orgId]);

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
    const profile = getPayrollProfile(orgId, selectedEmployee.id);
    setForm(profileToForm(profile));
  }, [orgId, selectedEmployee]);

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
        const profile = getPayrollProfile(orgId, fallbackId);
        setForm(profileToForm(profile));
      }
      return;
    }
    if (!selectedEmployee) return;
    const profile = getPayrollProfile(orgId, selectedEmployee.id);
    setForm(profileToForm(profile));
  }

  function handleSave() {
    if (!form) return;
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
      const created = createEmployeeProfile(orgId, trimmed, nextProfile, actorName);
      const refreshedEmployees = getEmployees(orgId);
      setEmployees(refreshedEmployees);
      setSelectedEmployeeId(created.id);
      setIsCreatingNew(false);
      setNewEmployee({ name: "", role: "", department: "" });
      const refreshed = getPayrollProfile(orgId, created.id);
      setForm(profileToForm(refreshed));
      setSaveNotice("Profile created and saved.");
      return;
    }
    if (!selectedEmployee) return;
    const prevProfile = getPayrollProfile(orgId, selectedEmployee.id);
    const nextProfile = formToProfile(form);

    updatePayrollProfile(orgId, selectedEmployee, prevProfile, nextProfile, actorName);
    const refreshed = getPayrollProfile(orgId, selectedEmployee.id);
    setForm(profileToForm(refreshed));
    setSaveNotice("Changes saved.");
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
    const blankProfile = getPayrollProfile(orgId, "__new__");
    setForm(profileToForm(blankProfile));
  }

  function handleConfirmDelete() {
    if (!deleteCandidate) return;
    deleteEmployeeProfile(orgId, deleteCandidate.id);
    const refreshedEmployees = getEmployees(orgId);
    setEmployees(refreshedEmployees);
    setDeleteCandidate(null);
    const fallbackId = refreshedEmployees[0]?.id ?? "";
    if (fallbackId) {
      setSelectedEmployeeId(fallbackId);
      const profile = getPayrollProfile(orgId, fallbackId);
      setForm(profileToForm(profile));
    } else {
      setSelectedEmployeeId("");
      setForm(null);
    }
  }

  return (
    <main className="min-h-screen p-6">
      <div className="mb-6 text-center">
        <div className="text-2xl font-semibold">Payroll</div>
        <div className="text-sm opacity-70">Org: {orgName}</div>
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
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide opacity-70">Hourly rate</label>
              <input
                className="w-full rounded-xl border px-3 py-2"
                type="number"
                step="0.01"
                value={form.hourlyRate}
                onChange={(event) =>
                  setForm((prev) => (prev ? { ...prev, hourlyRate: event.target.value } : prev))
                }
              />
            </div>
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
