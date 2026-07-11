import React, { useEffect, useMemo, useState } from "react";
import {
  Bug,
  CheckCircle2,
  Circle,
  Play,
  RefreshCw,
  Search,
  Square,
  XCircle,
} from "lucide-react";
import QualityPanel from "./QualityPanel";
import PerformancePanel from "./PerformancePanel";

interface TestItem {
  id: string;
  kind: "node" | "ctest";
  name: string;
  suite?: string;
  filePath?: string;
  line?: number;
  skipped?: boolean;
}
interface Result {
  testId: string;
  state: "passed" | "failed" | "skipped";
  durationMs: number;
  stdout: string;
  stderr: string;
}

export default function TestExplorer({ isDarkMode }: { isDarkMode: boolean }) {
  const [tests, setTests] = useState<TestItem[]>([]);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [filter, setFilter] = useState("");
  const [kind, setKind] = useState<"all" | "node" | "ctest">("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string>();
  const [debugState, setDebugState] = useState("");
  const request = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    const body = await response.json();
    if (!response.ok || body.ok === false)
      throw new Error(body.error || "测试请求失败。");
    return body;
  };
  const discover = async () => {
    setBusy(true);
    setError("");
    try {
      const body = await request("/api/tests/discover");
      setTests(body.tests);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void discover();
  }, []);
  const visible = useMemo(
    () =>
      tests.filter(
        (test) =>
          (kind === "all" || test.kind === kind) &&
          `${test.suite || ""} ${test.name} ${test.filePath || ""}`
            .toLowerCase()
            .includes(filter.trim().toLowerCase()),
      ),
    [tests, filter, kind],
  );
  const run = async (test: TestItem) => {
    setBusy(true);
    setError("");
    setSelected(test.id);
    try {
      const body = await request("/api/tests/run", {
        method: "POST",
        body: JSON.stringify({ testId: test.id }),
      });
      setResults((current) => ({ ...current, [test.id]: body.result }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  const runVisible = async () => {
    for (const test of visible) await run(test);
  };
  const debug = async (test: TestItem) => {
    setBusy(true);
    setError("");
    try {
      const body = await request("/api/tests/debug", {
        method: "POST",
        body: JSON.stringify({ testId: test.id }),
      });
      setDebugState(
        body.adapter === "node-inspector"
          ? "Node 测试已在入口暂停。"
          : "C++ 测试已交给 LLDB 并在入口暂停。",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  const selectedResult = selected ? results[selected] : undefined;
  const surface = isDarkMode
    ? "border-slate-800 bg-[#18181d]"
    : "border-slate-200 bg-slate-50";
  return (
    <div
      className={`grid h-full min-h-0 grid-cols-[minmax(320px,45%)_1fr] text-[11px] ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}
      aria-label="测试资源管理器"
    >
      <section className={`min-h-0 overflow-auto border-r ${surface}`}>
        <div className="sticky top-0 z-10 border-b border-inherit p-2">
          <div className="mb-2 flex gap-1">
            <button title="刷新测试" onClick={() => void discover()}>
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            </button>
            <button
              title="运行筛选后的测试"
              disabled={busy || !visible.length}
              onClick={() => void runVisible()}
            >
              <Play className="h-4 w-4 text-emerald-500" />
            </button>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as any)}
              className={`rounded border px-1 ${isDarkMode ? "border-slate-700 bg-black/20" : "border-slate-300 bg-white"}`}
            >
              <option value="all">全部</option>
              <option value="node">Node</option>
              <option value="ctest">C++ / CTest</option>
            </select>
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-1 top-1 h-3 w-3 opacity-60" />
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="筛选测试"
                className={`w-full rounded border py-0.5 pl-5 pr-1 ${isDarkMode ? "border-slate-700 bg-black/20" : "border-slate-300 bg-white"}`}
              />
            </div>
          </div>
          {error && (
            <div role="alert" className="text-rose-500">
              {error}
            </div>
          )}
          {debugState && (
            <div
              role="status"
              className="flex items-center gap-2 text-amber-500"
            >
              {debugState}
              <button
                onClick={() =>
                  void request("/api/tests/debug/node/continue", {
                    method: "POST",
                  })
                    .then(() => setDebugState("Node 测试正在调试运行。"))
                    .catch((reason) => setError(String(reason)))
                }
              >
                继续
              </button>
              <button
                onClick={() =>
                  void request("/api/tests/debug/stop", {
                    method: "POST",
                  }).then(() => setDebugState(""))
                }
              >
                <Square className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        {visible.length === 0 && !busy && (
          <div className="p-6 text-center opacity-60">
            没有发现匹配的测试。Node 文件使用 *.test.ts/js；C++ 工程需生成
            CTestTestfile.cmake。
          </div>
        )}
        {visible.map((test) => {
          const result = results[test.id];
          return (
            <div
              key={test.id}
              className={`flex items-start gap-2 border-b border-inherit px-2 py-1.5 ${selected === test.id ? "bg-blue-500/10" : ""}`}
            >
              <button onClick={() => setSelected(test.id)} className="mt-0.5">
                {result?.state === "passed" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : result?.state === "failed" ? (
                  <XCircle className="h-3.5 w-3.5 text-rose-500" />
                ) : (
                  <Circle className="h-3.5 w-3.5 opacity-40" />
                )}
              </button>
              <button
                onClick={() => setSelected(test.id)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate">{test.name}</div>
                <div className="truncate opacity-50">
                  {test.kind === "node" ? "Node" : "C++"} ·{" "}
                  {test.filePath || test.suite}
                  {test.line ? `:${test.line}` : ""}
                </div>
              </button>
              <button
                title="运行测试"
                disabled={busy}
                onClick={() => void run(test)}
              >
                <Play className="h-3.5 w-3.5 text-emerald-500" />
              </button>
              <button
                title="调试测试"
                disabled={busy || test.skipped}
                onClick={() => void debug(test)}
              >
                <Bug className="h-3.5 w-3.5 text-amber-500" />
              </button>
            </div>
          );
        })}
      </section>
      <section className="min-h-0 overflow-auto p-3">
        <h3 className="mb-2 font-semibold">测试结果</h3>
        {selectedResult ? (
          <>
            <div
              className={
                selectedResult.state === "passed"
                  ? "text-emerald-500"
                  : selectedResult.state === "failed"
                    ? "text-rose-500"
                    : "text-amber-500"
              }
            >
              {selectedResult.state === "passed"
                ? "通过"
                : selectedResult.state === "failed"
                  ? "失败"
                  : "跳过"}{" "}
              · {selectedResult.durationMs} ms
            </div>
            <pre className="mt-2 whitespace-pre-wrap rounded bg-black/10 p-2 font-mono">
              {selectedResult.stdout}
              {selectedResult.stderr && `\n${selectedResult.stderr}`}
            </pre>
          </>
        ) : (
          <div className="opacity-60">选择并运行一个测试后显示输出。</div>
        )}
        <QualityPanel isDarkMode={isDarkMode} />
        <PerformancePanel />
      </section>
    </div>
  );
}
