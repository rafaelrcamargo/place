import { RefObject, useEffect, useRef } from "react"

const PER_LINE = 1000
const SIZE = 1

const BASE = PER_LINE * SIZE

const match = (cell: number) =>
  ({
    0: "#fafafa",
    1: "#a1a1aa",
    2: "#27272a",
    3: "#09090b",
    4: "#ef4444",
    5: "#f97316",
    6: "#f59e0b",
    7: "#eab308",
    8: "#166534",
    9: "#10b981",
    10: "#06b6d4",
    11: "#0369a1",
    12: "#3b82f6",
    13: "#a855f7",
    14: "#e879f9",
    15: "#fb7185",
  }[cell] || "#fafafa")

const render = (canvas: HTMLCanvasElement, universe: Array<number>) => {
  const ctx = canvas.getContext("2d", { alpha: false })
  if (!ctx) return

  ctx.clearRect(0, 0, BASE, BASE)
  ctx.shadowColor = "transparent"
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0

  universe.forEach((cell, i) => {
    const x = i % PER_LINE
    const y = Math.floor(i / PER_LINE)

    ctx.fillStyle = match(cell)
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
  }, [ref, universe])

  return { ref, render }
}
