import rulesMarkdown from "../../Rules.md?raw";

// A small, format-specific markdown-lite renderer for Rules.md — not a
// general parser. It only needs to handle this file's actual patterns: a
// blank-line-separated block is either a blockquote (every line starts with
// ">"), a heading (the whole block is one line, entirely wrapped in
// "**...**"), a numbered/bulleted list item (grouped with its neighbors of
// the same kind into one <ol>/<ul>), or a plain paragraph with inline
// **bold** spans. Rules.md stays the single source of truth; this just
// avoids pulling in a full markdown-parser dependency for one static file.
function splitBlocks(markdown) {
  return markdown
    .split(/\n\s*\n/)
    .map(block => block.trim())
    .filter(Boolean);
}

function isBlockquote(block) {
  return block.split("\n").every(line => line.trim().startsWith(">"));
}

function isHeading(block) {
  return !block.includes("\n") && /^\*\*(.+)\*\*$/.test(block);
}

function isNumberedItem(block) {
  return /^\d+\.\s/.test(block);
}

function isBulletItem(block) {
  return /^-\s/.test(block);
}

// Wrapped lines within one block join into a single line (a blank line is
// what actually separates blocks, not a line break).
function joinWrapped(block) {
  return block
    .split("\n")
    .map(line => line.trim())
    .join(" ");
}

// Renders inline **bold** spans within a line of text; plain string parts
// pass straight through untouched (React doesn't need keys on bare strings).
function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    const match = /^\*\*(.+)\*\*$/.exec(part);
    return match ? <strong key={i}>{match[1]}</strong> : part;
  });
}

function renderBlockquote(block, key) {
  const lines = block.split("\n").map(line => line.trim().replace(/^>\s?/, ""));
  const paragraphs = [];
  let current = [];
  for (const line of lines) {
    if (line === "") {
      if (current.length) paragraphs.push(current.join(" "));
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) paragraphs.push(current.join(" "));

  return (
    <blockquote className="rules-quote" key={key}>
      {paragraphs.map((paragraph, i) => (
        <p key={i}>{renderInline(paragraph)}</p>
      ))}
    </blockquote>
  );
}

function renderRulesMarkdown(markdown) {
  const blocks = splitBlocks(markdown);
  const elements = [];
  let headingSeen = false;
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (isBlockquote(block)) {
      elements.push(renderBlockquote(block, `bq-${i}`));
      i++;
      continue;
    }

    if (isHeading(block)) {
      const text = block.slice(2, -2);
      const Tag = headingSeen ? "h2" : "h1";
      headingSeen = true;
      elements.push(<Tag key={`h-${i}`}>{text}</Tag>);
      i++;
      continue;
    }

    if (isNumberedItem(block)) {
      const items = [];
      while (i < blocks.length && isNumberedItem(blocks[i])) {
        items.push(joinWrapped(blocks[i]).replace(/^\d+\.\s+/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (isBulletItem(block)) {
      const items = [];
      while (i < blocks.length && isBulletItem(blocks[i])) {
        items.push(joinWrapped(blocks[i]).replace(/^-\s+/, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    elements.push(<p key={`p-${i}`}>{renderInline(joinWrapped(block))}</p>);
    i++;
  }

  return elements;
}

const RULES_CONTENT = renderRulesMarkdown(rulesMarkdown);

export default function RulesModal({ onClose }) {
  return (
    <div className="rules-overlay" onClick={onClose}>
      <div className="rules-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="icon-button rules-modal-close" onClick={onClose} title="Close">
          ✕
        </button>
        <div className="rules-content">{RULES_CONTENT}</div>
      </div>
    </div>
  );
}
