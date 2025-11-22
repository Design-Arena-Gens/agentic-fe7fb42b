"use client";

import { useMemo, useState } from "react";

type SummaryData = {
  titleSuggestion: string;
  thesis: string;
  keyPoints: string[];
  callToAction: string;
};

type FetchState = "idle" | "loading" | "error" | "success";

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [status, setStatus] = useState<FetchState>("idle");
  const [error, setError] = useState<string | null>(null);

  const fileLabel = useMemo(() => {
    if (!file) return "Sélectionnez un PDF";
    if (file.name.length > 32) {
      return file.name.slice(0, 29) + "...";
    }
    return file.name;
  }, [file]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Ajoutez d\u2019abord un fichier PDF.");
      return;
    }
    setStatus("loading");
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(details?.message ?? "Impossible de générer le résumé.");
      }

      const payload: SummaryData = await response.json();
      setSummary(payload);
      setStatus("success");
    } catch (fetchError) {
      setStatus("error");
      setSummary(null);
      setError(fetchError instanceof Error ? fetchError.message : "Une erreur est survenue.");
    }
  }

  return (
    <main className="page">
      <section className="panel">
        <h1>Distiller un PDF en extrait de chapitre</h1>
        <p className="lead">
          Téléversez votre PDF et obtenez immédiatement une synthèse structurée des idées clés,
          prête à être insérée dans un chapitre de livre.
        </p>

        <form className="upload" onSubmit={handleSubmit}>
          <label htmlFor="file" className="file-label">
            <span className="file-name">{fileLabel}</span>
            <span className="file-hint">PDF jusqu\u2019à 10&nbsp;Mo</span>
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept="application/pdf"
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              setFile(nextFile);
              setSummary(null);
              setStatus("idle");
            }}
            required
          />
          <button className="submit" type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Analyse en cours..." : "Analyser"}
          </button>
        </form>

        {status === "error" && error ? <p className="error">{error}</p> : null}
      </section>

      {summary && status === "success" ? (
        <section className="results">
          <h2>{summary.titleSuggestion}</h2>
          <p className="thesis">{summary.thesis}</p>
          <h3>Points indispensables</h3>
          <ul>
            {summary.keyPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <div className="cta">
            <h4>Transition suggérée</h4>
            <p>{summary.callToAction}</p>
          </div>
        </section>
      ) : (
        <section className="placeholder">
          <h2>Un extrait prêt à publier</h2>
          <p>
            Les phrases les plus parlantes de votre document sont sélectionnées, enrichies de
            transitions, et adaptées à une voix narrative professionnelle.
          </p>
        </section>
      )}
    </main>
  );
}
