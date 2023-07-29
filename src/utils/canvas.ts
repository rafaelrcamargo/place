import { RefObject, useEffect, useRef } from "react"

const PER_LINE = 1000
const SIZE = 1

const palette = [
  "#fafafa",
  "#a1a1aa",
  "#27272a",
  "#09090b",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#166534",
  "#10b981",
  "#06b6d4",
  "#0369a1",
  "#3b82f6",
  "#a855f7",
  "#e879f9",
  "#fb7185",
] as const

const render = (canvas: HTMLCanvasElement, universe: Array<number>) => {
  const ctx = canvas.getContext("2d", { alpha: false })
  if (!ctx) return

  universe.forEach((cell, i) => {
    const x = i % PER_LINE
    const y = Math.floor(i / PER_LINE)

    ctx.fillStyle = palette[cell] || palette[0]
    ctx.fillRect(x * SIZE, y * SIZE, SIZE, SIZE)
  })
}

type UseCanvas = (
  universe: Array<number>,
  perLine?: number
) => {
  ref: RefObject<HTMLCanvasElement>
  render: (canvas: HTMLCanvasElement, universe: Array<number>) => void
}

export const useCanvas: UseCanvas = universe => {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    render(canvas, universe)
  }, [ref])

  return { ref, render }
}
