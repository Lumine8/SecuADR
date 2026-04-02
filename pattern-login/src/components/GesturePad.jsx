import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";

const GesturePad = forwardRef(function GesturePad(
    {
        canvasWidth = 320,
        canvasHeight = 320,
        brushRadius = 3,
        brushColor = "#3b82f6",
        style,
        onChange,
    },
    ref,
) {
    const canvasRef = useRef(null);
    const drawingRef = useRef(false);
    const [lines, setLines] = useState([]);

    const drawSegment = (from, to) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushRadius * 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
    };

    const normalizeExternalPoint = (pt) => {
        const x = Number(pt?.x ?? pt?.X ?? 0);
        const y = Number(pt?.y ?? pt?.Y ?? 0);
        const timestamp = Number(pt?.timestamp ?? pt?.time ?? pt?.T ?? Date.now());
        return { x, y, timestamp };
    };

    const clearCanvasOnly = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const getPoint = (event) => {
        const rect = canvasRef.current.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    };

    const startLine = (event) => {
        if (!canvasRef.current) return;
        canvasRef.current.setPointerCapture(event.pointerId);
        const pt = getPoint(event);
        drawingRef.current = true;
        setLines((prev) => [...prev, { points: [pt] }]);
        if (onChange) onChange();
    };

    const extendLine = (event) => {
        if (!drawingRef.current) return;
        const pt = getPoint(event);

        setLines((prev) => {
            if (prev.length === 0) return prev;
            const next = [...prev];
            const lastIndex = next.length - 1;
            const lastLine = next[lastIndex];
            const prevPoint = lastLine.points[lastLine.points.length - 1];
            drawSegment(prevPoint, pt);
            next[lastIndex] = {
                ...lastLine,
                points: [...lastLine.points, pt],
            };
            return next;
        });

        if (onChange) onChange();
    };

    const stopLine = (event) => {
        drawingRef.current = false;
        if (canvasRef.current?.hasPointerCapture(event.pointerId)) {
            canvasRef.current.releasePointerCapture(event.pointerId);
        }
    };

    const clear = () => {
        clearCanvasOnly();
        setLines([]);
    };

    const playPath = (externalPoints = [], stepDelayMs = 14) =>
        new Promise((resolve) => {
            const points = Array.isArray(externalPoints)
                ? externalPoints
                    .map(normalizeExternalPoint)
                    .filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y))
                : [];

            if (points.length < 2) {
                clear();
                resolve();
                return;
            }

            clearCanvasOnly();
            let i = 1;
            const drawn = [points[0]];

            const timer = setInterval(() => {
                if (i >= points.length) {
                    clearInterval(timer);
                    setLines([{ points: drawn.map((pt) => ({ x: pt.x, y: pt.y, timestamp: pt.timestamp })) }]);
                    if (onChange) onChange();
                    resolve();
                    return;
                }

                drawSegment(points[i - 1], points[i]);
                drawn.push(points[i]);
                i += 1;
            }, Math.max(4, stepDelayMs));
        });

    const getSaveData = () => JSON.stringify({ lines });

    useImperativeHandle(ref, () => ({
        clear,
        getSaveData,
        playPath,
    }));

    return (
        <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            style={{
                width: canvasWidth,
                height: canvasHeight,
                touchAction: "none",
                WebkitUserSelect: "none",
                userSelect: "none",
                ...style,
            }}
            onPointerDown={startLine}
            onPointerMove={extendLine}
            onPointerUp={stopLine}
            onPointerCancel={stopLine}
            onPointerLeave={stopLine}
        />
    );
});

export default GesturePad;
