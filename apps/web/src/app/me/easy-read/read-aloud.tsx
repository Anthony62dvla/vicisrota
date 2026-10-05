"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/** Reads text aloud with the device's own voice. Nothing is sent anywhere. */
export function ReadAloud({ text, label = "Read aloud" }: { text: string; label?: string }) {
  const [speaking, setSpeaking] = useState(false);
  // Whether this device can speak never changes while the page is open, so there is nothing to subscribe to.
  const supported = useSyncExternalStore(
    () => () => {},
    () => "speechSynthesis" in window,
    () => false,
  );
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);
  if (!supported) return null;
  const toggle = () => {
    const synth = window.speechSynthesis;
    synth.cancel();
    if (speaking) return setSpeaking(false);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.rate = 0.9;
    const voice = synth.getVoices().find((v) => v.lang === "en-GB");
    if (voice) utterance.voice = voice;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utterance);
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={speaking} className="inline-flex items-center gap-2 rounded-lg border-2 border-brand px-4 py-2 font-medium text-heading">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {speaking ? <path d="M7 6h3v12H7zM14 6h3v12h-3z" /> : <path d="M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
      </svg>
      {speaking ? "Stop" : label}
    </button>
  );
}
