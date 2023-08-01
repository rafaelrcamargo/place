// @ts-nocheck

import { buildElement, isCloseTo, isTouchDevice } from "./utils"
import { PinchZoomOptions } from "./types"

type Touch = { pageX: number; pageY: number }

class PinchZoom {
  private options: PinchZoomOptions
  private element: HTMLElement
  private container: HTMLElement | null

  private zoomFactor: number
  private lastScale: number
  private offset: { x: number; y: number }
  private initialOffset: { x: number; y: number }

  // For the Drag
  private lastDragPosition?: Touch | PointerEvent
  private hasInteraction: boolean

  // For the Zoom
  private nthZoom: number
  private lastZoomCenter?: Touch | PointerEvent
  private isDoubleTap: boolean

  private static defaults: PinchZoomOptions = {
    tapZoomFactor: 2,
    zoomOutFactor: 1.3,
    animationDuration: 300,
    maxZoom: 4,
    minZoom: 0.5,
    draggableUnzoomed: true,
    lockDragAxis: false,
    setOffsetsOnce: false,
    use2d: true,
    useMouseWheel: false,
    verticalPadding: 0,
    horizontalPadding: 0,
    onZoomStart: undefined,
    onZoomEnd: undefined,
    onZoomUpdate: undefined,
    onDragStart: undefined,
    onDragEnd: undefined,
    onDragUpdate: undefined,
    onDoubleTap: undefined,
  }

  constructor(element: HTMLElement, options: PinchZoomOptions) {
    this.options = { ...PinchZoom.defaults, ...options }
    this.element = element
    this.container = null

    this.zoomFactor = 1
    this.lastScale = 1
    this.offset = { x: 0, y: 0 }
    this.initialOffset = { x: 0, y: 0 }

    this.lastDragPosition = undefined
    this.hasInteraction = false

    this.nthZoom = 0
    this.lastZoomCenter = undefined
    this.isDoubleTap = false

    this.setupMarkup()
    this.bindEvents()
    this.update()

    this.updateAspectRatio()
    this.setupOffsets()

    this.enable()
  }

  private handleDragStart(event: TouchEvent | PointerEvent): void {
    this.stopAnimation()
    this.lastDragPosition = undefined
    this.hasInteraction = true
    this.handleDrag(event)
  }

  private handleDrag(event: TouchEvent | PointerEvent): void {
    const touch = (
      event.type === "touchmove"
        ? this.getTouches(event)[0]
        : this.getPointer(event as PointerEvent)
    )!
    this.drag(touch, this.lastDragPosition)
    this.offset = this.sanitizeOffset(this.offset)
    this.lastDragPosition = touch
  }

  private handleDragEnd(): void {
    this.end()
  }

  private handleZoomStart(event: TouchEvent | PointerEvent): void {
    if (typeof this.options.onZoomStart === "function")
      this.options.onZoomStart(this, event)

    this.stopAnimation()
    this.lastScale = 1
    this.nthZoom = 0
    this.lastZoomCenter = undefined
    this.hasInteraction = true
  }

  private handleZoom(event: TouchEvent | PointerEvent, newScale: number): void {
    // A relative scale factor is used
    const touchCenter = this.getTouchCenter(this.getTouches(event))
    const scale = newScale / this.lastScale
    this.lastScale = newScale

    // The first touch events are thrown away since they are not precise
    this.nthZoom += 1
    if (this.nthZoom > 3) {
      this.scale(scale, touchCenter)
      this.drag(touchCenter, this.lastZoomCenter)
    }
    this.lastZoomCenter = touchCenter
  }

  private handleZoomEnd(event: Event): void {
    if (typeof this.options.onZoomEnd === "function")
      this.options.onZoomEnd(this, event)

    this.end()
  }

  private handleDoubleTap(event: TouchEvent): void {
    let center = this.getTouches(event)[0]
    const zoomFactor = this.zoomFactor > 1 ? 1 : this.options.tapZoomFactor
    const startZoomFactor = this.zoomFactor

    if (this.hasInteraction) {
      return
    }

    this.isDoubleTap = true

    if (startZoomFactor > zoomFactor) {
      center = this.getCurrentZoomCenter()
    }

    const updateProgress = (progress: number) => {
      this.scaleTo(
        startZoomFactor + progress * (zoomFactor - startZoomFactor),
        center
      )
    }

    this.animate(this.options.animationDuration, updateProgress, this.swing)
  }

