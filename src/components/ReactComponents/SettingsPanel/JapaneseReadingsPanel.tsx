import {useMemo} from "react";
import {useStore} from "@nanostores/react";
import {$currentLyricsData} from "../../../utils/stores.ts";
import type {JapaneseResolution} from "../../../utils/Lyrics/JapaneseResolver.ts";

const reasons = {
  literal: "Original text", "literal-kana": "Pronunciation written in kana",
  "contextual-dictionary": "Dictionary analysis of the line",
  "supplied-dictionary-match": "Supplied reading matches a dictionary candidate",
  annotation: "Explicit kana annotation", unresolved: "No supported reading",
};
export default function JapaneseReadingsPanel({onBack}: {onBack: () => void}) {
  const serialized = useStore($currentLyricsData);
  const lines = useMemo(() => {
    try {
      const lyrics = JSON.parse(serialized);
      const results: {label: string; resolution: JapaneseResolution}[] = [];
      const add = (entry: any, label: string) => {
        if (entry?.SakuraJapaneseAnalysis?.version === 2) results.push({label, resolution: entry.SakuraJapaneseAnalysis});
      };
      for (const line of lyrics.Lines ?? lyrics.Content ?? []) {
        add(line, "Main");
        add(line.Lead, "Main");
        for (const background of line.Background ?? []) add(background, "Background");
      }
      for (const line of lyrics.SakuraDirectRomaji?.Content ?? []) add(line, "Direct source");
      return results;
    } catch { return []; }
  }, [serialized]);
  return <div className="slm w-40" style={{padding: "8px 0"}}>
    <button className="sl-sp-back-btn" onClick={onBack}>Back to Settings</button>
    <p>Readings for the loaded lyrics. Dictionary candidates are possibilities, not proof of what was sung.</p>
    {!lines.length && <p>No Japanese reading analysis is available. Load a Japanese lyric first.</p>}
    {lines.map(({label, resolution}, i) => <details key={i} style={{marginBlock: 12}}>
      <summary>{label}: {resolution.source}</summary>
      <p>{resolution.segments.join("")}</p>
      <p>Reading source: {resolution.outputSource}. Timing: {resolution.timing}.</p>
      {resolution.issues.includes("supplied-output-not-word-aligned") &&
        <p>The supplied pronunciation is retained. The word analysis below is the dictionary interpretation, not an alignment of that supplied text.</p>}
      {resolution.issues.length > 0 && <p>Notes: {resolution.issues.join(", ")}</p>}
      {resolution.words.filter(word => word.text.trim()).map((word, j) => <div key={j} style={{marginBlock: 8}}>
        <strong>{word.text}</strong> → {word.kana} → {word.romaji}
        <div>{reasons[word.selectedBy]}{word.ambiguous ? " — multiple candidates" : ""}</div>
        {word.candidates.length > 1 && <div>Candidates: {word.candidates.join(" / ")}</div>}
        <small>{word.parts.map(part => [part.pos, part.detail, part.lemma].filter(Boolean).join(" · ")).join("; ")}</small>
      </div>)}
    </details>)}
  </div>;
}
