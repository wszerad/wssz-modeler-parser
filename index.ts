import { Parser} from './src/Parser';
import { Comparator } from './src/comparator';
import { getMarkers, hasMarkers } from '@wssz/modeler';
import {helpersCache} from "./src/Property";
import {ModelerParserOptions} from "./src/utils";

export { Parse, ItemsParse, Optional } from './src/decorators';

const parserCache = new Map<Function, Function>();
const equalCache = new Map<Function, Function>();

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
			parserCache.set(model, new Parser(name, getMarkers(model), options).execute());
		}

		return parserCache.get(model)(source, model, helpersCache, ModelerParser.parse);
	}

	static equal(model: Function, source0: Object, source1: Object, options: ModelerParserOptions = {}): boolean {
		if (source0 === source1) {
			return true;
		}

		const name = typeof model === 'string' ? model : model.name;

		if (!equalCache.has(model)) {
			equalCache.set(model, new Comparator(name, getMarkers(model), options).execute());
		}

		return equalCache.get(model)(source0, source1, model, helpersCache, ModelerParser.equal);
	}

	static clearCache() {
		parserCache.clear();
		equalCache.clear();
		helpersCache.length = 0;
	}
}
export {ModelerParserOptions} from "./src/utils";