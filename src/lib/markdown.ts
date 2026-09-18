/**
 * A deliberately small Markdown subset parser for the informational
 * pages stored in `PageTranslation.content` (privacy policy, terms,
 * cookie policy).
 *
 * It is a *parser*, not an HTML converter: it produces a plain block
 * tree that the renderer turns into React elements. Nothing ever reaches
 * `dangerouslySetInnerHTML`, so page content — which is editable from
 * the admin area — can never inject markup or scripts into the site.
 *
 * Supported: `##`–`####` headings, unordered (`-`, `*`) and ordered
 * (`1.`) lists, paragraphs, and inline `**bold**`, `*italic*` and
 * `[label](url)` links. Anything else is treated as literal text, which
 * degrades gracefully rather than breaking the page.
 */

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "strong"; value: string }
  | { type: "emphasis"; value: string }
  | { type: "link"; label: string; href: string };

export type MarkdownBlock =
  | { type: "heading"; level: 2 | 3 | 4; content: InlineNode[] }
  | { type: "list"; ordered: boolean; items: InlineNode[][] }
  | { type: "paragraph"; content: InlineNode[] };

const HEADING = /^(#{1,6})\s+(.*)$/;
const UNORDERED_ITEM = /^[-*]\s+(.*)$/;
const ORDERED_ITEM = /^\d+[.)]\s+(.*)$/;

/**
 * Inline tokens, in priority order. `**bold**` must precede `*italic*`
 * so a bold run isn't mistaken for two italic delimiters.
 */
const INLINE =
  /\*\*([^*]+)\*\*|\*([^*\n]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

/**
 * Only schemes that are meaningful and safe for page copy are kept.
 * Anything else (notably `javascript:` and `data:`) is dropped and the
 * link renders as plain text.
 */
function isSafeHref(href: string): boolean {
  if (href.startsWith("/") || href.startsWith("#")) return true;
  return /^(https?:|mailto:|tel:)/i.test(href);
}

export function parseInline(input: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let lastIndex = 0;

  // `INLINE` is a module-level regex with /g, so reset before each use.
  INLINE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = INLINE.exec(input)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: "text", value: input.slice(lastIndex, match.index) });
    }

    const [full, strong, emphasis, linkLabel, linkHref] = match;

    if (strong !== undefined) {
      nodes.push({ type: "strong", value: strong });
    } else if (emphasis !== undefined) {
      nodes.push({ type: "emphasis", value: emphasis });
    } else if (linkLabel !== undefined && linkHref !== undefined) {
      if (isSafeHref(linkHref)) {
        nodes.push({ type: "link", label: linkLabel, href: linkHref });
      } else {
        nodes.push({ type: "text", value: linkLabel });
      }
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < input.length) {
    nodes.push({ type: "text", value: input.slice(lastIndex) });
  }

  return nodes;
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];

  // Buffers for the block currently being accumulated.
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    // Consecutive non-blank lines form one paragraph, joined by spaces.
    blocks.push({ type: "paragraph", content: parseInline(paragraph.join(" ")) });
    paragraph = [];
  }

  function flushList() {
    if (listItems.length === 0) return;
    blocks.push({
      type: "list",
      ordered: listOrdered,
      items: listItems.map(parseInline),
    });
    listItems = [];
  }

  function flushAll() {
    flushParagraph();
    flushList();
  }

  for (const rawLine of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();

    if (line === "") {
      flushAll();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushAll();
      // The page title is the document's h1, so content headings start
      // at h2 and never jump past h4 — keeping a valid, accessible
      // heading outline regardless of how the source was authored.
      const level = Math.min(4, Math.max(2, heading[1].length)) as 2 | 3 | 4;
      blocks.push({ type: "heading", level, content: parseInline(heading[2]) });
      continue;
    }

    const ordered = ORDERED_ITEM.exec(line);
    if (ordered) {
      flushParagraph();
      if (listItems.length > 0 && !listOrdered) flushList();
      listOrdered = true;
      listItems.push(ordered[1]);
      continue;
    }

    const unordered = UNORDERED_ITEM.exec(line);
    if (unordered) {
      flushParagraph();
      if (listItems.length > 0 && listOrdered) flushList();
      listOrdered = false;
      listItems.push(unordered[1]);
      continue;
    }

    // Plain prose. A paragraph line also terminates any open list.
    flushList();
    paragraph.push(line);
  }

  flushAll();
  return blocks;
}
