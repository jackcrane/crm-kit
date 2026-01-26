import React, { useEffect, useRef } from "react";

export const Turnstile = ({ siteKey, onVerify }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!window.turnstile || !ref.current) return;

    const widgetId = window.turnstile.render(ref.current, {
      sitekey: siteKey,
      callback: onVerify,
    });

    return () => {
      window.turnstile.remove(widgetId);
    };
  }, [siteKey, onVerify]);

  return <div ref={ref} />;
};
