"use client"

import { useCanvas } from "@/utils/canvas"
import { useEffect, useState } from "react"

const SIZE = 1000
const SCALE = 1

let clicked = false
const universe = new Array(SIZE * SIZE)
  .fill(0)
  .map(() => Math.round(Math.random() * 15))

export const Canvas = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)

  const { ref } = useCanvas(universe, SIZE)

  useEffect(() => {
    const canvas = document.querySelector("canvas")
    if (!canvas) return // No canvas, no fun

    const isMobile = window.innerWidth < 768

    // BC we change them more often than react do re-render
    let scaleFactor = scale
    let iX = 0,
      iY = 0 // initial mouse position

    // Pan
    const handleInteractionEnd = () => (clicked = false)
    const handleInteractionStart = (e: MouseEvent | TouchEvent) => {
      const event = e instanceof MouseEvent ? e : e.touches[0]!

      clicked = true
      iX = event.clientX
      iY = event.clientY
    }
    const handleInteractionMove = (e: MouseEvent | TouchEvent) => {
      if (!clicked) return

      const event = e instanceof MouseEvent ? e : e.touches[0]!
      const { clientX: x, clientY: y } = event
      const dX = x - iX // Delta X
      const dY = y - iY // Delta Y

      // Update initial mouse position
      iX = x
      iY = y

      // Apply the translation & divide by the scale factor to keep the translation constant
      setPosition(({ x, y }) => ({
        x: x + dX / scaleFactor,
        y: y + dY / scaleFactor,
      }))
    }

    // Zoom
    const handleWheel = (e: WheelEvent) => {
      setScale(scale => {
        // Calculate the new scale and clamp it
        const NEW = Math.max(0.8, Math.min(20, scale - e.deltaY / 100))
        scaleFactor = NEW // Store a local copy of the new scale

        // Calculate the current center of the canvas based on the mouse position
        const centerX = e.clientX / scale
        const centerY = e.clientY / scale

        // Calculate the new center of the canvas after scaling
        const newCenterX = e.clientX / NEW
        const newCenterY = e.clientY / NEW

        // Calculate the translation required to keep the mouse position centered
        const dX = newCenterX - centerX
        const dY = newCenterY - centerY

        // Apply the translation
        setPosition(({ x, y }) => ({ x: x + dX, y: y + dY }))

        // Return the new scale
        return NEW
      })
    }

    if (isMobile) {
      // Pan - Mobile
      canvas.addEventListener("touchstart", handleInteractionStart)
      canvas.addEventListener("touchmove", handleInteractionMove)
      canvas.addEventListener("touchend", handleInteractionEnd)
    } else {
      // Pan - Desktop
      canvas.addEventListener("mousedown", handleInteractionStart)
      canvas.addEventListener("mousemove", handleInteractionMove)
      canvas.addEventListener("mouseup", handleInteractionEnd)

      // Zoom
      document.addEventListener("wheel", handleWheel)
    }

    return () => {
      if (isMobile) {
        // Pan - Mobile
        canvas.removeEventListener("touchstart", handleInteractionStart)
        canvas.removeEventListener("touchmove", handleInteractionMove)
        canvas.removeEventListener("touchend", handleInteractionEnd)
      } else {
        // Pan - Desktop
        canvas.removeEventListener("mousedown", handleInteractionStart)
        canvas.removeEventListener("mousemove", handleInteractionMove)
        canvas.removeEventListener("mouseup", handleInteractionEnd)

        // Zoom
        document.removeEventListener("wheel", handleWheel)
      }
    }
  }, [])

  return (
    <div className="touch-none select-none border border-zinc-700">
      <canvas
        ref={ref}
        width={SIZE * SCALE}
        height={SIZE * SCALE}
        style={{
          position: "fixed",
          willChange: "transform",
          imageRendering: "pixelated",
          transformOrigin: "top left",
          transform: `scale(${scale}) translate3d(${position.x}px, ${position.y}px, 0)`,
        }}
      />
    </div>
  )
}
