import { parse } from './src/parser';
export { Parse, ItemsParse } from './src/decorators';

export class ModelerParse {
	static parse(model: any, source: any) {
		return parse(model, source);
	}
}