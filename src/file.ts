import * as fs from 'fs';

export async function mkdirp(file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdir(file, { recursive: true }, (err) => {
      if (err && err.code != 'EEXIST')
        return reject(err);
      return resolve();
    });
  });
}

export async function readFile<T>(file: string, def: T, fn: (data: string) => T): Promise<T> {
  return new Promise((resolve, reject) => {
    fs.access(file, fs.constants.F_OK, (err) => {
      if (err) {
        resolve(def);
      } else {
        fs.readFile(file, 'utf8', (err, data) => {
          return err ? reject(err) : resolve(fn(data));
        });
      }
    });
  });
}

export async function writeFile<T>(file: string, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.writeFile(file, data, (err) => {
      return err ? reject(err) : resolve();
    });
  });
}
