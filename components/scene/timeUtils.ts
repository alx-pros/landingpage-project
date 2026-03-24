import * as THREE from "three";
import { sceneConfig } from "./sceneConfig";

const DAY_MS = 86_400_000;
const J1970 = 2_440_588;
const J2000 = 2_451_545;
const OBLIQUITY = THREE.MathUtils.degToRad(23.4397);

export interface SceneLocation {
  latitude: number;
  longitude: number;
}

export interface SunMoonPosition {
  sunElev: number;
  sunAz: number;
  moonElev: number;
  moonAz: number;
}

export interface SceneSnapshot extends SunMoonPosition {
  rayleigh: number;
  turbidity: number;
  mieCoefficient: number;
  mieG: number;
  lightIntensity: number;
  ambientIntensity: number;
  lightColorHex: number;
  waterColorHex: number;
  sunColorHex: number;
  nightFactor: number;
  twilightFactor: number;
  starsOpacity: number;
  moonOpacity: number;
  exposure: number;
  waterDistortionScale: number;
  waterSize: number;
  waterAlpha: number;
  waterTimeScale: number;
  sunReflectionIntensity: number;
  sunCoreScale: number;
  sunHaloScale: number;
  sunHaloOpacity: number;
  sunGlowColorHex: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  bloomSmoothing: number;
  cloudScale: number;
  cloudSpeed: number;
  cloudCoverage: number;
  cloudDensity: number;
  cloudElevation: number;
}

export function getHours(date: Date = new Date()): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3_600;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function wrap360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function mixHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;

  const rr = Math.round(lerp(ar, br, t));
  const rg = Math.round(lerp(ag, bg, t));
  const rb = Math.round(lerp(ab, bb, t));

  return (rr << 16) | (rg << 8) | rb;
}

function blendScalar(
  day: number,
  twilight: number,
  night: number,
  noonFactor: number,
  twilightFactor: number,
  nightFactor: number
): number {
  const daylight = lerp(twilight, day, noonFactor);
  const horizon = lerp(daylight, twilight, twilightFactor);
  return lerp(night, horizon, 1 - nightFactor);
}

function blendHex(
  day: number,
  twilight: number,
  night: number,
  noonFactor: number,
  twilightFactor: number,
  nightFactor: number
): number {
  const daylight = mixHex(twilight, day, noonFactor);
  const horizon = mixHex(daylight, twilight, twilightFactor);
  return mixHex(night, horizon, 1 - nightFactor);
}

function toJulian(date: Date): number {
  return date.valueOf() / DAY_MS - 0.5 + J1970;
}

function toDays(date: Date): number {
  return toJulian(date) - J2000;
}

function rightAscension(lambda: number, beta: number): number {
  return Math.atan2(
    Math.sin(lambda) * Math.cos(OBLIQUITY) - Math.tan(beta) * Math.sin(OBLIQUITY),
    Math.cos(lambda)
  );
}

function declination(lambda: number, beta: number): number {
  return Math.asin(
    Math.sin(beta) * Math.cos(OBLIQUITY) + Math.cos(beta) * Math.sin(OBLIQUITY) * Math.sin(lambda)
  );
}

function solarMeanAnomaly(days: number): number {
  return THREE.MathUtils.degToRad(357.5291 + 0.98560028 * days);
}

function eclipticLongitude(meanAnomaly: number): number {
  const center =
    THREE.MathUtils.degToRad(1.9148) * Math.sin(meanAnomaly) +
    THREE.MathUtils.degToRad(0.02) * Math.sin(2 * meanAnomaly) +
    THREE.MathUtils.degToRad(0.0003) * Math.sin(3 * meanAnomaly);

  const perihelion = THREE.MathUtils.degToRad(102.9372);
  return meanAnomaly + center + perihelion + Math.PI;
}

function siderealTime(days: number, longitudeRad: number): number {
  return THREE.MathUtils.degToRad(280.16 + 360.9856235 * days) - longitudeRad;
}

function getSolarPosition(
  date: Date,
  location: SceneLocation
): { elevation: number; azimuth: number } {
  const longitudeRad = THREE.MathUtils.degToRad(-location.longitude);
  const latitudeRad = THREE.MathUtils.degToRad(location.latitude);
  const days = toDays(date);
  const meanAnomaly = solarMeanAnomaly(days);
  const lambda = eclipticLongitude(meanAnomaly);
  const dec = declination(lambda, 0);
  const ra = rightAscension(lambda, 0);
  const hourAngle = siderealTime(days, longitudeRad) - ra;

  const elevation = Math.asin(
    Math.sin(latitudeRad) * Math.sin(dec) +
      Math.cos(latitudeRad) * Math.cos(dec) * Math.cos(hourAngle)
  );

  const azimuth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(latitudeRad) - Math.tan(dec) * Math.cos(latitudeRad)
  );

  return {
    elevation: THREE.MathUtils.radToDeg(elevation),
    azimuth: wrap360(THREE.MathUtils.radToDeg(azimuth) + 180),
  };
}

