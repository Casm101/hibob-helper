import { useEffect, useMemo, useRef, useState } from "react";
import { TimeField } from "./components/TimeField";
import { TARGET_URL_HINT, isSupportedUrl } from "../shared/config";
import type {
    AutomationProgressMessage,
    AutomationResultMessage,
    RunAutomationMessage,
} from "../shared/messaging";
import { isValidTime } from "../shared/validation";

const statusStyles: Record<string, string> = {
    idle: "bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-200",
    running:
        "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
    success:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
    error: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
};

type StatusState = {
    state: "idle" | "running" | "success" | "error";
    message: string;
};

const initialStatus: StatusState = {
    state: "idle",
    message: "Ready to fill missing attendance rows.",
};

const sendMessage = (message: RunAutomationMessage) =>
    new Promise<AutomationResultMessage | undefined>((resolve) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                resolve({
                    type: "AUTOMATION_RESULT",
                    requestId: message.requestId,
                    success: false,
                    error: chrome.runtime.lastError.message,
                });
                return;
            }
            resolve(response);
        });
    });

export const App = () => {
    const [clockIn, setClockIn] = useState("09:00");
    const [clockOut, setClockOut] = useState("17:00");
    const [supported, setSupported] = useState(false);
    const [status, setStatus] = useState<StatusState>(initialStatus);
    const [progress, setProgress] = useState({ total: 0, completed: 0, saved: 0 });
    const activeRequestId = useRef<string | null>(null);

    useEffect(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const url = tabs[0]?.url ?? null;
            setSupported(isSupportedUrl(url));
        });
    }, []);

    useEffect(() => {
        const handler = (message: AutomationProgressMessage) => {
            if (!message || message.type !== "AUTOMATION_PROGRESS") return;
            if (
                !activeRequestId.current ||
                message.requestId !== activeRequestId.current
            )
                return;

            setProgress((previous) => ({
                total: message.total,
                completed: message.completed,
                saved: message.saved ?? previous.saved,
            }));
        };

        chrome.runtime.onMessage.addListener(handler);
        return () => chrome.runtime.onMessage.removeListener(handler);
    }, []);

    const timesValid = useMemo(() => {
        return isValidTime(clockIn) && isValidTime(clockOut);
    }, [clockIn, clockOut]);

    const canRun = supported && timesValid && status.state !== "running";

    const handleRun = async () => {
        if (!canRun) return;

        setStatus({ state: "running", message: "Running automation..." });
        const requestId = crypto.randomUUID();
        activeRequestId.current = requestId;
        setProgress({ total: 0, completed: 0, saved: 0 });
        const response = await sendMessage({
            type: "RUN_AUTOMATION",
            requestId,
            payload: { clockIn, clockOut },
        });

        if (!response || response.type !== "AUTOMATION_RESULT") {
            setStatus({
                state: "error",
                message: "No response from content script.",
            });
            activeRequestId.current = null;
            return;
        }

        if (!response.success) {
            setStatus({
                state: "error",
                message:
                    response.error ??
                    "Automation failed. Check the console for details.",
            });
            activeRequestId.current = null;
            return;
        }

        const processed = response.processed ?? 0;
        setStatus({
            state: "success",
            message: `Automation complete. Updated ${processed} row${processed === 1 ? "" : "s"}.`,
        });
        activeRequestId.current = null;
    };

    const progressPercent =
        progress.total > 0
            ? Math.min(
                  100,
                  Math.round((progress.completed / progress.total) * 100)
              )
            : 0;

    return (
        <div className="flex min-h-[360px] w-[360px] flex-col bg-gradient-to-br from-rose-50 via-slate-50 to-amber-50 p-4 text-slate-900 dark:from-[#0f0f12] dark:via-[#1a1a20] dark:to-[#24151c] dark:text-slate-100">
            <div className="flex-1 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel backdrop-blur dark:border-white/10 dark:bg-[#1a1a22]/80">
                <header className="flex items-start justify-between gap-3">
                    <div className="space-y-1 animate-fade-up">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-500">
                            HiBob Helper
                        </p>
                        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            Attendance Auto-Fill
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-300">
                            Apply your default time entry to flagged rows.
                        </p>
                    </div>
                    <div
                        className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                            supported
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200"
                        }`}
                    >
                        {supported ? "Supported" : "Unsupported"}
                    </div>
                </header>

                <div className="mt-4 space-y-3 animate-fade-in">
                    <TimeField
                        id="clock-in"
                        label="Clock In Time"
                        value={clockIn}
                        onChange={setClockIn}
                        hasError={!isValidTime(clockIn)}
                    />
                    <TimeField
                        id="clock-out"
                        label="Clock Out Time"
                        value={clockOut}
                        onChange={setClockOut}
                        hasError={!isValidTime(clockOut)}
                    />
                </div>

                {!supported ? (
                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200">
                        Site not supported. Open {TARGET_URL_HINT} and try
                        again.
                    </div>
                ) : null}

                {!timesValid ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
                        Enter valid 24-hour times (HH:MM).
                    </div>
                ) : null}

                <button
                    type="button"
                    onClick={handleRun}
                    disabled={!canRun}
                    className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-rose-500 dark:text-white dark:hover:bg-rose-400 dark:disabled:bg-slate-700"
                >
                    {status.state === "running"
                        ? "Running Automation…"
                        : "Run Automation"}
                </button>

                {status.state === "running" ? (
                    <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                            <span>Progress</span>
                            <span>
                                {progress.completed}/{progress.total || "—"}
                            </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-800/80">
                            <div
                                className="h-full rounded-full bg-rose-400 transition-all duration-300 dark:bg-rose-300"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-300">
                            Saved {progress.saved} of {progress.total || "0"} row
                            {progress.total === 1 ? "" : "s"}.
                        </p>
                    </div>
                ) : null}

                {supported ? (
                    <div
                        className={`mt-3 rounded-xl px-3 py-2 text-xs font-medium ${statusStyles[status.state]}`}
                    >
                        {status.message}
                    </div>
                ) : null}
            </div>

            <p className="mt-3 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                Target: {TARGET_URL_HINT}
            </p>
        </div>
    );
};
