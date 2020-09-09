import fs from 'fs';
import os from 'os';

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

export function resolvePath(path: string, home: string = os.homedir()): string {
  if (home)
    return path.replace(/^~(?=$|\/|\\)/, home)
  return path;
}

export async function readFile(path: string, options: object | string): Promise<string> {
  return new Promise(
    (okay, fail) => {
      fs.readFile(resolvePath(path), options, (err, data) => {
        if (err)
          return fail(err);
        if (data instanceof Buffer)
          return okay(data.toString());
        return okay(data);
      })
    });
}

export function describeProvider(provider): string {
  if (!provider) {
    return "no provider";
  } else if (provider && provider.hasOwnProperty('host')) {
    return provider['host'];
  } else {
    return provider.engine ? provider.engine.constructor.name : 'unknown provider';
  }
}

export function isValidJSONString(str) {
  try {
    let res = JSON.parse(str);

    return typeof(res) !== 'number';
  } catch (e) {
    return false;
  }

  return true;
}
