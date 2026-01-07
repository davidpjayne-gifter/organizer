import { NativeMessage } from "./NativeMessage";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return <NativeMessage title={title} body={body} actions={action} />;
}
