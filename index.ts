import { helpersCache, Model, ModelerParserOptions } from './src/parser';
import { getMarkers } from '@wssz/modeler';

export { Parse, ItemsParse } from './src/decorators';
export * from '@wssz/modeler';
export { ModelerParserOptions } from './src/parser';

const parserCache = new Map<any, Function>();
export class ModelerParser {
	static parse(model: Function, source: Object, options: ModelerParserOptions = {}) {
		if (!parserCache.has(model)) {
			parserCache.set(model, new Model(model, getMarkers(model), options).execute());
		}

		return parserCache.get(model)(source, model, helpersCache, ModelerParser.parse);
	}
}