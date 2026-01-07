import * as React from "react";

type Tone = "default" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<Tone, string> = {
  default: "bg-card text-card-foreground border-border",
  info: "bg-card text-card-foreground border-border",
  success: "bg-card text-card-foreground border-border",
  warning: "bg-card text-card-foreground border-border",
  danger: "bg-card text-card-foreground border-border",
};

export function NativeMessage({
  title,
  body,
  tone = "default",
  icon,
  actions,
}: {
  title: string;
  body?: string;
  tone?: Tone;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className={`w-full rounded-xl border p-4 ${toneClasses[tone]}`}>
      <div className="flex items-start gap-3">
        {icon ? <div className="mt-0.5">{icon}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-6">{title}</div>
          {body ? <div className="mt-1 text-sm text-muted-foreground">{body}</div> : null}
          {actions ? <div className="mt-3 flex gap-2">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
