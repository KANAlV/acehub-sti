interface ImportResultsPanelProps {
  logs: string[];
  ariaLabel?: string;
}

export default function ImportResultsPanel({
  logs,
  ariaLabel = "Import summary and results",
}: ImportResultsPanelProps) {
  if (logs.length === 0) return null;

  const completionLog = [...logs]
    .reverse()
    .find((log) => log.startsWith("Import Completed:"));
  const completionMatch = completionLog?.match(
    /Import Completed:\s*(\d+) successful,\s*(\d+) failed(?:,\s*(\d+) skipped)?/i,
  );
  const readyLog = [...logs]
    .reverse()
    .find((log) => /\d+ row\(s\) ready to import\./i.test(log));
  const readyMatch = readyLog?.match(/(\d+) row\(s\) ready to import\./i);
  const resultLogs = logs.filter(
    (log) =>
      !log.startsWith("Reading Excel workbook") &&
      !log.startsWith("Headers verified") &&
      !log.startsWith("Import Completed:") &&
      !/\d+ row\(s\) ready to import\./i.test(log),
  );
  const visibleLogs = resultLogs.length > 0 ? resultLogs : logs.slice(-1);

  return (
    <section
      aria-label={ariaLabel}
      aria-live="polite"
      className="space-y-3 rounded-xl border border-slate-600 bg-slate-900 p-3"
    >
      {completionMatch && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-3">
            <p className="text-xs text-emerald-300">Successful</p>
            <p className="text-xl font-bold text-emerald-200">
              {completionMatch[1]}
            </p>
          </div>
          <div className="rounded-lg border border-red-900 bg-red-950/40 p-3">
            <p className="text-xs text-red-300">Failed</p>
            <p className="text-xl font-bold text-red-200">
              {completionMatch[2]}
            </p>
          </div>
        </div>
      )}

      {readyMatch && (
        <p role="status" className="text-xs text-slate-300">
          {readyMatch[1]} row(s) ready to import.
        </p>
      )}

      <div className="max-h-64 space-y-2 overflow-y-auto pr-1 text-xs">
        {visibleLogs.map((log, index) => {
          const isSuccess =
            /Imported successfully|Created successfully|Updated existing program/i.test(
              log,
            );
          const isSkipped = /\bSkipped\b/i.test(log);
          const colorClass = isSuccess
            ? "text-emerald-200"
            : isSkipped
              ? "text-amber-200"
              : /\b(Failed|Error|Blocked)\b/i.test(log) ||
                  /^(Row|Workbook)\b/i.test(log)
                ? "text-red-300"
                : "text-slate-300";

          return (
            <p key={`${index}-${log}`} className={`break-words ${colorClass}`}>
              {log}
            </p>
          );
        })}
      </div>
    </section>
  );
}
