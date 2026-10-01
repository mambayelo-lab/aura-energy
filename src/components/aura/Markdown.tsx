// Lightweight markdown renderer — no external deps
// Handles: headers, bold, italic, code, lists, blockquotes, horizontal rules, tables, chart blocks

import { ChartBlock } from "@/components/aura/ChartBlock";

interface Props { children: string; className?: string; }

function parseLine(line: string, key: number): React.ReactNode {
  // Split by bold/italic/inline code
  const parts: React.ReactNode[] = [];
  const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) parts.push(<span key={idx++}>{line.slice(last, m.index)}</span>);
    if (m[2]) parts.push(<strong key={idx++}><em>{m[2]}</em></strong>);
    else if (m[3]) parts.push(<strong key={idx++}>{m[3]}</strong>);
    else if (m[4]) parts.push(<em key={idx++}>{m[4]}</em>);
    else if (m[5]) parts.push(<code key={idx++} className="px-1 py-0.5 rounded bg-[var(--border)] font-mono text-[0.85em]">{m[5]}</code>);
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push(<span key={idx++}>{line.slice(last)}</span>);
  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : <>{parts}</>;
}

export function Markdown({ children, className = "" }: Props) {
  const lines = children.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw;

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={i} className="my-3 border-[var(--border)]" />);
      i++; continue;
    }

    // Heading
    const hm = line.match(/^(#{1,4})\s+(.+)/);
    if (hm) {
      const level = hm[1].length;
      const text = hm[2];
      const cls = [
        "font-bold mt-4 mb-1",
        level === 1 ? "text-xl" : level === 2 ? "text-lg" : level === 3 ? "text-base" : "text-sm",
      ].join(" ");
      nodes.push(<div key={i} className={cls}>{parseLine(text, i)}</div>);
      i++; continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        bqLines.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <blockquote key={i} className="border-l-4 border-[var(--brand)]/40 pl-3 my-2 text-muted-foreground italic">
          {bqLines.map((l, j) => <p key={j}>{parseLine(l, j)}</p>)}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <ul key={i} className="list-disc pl-4 my-1 space-y-0.5">
          {items.map((item, j) => <li key={j} className="text-sm">{parseLine(item, j)}</li>)}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      nodes.push(
        <ol key={i} className="list-decimal pl-4 my-1 space-y-0.5">
          {items.map((item, j) => <li key={j} className="text-sm">{parseLine(item, j)}</li>)}
        </ol>
      );
      continue;
    }

    // Code block (including ```chart blocks rendered as interactive charts)
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim().toLowerCase();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const raw = codeLines.join("\n");
      if (lang === "chart") {
        nodes.push(<ChartBlock key={i} raw={raw} />);
      } else {
        nodes.push(
          <pre key={i} className="my-2 p-3 rounded-lg bg-[var(--border)]/40 overflow-x-auto text-[0.8em] font-mono leading-relaxed">
            <code>{raw}</code>
          </pre>
        );
      }
      continue;
    }

    // GFM table: lines starting with |
    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      // Skip separator row (--- line)
      const [headerRow, ...bodyRows] = tableLines.filter(l => !/^\|[-| :]+\|?$/.test(l.trim()));
      const headers = headerRow.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(h => h.trim());
      nodes.push(
        <div key={i} className="overflow-x-auto my-2">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-foreground/[0.04]">
                {headers.map((h, j) => (
                  <th key={j} className="border border-border px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                    {parseLine(h, j)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => {
                const cells = row.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim());
                return (
                  <tr key={ri} className={ri % 2 === 1 ? "bg-foreground/[0.02]" : ""}>
                    {cells.map((cell, ci) => (
                      <td key={ci} className="border border-border px-2 py-1 break-words">
                        {parseLine(cell, ci)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Empty line → spacer
    if (line.trim() === "") {
      nodes.push(<div key={i} className="h-2" />);
      i++; continue;
    }

    // Regular paragraph
    nodes.push(<p key={i} className="text-sm leading-relaxed">{parseLine(line, i)}</p>);
    i++;
  }

  return <div className={`prose-aura ${className}`}>{nodes}</div>;
}
