import React, { useEffect, useRef } from "react";

export default function GestureReplayCanvas({ points = [] }) {
    const ref = useRef(null);

    useEffect(() => {
        const canvas = ref.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(7, 15, 39, 0.88)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (!points.length) return;

        const minX = Math.min(...points.map((p) => p.x));
        const maxX = Math.max(...points.map((p) => p.x));
        const minY = Math.min(...points.map((p) => p.y));
        const maxY = Math.max(...points.map((p) => p.y));

        const w = Math.max(maxX - minX, 1);
        const h = Math.max(maxY - minY, 1);

        const mapped = points.map((p) => ({
            x: 20 + ((p.x - minX) / w) * 220,
            y: 20 + ((p.y - minY) / h) * 120,
        }));

        let i = 1;
        ctx.strokeStyle = "#2fe4ff";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        const timer = setInterval(() => {
            if (i >= mapped.length) {
                clearInterval(timer);
                return;
            }
            ctx.beginPath();
            ctx.moveTo(mapped[i - 1].x, mapped[i - 1].y);
            ctx.lineTo(mapped[i].x, mapped[i].y);
            ctx.stroke();
            i += 1;
        }, 20);

        return () => clearInterval(timer);
    }, [points]);

    return <canvas ref={ref} width={260} height={160} className="replay-canvas" />;
}
