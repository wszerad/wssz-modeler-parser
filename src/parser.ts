import {
	Default,
	hasMarkers,
	Prop,
	Markers,
	getMarkers,
	PropMarkers,
	extractDecoratorMarkers,
	Required
} from '@wssz/modeler';
import { ItemsParse, Parse } from './decorators';

const parserCache = new Map<any, Function>();
const helpersCache: Function[] = [];

export interface ModelerParserOptions {
	development?: boolean
}

export function parse(model: any, source: any, options: ModelerParserOptions = {}) {
	if (!parserCache.has(model)) {
		parserCache.set(model, new Model(model, getMarkers(model), options).execute());
	}

	return parserCache.get(model)(source, model, helpersCache, parse);
}

class Model {
	constructor(
		private modelClass: any,
		private markers: Markers,
		private options: ModelerParserOptions
	) {}

	private keysIterator() {
		const params: Property[] = [];
		for (let [key, keyMarkers] of this.markers.entries()) {
			params.push(new Property(this.modelClass, keyMarkers, key, this.options));
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
		private key: string | number,
		private depth: number,
		private options: ModelerParserOptions
	) {}

	private source(key?: string) {
		return `source['${key || this.key}']`;
	}

	private dest(key?: string) {
		return `obj['${key || this.key}']`;
	}

	private index(level: number) {
		return 'i' + 'i'.repeat(this.depth - level);
	}

	private sourceArray(level: number) {
		return 'a' + 'a'.repeat(this.depth - level);
	}

	private destArray(level: number) {
		return 'c' + 'c'.repeat(this.depth - level);
	}

	private levelRedeclare(level: number) {
		return `
			let ${this.sourceArray(level + 1)} = ${this.sourceArray(level)}[${this.index(level)}];
			let ${this.destArray(level + 1)} = ${this.destArray(level)}[${this.index(level)}] = [];
		`;
	}

	private loopGenerator(depth: number, body: string, source: string, level: number = 0) {
		if (depth < level) {
			return body;
		}


		return `
			for (let ${this.index(level)} = 0; ${this.index(level)} < ${this.sourceArray(level)}.length; ${this.index(level)}++) {
				${(depth === level) ? '' : this.levelRedeclare(level)}
				${this.loopGenerator(depth, body, source,level + 1)}
			}
		`;
	}

	execute(body: string) {
		return `
			{
				let ${this.sourceArray(1)} = ${this.source()};
				let ${this.destArray(1)} = [];
				${this.loopGenerator(this.depth, body, this.source(), 1)}
				${this.dest()} = ${this.destArray(1)};
			}
		`;
	}
}

class Property {
	private discovered;

	constructor(
		private modelClass: any,
		private keyMarkers: PropMarkers,
		private key: string | number,
		private options: ModelerParserOptions
	) {
		const itemParse = this.extractKeyMarkers(ItemsParse);
		const type = this.extractKeyMarkers(Prop);
		const required = this.extractKeyMarkers(Required, true);
		const parse = this.extractKeyMarkers(Parse);
		const isArray = (type === Array || Array.isArray(type));
		const {type: itemType, depth} = this.getArrayDepthAndType(type);
		const def = this.extractKeyMarkers(Default);
		const isDeepArray = isArray && !!itemType;

		this.discovered = {
			def,
			parse,
			itemParse,
			isArray,
			isDeepArray,
			required,
			depth: itemParse ? Math.max(1, depth) : depth,
			type: isArray? itemType : type
		};
	}

	execute() {
		let body;
		if (this.discovered.parse) {
			body = `
				${this.parserExtractor()}
			`;
		} else {
			body = `
				${this.discovered.def ? this.defaultExtractor() : ''}
				${this.discovered.def ? `else {` : ''}
				${this.typeExtractor()}
				${this.discovered.def ? `\n}` : ''}
			`;
		}

		return this.options.development
			? this.errorCatchWrapper(body)
			: body;
	}

	private errorCatchWrapper(body: string) {
		return `
		try {
			${body}
		} catch (e) {
			throw new Error('ModelerParser error at "${this.key}" filed of ${this.modelClass.name} model!\\n'
			+ 'Message: ' + e.message + '\\n'
			+ 'Input: ' + ${this.source()});
		}`;
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

	private source(isArray?: boolean) {
		return isArray
			? `a[i]`
			: `source['${this.key}']`;
	}

	private dest(isArray?: boolean) {
		return isArray
			? `c[i]`
			: `obj['${this.key}']`;
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

	private itemsParseExecutor() {
		const parsePhase = this.param(this.discovered.itemParse) + `(${this.source(true)}, i, '${this.key}', ${this.body()})`;
		return `${this.dest(true)} = ${parsePhase};`;
	}

	private parserExtractor() {
		const parsePhase = this.param(this.discovered.parse) + `(${this.source(false)}, '${this.key}', ${this.body()})`;
		return `${this.dest(false)} = ${parsePhase};`;
	}

	private typeExtractor() {
		let phase;
		const isDeepArray = this.discovered.isDeepArray;

		if (this.discovered.isArray && this.discovered.itemParse) {
			phase = `${this.itemsParseExecutor()};`;
		} else {
			switch (this.discovered.type) {
				case Date:
					phase = `${this.dest(isDeepArray)} = new Date(${this.source(isDeepArray)});`;
					break;
				default:
					if (this.discovered.type && hasMarkers(this.discovered.type)) {
						if (!this.discovered.required) {
							phase = `
								if (${this.source()} !== undefined) {
									${this.dest()} = parse(${this.param(this.discovered.type)}, ${this.source()});
								}
							`;
						} else {
							phase = `${this.dest()} = parse(${this.param(this.discovered.type)}, ${this.source()});`;
						}
					} else {
						phase = `${this.dest(isDeepArray)} = ${this.source(isDeepArray)};`;
					}
			}
		}

		if (isDeepArray || this.discovered.itemParse) {
			if (this.discovered.required) {
				return new ArrayProperty(this.key, this.discovered.depth, this.options).execute(phase);
			} else {
				return `
					if (Array.isArray(${this.source()})) {
						${new ArrayProperty(this.key, this.discovered.depth, this.options).execute(phase)}
					}
				`;
			}
		} else {
			return phase;
		}
	}

	private getArrayDepthAndType(type: any, depth: number = 0) {
		if (type === Array) {
			return {
				depth: 0,
				type: undefined
			};
		} else if (Array.isArray(type)) {
			return this.getArrayDepthAndType(type[0], ++depth);
		}
		return {
			depth,
			type
		};
	}

	private extractKeyMarkers(decorator: Function, value?: any) {
		return extractDecoratorMarkers(this.keyMarkers, decorator, value);
	}
}
