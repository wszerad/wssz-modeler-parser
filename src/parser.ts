import { Default, hasMarkers, Type, Markers, getMarkers, Items } from '@wssz/modeler';
import { ItemsParse, Parse } from './decorators';

const parserCache = new Map<any, Function>();
const helpersCache: Function[] = [];

export function parse(model: any, source: any) {
	if (!parserCache.has(model)) {
		parserCache.set(model, new Model(model, getMarkers(model)).execute());
	}

	return parserCache.get(model)(source, model, helpersCache, parse);
}

class Model {
	constructor(
		private modelClass: any,
		private markers: Markers
	) {}

	private keysIterator() {
		const params: Property[] = [];
		for (let [key, keyMarkers] of this.markers.entries()) {
			params.push(new Property(this.modelClass, keyMarkers, key));
		}
		return params
			.map(property => property.execute())
			.reduce((lines, pharse) => {
				lines.push(...pharse.split('\n'));
				return lines;
			}, [])
			.filter(p => !!p && !!p.trim())
			.map(p => '\t' + p)
			.join('\n');
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

class ArrayProperty {
	constructor(
		private modelClass: any,
		private keyMarkers: Map<Function, any>,
		private key: string | number
	) {}

	private source(key?: string) {
		return `source['${key || this.key}']`;
	}

	private dest(key?: string) {
		return `obj['${key || this.key}']`;
	}

	private itemsIterator() {
		const param: Property = new Property(this.modelClass, this.keyMarkers, this.key, true);
		return param.execute()
	}

	execute() {
		return `
		{
			let arr = [];
			for (let i = 0; i < ${this.source()}.length; i++) {
				${this.itemsIterator()}
			}
			${this.dest()} = arr;
		}
		`;
	}
}

class Property {
	constructor(
		private modelClass: any,
		private keyMarkers: Map<Function, any>,
		private key: string | number,
		private isArray = false
	) {}

	execute() {
		const def = this.defaultExtractor();
		const parse = this.parserExtractor();
		const type = this.typeExtractor();

		return `
		${parse}
		${parse ? '' : def}
		${def ? `else {` : ''}
		${parse ? '' : type}
		${def ? `\n}` : ''}
		`;
	}

	private asArray() {
		return this.isArray ? `[i]` : '';
	}

	private body() {
		return `source`;
	}

	private param(param: any) {
		const index = helpersCache.indexOf(param);
		if (index === -1) {
			return `params[${helpersCache.push(param) - 1}]`;
		}
		return `params[${index}]`;
	}

	private source(key?: string) {
		return `source['${key || this.key}']${this.asArray()}`;
	}

	private dest(key?: string) {
		return this.isArray ? `arr${this.asArray()}` : `obj['${key || this.key}']`;
	}

	private defaultExtractor() {
		const marker = this.extractKeyMarkers(Default);

		if (marker === undefined) {
			return '';
		}

		const defaultPhase = this.param(marker) + (marker instanceof Function ? '()' : '');
		return `if (${this.source()} === undefined) {
			${this.dest()} = ${defaultPhase};
		}`;
	}

	private parserExtractor() {
		const marker = this.isArray ? this.extractKeyMarkers(ItemsParse) : this.extractKeyMarkers(Parse);

		if (marker === undefined) {
			return '';
		}

		const parsePhase = this.param(marker) + `(${this.source()},${this.isArray ? ` i,` : ''} '${this.key}', ${this.body()})`;
		return `${this.dest()} = ${parsePhase};`;
	}

	private typeExtractor() {
		const arrayMarker = this.extractKeyMarkers(Items);
		const arrayParse = this.extractKeyMarkers(ItemsParse);
		const type = this.extractKeyMarkers(Type) || ((arrayMarker || arrayParse) ? Array : undefined);

		let marker = this.isArray ? arrayMarker : type;
		switch (marker) {
			case Date:
				return `${this.dest()} = new Date(${this.source()});`;
			case Array:
				return `${new ArrayProperty(this.modelClass, this.keyMarkers, this.key).execute()}`;
			default:
				if (marker && hasMarkers(marker)) {
					return `${this.dest()} = parse(${this.param(marker)}, ${this.source()});`;
				}

				return `${this.dest()} = ${this.source()};`;
		}
	}

	private extractKeyMarkers(decorator: Function, value?: any) {
		if (!this.keyMarkers.has(decorator)) {
			return;
		}
		return value !== undefined ? value : this.keyMarkers.get(decorator);
	}
}
