import {
	Default,
	hasMarkers,
	Prop,
	Markers,
	getMarkers,
	extractDecoratorMarkers,
	Required,
    Items,
    NestedItems
} from '@wssz/modeler';
import { ItemsParse, Parse } from './decorators';

const parserCache = new Map<any, Function>();
const helpersCache: Function[] = [];

interface PropertyMarkers {
	type: Object,
	parse: Function,
	items: Object | true,
	nestedItems: any[],
	itemParse: Function,
	required: boolean,
	def: any
}

export interface ModelerParserOptions {
	development?: boolean
}

export function parse(model: Function, source: Object, options: ModelerParserOptions = {}) {
	if (!parserCache.has(model)) {
		parserCache.set(model, new Model(model, getMarkers(model), options).execute());
	}

	console.log(parserCache.get(model).toString());
	return parserCache.get(model)(source, model, helpersCache, parse);
}

class Model {
	constructor(
		private modelClass: Function,
		private markers: Markers,
		private options: ModelerParserOptions
	) {}

	private keysIterator() {
		const params: Property[] = [];
		for (let [key, keyMarkers] of this.markers.entries()) {
			params.push(new Property(
				this.modelClass.name,
				key as string,
				{
					type: extractDecoratorMarkers(keyMarkers, Prop),
					parse: extractDecoratorMarkers(keyMarkers, Parse),
					items: extractDecoratorMarkers(keyMarkers, Items),
					nestedItems: extractDecoratorMarkers(keyMarkers, NestedItems),
					itemParse: extractDecoratorMarkers(keyMarkers, ItemsParse),
					required: extractDecoratorMarkers(keyMarkers, Required),
					def: extractDecoratorMarkers(keyMarkers, Default)
				},
				0,
				this.options
			));
		}
		return params
			.map(property => property.execute())
			.reduce((lines, phase) => {
				lines.push(...phase.split('\n'));
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
	constructor(
		private modelName: string,
		private key: string,
		private markers: PropertyMarkers,
		private depth: number,
		private options: ModelerParserOptions
	) {}

	execute() {
		let body;
		if (this.markers.parse) {
			body = `
				${this.parserExtractor()}
			`;
		} else {
			body = `
				${this.markers.def ? this.defaultExtractor() : ''}
				${this.markers.def ? `else {` : ''}
				${this.typeExtractor((this.markers.nestedItems.length > this.depth) ? this.markers.type : this.markers.items)}
				${this.markers.def ? `\n}` : ''}
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
			throw new Error('ModelerParser error at "${this.key}" filed of ${this.modelName} model!\\n'
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

	private arraySource(level = this.depth) {
		return `a${'a'.repeat(level)}`;
	}

	private arrayDest(level = this.depth) {
		return `c${'c'.repeat(level)}`;
	}

	private index(level = this.depth) {
		return 'i' + 'i'.repeat(level);
	}

	private defaultExtractor() {
		const defaultPhase = this.param(this.markers.def) + (this.markers.def instanceof Function ? '()' : '');
		return `if (${this.source()} === undefined) {
			${this.dest()} = ${defaultPhase};
		}`;
	}

	private parserExtractor() {
		const param = this.param(this.depth ? this.markers.itemParse : this.markers.parse);
		const index = this.depth ? ' i,' : '';
		const parsePhase = `${param}(${this.source()}, ${index} '${this.key}', ${this.body()})`;
		return `${this.dest()} = ${parsePhase};`;
	}

	private typeExtractor(type: Object, isArray: boolean = false) {
		let phase = '';

		switch (type) {
			case Date:
				phase = `${this.dest(isArray)} = new Date(${this.source(isArray)});`;
				break;
			case Array:
				phase = this.arrayExtractor();
				break;
			default:
				if (hasMarkers(type)) {
					phase = `${this.dest(isArray)} = parse(${this.param(type)}, ${this.source(isArray)});`;
				} else {
					phase = `${this.dest(isArray)} = ${this.source(isArray)};`;
				}
		}

		return phase;
	}

	private arrayExtractor() {
		let phase = '';
		if (!this.depth) {
			phase += `
				let ${this.arraySource()} = ${this.source()};
				let ${this.arrayDest()} = [];
			`;
		}

		phase += `
			for (let ${this.index()} = 0; ${this.index()} < ${this.arraySource()}.length; ${this.index()}++) {
		`;

		if (this.markers.nestedItems.length > this.depth) {
			phase += `
				let ${this.arraySource(this.depth + 1)} = ${this.arraySource(this.depth)}[${this.index(this.depth)}];
				let ${this.arrayDest(this.depth + 1)} = ${this.arrayDest(this.depth)}[${this.index(this.depth)}] = [];
				${new Property(this.modelName, this.key, this.markers.nestedItems[this.depth], this.depth + 1, this.options).execute()}
			`;
		} else {
			phase += `
				${this.typeExtractor(this.markers.items, true)};
			`;
		}

		if (this.markers.itemParse) {
			phase += `
				${this.parserExtractor()};
			`;
		}

		phase += `
			}
		`;

		if (!this.depth) {
			phase += `
				${this.dest()} = ${this.arrayDest()};
			`;
		}

		return phase;
	}
}
