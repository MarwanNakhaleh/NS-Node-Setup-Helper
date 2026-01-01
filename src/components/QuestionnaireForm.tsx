"use client";

import { useMemo, useState } from "react";
import type { Question } from "@/lib/questionnaire";

type Props = {
  questions: Question[];
};

type Answers = Record<string, string | number | null>;

function initAnswers(questions: Question[]): Answers {
  const a: Answers = {};
  for (const q of questions) {
    a[q.id] = q.type === "number" ? null : "";
  }
  return a;
}

export default function QuestionnaireForm({ questions }: Props) {
  const [answers, setAnswers] = useState<Answers>(() => initAnswers(questions));
  const [submitted, setSubmitted] = useState<Answers | null>(null);

  const requiredIds = useMemo(
    () => new Set(questions.filter(q => q.required).map(q => q.id)),
    [questions]
  );

  function setValue(id: string, value: string | number | null) {
    setAnswers(prev => ({ ...prev, [id]: value }));
  }

  function isMissingRequired(): string[] {
    const missing: string[] = [];
    for (const id of requiredIds) {
      const v = answers[id];
      if (v === null) missing.push(id);
      if (typeof v === "string" && v.trim().length === 0) missing.push(id);
    }
    return Array.from(new Set(missing));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing = isMissingRequired();
    if (missing.length > 0) {
      alert(`Please fill required fields: ${missing.join(", ")}`);
      return;
    }
    setSubmitted(answers);

    // Later: send to an API route / server action
    // fetch("/api/intake", { method: "POST", body: JSON.stringify(answers) })
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold">Project Criteria</h1>
      <p className="text-sm text-gray-600 mt-1">
        Provide details below. We'll use this later to estimate costs and steps.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        {questions.map((q) => (
          <div key={q.id} className="space-y-1">
            <label className="block text-sm font-medium" htmlFor={q.id}>
              {q.label} {q.required ? <span className="text-red-500">*</span> : null}
            </label>

            {q.helpText ? (
              <p className="text-xs text-gray-600">{q.helpText}</p>
            ) : null}

            {q.type === "select" ? (
              <select
                id={q.id}
                className="w-full rounded-md border px-3 py-2"
                value={(answers[q.id] as string) ?? ""}
                onChange={(e) => setValue(q.id, e.target.value)}
              >
                <option value="">Select…</option>
                {(q.options ?? []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : q.type === "textarea" ? (
              <textarea
                id={q.id}
                className="w-full rounded-md border px-3 py-2 min-h-28"
                placeholder={q.placeholder ?? ""}
                value={(answers[q.id] as string) ?? ""}
                onChange={(e) => setValue(q.id, e.target.value)}
              />
            ) : (
              <input
                id={q.id}
                className="w-full rounded-md border px-3 py-2"
                type={q.type}
                placeholder={q.placeholder ?? ""}
                min={q.type === "number" ? q.min : undefined}
                max={q.type === "number" ? q.max : undefined}
                value={
                  q.type === "number"
                    ? (answers[q.id] ?? "")?.toString()
                    : ((answers[q.id] as string) ?? "")
                }
                onChange={(e) => {
                  if (q.type === "number") {
                    const raw = e.target.value;
                    setValue(q.id, raw === "" ? null : Number(raw));
                  } else {
                    setValue(q.id, e.target.value);
                  }
                }}
              />
            )}
          </div>
        ))}

        <button
          type="submit"
          className="rounded-md bg-black text-white px-4 py-2 text-sm"
        >
          Submit
        </button>
      </form>

      {submitted ? (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Captured payload (for now)</h2>
          <pre className="mt-2 rounded-md bg-gray-50 border p-3 text-xs overflow-auto">
            {JSON.stringify(submitted, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

