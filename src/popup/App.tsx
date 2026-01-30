import { useEffect, useMemo, useRef, useState } from "react";
import { TimeField } from "./components/TimeField";
import { TARGET_URL_HINT, isSupportedUrl } from "../shared/config";
import type {
    AutomationProgressMessage,
    AutomationResultMessage,
    CancelAutomationMessage,
    RunAutomationMessage,
} from "../shared/messaging";
import { isValidTime } from "../shared/validation";
import {
    getStoredSettings,
    getStoredTimes,
    setStoredSettings,
    setStoredTimes,
} from "../shared/storage";

const statusStyles: Record<string, string> = {
    idle: "bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-200",
    running:
        "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
    success:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
    error: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
    cancelled:
        "bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200",
};

type StatusState = {
    state: "idle" | "running" | "success" | "error" | "cancelled";
    message: string;
};

type ViewState = "main" | "settings";

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

const sendCancelMessage = (message: CancelAutomationMessage) =>
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
    const [progress, setProgress] = useState({
        total: 0,
        completed: 0,
        saved: 0,
    });
    const activeRequestId = useRef<string | null>(null);
    const hasLoadedTimes = useRef(false);
    const hasLoadedSettings = useRef(false);
    const [view, setView] = useState<ViewState>("main");
    const [randomizeEnabled, setRandomizeEnabled] = useState(false);
    const [randomizeMinutes, setRandomizeMinutes] = useState(15);
    const [breakEnabled, setBreakEnabled] = useState(false);
    const [breakStart, setBreakStart] = useState("12:00");
    const [breakDuration, setBreakDuration] = useState(30);

    useEffect(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const url = tabs[0]?.url ?? null;
            setSupported(isSupportedUrl(url));
        });
    }, []);

    useEffect(() => {
        getStoredTimes().then((times) => {
            setClockIn(times.clockIn);
            setClockOut(times.clockOut);
            hasLoadedTimes.current = true;
        });
    }, []);

    useEffect(() => {
        getStoredSettings().then((settings) => {
            setRandomizeEnabled(settings.randomizeEnabled);
            setRandomizeMinutes(settings.randomizeMinutes);
            setBreakEnabled(settings.breakEnabled);
            setBreakStart(settings.breakStart);
            setBreakDuration(settings.breakDurationMinutes);
            hasLoadedSettings.current = true;
        });
    }, []);

    useEffect(() => {
        if (!hasLoadedTimes.current) return;
        setStoredTimes({ clockIn, clockOut });
    }, [clockIn, clockOut]);

    useEffect(() => {
        if (!hasLoadedSettings.current) return;
        setStoredSettings({
            randomizeEnabled,
            randomizeMinutes: Number.isFinite(randomizeMinutes)
                ? randomizeMinutes
                : 15,
            breakEnabled,
            breakStart,
            breakDurationMinutes: Number.isFinite(breakDuration)
                ? breakDuration
                : 30,
        });
    }, [
        randomizeEnabled,
        randomizeMinutes,
        breakEnabled,
        breakStart,
        breakDuration,
    ]);

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
            payload: {
                clockIn,
                clockOut,
                randomizeEnabled,
                randomizeMinutes,
                breakEnabled,
                breakStart,
                breakDurationMinutes: breakDuration,
            },
        });

        if (!response || response.type !== "AUTOMATION_RESULT") {
            setStatus({
                state: "error",
                message: "No response from content script.",
            });
            activeRequestId.current = null;
            return;
        }

        if (response.cancelled) {
            const processed = response.processed ?? progress.saved;
            setStatus({
                state: "cancelled",
                message: `Automation cancelled. Updated ${processed} row${
                    processed === 1 ? "" : "s"
                }.`,
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

    const handleCancel = async () => {
        if (!activeRequestId.current) return;
        setStatus({ state: "running", message: "Cancelling automation..." });
        await sendCancelMessage({
            type: "CANCEL_AUTOMATION",
            requestId: activeRequestId.current,
        });
    };

    const progressPercent =
        progress.total > 0
            ? Math.min(
                  100,
                  Math.round((progress.completed / progress.total) * 100),
              )
            : 0;

    return (
        <div className="flex min-h-[360px] w-[360px] flex-col bg-gradient-to-br from-rose-50 via-slate-50 to-amber-50 p-4 text-slate-900 dark:from-[#0f0f12] dark:via-[#1a1a20] dark:to-[#24151c] dark:text-slate-100">
            <div className="flex-1 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel backdrop-blur dark:border-white/10 dark:bg-[#1a1a22]/80">
                {view === "main" ? (
                    <header className="relative flex items-start gap-3">
                        <div className="space-y-1 animate-fade-up pr-10">
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
                        <button
                            type="button"
                            onClick={() => setView("settings")}
                            className="absolute right-0 top-0 rounded-full border border-slate-200 bg-white/70 p-2 text-slate-500 shadow-sm transition hover:text-slate-700 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-slate-100"
                            aria-label="Open settings"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M12 8.5a3.5 3.5 0 1 0 3.5 3.5A3.5 3.5 0 0 0 12 8.5Z" />
                                <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.05.05a2 2 0 1 1-2.83 2.83l-.05-.05a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.54V21a2 2 0 0 1-4 0v-.07a1.7 1.7 0 0 0-1-1.54 1.7 1.7 0 0 0-1.87.34l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.54-1H3a2 2 0 0 1 0-4h.06a1.7 1.7 0 0 0 1.54-1 1.7 1.7 0 0 0-.34-1.87l-.05-.05a2 2 0 1 1 2.83-2.83l.05.05A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.54V3a2 2 0 0 1 4 0v.06a1.7 1.7 0 0 0 1 1.54 1.7 1.7 0 0 0 1.87-.34l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.54 1H21a2 2 0 0 1 0 4h-.06a1.7 1.7 0 0 0-1.54 1Z" />
                            </svg>
                        </button>
                    </header>
                ) : (
                    <header className="relative flex items-start gap-3">
                        <div className="space-y-1 animate-fade-up pr-10">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-500">
                                HiBob Helper
                            </p>
                            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                Settings
                            </h1>
                            <p className="text-xs text-slate-500 dark:text-slate-300">
                                Configure your automation preferences.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setView("main")}
                            className="absolute right-0 top-0 rounded-full border border-slate-200 bg-white/70 p-2 text-slate-500 shadow-sm transition hover:text-slate-700 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-slate-100"
                            aria-label="Back to main"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M15 18l-6-6 6-6" />
                            </svg>
                        </button>
                    </header>
                )}

                {view === "main" ? (
                    <>
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
                                Site not supported. Open {TARGET_URL_HINT} and
                                try again.
                            </div>
                        ) : null}

                        {!timesValid ? (
                            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
                                Enter valid 24-hour times (HH:MM).
                            </div>
                        ) : null}

                        <div className="mt-4 flex w-full gap-2">
                            <button
                                type="button"
                                onClick={handleRun}
                                disabled={!canRun}
                                className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-rose-500 dark:text-white dark:hover:bg-rose-400 dark:disabled:bg-slate-700"
                            >
                                {status.state === "running"
                                    ? "Running…"
                                    : "Run Automation"}
                            </button>
                            {status.state === "running" ? (
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-700 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                            ) : null}
                        </div>

                        {status.state === "running" ? (
                            <div className="mt-3 space-y-2">
                                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                                    <span>Progress</span>
                                    <span>
                                        {progress.completed}/
                                        {progress.total || "—"}
                                    </span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-800/80">
                                    <div
                                        className="h-full rounded-full bg-rose-400 transition-all duration-300 dark:bg-rose-300"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-300">
                                    Saved {progress.saved} of{" "}
                                    {progress.total || "0"} row
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
                    </>
                ) : (
                    <div className="mt-6 space-y-4 animate-fade-in">
                        <div className="rounded-2xl border border-slate-200/70 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        Randomise clock in/out
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-300">
                                        Add a small offset to each time entry.
                                    </p>
                                </div>
                                <label className="relative inline-flex cursor-pointer items-center">
                                    <input
                                        type="checkbox"
                                        className="peer sr-only"
                                        checked={randomizeEnabled}
                                        onChange={(event) =>
                                            setRandomizeEnabled(
                                                event.target.checked,
                                            )
                                        }
                                    />
                                    <span className="h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-rose-500 dark:bg-slate-700 dark:peer-checked:bg-rose-400" />
                                    <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5 dark:bg-slate-100" />
                                </label>
                            </div>
                            <div className="mt-4">
                                <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                                    Randomization window (minutes)
                                </label>
                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={
                                            Number.isFinite(randomizeMinutes)
                                                ? randomizeMinutes
                                                : 0
                                        }
                                        onChange={(event) => {
                                            const parsed = Number.parseInt(
                                                event.target.value,
                                                10,
                                            );
                                            setRandomizeMinutes(
                                                Number.isFinite(parsed)
                                                    ? parsed
                                                    : 0,
                                            );
                                        }}
                                        disabled={!randomizeEnabled}
                                        className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:cursor-not-allowed disabled:border-slate-200/60 disabled:bg-slate-100/80 disabled:text-slate-400 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:border-rose-400/70 dark:focus:ring-rose-500/20 dark:disabled:border-white/5 dark:disabled:bg-slate-900/30 dark:disabled:text-slate-500"
                                    />
                                    <span className="text-xs text-slate-500 dark:text-slate-300">
                                        minutes
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200/70 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        Enable break time
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-300">
                                        Schedule a break within the shift.
                                    </p>
                                </div>
                                <label className="relative inline-flex cursor-pointer items-center">
                                    <input
                                        type="checkbox"
                                        className="peer sr-only"
                                        checked={breakEnabled}
                                        onChange={(event) =>
                                            setBreakEnabled(
                                                event.target.checked,
                                            )
                                        }
                                    />
                                    <span className="h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-rose-500 dark:bg-slate-700 dark:peer-checked:bg-rose-400" />
                                    <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5 dark:bg-slate-100" />
                                </label>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <TimeField
                                    id="break-start"
                                    label="Break start"
                                    value={breakStart}
                                    onChange={setBreakStart}
                                    hasError={
                                        breakEnabled && !isValidTime(breakStart)
                                    }
                                    disabled={!breakEnabled}
                                />
                                <label className="block space-y-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">
                                    <span>Break duration</span>
                                    <input
                                        type="number"
                                        min={1}
                                        step={1}
                                        value={
                                            Number.isFinite(breakDuration)
                                                ? breakDuration
                                                : 0
                                        }
                                        onChange={(event) => {
                                            const parsed = Number.parseInt(
                                                event.target.value,
                                                10,
                                            );
                                            setBreakDuration(
                                                Number.isFinite(parsed)
                                                    ? parsed
                                                    : 0,
                                            );
                                        }}
                                        disabled={!breakEnabled}
                                        className="w-full rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:cursor-not-allowed disabled:border-slate-200/60 disabled:bg-slate-100/80 disabled:text-slate-400 dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-rose-300 dark:focus:ring-rose-400/40 dark:disabled:border-slate-700/40 dark:disabled:bg-slate-900/40 dark:disabled:text-slate-500"
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <p className="mt-3 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                Target: {TARGET_URL_HINT}
            </p>
        </div>
    );
};
