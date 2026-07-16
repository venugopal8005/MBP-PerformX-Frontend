import { FileWarning } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { getReportArtifact, historyErrorMessage } from "../../api/history";
import { artifactRequestKey, shouldApplyArtifactResponse } from "../../utils/history";
import { Skeleton } from "../ui/Skeleton";

export default function ArtifactPreviewPanel({
  reportRunId,
  audience,
  available = true,
  enabled = true,
}) {
  const [artifact, setArtifact] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const currentRequestKeyRef = useRef("");

  useEffect(() => {
    const requestKey = artifactRequestKey(reportRunId, audience);
    currentRequestKeyRef.current = requestKey;
    const controller = new AbortController();

    queueMicrotask(() => {
      if (!shouldApplyArtifactResponse(requestKey, currentRequestKeyRef.current)) return;
      setArtifact(null);
      setError("");

      if (!enabled || !reportRunId || !audience || available === false) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      getReportArtifact(reportRunId, audience, { signal: controller.signal })
        .then((data) => {
          if (
            controller.signal.aborted ||
            !shouldApplyArtifactResponse(requestKey, currentRequestKeyRef.current)
          ) {
            return;
          }
          setArtifact(data.artifact || null);
        })
        .catch((requestError) => {
          if (
            controller.signal.aborted ||
            !shouldApplyArtifactResponse(requestKey, currentRequestKeyRef.current)
          ) {
            return;
          }
          setError(historyErrorMessage(requestError, "Could not load this report artifact."));
        })
        .finally(() => {
          if (
            !controller.signal.aborted &&
            shouldApplyArtifactResponse(requestKey, currentRequestKeyRef.current)
          ) {
            setIsLoading(false);
          }
        });
    });

    return () => {
      controller.abort();
      if (currentRequestKeyRef.current === requestKey) currentRequestKeyRef.current = "";
    };
  }, [audience, available, enabled, reportRunId]);

  if (!enabled) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Select an audience to load its stored report preview.
      </div>
    );
  }

  if (available === false) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-5 py-10 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <FileWarning size={17} />
        No {audience} report artifact is available for this run.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-[520px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
        {error}
      </div>
    );
  }

  if (!artifact?.html && !artifact?.text) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        This artifact contains no previewable HTML or text.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {artifact.subject && (
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {artifact.subject}
        </div>
      )}
      {artifact.html ? (
        <iframe
          title={`${audience} report artifact`}
          srcDoc={artifact.html}
          sandbox=""
          referrerPolicy="no-referrer"
          className="h-[680px] w-full rounded-lg border border-slate-200 bg-white dark:border-slate-800"
        />
      ) : (
        <pre className="max-h-[680px] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          {artifact.text}
        </pre>
      )}
    </div>
  );
}
