"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { transferOwnership } from "./actions";
import { NativeMessage } from "@/components/ui/NativeMessage";

const initialState = { error: "", success: "" };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-danger w-full sm:w-auto" type="submit" disabled={pending || disabled}>
      {pending ? "Transferring…" : "Transfer Ownership"}
    </button>
  );
}

export function TransferOwnershipClient({
  members,
}: {
  members: Array<{ user_id: string; role: string }>;
}) {
  const [state, formAction] = useFormState(transferOwnership, initialState);
  const [confirmText, setConfirmText] = useState("");
  const eligible = members.filter((member) => member.role !== "owner");
  const disabled = confirmText.trim() !== "TRANSFER" || eligible.length === 0;

  return (
    <div className="space-y-3">
      {eligible.length === 0 ? (
        <NativeMessage
          title="Add another member before transferring ownership."
          tone="warning"
        />
      ) : (
        <form action={formAction} className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide opacity-70">New owner</label>
            <select
              name="new_owner_user_id"
              className="w-full rounded-xl border px-3 py-2"
              required
            >
              <option value="">Select a member</option>
              {eligible.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.user_id} ({member.role})
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm opacity-80">
            This will make the selected user the owner. You will become an admin.
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide opacity-70">
              Type TRANSFER to confirm
            </label>
            <input
              className="w-full rounded-xl border px-3 py-2"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="TRANSFER"
            />
          </div>
          <SubmitButton disabled={disabled} />
        </form>
      )}

      {state.error ? <NativeMessage title={state.error} tone="danger" /> : null}
      {state.success ? <NativeMessage title={state.success} tone="success" /> : null}
    </div>
  );
}
