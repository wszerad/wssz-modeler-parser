import {
	Default,
	hasMarkers,
	Prop,
	Markers,
	getMarkers,
	extractDecoratorMarkers,
	Required,
	Items,
	NestedItems, PropMarkers
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
		const markers = this.markers || new Map();
		for (let [key, keyMarkers] of markers.entries()) {
			params.push(new Property(
				this.modelClass.name,
				key as string,
				keyMarkers,
				false,
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

class Property {
	private markers: PropertyMarkers;

	constructor(
		private modelName: string,
		private key: string,
		keyMarkers: PropMarkers,
		private depth: number | false,
		private options: ModelerParserOptions
	) {
		this.markers = {
			type: extractDecoratorMarkers(keyMarkers, Prop),
			parse: extractDecoratorMarkers(keyMarkers, Parse),
			items: extractDecoratorMarkers(keyMarkers, Items),
			nestedItems: extractDecoratorMarkers(keyMarkers, NestedItems),
			itemParse: extractDecoratorMarkers(keyMarkers, ItemsParse),
			required: extractDecoratorMarkers(keyMarkers, Required),
			def: extractDecoratorMarkers(keyMarkers, Default)
		}
	}

	get isArray(): boolean {
		return this.depth !== false;
	}

	get level(): number {
		return Number(this.depth);
	}

	execute() {
		// cast array to simple type if there is no declared
		const type = (this.markers.type === Array && !this.markers.items) ? undefined : this.markers.type;

		let body;
		if (this.markers.parse) {
			body = `
				${this.parserExtractor()}
			`;
		} else {
			body = `
				${this.markers.def ? this.defaultExtractor() : ''}
				${this.markers.def ? `else {` : ''}
				${this.typeExtractor(type)}
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

	private source(level: number = this.level) {
		return (this.isArray)
			? `a${'a'.repeat(level)}[${this.index(level)}]`
			: `source['${this.key}']`;
	}

	private dest(level: number = this.level) {
		return (this.isArray)
			? `c${'c'.repeat(level)}[${this.index(level)}]`
			: `obj['${this.key}']`;
	}

	private arraySource(level: number = this.level) {
		return `a${'a'.repeat(level)}`;
	}

	private arrayDest(level: number = this.level) {
		return `c${'c'.repeat(level)}`;
	}

	private index(level = this.level) {
		return 'i' + 'i'.repeat(level);
	}

	private defaultExtractor() {
		const defaultPhase = this.param(this.markers.def) + (this.markers.def instanceof Function ? '()' : '');
		return `if (${this.source()} === undefined) {
			${this.dest()} = ${defaultPhase};
		}`;
	}

	private parserExtractor() {
		const parsePhase = `${this.param(this.markers.parse)}(${this.source()} '${this.key}', ${this.body()})`;
		return `${this.dest()} = ${parsePhase};`;
	}

	private itemParserExtractor() {
		const parsePhase = `${this.param(this.markers.itemParse)}(${this.source()}, ${this.index()} '${this.key}', ${this.body()})`;
		return `${this.dest()} = ${parsePhase};`;
	}

	private typeExtractor(type: Object) {
		const dest = this.dest();
		const source = this.source();

		switch (type) {
			case Date:
				return `${dest} = new Date(${source});`;
			case Array:
				return this.arrayExtractor();
			default:
				if (hasMarkers(type)) {
					return `${dest} = parse(${this.param(type)}, ${source});`;
				} else {
					return `${dest} = ${source};`;
				}
		}
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
			for (let ${this.index()} = 0; ${this.index()} < ${this.arraySource(this.level)}.length; ${this.index()}++) {
		`;

		if (this.markers.nestedItems.length > this.depth) {
			phase += `
				let ${this.arraySource(this.level + 1)} = ${this.arraySource(this.level)}[${this.index(this.level)}];
				let ${this.arrayDest(this.level + 1)} = ${this.arrayDest(this.level)}[${this.index(this.level)}] = [];
				${new Property(this.modelName, this.key, this.markers.nestedItems[this.level], this.level + 1, this.options).execute()}
			`;
		} else if(this.markers.itemParse) {
			phase += `
				${this.itemParserExtractor()};
			`;
		} else {
			phase += `
				${this.typeExtractor(this.markers.items)}
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
