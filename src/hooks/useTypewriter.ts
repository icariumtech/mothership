import { useState, useEffect, useRef, useCallback } from 'react';

interface UseTypewriterOptions {
  speed?: number;
  showCursor?: boolean;
  cursorChar?: string;
  onComplete?: () => void;
}

interface UseTypewriterReturn {
  displayedContent: string;
  isTyping: boolean;
  reset: () => void;
}

/**
 * Hook that provides a typewriter animation effect for text content.
 * Supports HTML content by preserving tags while animating text.
 * Cursor is inserted inline at the end of the typed content.
 */
export function useTypewriter(
  content: string,
  options: UseTypewriterOptions = {}
): UseTypewriterReturn {
  const { speed = 15, showCursor = true, cursorChar = '_', onComplete } = options;
  const [displayedContent, setDisplayedContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const operationIdRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setDisplayedContent('');
    setIsTyping(false);
  }, []);

  useEffect(() => {
    if (!content) {
      setDisplayedContent('');
      setIsTyping(false);
      return;
    }

    // Cancel any existing animation
    operationIdRef.current++;
    const thisOperationId = operationIdRef.current;

    // Parse HTML to extract text content for animation
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const fullText = tempDiv.textContent || '';

    let charIndex = 0;
    setDisplayedContent('');
    setIsTyping(true);

    // Track where the cursor should be inserted
    interface BuildContext {
      textIndex: number;
      cursorInserted: boolean;
      targetCharIndex: number;
    }

    function buildHTML(node: Node, ctx: BuildContext): string {
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
          innerHTML += buildHTML(child, ctx);
        }

        if (innerHTML.length > 0 || ctx.cursorInserted) {
          return `<${tagName}${className}>${innerHTML}</${tagName}>`;
        }
        return '';
      }
      return '';
    }

    function typeNextChar() {
      // Check if this operation was cancelled
      if (operationIdRef.current !== thisOperationId) {
        return;
      }

      if (charIndex < fullText.length) {
        charIndex++;

        const ctx: BuildContext = {
          textIndex: 0,
          cursorInserted: false,
          targetCharIndex: charIndex,
        };

        let currentHTML = '';
        for (const child of Array.from(tempDiv.childNodes)) {
          currentHTML += buildHTML(child, ctx);
        }

        // If cursor wasn't inserted (edge case), append it at the end
        if (showCursor && !ctx.cursorInserted) {
          currentHTML += `<span class="typing-cursor">${cursorChar}</span>`;
        }

        setDisplayedContent(currentHTML);
        timeoutRef.current = window.setTimeout(typeNextChar, speed);
      } else {
        // Animation complete - show final content without cursor
        const ctx: BuildContext = {
          textIndex: 0,
          cursorInserted: true, // Prevent cursor insertion
          targetCharIndex: fullText.length,
        };

        let finalHTML = '';
        for (const child of Array.from(tempDiv.childNodes)) {
          finalHTML += buildHTML(child, ctx);
        }

        setDisplayedContent(finalHTML);
        setIsTyping(false);
        onComplete?.();
      }
    }

    typeNextChar();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, speed, showCursor, cursorChar, onComplete]);

  return { displayedContent, isTyping, reset };
}
