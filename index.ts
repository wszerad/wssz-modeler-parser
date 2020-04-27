import { helpersCache, Model, ModelerParserOptions } from './src/parser';
import { getMarkers, hasMarkers } from '@wssz/modeler';

export { Parse, ItemsParse, Optional } from './src/decorators';
export { ModelerParserOptions } from './src/parser';

const parserCache = new Map<Function, Function>();
export class ModelerParser {

	static optionalParse(model: any, source: Object, options: ModelerParserOptions = {}) {
		if (!hasMarkers(model)) {
			return source;
		}

		return ModelerParser.parse(model, source, options);
	}

	static parse(model: Function, source: Object, options: ModelerParserOptions = {}) {
		const name = typeof model === 'string' ? model : model.name;

		if (!parserCache.has(model)) {
			parserCache.set(model, new Model(name, getMarkers(model), options).execute());
		}

		return parserCache.get(model)(source, model, helpersCache, ModelerParser.parse);
	}
}
