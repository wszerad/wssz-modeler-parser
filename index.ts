import { ItemsParse } from './src/decorators';
import { Prop } from '@wssz/modeler';

import { parse } from './src/parser';
export { Parse, ItemsParse } from './src/decorators';

class TestClass {
	@Prop([[String]])
	nested: string[][];
}

const input = JSON.parse(JSON.stringify({
	nested: [['str']]
}));

console.log(parse(TestClass, input));