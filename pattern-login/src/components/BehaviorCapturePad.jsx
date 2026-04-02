import React, { useEffect, useRef, useState } from "react";

function drawPath(ctx, points, color = "#32e6ff", progress = 1) {
    if (!ctx || !points || points.length < 2) return;

    const count = Math.max(2, Math.floor(points.length * progress));
    const visible = points.slice(0, count);

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(visible[0].x, visible[0].y);

    for (let i = 1; i < visible.length; i++) {
        ctx.lineTo(visible[i].x, visible[i].y);
    }

    ctx.stroke();
}

export default function BehaviorCapturePad({
    width = 360,
    height = 220,
    points,
    onPointsChange,
    replay = false,
    accent = "#32e6ff",
}) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [replayProgress, setReplayProgress] = useState(1);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "rgba(5, 13, 34, 0.75)";
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = "rgba(85, 112, 161, 0.25)";
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 20) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += 20) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        drawPath(ctx, points || [], accent, replay ? replayProgress : 1);
    }, [points, replayProgress, replay, accent, width, height]);

    useEffect(() => {
        if (!replay || !points || points.length < 2) {
            setReplayProgress(1);
            return;
        }

        setReplayProgress(0.01);
        const timer = setInterval(() => {
            setReplayProgress((prev) => {
                const next = prev + 0.025;
                if (next >= 1) return 1;
                return next;
            });
        }, 18);

        return () => clearInterval(timer);
    }, [replay, points]);

    function extractPoint(event) {
        const rect = canvasRef.current.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            t: Date.now(),
        };
    }

    function handlePointerDown(event) {
        if (replay || !onPointsChange) return;
        setIsDrawing(true);
        const p = extractPoint(event);
        onPointsChange([p]);
    }

    function handlePointerMove(event) {
        if (!isDrawing || replay || !onPointsChange) return;
        const p = extractPoint(event);
        onPointsChange([...(points || []), p]);
    }

    function handlePointerUp() {
        setIsDrawing(false);
    }

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            style={{
                width: "100%",
                maxWidth: `${width}px`,
                height: "auto",
                borderRadius: "14px",
                border: "1px solid rgba(102, 191, 255, 0.3)",
                boxShadow: "inset 0 0 38px rgba(45, 131, 255, 0.12)",
                touchAction: "none",
            }}
        />
    );
}
