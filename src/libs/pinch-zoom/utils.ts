/**
 * Sums two numbers
 * @param a number
 * @param b number
 * @returns number
 */
export const sum = (a: number, b: number) => a + b

/**
 * Checks if the device supports touch events
 * @returns boolean
 */
export const isTouchDevice = () =>
  "ontouchstart" in window || window.matchMedia("(pointer: coarse)").matches

/**
 * Builds the markup for the pinch zoom container
 * @param str string
 * @returns Element | null
 */
export const buildElement = function (str: string): Element | null {
  const template = document.createElement("template")
  template.innerHTML = str.trim()

  return template.content.firstChild as Element | null
}

/**
 * Checks if the value is close to the expected value
 * @param value number
 * @param expected number
 * @returns boolean
 */
export const isCloseTo = (value: number, expected: number) =>
  value > expected - 0.01 && value < expected + 0.01
