interface AuthStatusMessageProps {
  message: string;
  isError: boolean;
}

export function AuthStatusMessage({
  message,
  isError,
}: AuthStatusMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      className={`border-l-2 px-4 py-3 font-mono text-xs ${
        isError
          ? 'border-red-500 bg-red-950/40 text-red-300'
          : 'border-zinc-500 bg-zinc-900 text-zinc-300'
      }`}
    >
      <span className="mr-2 text-red-500">&gt;</span>
      {message}
    </div>
  );
}