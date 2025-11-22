import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MIN_SENTENCE_LENGTH = 40;
const MAX_KEY_POINTS = 6;

const STOPWORDS = new Set([
  "a",
  "afin",
  "ai",
  "ainsi",
  "alors",
  "après",
  "au",
  "aucun",
  "aussi",
  "autre",
  "aux",
  "avant",
  "avec",
  "avoir",
  "bon",
  "car",
  "ce",
  "ceci",
  "cela",
  "ces",
  "cet",
  "cette",
  "ceux",
  "chaque",
  "comme",
  "comment",
  "dans",
  "de",
  "des",
  "du",
  "elle",
  "elles",
  "en",
  "encore",
  "est",
  "et",
  "étaient",
  "était",
  "être",
  "eu",
  "fait",
  "faites",
  "fais",
  "font",
  "ici",
  "il",
  "ils",
  "je",
  "la",
  "le",
  "les",
  "leur",
  "leurs",
  "lui",
  "mais",
  "mes",
  "moi",
  "mon",
  "ne",
  "nos",
  "notre",
  "nous",
  "on",
  "ou",
  "par",
  "pas",
  "peu",
  "plus",
  "pour",
  "qu",
  "que",
  "quel",
  "quelle",
  "quelles",
  "quels",
  "qui",
  "sa",
  "sans",
  "ses",
  "son",
  "sont",
  "sur",
  "ta",
  "tandis",
  "te",
  "tes",
  "toi",
  "ton",
  "toujours",
  "tous",
  "tout",
  "toute",
  "toutes",
  "tu",
  "un",
  "une",
  "vos",
  "votre",
  "vous",
  "y"
]);

function sanitizeText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim();
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ])/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= MIN_SENTENCE_LENGTH);
}

function tokenize(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\p{Diacritic}]/gu, "")
    .replace(/[^a-zà-ÿ\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !STOPWORDS.has(token));
}

function buildFrequencyMap(sentences: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const sentence of sentences) {
    for (const token of tokenize(sentence)) {
      const prev = freq.get(token) ?? 0;
      freq.set(token, prev + 1);
    }
  }
  return freq;
}

function scoreSentences(sentences: string[], freq: Map<string, number>): Map<string, number> {
  const scores = new Map<string, number>();
  for (const sentence of sentences) {
    const tokens = tokenize(sentence);
    if (!tokens.length) continue;
    const total = tokens.reduce((sum, token) => sum + (freq.get(token) ?? 0), 0);
    scores.set(sentence, total / tokens.length);
  }
  return scores;
}

function pickTopSentences(sentences: string[], scores: Map<string, number>, limit: number): string[] {
  const sorted = [...sentences].sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0));
  const strongest = new Set(sorted.slice(0, limit));
  return sentences.filter((sentence) => strongest.has(sentence));
}

function buildTitle(sentences: string[]): string {
  if (!sentences.length) {
    return "Essentiel du chapitre";
  }
  const first = sentences[0];
  const snippet = first.split(/[:.!?]/)[0].trim();
  return snippet.length > 0 ? snippet : "Essentiel du chapitre";
}

function buildThesis(sentences: string[]): string {
  return sentences
    .slice(0, 2)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCallToAction(sentences: string[]): string {
  const last = sentences[sentences.length - 1] ?? "";
  if (!last) {
    return "Concluez en soulignant la portée pratique de ces enseignements pour le lecteur.";
  }
  return `Poursuivez le chapitre en développant: ${last}`;
}

async function extractText(buffer: Buffer): Promise<string> {
  const { default: pdfParse } = await import("pdf-parse");
  const result = await pdfParse(buffer);
  return result.text;
}

function summarise(text: string) {
  const sanitized = sanitizeText(text);
  const sentences = splitIntoSentences(sanitized).slice(0, 180);

  if (!sentences.length) {
    throw new Error("Aucun contenu exploitable trouvé dans ce PDF.");
  }

  const freq = buildFrequencyMap(sentences);
  const scores = scoreSentences(sentences, freq);
  const keySentences = pickTopSentences(sentences, scores, MAX_KEY_POINTS);

  return {
    titleSuggestion: buildTitle(keySentences),
    thesis: buildThesis(sentences),
    keyPoints: keySentences,
    callToAction: buildCallToAction(sentences)
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ message: "Fichier PDF manquant." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: "Le fichier dépasse la taille maximale autorisée de 10 Mo." },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const rawText = await extractText(buffer);
    if (!rawText || rawText.trim().length < 200) {
      return NextResponse.json(
        { message: "Le document ne contient pas assez de texte pour une synthèse pertinente." },
        { status: 422 }
      );
    }

    const summary = summarise(rawText);

    return NextResponse.json(summary);
  } catch (error) {
    console.error("SUMMARIZE_ERROR", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Une erreur inattendue empêche la génération de la synthèse.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
