"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createInvite } from "./actions";
import { NativeMessage } from "@/components/ui/NativeMessage";

const initialState = { error: "", inviteLink: "", email: "" };

function ReinviteSubmit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-sm" type="submit" disabled={pending}>
      {pending ? "Re-inviting…" : "Re-invite"}
    </button>
  );
}

export function ReinviteButton({ email, role }: { email: string; role: string }) {
  const [state, formAction] = useFormState(createInvite, initialState);

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="role" value={role} />
        <ReinviteSubmit />
      </form>
      {state.inviteLink ? (
        <NativeMessage
          title="New invite link"
          body={state.inviteLink}
          tone="success"
          actions={
            <button
              className="btn btn-sm"
              type="button"
              onClick={() => navigator.clipboard.writeText(state.inviteLink ?? "")}
            >
              Copy link
            </button>
          }
        />
      ) : null}
      {state.error ? <NativeMessage title={state.error} tone="danger" /> : null}
    </div>
  );
}
