"use client";

import { useState, useEffect } from "react";
import { formatTime } from "@/lib/formatTime";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  endTime: string | Date;
  onComplete?: () => void;
}

export default function CountdownTimer({ endTime, onComplete }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const total = new Date(endTime).getTime() - Date.now();
      return Math.max(0, Math.floor(total / 1000));
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);

      if (newTimeLeft === 0) {
        clearInterval(timer);
        onComplete?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime, onComplete]);

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 rounded-lg"
      style={{
        background: "var(--background-secondary)",
        border: "1px solid var(--border)",
      }}
    >
      <Clock className="w-5 h-5" style={{ color: "var(--primary)" }} />
      <span
        className="font-mono text-lg font-semibold"
        style={{ color: "var(--foreground)" }}
      >
        {formatTime(timeLeft)}
      </span>
    </div>
  );
}
