"use client";

import { useFormState, useFormStatus } from "react-dom";
import { acceptInvite } from "./actions";
import { NativeMessage } from "@/components/ui/NativeMessage";

const initialState = { error: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary w-full" type="submit" disabled={pending}>
      {pending ? "Accepting…" : "Accept Invite"}
    </button>
  );
}

export function AcceptInviteClient({ token }: { token: string }) {
  const [state, formAction] = useFormState(acceptInvite, initialState);

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="token" value={token} />
        <SubmitButton />
      </form>
      {state.error ? <NativeMessage title={state.error} tone="warning" /> : null}
    </div>
  );
}