function getReferenceSunPosition(hours: number): { elevation: number; azimuth: number } {
  const normalized = wrap360(hours * 15) / 15;

  if (normalized >= 5 && normalized <= 12) {
    const t = (normalized - 5) / 7;
    return {
      elevation: Math.sin(t * Math.PI * 0.5) * 85,
      azimuth: 90 + t * 90,
    };
  }

  if (normalized > 12 && normalized <= 18) {
    const t = (normalized - 12) / 6;
    return {
      elevation: Math.cos(t * Math.PI * 0.5) * 85,
      azimuth: 180 + t * 90,
    };
  }

  if (normalized > 18) {
    const t = (normalized - 18) / 11;
    return {
      elevation: lerp(0, -18, t),
      azimuth: 270 + t * 90,
    };
  }

  const t = normalized / 5;
  return {
    elevation: lerp(-18, 0, t),
    azimuth: t * 90,
  };
}

function getReferenceMoonPosition(hours: number): { elevation: number; azimuth: number } {
  const sunLikeMoon = getReferenceSunPosition((hours + 12) % 24);
  return {
    elevation: clamp(sunLikeMoon.elevation, -12, 68),
    azimuth: sunLikeMoon.azimuth,
  };
}

export function getSceneSnapshot(
  date: Date = new Date(),
  location: SceneLocation | null = null
): SceneSnapshot {
  const hours = getHours(date);
  const sun = location ? getSolarPosition(date, location) : getReferenceSunPosition(hours);
  const moon = getReferenceMoonPosition(hours);

  const twilightFactor = 1 - smoothstep(0, 16, Math.abs(sun.elevation));
  const nightFactor = clamp((-sun.elevation - 2) / 16, 0, 1);
  const noonFactor = smoothstep(12, 75, sun.elevation);

  const rayleigh = blendScalar(
    sceneConfig.sky.dayRayleigh,
    sceneConfig.sky.twilightRayleigh,
    sceneConfig.sky.nightRayleigh,
    noonFactor,
    twilightFactor,
    nightFactor
  );

  const turbidity = blendScalar(
    sceneConfig.sky.dayTurbidity,
    sceneConfig.sky.twilightTurbidity,
    sceneConfig.sky.nightTurbidity,
    noonFactor,
    twilightFactor,
    nightFactor
  );

  const mieCoefficient = blendScalar(
    sceneConfig.sky.dayMieCoefficient,
    sceneConfig.sky.twilightMieCoefficient,
    sceneConfig.sky.nightMieCoefficient,
    noonFactor,
    twilightFactor,
    nightFactor
  );

  const mieG = blendScalar(
    sceneConfig.sky.dayMieDirectionalG,
    sceneConfig.sky.twilightMieDirectionalG,
    sceneConfig.sky.nightMieDirectionalG,
    noonFactor,
    twilightFactor,
    nightFactor
  );

  const lightIntensity = blendScalar(
    sceneConfig.light.dayIntensity,
    sceneConfig.light.twilightIntensity,
    sceneConfig.light.nightIntensity,
    noonFactor,
    twilightFactor,
    nightFactor
  );

  const ambientIntensity = blendScalar(
    sceneConfig.light.dayAmbient,
    sceneConfig.light.twilightAmbient,
    sceneConfig.light.nightAmbient,
    noonFactor,
    twilightFactor,
    nightFactor
  );

  const exposure = blendScalar(
    sceneConfig.exposure.day,
    sceneConfig.exposure.twilight,
    sceneConfig.exposure.night,
    noonFactor,
    twilightFactor,
    nightFactor
  );

  const waterDistortionScale = blendScalar(
    sceneConfig.water.dayDistortionScale,
    sceneConfig.water.twilightDistortionScale,
    sceneConfig.water.nightDistortionScale,
    noonFactor,
    twilightFactor,
    nightFactor
  );

  const waterAlpha = blendScalar(
    sceneConfig.water.dayAlpha,
    sceneConfig.water.twilightAlpha,
    sceneConfig.water.nightAlpha,
    noonFactor,
    twilightFactor,
    nightFactor
  );

  const sunReflectionIntensity = blendScalar(
    sceneConfig.sun.dayReflectionIntensity,
    sceneConfig.sun.twilightReflectionIntensity,
    sceneConfig.sun.nightReflectionIntensity,
    noonFactor,
    twilightFactor,
    nightFactor
  );

  const sunCoreScale = blendScalar(
    sceneConfig.sun.dayCoreScale,
    sceneConfig.sun.twilightCoreScale,
    sceneConfig.sun.nightCoreScale,
    noonFactor,
    twilightFactor,
    nightFactor
  );

  const sunHaloScale = blendScalar(
    sceneConfig.sun.dayHaloScale,
    sceneConfig.sun.twilightHaloScale,
    sceneConfig.sun.nightHaloScale,
    noonFactor,
    twilightFactor,
    nightFactor
  );

  const sunHaloOpacity = blendScalar(
    sceneConfig.sun.dayHaloOpacity,
    sceneConfig.sun.twilightHaloOpacity,
    sceneConfig.sun.nightHaloOpacity,
    noonFactor,
    twilightFactor,
    nightFactor
  );

  const bloomStrength = blendScalar(
    sceneConfig.bloom.dayStrength,
    sceneConfig.bloom.twilightStrength,
    sceneConfig.bloom.nightStrength,
    noonFactor,
    twilightFactor,
    nightFactor
  );

  const bloomRadius = blendScalar(
    sceneConfig.bloom.dayRadius,
    sceneConfig.bloom.twilightRadius,
    sceneConfig.bloom.nightRadius,
    noonFactor,
    twilightFactor,
    nightFactor
  );

  const cloudSpeed = blendScalar(
    sceneConfig.clouds.daySpeed,
    sceneConfig.clouds.twilightSpeed,
    sceneConfig.clouds.nightSpeed,
    noonFactor,
    twilightFactor,
    nightFactor
  );

  const cloudCoverage = blendScalar(
    sceneConfig.clouds.dayCoverage,
    sceneConfig.clouds.twilightCoverage,
    sceneConfig.clouds.nightCoverage,
    noonFactor,
    twilightFactor,
    nightFactor
  );

  const cloudDensity = blendScalar(
    sceneConfig.clouds.dayDensity,
    sceneConfig.clouds.twilightDensity,
    sceneConfig.clouds.nightDensity,
    noonFactor,
    twilightFactor,
    nightFactor
  );

  return {
    sunElev: sun.elevation,
    sunAz: sun.azimuth,
    moonElev: moon.elevation,
    moonAz: moon.azimuth,
    rayleigh,
    turbidity,
    mieCoefficient,
    mieG,
    lightIntensity,
    ambientIntensity,
    lightColorHex: blendHex(
      sceneConfig.colors.lightDay,
      sceneConfig.colors.lightTwilight,
      sceneConfig.colors.lightNight,
      noonFactor,
      twilightFactor,
      nightFactor
    ),
    waterColorHex: blendHex(
      sceneConfig.colors.waterDay,
      sceneConfig.colors.waterTwilight,
      sceneConfig.colors.waterNight,
      noonFactor,
      twilightFactor,
      nightFactor
    ),
    sunColorHex: blendHex(
      sceneConfig.colors.sunDay,
      sceneConfig.colors.sunTwilight,
      sceneConfig.colors.sunNight,
      noonFactor,
      twilightFactor,
      nightFactor
    ),
    nightFactor,
    twilightFactor,
    starsOpacity: clamp(nightFactor * 1.35, 0, 1),
    moonOpacity: clamp(0.15 + nightFactor * 1.1, 0, 1),
    exposure,
    waterDistortionScale,
    waterSize: sceneConfig.water.size,
    waterAlpha,
    waterTimeScale: sceneConfig.water.timeScale,
    sunReflectionIntensity,
    sunCoreScale,
    sunHaloScale,
    sunHaloOpacity,
    sunGlowColorHex: blendHex(
      sceneConfig.colors.sunGlowDay,
      sceneConfig.colors.sunGlowTwilight,
      sceneConfig.colors.sunGlowNight,
      noonFactor,
      twilightFactor,
      nightFactor
    ),
    bloomStrength,
    bloomRadius,
    bloomThreshold: sceneConfig.bloom.threshold,
    bloomSmoothing: sceneConfig.bloom.smoothing,
    cloudScale: sceneConfig.clouds.scale,
    cloudSpeed,
    cloudCoverage,
    cloudDensity,
    cloudElevation: sceneConfig.clouds.elevation,
  };
}

/**
 * Elevation + azimuth (degrees) to a unit Vector3.
 *
 * The incoming azimuth is a real-world bearing where:
 * north = 0, east = 90, south = 180, west = 270.
 * We rotate it so sunrise appears on the right and sunset on the left
 * from the default camera framing.
 */
export function vecFromSpherical(
  elevation: number,
  azimuth: number,
  target: THREE.Vector3 = new THREE.Vector3()
): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth - 90);
  return target.setFromSphericalCoords(1, phi, theta);
}
