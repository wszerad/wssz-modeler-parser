import {Markers} from '@wssz/modeler';
import {codeCleaner, ModelerParserOptions, propertyExtractor} from "./utils";

export class Parser {
	constructor(
		private name: string,
		private markers: Markers,
		private options: ModelerParserOptions
	) {}

	private keysIterator() {
		const params = propertyExtractor(this.name, this.markers, this.options);
		return codeCleaner(params.map(property => property.execute()));
	}

	execute() {
		const body = `
			const obj = new constructor();
			${this.keysIterator()}
			return obj;
		`;
		return new Function('source', 'constructor', 'params', 'parse', body);
	}
}

