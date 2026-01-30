/**
 * Utility functions for RAF-driven typewriter effect
 * Computes displayed content based on progress (0-1) synchronized with Canvas RAF loop
 */

export interface TypewriterRenderOptions {
  /** Full HTML content to display progressively */
  content: string;
  /** Progress from 0-1 */
  progress: number;
  /** Show blinking cursor */
  showCursor?: boolean;
  /** Cursor character */
  cursorChar?: string;
}

interface BuildContext {
  textIndex: number;
  cursorInserted: boolean;
  targetCharIndex: number;
}

/**
 * Parse HTML content and extract plain text for character counting
 */
export function extractTextContent(htmlContent: string): string {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  return tempDiv.textContent || '';
}

/**
 * Build HTML with partial content revealed based on progress
 * Preserves HTML tags while animating text content
 */
function buildHTML(node: Node, ctx: BuildContext, showCursor: boolean, cursorChar: string): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const nodeText = node.textContent || '';
    const nodeStartIndex = ctx.textIndex;
    const nodeEndIndex = ctx.textIndex + nodeText.length;
    ctx.textIndex = nodeEndIndex;

    // Calculate how many characters to show from this node
    const charsToShow = Math.min(
      nodeText.length,
      Math.max(0, ctx.targetCharIndex - nodeStartIndex)
    );

    const visibleText = nodeText.substring(0, charsToShow);

    // Insert cursor at the end of visible text if this is where typing stopped
    if (showCursor && !ctx.cursorInserted && ctx.targetCharIndex >= nodeStartIndex && ctx.targetCharIndex <= nodeEndIndex) {
      ctx.cursorInserted = true;
      return visibleText + `<span class="typing-cursor">${cursorChar}</span>`;
    }

    return visibleText;
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element;
    const tagName = element.tagName.toLowerCase();
    const className = element.className ? ` class="${element.className}"` : '';
    let innerHTML = '';

    for (const child of Array.from(node.childNodes)) {
      innerHTML += buildHTML(child, ctx, showCursor, cursorChar);
    }

    if (innerHTML.length > 0 || ctx.cursorInserted) {
      return `<${tagName}${className}>${innerHTML}</${tagName}>`;
    }
    return '';
  }
  return '';
}

/**
 * Compute displayed content based on progress (0-1)
 * This replaces the setTimeout-based useTypewriter for InfoPanel
 */
export function computeTypewriterContent(options: TypewriterRenderOptions): string {
  const { content, progress, showCursor = true, cursorChar = '_' } = options;

  if (!content || progress === 0) {
    return showCursor ? `<span class="typing-cursor">${cursorChar}</span>` : '';
  }

  // Parse HTML to build DOM tree
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  const fullText = tempDiv.textContent || '';

  // Calculate target character index based on progress
  const targetCharIndex = Math.floor(fullText.length * progress);

  // If fully complete (progress = 1), return content without cursor
  if (progress >= 1) {
    return content;
  }

  // Build partial HTML
  const ctx: BuildContext = {
    textIndex: 0,
    cursorInserted: false,
    targetCharIndex,
  };

  let result = '';
  for (const child of Array.from(tempDiv.childNodes)) {
    result += buildHTML(child, ctx, showCursor, cursorChar);
  }

  // If cursor wasn't inserted (edge case), append it at the end
  if (showCursor && !ctx.cursorInserted) {
    result += `<span class="typing-cursor">${cursorChar}</span>`;
  }

  return result;
}

/**
 * Calculate typewriter duration in milliseconds based on character count
 * Uses standard typing speed
 */
export function calculateTypewriterDuration(content: string, speedPerChar: number = 15): number {
  const textLength = extractTextContent(content).length;
  return textLength * speedPerChar;
}
