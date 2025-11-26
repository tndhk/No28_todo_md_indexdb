import React from 'react';

/**
 * Parses Markdown links [text](url) and renders them as clickable links
 * Non-link text is rendered as plain text
 */
export function renderMarkdownLinks(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Add the link
    const linkText = match[1];
    const url = match[2];
    
    // SECURITY: Check for dangerous protocols
    // We only allow http, https, mailto, tel, and relative paths
    const isSafeUrl = /^(https?:\/\/|mailto:|tel:|\/|\.\/|\.\.\/)/i.test(url);

    if (isSafeUrl) {
      parts.push(
        <a
          key={`link-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#0066cc',
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          {linkText}
        </a>
      );
    } else {
      // Render unsafe links as plain text with a warning
      parts.push(
        <span key={`unsafe-${match.index}`} style={{ color: 'red' }} title="Unsafe link blocked">
          {linkText} [BLOCKED]
        </span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length === 0 ? text : parts;
}
