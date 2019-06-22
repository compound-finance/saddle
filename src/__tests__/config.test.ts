import {instantiateConfig} from '../config';


test('tests config', async () => {
  let saddle = require('../../saddle');
  let x = await instantiateConfig(saddle, 'test');

  expect(x).toEqual(5);
});
