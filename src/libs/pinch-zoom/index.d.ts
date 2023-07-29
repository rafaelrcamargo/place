type PinchZoomEventHandler = (target: PinchZoom, event: TouchEvent) => void

declare interface IPinchZoomOptions {
  tapZoomFactor?: number
  zoomOutFactor?: number
  animationDuration?: number
  maxZoom?: number
  minZoom?: number
  draggableUnzoomed?: boolean
  lockDragAxis?: boolean
  setOffsetsOnce?: boolean
  use2d?: boolean
  useMouseWheel?: boolean
  verticalPadding?: number
  horizontalPadding?: number

  onZoomStart?: PinchZoomEventHandler
  onZoomEnd?: PinchZoomEventHandler
  onZoomUpdate?: PinchZoomEventHandler
  onDragStart?: PinchZoomEventHandler
  onDragEnd?: PinchZoomEventHandler
  onDragUpdate?: PinchZoomEventHandler
  onDoubleTap?: PinchZoomEventHandler
}

declare class PinchZoom {
  constructor(element: HTMLElement, options?: IPinchZoomOptions)
  public enable(): void
  public disable(): void
  public destroy(): void
}

export default PinchZoom
