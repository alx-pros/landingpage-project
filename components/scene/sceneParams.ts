export interface SceneLocation {
  latitude: number
  longitude: number
}

export const sceneParams = {
  location: null as SceneLocation | null,
  timeOverrideHour: null as number | null,
}

export function setSceneTimeOverride(hour: number | null) {
  sceneParams.timeOverrideHour = hour
}

export function getSceneDate(baseDate: Date = new Date()) {
  if (sceneParams.timeOverrideHour === null) {
    return baseDate
  }

  const date = new Date(baseDate)
  const wholeHours = Math.floor(sceneParams.timeOverrideHour)
  const minutes = Math.round((sceneParams.timeOverrideHour - wholeHours) * 60)

  date.setHours(wholeHours, minutes, 0, 0)
  return date
}
