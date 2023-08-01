"use client"

import { useEffect } from "react"

import PinchZoom from "@/libs/pinch-zoom/new"
import { useCanvas } from "@/utils/canvas"

const SIZE = 1000

const universe = new Array(SIZE * SIZE)
  .fill(0)
  .map(() => Math.round(Math.random() * 15))

export const Canvas = () => {
  const { ref } = useCanvas(universe, SIZE)

  useEffect(() => {
    const canvas = document.querySelector("canvas")
    if (!canvas) return // No canvas, no fun

    const pz = new PinchZoom(canvas, {
      useMouseWheel: true,
      maxZoom: 20,
      minZoom: 0.8,
      tapZoomFactor: 15,
      verticalPadding: 500,
      horizontalPadding: 500,
      draggableUnzoomed: true,
    })

    return () => pz.destroy()
  }, [])

  return (
    <div className="w-[-webkit-fill-available] touch-none select-none overflow-hidden">
      <canvas
        ref={ref}
        width={SIZE}
        height={SIZE}
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  )
}
