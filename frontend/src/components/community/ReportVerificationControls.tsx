import { useState, useMemo } from "react";
import { Check, X, Loader2, ShieldCheck, ShieldAlert, Users } from "lucide-react";
import { Button } from "../ui/Button";
import type { CommunityReport, VerificationType } from "../../types/community";
import { useCommunityStore } from "../../store/communityStore";
import { getUserVerificationType, CURRENT_USER_ID } from "../../api/community";

function getVisualState(report: CommunityReport): { label: string; tone: "corroborated" | "conflicting" | "unverified" | "disputed" } {
  const c = report.confirmations;
  const d = report.disputes;
  if (c > 0 && d > 0) return { label: "Conflicting observations", tone: "conflicting" };
  if (c >= 3 && d === 0) return { label: "Corroborated", tone: "corroborated" };
  if (c >= 2 && d === 0) return { label: "Corroborated", tone: "corroborated" };
  if (d >= 2 && c === 0) return { label: "Disputed", tone: "disputed" };
  if (c > 0 || d > 0) return { label: "Unverified — limited evidence", tone: "unverified" };
  return { label: "Unverified — awaiting verification", tone: "unverified" };
}

interface Props {
  report: CommunityReport;
  compact?: boolean;
}

export function ReportVerificationControls({ report, compact = false }: Props) {
  const verifyReport = useCommunityStore((s) => s.verifyReport);
  const [loading, setLoading] = useState<VerificationType | null>(null);
  const [feedback, setFeedback] = useState<{ type: VerificationType; ok: boolean; msg: string } | null>(null);

  const userType = useMemo(() => getUserVerificationType(report.id, CURRENT_USER_ID), [report.id]);
  const alreadyVoted = userType !== null;
  const isOwnReport = report.reporter.id === CURRENT_USER_ID;

  const visual = getVisualState(report);

  const handleVerify = async (type: VerificationType) => {
    if (alreadyVoted || isOwnReport || loading) return;
    setLoading(type);
    setFeedback(null);
    const res = await verifyReport(report.id, type);
    setLoading(null);
    if (!res.ok) {
      setFeedback({ type, ok: false, msg: res.error });
      return;
    }
    setFeedback({
      type,
      ok: true,
      msg: type === "corroborate" ? "Ground corroboration recorded — community evidence updated." : "Disagreement recorded — marked for review.",
    });
  };

  const corroboratedTone =
    visual.tone === "corroborated"
      ? "bg-[var(--success-weak)] text-[var(--success-text)] border-[var(--success-border)]"
      : visual.tone === "conflicting"
        ? "bg-[var(--high-weak)] text-[var(--high-text)] border-[var(--high-border)]"
        : visual.tone === "disputed"
          ? "bg-[var(--medium-weak)] text-[var(--medium-text)] border-[var(--medium-border)]"
          : "bg-[var(--surface-subtle)] text-[var(--text-muted)] border-[var(--border)]";

  return (
    <div className={`rounded-[4px] border border-[var(--border)] bg-white ${compact ? "p-2.5" : "p-3"} space-y-2.5`}>
      {/* Counts — operational metrics, not voting */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[11px] tabular-nums">
          <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0f5e59]" aria-hidden="true" /> <span className="font-medium text-[var(--text-primary)]">{report.confirmations}</span> <span className="text-[var(--text-muted)]">corroborate</span>
          </span>
          <span className="h-3 w-px bg-[var(--border)]" aria-hidden="true" />
          <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#92400e]" aria-hidden="true" /> <span className="font-medium text-[var(--text-primary)]">{report.disputes}</span> <span className="text-[var(--text-muted)]">dispute</span>
          </span>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-[4px] border bg-white px-1.5 py-0.5 text-[10px] font-medium ${corroboratedTone}`}>
          {visual.tone === "corroborated" ? <ShieldCheck className="h-3 w-3" /> : visual.tone === "conflicting" ? <ShieldAlert className="h-3 w-3" /> : <Users className="h-3 w-3" />}
          {visual.label}
        </span>
      </div>

      {/* Actions — ground verification, not social voting */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleVerify("corroborate")}
          disabled={alreadyVoted || isOwnReport || !!loading}
          className={`transition-colors duration-150 ${alreadyVoted && userType === "corroborate" ? "border-[#0f5e59] bg-[#f0fdfa] text-[#0f5e59]" : "border-[var(--border)] hover:bg-[var(--surface-subtle)] hover:border-[var(--border-strong)]"}`}
          aria-label="I observed this — corroborate ground observation"
          title={isOwnReport ? "Cannot verify own observation" : alreadyVoted ? `Already ${userType}` : "Corroborate — I observed this"}
        >
          {loading === "corroborate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          I observed this
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleVerify("dispute")}
          disabled={alreadyVoted || isOwnReport || !!loading}
          className={`transition-colors duration-150 ${alreadyVoted && userType === "dispute" ? "border-[var(--border-strong)] bg-[var(--surface-subtle)] text-[var(--text-primary)]" : "border-[var(--border)] hover:bg-[var(--surface-subtle)]"}`}
          aria-label="I disagree — did not observe this"
          title={isOwnReport ? "Cannot verify own observation" : alreadyVoted ? `Already ${userType}` : "Dispute — did not observe"}
        >
          {loading === "dispute" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          I disagree
        </Button>
      </div>
      <p className="text-[11px] leading-relaxed text-[var(--text-faint)]">
        Ground verification — not a vote on truth. One verification per observer per report. Maps to <span className="font-mono text-[10px]">POST /reports/{report.id}/verify</span> when backend is ready.
      </p>

      {/* Feedback */}
      {feedback && (
        <div
          className={`rounded-[4px] border px-2.5 py-2 text-[11px] leading-relaxed ${feedback.ok ? "border-[var(--success-border)] bg-[var(--success-weak)] text-[var(--success-text)]" : "border-[var(--critical-border)] bg-[var(--critical-weak)] text-[var(--critical-text)]"}`}
          role="status"
          aria-live="polite"
        >
          {feedback.msg}
        </div>
      )}
      {alreadyVoted && !feedback && (
        <div className="rounded-[4px] border border-[var(--informational-border)] bg-[var(--informational-weak)] px-2.5 py-2 text-[11px] text-[var(--informational-text)]">
          You have already submitted ground verification as <span className="font-medium">{userType === "corroborate" ? "“I observed this”" : "“I disagree”"}</span>. Evidence state updated to <span className="font-medium">{visual.label}</span>.
        </div>
      )}
      {isOwnReport && !alreadyVoted && (
        <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-2 text-[11px] text-[var(--text-muted)]">
          This is your observation — verification by the reporter is not counted to preserve independent evidence.
        </div>
      )}
      <p className="text-[10px] leading-relaxed text-[var(--text-faint)]">
        Community corroboration alone does not constitute scientific confirmation. Use with satellite &amp; AI evidence.
      </p>
    </div>
  );
}
