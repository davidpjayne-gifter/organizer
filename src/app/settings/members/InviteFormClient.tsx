"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createInvite } from "./actions";
import { NativeMessage } from "@/components/ui/NativeMessage";

const initialState = { error: "", inviteLink: "", email: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary w-full sm:w-auto" type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create invite"}
    </button>
  );
}

export function InviteFormClient() {
  const [state, formAction] = useFormState(createInvite, initialState);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!state.inviteLink) return;
    await navigator.clipboard.writeText(state.inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide opacity-70">Email</label>
            <input
              name="email"
              className="w-full rounded-xl border px-3 py-2"
              type="email"
              placeholder="name@company.com"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide opacity-70">Role</label>
            <select name="role" className="w-full rounded-xl border px-3 py-2">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <SubmitButton />
      </form>

      {state.error ? <NativeMessage title={state.error} tone="danger" /> : null}
      {state.inviteLink ? (
        <NativeMessage
          title="Invite link ready"
          body={state.inviteLink}
          tone="success"
          actions={
            <button className="btn btn-sm" type="button" onClick={copyLink}>
              {copied ? "Copied" : "Copy link"}
            </button>
          }
        />
      ) : null}
    </div>
  );
}