  private handleMouseWheel(event: WheelEvent): void {
    const center = this.getPointer(event)
    const newScale = Math.max(
      this.options.minZoom,
      Math.min(this.options.maxZoom, this.lastScale - event.deltaY / 100)
    )
    const scale = newScale / this.lastScale

    this.scale(scale, center)

    this.lastScale = newScale
    this.update()

    if (typeof this.options.onMouseWheel === "function") {
      this.options.onMouseWheel(this, event)
    }
  }

  private computeInitialOffset(): void {
    this.initialOffset = {
      x:
        -Math.abs(
          this.element.offsetWidth * this.getInitialZoomFactor() -
            this.container.offsetWidth
        ) / 2,
      y:
        -Math.abs(
          this.element.offsetHeight * this.getInitialZoomFactor() -
            this.container.offsetHeight
        ) / 2,
    }
  }

  private resetOffset(): void {
    this.offset.x = this.initialOffset.x
    this.offset.y = this.initialOffset.y
  }

  private setupOffsets(): void {
    if (this.options.setOffsetsOnce && this._isOffsetsSet) {
      return
    }

    this._isOffsetsSet = true

    this.computeInitialOffset()
    this.resetOffset()
  }

  private sanitizeOffset(offset: { x: number; y: number }): {
    x: number
    y: number
  } {
    const elWidth =
      this.element.offsetWidth * this.getInitialZoomFactor() * this.zoomFactor
    const elHeight =
      this.element.offsetHeight * this.getInitialZoomFactor() * this.zoomFactor
    const maxX = elWidth - this.getContainerX() + this.options.horizontalPadding
    const maxY = elHeight - this.getContainerY() + this.options.verticalPadding
    const maxOffsetX = Math.max(maxX, 0)
    const maxOffsetY = Math.max(maxY, 0)
    const minOffsetX = Math.min(maxX, 0) - this.options.horizontalPadding
    const minOffsetY = Math.min(maxY, 0) - this.options.verticalPadding

    return {
      x: Math.min(Math.max(offset.x, minOffsetX), maxOffsetX),
      y: Math.min(Math.max(offset.y, minOffsetY), maxOffsetY),
    }
  }

  private scaleTo(zoomFactor: number, center: { x: number; y: number }): void {
    this.scale(zoomFactor / this.zoomFactor, center)
  }

  private scale(scale: number, center: { x: number; y: number }): void {
    scale = this.scaleZoomFactor(scale)
    this.addOffset({
      x: (scale - 1) * (center.x + this.offset.x),
      y: (scale - 1) * (center.y + this.offset.y),
    })
    if (typeof this.options.onZoomUpdate === "function") {
      this.options.onZoomUpdate(this, event)
    }
  }

  private scaleZoomFactor(scale: number): number {
    const originalZoomFactor = this.zoomFactor
    this.zoomFactor *= scale
    this.zoomFactor = Math.min(
      this.options.maxZoom,
      Math.max(this.zoomFactor, this.options.minZoom)
    )
    return this.zoomFactor / originalZoomFactor
  }

  private canDrag(): boolean {
    return this.options.draggableUnzoomed || !isCloseTo(this.zoomFactor, 1)
  }

  private drag(
    center: { x: number; y: number },
    lastCenter?: { x: number; y: number }
  ): void {
    if (lastCenter) {
      if (this.options.lockDragAxis) {
        // Lock scroll to position that was changed the most
        if (
          Math.abs(center.x - lastCenter.x) > Math.abs(center.y - lastCenter.y)
        ) {
          this.addOffset({
            x: -(center.x - lastCenter.x),
            y: 0,
          })
        } else {
          this.addOffset({
            y: -(center.y - lastCenter.y),
            x: 0,
          })
        }
      } else {
        this.addOffset({
          y: -(center.y - lastCenter.y),
          x: -(center.x - lastCenter.x),
        })
      }
      if (typeof this.options.onDragUpdate === "function") {
        this.options.onDragUpdate(this, event)
      }
    }
  }

  private getTouchCenter(touches: Touch[]): { x: number; y: number } {
    return this.getVectorAvg(touches)
  }

  private getVectorAvg(vectors: { x: number; y: number }[]): {
    x: number
    y: number
  } {
    const sum = (acc: number, val: number) => acc + val
    return {
      x: vectors.map(v => v.x).reduce(sum) / vectors.length,
      y: vectors.map(v => v.y).reduce(sum) / vectors.length,
    }
  }

