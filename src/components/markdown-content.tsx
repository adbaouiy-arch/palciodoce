import { parseMarkdown, type InlineNode } from "@/lib/markdown";

/**
 * Renders the Markdown subset used by informational pages as real React
 * elements (never raw HTML), styled to match the site's typography.
 *
 * Because the block tree comes from `parseMarkdown`, admin-authored page
 * content cannot introduce markup or scripts — the worst a malformed
 * document can do is render as plain text.
 */

function InlineNodes({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.type) {
          case "strong":
            return (
              <strong key={index} className="font-semibold text-cocoa">
                {node.value}
              </strong>
            );
          case "emphasis":
            return <em key={index}>{node.value}</em>;
          case "link": {
            const isExternal = /^https?:/i.test(node.href);
            return (
              <a
                key={index}
                href={node.href}
                {...(isExternal
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className="font-medium text-cocoa underline underline-offset-4 transition-colors hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                {node.label}
              </a>
            );
          }
          default:
            return <span key={index}>{node.value}</span>;
        }
      })}
    </>
  );
}

export function MarkdownContent({ content }: { content: string }) {
  const blocks = parseMarkdown(content);

  return (
    <div className="flex flex-col gap-5">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading": {
            const Heading = `h${block.level}` as "h2" | "h3" | "h4";
            const sizes = {
              2: "text-2xl",
              3: "text-xl",
              4: "text-lg",
            } as const;

            return (
              <Heading
                key={index}
                className={`mt-4 font-heading font-semibold text-cocoa first:mt-0 ${sizes[block.level]}`}
              >
                <InlineNodes nodes={block.content} />
              </Heading>
            );
          }

          case "list": {
            const List = block.ordered ? "ol" : "ul";
            return (
              <List
                key={index}
                className={`flex flex-col gap-2 ps-6 leading-relaxed text-cocoa-soft ${
                  block.ordered ? "list-decimal" : "list-disc"
                }`}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <InlineNodes nodes={item} />
                  </li>
                ))}
              </List>
            );
          }

          default:
            return (
              <p key={index} className="leading-relaxed text-cocoa-soft">
                <InlineNodes nodes={block.content} />
              </p>
            );
        }
      })}
    </div>
  );
}
