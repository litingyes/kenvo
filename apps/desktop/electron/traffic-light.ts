import { isMacOS } from './platform'

export interface TrafficLightInset {
  x: number
  y: number
  width: number
  height: number
  spacing: number
  margin: number
  paddingLeft: number
}

export const HEADER_HEIGHT = 36

const TRAFFIC_LIGHT_X = 12
const TRAFFIC_LIGHT_SIZE = 14
const TRAFFIC_LIGHT_SPACING = 8
const TRAFFIC_LIGHT_MARGIN = 14

export function getTrafficLightPosition(): { x: number; y: number } {
  return {
    x: TRAFFIC_LIGHT_X,
    y: (HEADER_HEIGHT - TRAFFIC_LIGHT_SIZE) / 2,
  }
}

export function getTrafficLightInset(): TrafficLightInset {
  const width = TRAFFIC_LIGHT_SIZE * 3 + TRAFFIC_LIGHT_SPACING * 2

  return {
    x: TRAFFIC_LIGHT_X,
    y: getTrafficLightPosition().y,
    width,
    height: TRAFFIC_LIGHT_SIZE,
    spacing: TRAFFIC_LIGHT_SPACING,
    margin: TRAFFIC_LIGHT_MARGIN,
    paddingLeft: TRAFFIC_LIGHT_X + width + TRAFFIC_LIGHT_MARGIN,
  }
}

export function getMainWindowTrafficLightInset(): TrafficLightInset {
  if (isMacOS()) {
    return getTrafficLightInset()
  }

  return {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    spacing: 0,
    margin: 0,
    paddingLeft: 0,
  }
}
