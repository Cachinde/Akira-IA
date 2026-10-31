"use client";

import React, { useEffect, useState, useRef } from "react";
import { AkiraMessageRenderer } from "@/components/AkiraMessageRenderer";

type Props = {
  content: string;
  className?: string;
  typingSpeed?: number;
  initialDelay?: number;
  animate?: boolean;
};

export function TypewriterMessage({
  content,
  className = "",
  typingSpeed = 20,
  initialDelay = 100,
  animate = true,
}: Props) {
  const [displayed, setDisplayed] = useState("");
  const displayRef = useRef(displayed);
  const timersRef = useRef<{ interval: NodeJS.Timeout; timeout: NodeJS.Timeout | null } | null>(null);

  useEffect(() => {
    if (!animate) {
      setDisplayed("");
      return;
    }

    if (!content) {
      setDisplayed("");
      return;
    }

    // Reset if content changed significantly
    if (displayRef.current && !content.startsWith(displayRef.current)) {
      setDisplayed("");
    }
    displayRef.current = displayed;

    // First clear any existing timers
    if (timersRef.current) {
      clearInterval(timersRef.current.interval);
      if (timersRef.current.timeout) clearTimeout(timersRef.current.timeout);
    }

    // Start typing after initial delay
    if (!displayed) {
      const timeoutId = setTimeout(() => {
        if (!content) return;

        let i = 0;
        const intervalId = setInterval(() => {
          if (i <= content.length) {
            setDisplayed(content.slice(0, i));
            i++;
            if (i > content.length) {
              clearInterval(intervalId);
              timersRef.current = null;
            }
          }
        }, typingSpeed);

        timersRef.current = { interval: intervalId, timeout: timeoutId };
      }, initialDelay);
    }

    return () => {
      if (timersRef.current) {
        clearInterval(timersRef.current.interval);
        if (timersRef.current.timeout) {
          clearTimeout(timersRef.current.timeout);
        }
      }
    };
  }, [animate, content, initialDelay, typingSpeed]);

  if (!animate) {
    // Mensagem restaurada do histórico: renderiza o conteúdo final de imediato,
    // sem simulador de escrita nem indicador "A AKIRA está a escrever...".
    if (!content) return null;
    return (
      <div className={className}>
        <AkiraMessageRenderer content={content} />
      </div>
    );
  }

  if (!displayed) {
    // Show typing indicator initially
    return (
      <div className={className}>
        <div className="markdown-content">
          <div className="typing-indicator">
            <span className="typing-dots">
              <i />
              <i />
              <i />
            </span>
            <span className="typing-note">A AKIRA está a escrever...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <AkiraMessageRenderer content={displayed} />
    </div>
  );
}
