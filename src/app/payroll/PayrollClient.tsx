"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Employee,
  getEmployees,
  getPayrollProfile,
  PayrollProfile,
  updatePayrollProfile,
} from "@/lib/payroll/store";

interface PayrollFormState {
  payType: "Hourly" | "Salary";
  hourlyRate: string;
  salaryAmount: string;
  ptoAccrualRate: string;
  stipend: string;
  notes: string;
  effectiveDate: string;
}

const profileToForm = (profile: PayrollProfile): PayrollFormState => ({
  payType: profile.payType,
  hourlyRate: profile.hourlyRate.toString(),
  salaryAmount: profile.salaryAmount.toString(),
  ptoAccrualRate: profile.ptoAccrualRate.toString(),
  stipend: profile.stipend.toString(),
  notes: profile.notes,
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
    effectiveDate: form.effectiveDate,
  };
};

interface PayrollClientProps {
  orgId: string;
  orgName: string;
  actorName: string;
}

export default function PayrollClient({ orgId, orgName, actorName }: PayrollClientProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<PayrollFormState | null>(null);

  useEffect(() => {
    const loadedEmployees = getEmployees(orgId);
    const initialEmployeeId = loadedEmployees[0]?.id ?? "";
    if (initialEmployeeId) {
      const profile = getPayrollProfile(orgId, initialEmployeeId);
      setForm(profileToForm(profile));
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
    if (!selectedEmployee) return;
    const profile = getPayrollProfile(orgId, selectedEmployee.id);
    setForm(profileToForm(profile));
  }, [orgId, selectedEmployee]);

  if (!form) {
    return <div className="p-6">Loading…</div>;
  }

  function handleSelectEmployee(employeeId: string) {
    setSelectedEmployeeId(employeeId);
  }

  function handleCancel() {
    if (!selectedEmployee) return;
    const profile = getPayrollProfile(orgId, selectedEmployee.id);
    setForm(profileToForm(profile));
  }

  function handleSave() {
    if (!selectedEmployee) return;
    const prevProfile = getPayrollProfile(orgId, selectedEmployee.id);
    const nextProfile = formToProfile(form);

    updatePayrollProfile(orgId, selectedEmployee, prevProfile, nextProfile, actorName);
    const refreshed = getPayrollProfile(orgId, selectedEmployee.id);
    setForm(profileToForm(refreshed));
  }

  return (
    <main className="min-h-screen p-6">
      <div className="mb-6 text-center">
        <div className="text-2xl font-semibold">Payroll</div>
        <div className="text-sm opacity-70">Org: {orgName}</div>
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
          <div className="max-h-[420px] overflow-y-auto rounded-2xl border divide-y">
            {filteredEmployees.length === 0 ? (
              <div className="p-6 text-sm opacity-70 text-center">No employees found.</div>
            ) : (
              filteredEmployees.map((employee) => {
                const isActive = employee.id === selectedEmployeeId;
                return (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => handleSelectEmployee(employee.id)}
                    className={`w-full text-left p-4 transition ${
                      isActive ? "bg-black/10" : "hover:bg-black/5"
                    }`}
                  >
                    <div className="font-semibold">{employee.name}</div>
                    <div className="text-xs opacity-70">
                      {employee.role} · {employee.department}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="lg:flex-1 rounded-2xl border p-6 space-y-4">
          <div>
            <div className="text-lg font-semibold">Payroll Details</div>
            {selectedEmployee ? (
              <div className="text-sm opacity-80 mt-1">
                {selectedEmployee.name} · {selectedEmployee.role}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="w-full rounded-xl border px-4 py-2 font-medium hover:bg-black/5"
              type="button"
              onClick={handleSave}
              disabled={!selectedEmployee}
            >
              Save changes
            </button>
            <button
              className="w-full rounded-xl border px-4 py-2 text-sm opacity-80 hover:opacity-100"
              type="button"
              onClick={handleCancel}
              disabled={!selectedEmployee}
            >
              Cancel
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
