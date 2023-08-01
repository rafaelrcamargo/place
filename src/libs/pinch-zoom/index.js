import { buildElement, isCloseTo, isTouchDevice, sum } from "./utils"

const definePinchZoom = function() {
  const PinchZoom = function(el, options) {
    this.el = el
    this.zoomFactor = 1
    this.lastScale = 1
    this.offset = { x: 0, y: 0 }
    this.initialOffset = { x: 0, y: 0 }
    this.options = Object.assign({}, this.defaults, options)
    this.setupMarkup()
    this.bindEvents()
    this.update()

    this.updateAspectRatio()
    this.setupOffsets()

    this.enable()
  }

  PinchZoom.prototype = {
    defaults: {
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
      onZoomStart: null,
      onZoomEnd: null,
      onZoomUpdate: null,
      onDragStart: null,
      onDragEnd: null,
      onDragUpdate: null,
      onDoubleTap: null,
      onMouseWheel: null
    },

    /**
     * Event handler for 'dragstart'
     * @param event
     */
    handleDragStart: function(event) {
      if (typeof this.options.onDragStart == "function")
        this.options.onDragStart(this, event)

      this.stopAnimation()
      this.lastDragPosition = false
      this.hasInteraction = true
      this.handleDrag(event)
    },

    /**
     * Event handler for 'drag'
     * @param event
     */
    handleDrag: function(event) {
      let touch =
        event.type === "touchmove"
          ? this.getTouches(event)[0]
          : this.getPointer(event)

      this.drag(touch, this.lastDragPosition)
      this.offset = this.sanitizeOffset(this.offset)
      this.lastDragPosition = touch
    },

    handleDragEnd: function() {
      if (typeof this.options.onDragEnd == "function")
        this.options.onDragEnd(this, event)

      this.end()
    },

    /**
     * Event handler for 'zoomstart'
     * @param event
     */
    handleZoomStart: function(event) {
      if (typeof this.options.onZoomStart == "function")
        this.options.onZoomStart(this, event)

      this.stopAnimation()
      this.lastScale = 1
      this.nthZoom = 0
      this.lastZoomCenter = false
      this.hasInteraction = true
    },

    /**
     * Event handler for 'zoom'
     * @param event
     */
    handleZoom: function(event, newScale) {
      // a relative scale factor is used
      let touchCenter = this.getTouchCenter(this.getTouches(event)),
        scale = newScale / this.lastScale
      this.lastScale = newScale

      // the first touch events are thrown away since they are not precise
      this.nthZoom += 1
      if (this.nthZoom > 3) {
        this.scale(scale, touchCenter)
        this.drag(touchCenter, this.lastZoomCenter)
      }
      this.lastZoomCenter = touchCenter
    },

    handleZoomEnd: function() {
      if (typeof this.options.onZoomEnd == "function")
        this.options.onZoomEnd(this, event)

      this.end()
    },

    /**
     * Event handler for 'doubletap'
     * @param event
     */
    handleDoubleTap: function(event) {
      let center = this.getTouches(event)[0],
        zoomFactor = this.zoomFactor > 1 ? 1 : this.options.tapZoomFactor,
        startZoomFactor = this.zoomFactor,
        updateProgress = function(progress) {
          this.scaleTo(
            startZoomFactor + progress * (zoomFactor - startZoomFactor),
            center
          )
        }.bind(this)

      if (this.hasInteraction) {
        return
      }

      this.isDoubleTap = true

      if (startZoomFactor > zoomFactor) {
        center = this.getCurrentZoomCenter()
      }

      this.animate(this.options.animationDuration, updateProgress, this.swing)

      if (typeof this.options.onDoubleTap == "function") {
        this.options.onDoubleTap(this, event)
      }
    },

    /**
     * Event handler for 'mousewheel'
     * @param event
     */
    handleMouseWheel: function(event) {
      let center = this.getPointer(event),
        newScale = Math.max(
          this.options.minZoom,
          Math.min(this.options.maxZoom, this.lastScale - event.deltaY / 100)
        ),
        scale = newScale / this.lastScale

      this.scale(scale, center)

      this.lastScale = newScale
      this.update()

      if (typeof this.options.onMouseWheel == "function") {
        this.options.onMouseWheel(this, event)
      }
    },

    /**
     * Compute the initial offset
     *
     * the element should be centered in the container upon initialization
     */
    computeInitialOffset: function() {
      this.initialOffset = {
        x:
          -Math.abs(
            this.el.offsetWidth * this.getInitialZoomFactor() -
              this.container.offsetWidth
          ) / 2,
        y:
          -Math.abs(
            this.el.offsetHeight * this.getInitialZoomFactor() -
              this.container.offsetHeight
          ) / 2
      }
    },

    /**
     * Reset current image offset to that of the initial offset
     */
    resetOffset: function() {
      this.offset.x = this.initialOffset.x
      this.offset.y = this.initialOffset.y
    },

    setupOffsets: function() {
      if (this.options.setOffsetsOnce && this._isOffsetsSet) {
        return
      }

      this._isOffsetsSet = true

      this.computeInitialOffset()
      this.resetOffset()
    },

    /**
     * Max / min values for the offset
     * @param offset
     * @return {Object} the sanitized offset
     */
    sanitizeOffset: function(offset) {
      let elWidth =
        this.el.offsetWidth * this.getInitialZoomFactor() * this.zoomFactor
      let elHeight =
        this.el.offsetHeight * this.getInitialZoomFactor() * this.zoomFactor
      let maxX =
          elWidth - this.getContainerX() + this.options.horizontalPadding,
        maxY = elHeight - this.getContainerY() + this.options.verticalPadding,
        maxOffsetX = Math.max(maxX, 0),
        maxOffsetY = Math.max(maxY, 0),
        minOffsetX = Math.min(maxX, 0) - this.options.horizontalPadding,
        minOffsetY = Math.min(maxY, 0) - this.options.verticalPadding

      return {
        x: Math.min(Math.max(offset.x, minOffsetX), maxOffsetX),
        y: Math.min(Math.max(offset.y, minOffsetY), maxOffsetY)
      }
    },

    /**
     * Scale to a specific zoom factor (not relative)
     * @param zoomFactor
     * @param center
     */
    scaleTo: function(zoomFactor, center) {
      this.scale(zoomFactor / this.zoomFactor, center)
    },

    /**
     * Scales the element from specified center
     * @param scale
     * @param center
     */
    scale: function(scale, center) {
      scale = this.scaleZoomFactor(scale)
      this.addOffset({
        x: (scale - 1) * (center.x + this.offset.x),
        y: (scale - 1) * (center.y + this.offset.y)
      })
      if (typeof this.options.onZoomUpdate == "function") {
        this.options.onZoomUpdate(this, event)
      }
    },

    /**
     * Scales the zoom factor relative to current state
     * @param scale
     * @return the actual scale (can differ because of max min zoom factor)
     */
    scaleZoomFactor: function(scale) {
      let originalZoomFactor = this.zoomFactor
      this.zoomFactor *= scale
      this.zoomFactor = Math.min(
        this.options.maxZoom,
        Math.max(this.zoomFactor, this.options.minZoom)
      )
      return this.zoomFactor / originalZoomFactor
    },

    /**
     * Determine if the image is in a draggable state
     *
     * When the image can be dragged, the drag event is acted upon and cancelled.
     * When not draggable, the drag event bubbles through this component.
     *
     * @return {Boolean}
     */
    canDrag: function() {
      return this.options.draggableUnzoomed || !isCloseTo(this.zoomFactor, 1)
    },

    /**
     * Drags the element
     * @param center
     * @param lastCenter
     */
    drag: function(center, lastCenter) {
      if (lastCenter) {
        if (this.options.lockDragAxis) {
          // lock scroll to position that was changed the most
          if (
            Math.abs(center.x - lastCenter.x) >
            Math.abs(center.y - lastCenter.y)
          ) {
            this.addOffset({
              x: -(center.x - lastCenter.x),
              y: 0
            })
          } else {
            this.addOffset({
              y: -(center.y - lastCenter.y),
              x: 0
            })
          }
        } else {
          this.addOffset({
            y: -(center.y - lastCenter.y),
            x: -(center.x - lastCenter.x)
          })
        }
        if (typeof this.options.onDragUpdate == "function") {
          this.options.onDragUpdate(this, event)
        }
      }
    },

    /**
     * Calculates the touch center of multiple touches
     * @param touches
     * @return {Object}
     */
    getTouchCenter: function(touches) {
      return this.getVectorAvg(touches)
    },

    /**
     * Calculates the average of multiple vectors (x, y values)
     */
    getVectorAvg: function(vectors) {
      return {
        x:
          vectors
            .map(function(v) {
              return v.x
            })
            .reduce(sum) / vectors.length,
        y:
          vectors
            .map(function(v) {
              return v.y
            })
            .reduce(sum) / vectors.length
      }
    },

    /**
     * Adds an offset
     * @param offset the offset to add
     * @return return true when the offset change was accepted
     */
    addOffset: function(offset) {
      this.offset = {
        x: this.offset.x + offset.x,
        y: this.offset.y + offset.y
      }
    },

    sanitize: function() {
      if (this.zoomFactor < this.options.zoomOutFactor) {
        this.zoomOutAnimation()
      } else if (this.isInsaneOffset(this.offset)) {
        this.sanitizeOffsetAnimation()
      }
    },

    /**
     * Checks if the offset is ok with the current zoom factor
     * @param offset
     * @return {Boolean}
     */
    isInsaneOffset: function(offset) {
      let sanitizedOffset = this.sanitizeOffset(offset)
      return sanitizedOffset.x !== offset.x || sanitizedOffset.y !== offset.y
    },

    /**
     * Creates an animation moving to a sane offset
     */
    sanitizeOffsetAnimation: function() {
      let targetOffset = this.sanitizeOffset(this.offset),
        startOffset = {
          x: this.offset.x,
          y: this.offset.y
        },
        updateProgress = function(progress) {
          this.offset.x =
            startOffset.x + progress * (targetOffset.x - startOffset.x)
          this.offset.y =
            startOffset.y + progress * (targetOffset.y - startOffset.y)
          this.update()
        }.bind(this)

      this.animate(this.options.animationDuration, updateProgress, this.swing)
    },

    /**
     * Zooms back to the original position,
     * (no offset and zoom factor 1)
     */
    zoomOutAnimation: function() {
      if (this.zoomFactor === 1) {
        return
      }

      let startZoomFactor = this.zoomFactor,
        zoomFactor = 1,
        center = this.getCurrentZoomCenter(),
        updateProgress = function(progress) {
          this.scaleTo(
            startZoomFactor + progress * (zoomFactor - startZoomFactor),
            center
          )
        }.bind(this)

      this.animate(this.options.animationDuration, updateProgress, this.swing)
    },

    /**
     * Updates the container aspect ratio
     *
     * Any previous container height must be cleared before re-measuring the
     * parent height, since it depends implicitly on the height of any of its children
     */
    updateAspectRatio: function() {
      this.unsetContainerY()
      this.setContainerY(this.container.parentElement.offsetHeight)
    },

    /**
     * Calculates the initial zoom factor (for the element to fit into the container)
     * @return {number} the initial zoom factor
     */
    getInitialZoomFactor: function() {
      let xZoomFactor = this.container.offsetWidth / this.el.offsetWidth
      let yZoomFactor = this.container.offsetHeight / this.el.offsetHeight

      return Math.min(xZoomFactor, yZoomFactor)
    },

    /**
     * Calculates the aspect ratio of the element
     * @return the aspect ratio
     */
    getAspectRatio: function() {
      return this.el.offsetWidth / this.el.offsetHeight
    },

    /**
     * Calculates the virtual zoom center for the current offset and zoom factor
     * (used for reverse zoom)
     * @return {Object} the current zoom center
     */
    getCurrentZoomCenter: function() {
      let offsetLeft = this.offset.x - this.initialOffset.x
      let centerX = -1 * this.offset.x - offsetLeft / (1 / this.zoomFactor - 1)

      let offsetTop = this.offset.y - this.initialOffset.y
      let centerY = -1 * this.offset.y - offsetTop / (1 / this.zoomFactor - 1)

      return {
        x: centerX,
        y: centerY
      }
    },

    /**
     * Returns the touches of an event relative to the container offset
     * @param event
     * @return array touches
     */
    getTouches: function(event) {
      if (isTouchDevice()) {
        if (!event.touches || event.touches.length === 0)
          return [
            {
              x: event.pageX,
              y: event.pageY
            }
          ]

        let rect = this.container.getBoundingClientRect()
        let scrollTop =
          document.documentElement.scrollTop || document.body.scrollTop
        let scrollLeft =
          document.documentElement.scrollLeft || document.body.scrollLeft
        let posTop = rect.top + scrollTop
        let posLeft = rect.left + scrollLeft

        return [
          {
            x: event.touches[0].pageX - posLeft,
            y: event.touches[0].pageY - posTop
          }
        ]
      } else {
        return [{ x: event.clientX, y: event.clientY }]
      }
    },

    /**
     * Returns the pointer of an event relative to the container offset
     * @param event
     * @return pointer
     */
    getPointer: function(event) {
      let rect = this.container.getBoundingClientRect()
      let scrollTop =
        document.documentElement.scrollTop || document.body.scrollTop
      let scrollLeft =
        document.documentElement.scrollLeft || document.body.scrollLeft
      let posTop = rect.top + scrollTop
      let posLeft = rect.left + scrollLeft

      return {
        x: event.pageX - posLeft,
        y: event.pageY - posTop
      }
    },

    /**
     * Animation loop
     * does not support simultaneous animations
     * @param duration
     * @param framefn
     * @param timefn
     * @param callback
     */
    animate: function(duration, framefn, timefn, callback) {
      let startTime = new Date().getTime(),
        renderFrame = function() {
          if (!this.inAnimation) {
            return
          }
          let frameTime = new Date().getTime() - startTime,
            progress = frameTime / duration
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
        }.bind(this)
      this.inAnimation = true
      requestAnimationFrame(renderFrame)
    },

    /**
     * Stops the animation
     */
    stopAnimation: function() {
      this.inAnimation = false
    },

    /**
     * Swing timing function for animations
     * @param p
     * @return {Number}
     */
    swing: function(p) {
      return -Math.cos(p * Math.PI) / 2 + 0.5
    },

    getContainerX: function() {
      return this.container.offsetWidth
    },

    getContainerY: function() {
      return this.container.offsetHeight
    },

    setContainerY: function(y) {
      return (this.container.style.height = y + "px")
    },

    unsetContainerY: function() {
      this.container.style.height = null
    },

    /**
     * Creates the expected html structure
     */
    setupMarkup: function() {
      this.container = buildElement('<div class="pinch-zoom-container"></div>')
      this.el.parentNode.insertBefore(this.container, this.el)
      this.container.appendChild(this.el)

      this.container.style.overflow = "hidden"
      this.container.style.position = "relative"

      this.el.style.webkitTransformOrigin = "0% 0%"
      this.el.style.mozTransformOrigin = "0% 0%"
      this.el.style.msTransformOrigin = "0% 0%"
      this.el.style.oTransformOrigin = "0% 0%"
      this.el.style.transformOrigin = "0% 0%"

      this.el.style.position = "absolute"
      this.el.style.backfaceVisibility = "hidden"
      this.el.style.willChange = "transform"
    },

    end: function() {
      this.hasInteraction = false
      this.sanitize()
      this.update()
    },

    /**
     * Binds all required event listeners
     */
    bindEvents: function() {
      let self = this
      detectGestures(this.container, this)

      this.resizeHandler = this.update.bind(this)
      window.addEventListener("resize", this.resizeHandler)
      Array.from(this.el.querySelectorAll("img")).forEach(function(imgEl) {
        imgEl.addEventListener("load", self.update.bind(self))
      })

      if (this.el.nodeName === "IMG") {
        this.el.addEventListener("load", this.update.bind(this))
      }
    },

    /**
     * Updates the css values according to the current zoom factor and offset
     */
    update: function(event) {
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

      window.setTimeout(
        function() {
          this.updatePlanned = false

          let zoomFactor = this.getInitialZoomFactor() * this.zoomFactor,
            offsetX = -this.offset.x / zoomFactor,
            offsetY = -this.offset.y / zoomFactor,
            transform3d =
              "scale3d(" +
              zoomFactor +
              ", " +
              zoomFactor +
              ",1) " +
              "translate3d(" +
              offsetX +
              "px," +
              offsetY +
              "px,0px)",
            transform2d =
              "scale(" +
              zoomFactor +
              ", " +
              zoomFactor +
              ") " +
              "translate(" +
              offsetX +
              "px," +
              offsetY +
              "px)",
            removeClone = function() {
              if (this.clone) {
                this.clone.parentNode.removeChild(this.clone)
                delete this.clone
              }
            }.bind(this)

          // Scale 3d and translate3d are faster (at least on ios)
          // but they also reduce the quality.
          // PinchZoom uses the 3d transformations during interactions
          // after interactions it falls back to 2d transformations
          if (!this.options.use2d || this.hasInteraction || this.inAnimation) {
            this.is3d = true
            removeClone()

            this.el.style.webkitTransform = transform3d
            this.el.style.mozTransform = transform2d
            this.el.style.msTransform = transform2d
            this.el.style.oTransform = transform2d
            this.el.style.transform = transform3d
          } else {
            // When changing from 3d to 2d transform webkit has some glitches.
            // To avoid this, a copy of the 3d transformed element is displayed in the
            // foreground while the element is converted from 3d to 2d transform
            if (this.is3d) {
              this.clone = this.el.cloneNode(true)
              this.clone.style.pointerEvents = "none"
              this.container.appendChild(this.clone)
              window.setTimeout(removeClone, 200)
            }

            this.el.style.webkitTransform = transform2d
            this.el.style.mozTransform = transform2d
            this.el.style.msTransform = transform2d
            this.el.style.oTransform = transform2d
            this.el.style.transform = transform2d

            this.is3d = false
          }
        }.bind(this),
        0
      )
    },

    /**
     * Enables event handling for gestures
     */
    enable: function() {
      this.enabled = true
    },

    /**
     * Disables event handling for gestures
     */
    disable: function() {
      this.enabled = false
    },

    /**
     * Unmounts the zooming container and global event listeners
     */
    destroy: function() {
      window.removeEventListener("resize", this.resizeHandler)

      if (this.container) {
        this.container.remove()
        this.container = null
      }
    }
  }

  let detectGestures = function(el, target) {
    let interaction = null,
      fingers = 0,
      lastTouchStart = null,
      startTouches = null,
      setInteraction = function(newInteraction, event) {
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
      },
      updateInteraction = function(event) {
        if (fingers === 2) {
          setInteraction("zoom")
        } else if (fingers === 1 && target.canDrag()) {
          setInteraction("drag", event)
        } else {
          setInteraction(null, event)
        }
      },
      targetTouches = function(touches) {
        return Array.from(touches).map(touch => ({
          x: touch.pageX,
          y: touch.pageY
        }))
      },
      getDistance = function(a, b) {
        let x, y
        x = a.x - b.x
        y = a.y - b.y
        return Math.sqrt(x * x + y * y)
      },
      calculateScale = function(startTouches, endTouches) {
        let startDistance = getDistance(startTouches[0], startTouches[1]),
          endDistance = getDistance(endTouches[0], endTouches[1])
        return endDistance / startDistance
      },
      cancelEvent = function(event) {
        event.stopPropagation()
        event.preventDefault()
      },
      detectDoubleTap = function(event) {
        let time = new Date().getTime()

        if (fingers > 1) {
          lastTouchStart = null
        }

        if (time - lastTouchStart < 300) {
          if (isTouchDevice() === 1) cancelEvent(event)
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
      },
      firstMove = true

    if (isTouchDevice()) {
      el.addEventListener(
        "touchstart",
        event => {
          if (!target.enabled) return

          firstMove = true
          fingers = event.touches.length
          detectDoubleTap(event)
        },
        { passive: false }
      )

      el.addEventListener(
        "touchmove",
        event => {
          if (target.enabled && !target.isDoubleTap) {
            if (firstMove) {
              updateInteraction(event)

              if (interaction) cancelEvent(event)
              startTouches = targetTouches(event.touches)
            } else {
              switch (interaction) {
                case "zoom":
                  if (startTouches.length == 2 && event.touches.length == 2) {
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
        },
        { passive: false }
      )

      el.addEventListener("touchend", function(event) {
        if (!target.enabled) return

        fingers = event.touches.length
        updateInteraction(event)
      })
    } else if (target.options.useMouseWheel) {
      el.addEventListener(
        "mousewheel",
        event => {
          if (!target.enabled) return

          cancelEvent(event)
          target.handleMouseWheel(event)
        },
        { passive: false }
      )

      el.addEventListener(
        "mousedown",
        event => {
          if (!target.enabled) return

          fingers = 1
          firstMove = true
          detectDoubleTap(event)
        },
        { passive: true }
      )

      el.addEventListener(
        "mousemove",
        event => {
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
        },
        { passive: false }
      )

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

  return PinchZoom
}

const PinchZoom = definePinchZoom()
export default PinchZoom
