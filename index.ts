import { parse } from './src/parser';
import { Prop, Items, ArrayItems } from '@wssz/modeler';
export { Parse, ItemsParse } from './src/decorators';

export class ModelerParse {
	static parse(model: any, source: any) {
		return parse(model, source);
	}
}

class OTest {
	@Prop() prop: Date;
}

class Nested extends ArrayItems {
	@Items(Date)
	@Prop() items: Date[];
}

class Test {
	@Items(Nested)
	@Prop() prop: Date[][];
}

console.log(ModelerParse.parse(Test, {prop: []}));