  private addOffset(offset: { x: number; y: number }): void {
    this.offset = {
      x: this.offset.x + offset.x,
      y: this.offset.y + offset.y,
    }
  }

  private sanitize(): void {
    if (this.zoomFactor < this.options.zoomOutFactor) {
      this.zoomOutAnimation()
    } else if (this.isInsaneOffset(this.offset)) {
      this.sanitizeOffsetAnimation()
    }
  }

  private isInsaneOffset(offset: { x: number; y: number }): boolean {
    const sanitizedOffset = this.sanitizeOffset(offset)
    return sanitizedOffset.x !== offset.x || sanitizedOffset.y !== offset.y
  }

  private sanitizeOffsetAnimation(): void {
    const targetOffset = this.sanitizeOffset(this.offset)
    const startOffset = {
      x: this.offset.x,
      y: this.offset.y,
    }
    const updateProgress = (progress: number) => {
      this.offset.x =
        startOffset.x + progress * (targetOffset.x - startOffset.x)
      this.offset.y =
        startOffset.y + progress * (targetOffset.y - startOffset.y)
      this.update()
    }

    this.animate(this.options.animationDuration, updateProgress, this.swing)
  }

  private zoomOutAnimation(): void {
    if (this.zoomFactor === 1) {
      return
    }

    const startZoomFactor = this.zoomFactor
    const zoomFactor = 1
    const center = this.getCurrentZoomCenter()
    const updateProgress = (progress: number) => {
      this.scaleTo(
        startZoomFactor + progress * (zoomFactor - startZoomFactor),
        center
      )
    }

    this.animate(this.options.animationDuration, updateProgress, this.swing)
  }

  private updateAspectRatio(): void {
    this.unsetContainerY()
    this.setContainerY(this.container.parentElement.offsetHeight)
  }

  private getInitialZoomFactor(): number {
    const xZoomFactor = this.container.offsetWidth / this.element.offsetWidth
    const yZoomFactor = this.container.offsetHeight / this.element.offsetHeight

    return Math.min(xZoomFactor, yZoomFactor)
  }

  private getCurrentZoomCenter(): { x: number; y: number } {
    const offsetLeft = this.offset.x - this.initialOffset.x
    const centerX = -1 * this.offset.x - offsetLeft / (1 / this.zoomFactor - 1)

    const offsetTop = this.offset.y - this.initialOffset.y
    const centerY = -1 * this.offset.y - offsetTop / (1 / this.zoomFactor - 1)

    return {
      x: centerX,
      y: centerY,
    }
  }

  private getTouches(
    event: TouchEvent | MouseEvent
  ): { x: number; y: number }[] {
    if (isTouchDevice()) {
      if (!event.touches || event.touches.length === 0) {
        return [{ x: event.pageX, y: event.pageY }]
      }

      const rect = this.container.getBoundingClientRect()
      const scrollTop =
        document.documentElement.scrollTop || document.body.scrollTop
      const scrollLeft =
        document.documentElement.scrollLeft || document.body.scrollLeft
      const posTop = rect.top + scrollTop
      const posLeft = rect.left + scrollLeft

      return [
        {
          x: event.touches[0].pageX - posLeft,
          y: event.touches[0].pageY - posTop,
        },
      ]
    } else {
      return [{ x: event.clientX, y: event.clientY }]
    }
  }

  private getPointer(event: PointerEvent): { x: number; y: number } {
    const rect = this.container?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }

    const scrollTop =
      document.documentElement.scrollTop || document.body.scrollTop
    const scrollLeft =
      document.documentElement.scrollLeft || document.body.scrollLeft
    const posTop = rect.top + scrollTop
    const posLeft = rect.left + scrollLeft

