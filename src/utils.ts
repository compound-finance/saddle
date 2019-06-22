import util from 'util';
import fs from 'fs';

export function arr<T>(v: undefined | T | T[]): T[] {
  if (!v) {
    return [];
  } else if (Array.isArray(v)) {
    return v;
  } else {
    return [v];
  }
}

export function mergeDeep(target, source) {
  const isObject = (obj) => obj && typeof obj === 'object';

  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  Object.keys(source).forEach(key => {
    const targetValue = target[key];
    const sourceValue = source[key];

    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      target[key] = sourceValue; // Always use source key, if given
    } else if (isObject(targetValue) && isObject(sourceValue)) {
      target[key] = mergeDeep(Object.assign({}, targetValue), sourceValue);
    } else {
      target[key] = sourceValue;
    }
  });

  return target;
}

export function tryNumber(n: string | undefined): number | undefined {
  if (n === undefined) {
    return undefined;
  }

  let x = Number(n);
  if (isNaN(x)) {
    return undefined;
  } else {
    return x;
  }
}

export const readFile = util.promisify(fs.readFile);