    return {
      x: event.pageX - posLeft,
      y: event.pageY - posTop,
    }
  }

  private animate(
    duration: number,
    framefn: (progress: number) => void,
    timefn: (progress: number) => number,
    callback?: () => void
  ): void {
    const startTime = new Date().getTime()
    const renderFrame = () => {
      if (!this.inAnimation) {
        return
      }
      const frameTime = new Date().getTime() - startTime
      let progress = frameTime / duration
      if (frameTime >= duration) {
        framefn(1)
        if (callback) {
          callback()
        }
        this.update()
        this.stopAnimation()
        this.update()
      } else {
        if (timefn) {
          progress = timefn(progress)
        }
        framefn(progress)
        this.update()
        requestAnimationFrame(renderFrame)
      }
    }
    this.inAnimation = true
    requestAnimationFrame(renderFrame)
  }

  private stopAnimation(): void {
    this.inAnimation = false
  }

  private swing(p: number): number {
    return -Math.cos(p * Math.PI) / 2 + 0.5
  }

  private getContainerX(): number {
    return this.container.offsetWidth
  }

  private getContainerY(): number {
    return this.container.offsetHeight
  }

  private setContainerY(y: number): void {
    this.container.style.height = y + "px"
  }

  private unsetContainerY(): void {
    this.container.style.height = null
  }

  private setupMarkup(): void {
    this.container = buildElement('<div class="pinch-zoom-container"></div>')
    this.element.parentNode.insertBefore(this.container, this.element)
    this.container.appendChild(this.element)

    this.container.style.overflow = "hidden"
    this.container.style.position = "relative"

    this.element.style.webkitTransformOrigin = "0% 0%"
    this.element.style.mozTransformOrigin = "0% 0%"
    this.element.style.msTransformOrigin = "0% 0%"
    this.element.style.oTransformOrigin = "0% 0%"
    this.element.style.transformOrigin = "0% 0%"

    this.element.style.position = "absolute"
    this.element.style.backfaceVisibility = "hidden"
    this.element.style.willChange = "transform"
  }

  private end(): void {
    this.hasInteraction = false
    this.sanitize()
    this.update()
  }

  detectGestures = function (el: HTMLElement, target: PinchZoom): void {
    let interaction: string | null = null,
      fingers = 0,
      lastTouchStart: number | null = null,
      startTouches: Touch[] | null = null

    const setInteraction = function (
      newInteraction: string | null,
      event: TouchEvent
    ): void {
      if (interaction !== newInteraction) {
        if (interaction && !newInteraction) {
          switch (interaction) {
            case "zoom":
              target.handleZoomEnd(event)
              break
            case "drag":
              target.handleDragEnd(event)
              break
          }
        }

        switch (newInteraction) {
          case "zoom":
            target.handleZoomStart(event)
            break
          case "drag":
            target.handleDragStart(event)
            break
        }
      }
      interaction = newInteraction
    }

    const updateInteraction = function (event: TouchEvent): void {
      if (fingers === 2) {
        setInteraction("zoom", event)
      } else if (fingers === 1 && target.canDrag()) {
        setInteraction("drag", event)
      } else {
        setInteraction(null, event)
      }
    }

    const targetTouches = function (touches: TouchList) {
      return Array.from(touches).map(touch => ({
        x: touch.pageX,
        y: touch.pageY,
      }))
    }

    const getDistance = function (
      a: { x: number; y: number },
      b: { x: number; y: number }
    ): number {
      let x, y
      x = a.x - b.x
      y = a.y - b.y
      return Math.sqrt(x * x + y * y)
    }

    const calculateScale = function (
      startTouches: Touch[],
      endTouches: Touch[]
    ): number {
      let startDistance = getDistance(startTouches[0], startTouches[1])
      let endDistance = getDistance(endTouches[0], endTouches[1])
      return endDistance / startDistance
    }

    const cancelEvent = function (event: Event): void {
      event.stopPropagation()
      event.preventDefault()
    }

    const detectDoubleTap = function (event: TouchEvent): void {
      let time = new Date().getTime()

      if (fingers > 1) {
        lastTouchStart = null
      }

      if (time - (lastTouchStart || 0) < 300) {
        if (isTouchDevice()) cancelEvent(event)
        target.handleDoubleTap(event)

        switch (interaction) {
          case "zoom":
            target.handleZoomEnd(event)
            break
          case "drag":
            target.handleDragEnd(event)
            break
        }
      } else {
        target.isDoubleTap = false
      }

      if (fingers === 1) {
        lastTouchStart = time
      }
    }

    let firstMove = true

    if (isTouchDevice()) {
      el.addEventListener("touchstart", event => {
        if (!target.enabled) return

        firstMove = true
        fingers = event.touches.length
        detectDoubleTap(event)
      })

      el.addEventListener("touchmove", event => {
        if (target.enabled && !target.isDoubleTap) {
          if (firstMove) {
            updateInteraction(event)

            if (interaction) cancelEvent(event)
            startTouches = targetTouches(event.touches)
          } else {
            switch (interaction) {
              case "zoom":
                if (startTouches?.length === 2 && event.touches.length === 2) {
                  target.handleZoom(
                    event,
                    calculateScale(startTouches, targetTouches(event.touches))
                  )
                }
                break
              case "drag":
                target.handleDrag(event)
                break
            }
            if (interaction) {
              cancelEvent(event)
              target.update()
            }
          }

          firstMove = false
        }
      })

      el.addEventListener("touchend", function (event) {
        if (!target.enabled) return

        fingers = event.touches.length
        updateInteraction(event)
      })
    } else if (target.options.useMouseWheel) {
      el.addEventListener("mousewheel", event => {
        if (!target.enabled) return

        cancelEvent(event)
        target.handleMouseWheel(event)
      })

      el.addEventListener("mousedown", event => {
        if (!target.enabled) return

        fingers = 1
        firstMove = true
        detectDoubleTap(event)
      })

      el.addEventListener("mousemove", event => {
        if (!target.enabled) return

        if (firstMove) {
          updateInteraction(event)
          if (interaction) cancelEvent(event)
        } else {
          if (interaction === "drag") target.handleDrag(event)

          if (interaction) {
            cancelEvent(event)
            target.update()
          }
        }

        firstMove = false
      })

      el.addEventListener(
        "mouseup",
        event => {
          if (!target.enabled) return

          fingers = 0
          updateInteraction(event)
        },
        { passive: true }
      )
    }
  }

  private bindEvents(): void {
    const self = this
    this.detectGestures(this.container, this)

    this.resizeHandler = this.update.bind(this)
    window.addEventListener("resize", this.resizeHandler)
    Array.from(this.element.querySelectorAll("img")).forEach(function (imgEl) {
      imgEl.addEventListener("load", self.update.bind(self))
    })

    if (this.element.nodeName === "IMG") {
      this.element.addEventListener("load", this.update.bind(this))
    }
  }

  private update(event?: Event): void {
    if (event && event.type === "resize") {
      this.updateAspectRatio()
      this.setupOffsets()
    }

    if (event && event.type === "load") {
      this.updateAspectRatio()
      this.setupOffsets()
    }

    if (this.updatePlanned) {
      return
    }
    this.updatePlanned = true

    window.setTimeout(() => {
      this.updatePlanned = false

      const zoomFactor = this.getInitialZoomFactor() * this.zoomFactor
      const offsetX = -this.offset.x / zoomFactor
      const offsetY = -this.offset.y / zoomFactor
      const transform3d = `scale3d(${zoomFactor}, ${zoomFactor}, 1) translate3d(${offsetX}px, ${offsetY}px, 0px)`
      const transform2d = `scale(${zoomFactor}, ${zoomFactor}) translate(${offsetX}px, ${offsetY}px)`

      const removeClone = () => {
        if (this.clone) {
          this.clone.parentNode.removeChild(this.clone)
          delete this.clone
        }
      }

      // Scale 3d and translate3d are faster (at least on ios)
      // but they also reduce the quality.
      // PinchZoom uses the 3d transformations during interactions
      // after interactions it falls back to 2d transformations
      if (!this.options.use2d || this.hasInteraction || this.inAnimation) {
        this.is3d = true
        removeClone()

        this.element.style.webkitTransform = transform3d
        this.element.style.mozTransform = transform2d
        this.element.style.msTransform = transform2d
        this.element.style.oTransform = transform2d
        this.element.style.transform = transform3d
      } else {
        // When changing from 3d to 2d transform webkit has some glitches.
        // To avoid this, a copy of the 3d transformed element is displayed in the
        // foreground while the element is converted from 3d to 2d transform
        if (this.is3d) {
          this.clone = this.element.cloneNode(true) as HTMLElement
          this.clone.style.pointerEvents = "none"
          this.container.appendChild(this.clone)
          window.setTimeout(removeClone, 200)
        }

        this.element.style.webkitTransform = transform2d
        this.element.style.mozTransform = transform2d
        this.element.style.msTransform = transform2d
        this.element.style.oTransform = transform2d
        this.element.style.transform = transform2d

        this.is3d = false
      }
    }, 0)
  }

  enable(): void {
    this.enabled = true
  }

  disable(): void {
    this.enabled = false
  }

  destroy(): void {
    window.removeEventListener("resize", this.resizeHandler)

    if (this.container) {
      this.container.remove()
      this.container = null
    }
  }
}

export default PinchZoom
