import {
    Default,
    extractDecoratorMarkers,
    hasMarkers,
    Items,
    NestedItems,
    Nullable,
    Prop,
    PropMarkers
} from '@wssz/modeler';
import {ItemsParse, Optional, Parse} from './decorators';
import { Comparator, ModelerParserOptions } from './utils';

interface PropertyMarkers {
    type: Object,
    parse: Function,
    items: Object | true,
    nestedItems: any[],
    itemParse: Function,
    def: any,
    optional: boolean,
    nullable: boolean
}

export const helpersCache: Function[] = [];

export class Property {
    private markers: PropertyMarkers;
    private ifChain = 0;

    constructor(
        private modelName: string,
        private key: string,
        keyMarkers: PropMarkers,
        private depth: number | false,
        private options: ModelerParserOptions & {customComparatorsMap: Map<any, Comparator<any>>}
    ) {
        this.markers = {
            type: extractDecoratorMarkers(keyMarkers, Prop),
            parse: extractDecoratorMarkers(keyMarkers, Parse),
            items: extractDecoratorMarkers(keyMarkers, Items),
            nestedItems: extractDecoratorMarkers(keyMarkers, NestedItems),
            itemParse: extractDecoratorMarkers(keyMarkers, ItemsParse),
            def: extractDecoratorMarkers(keyMarkers, Default),
            optional: extractDecoratorMarkers(keyMarkers, Optional),
            nullable: extractDecoratorMarkers(keyMarkers, Nullable),
        }
    }

    get level(): number {
        return Number(this.depth);
    }

    execute() {
        let type;

        if (this.markers.items || this.markers.itemParse) {
            type = Array;
        } else if (this.markers.type === Array && !this.markers.items) {
            type = undefined;
        } else {
            type = this.markers.type;
        }

        let body;
        if (this.markers.parse) {
            body = `
				${this.parserExtractor()}
			`;
        } else {
            body = `
				${this.addChain(this.markers.optional, this.optionalExtractor)}
				${this.addChain(this.markers.def, this.defaultExtractor)}
				${this.addChain(this.markers.nullable, this.nullableExtractor)}
				${this.ifChain ? `else {` : ''}
				${this.typeExtractor(type, this.dest(), this.source())}
				${this.ifChain ? `\n}` : ''}
			`;
        }

        return this.options.development
            ? this.errorCatchWrapper(body)
            : body;
    }

    equal() {
        let type;

        if (this.markers.items || this.markers.itemParse) {
            type = Array;
        } else if (this.markers.type === Array && !this.markers.items) {
            type = undefined;
        } else {
            type = this.markers.type;
        }

        let body = `
                ${this.typeComparator(type, this.dest(), this.source())}
            `;

        return this.options.development
            ? this.errorCatchWrapper(`
                pass = (function compare() {
                    ${body}
                    return true;
                })();
            `)
            : body;
    }

    private addChain(condition: boolean, exec: Function) {
        if (!condition) return '';

        if (!this.ifChain++) {
            return 'if ' + exec.call(this);
        } else {
            return 'else if ' + exec.call(this);
        }
    }

    private errorCatchWrapper(body: string) {
        return `
		try {
			${body}
		} catch (e) {
			throw new Error('ModelerParser error at "${this.key}" of ${this.modelName} model!\\n'
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

    private source(level?: number) {
        if (this.depth === false && level === undefined) {
            return `source['${this.key}']`;
        }

        level = level === undefined ? this.level : level;
        return `a${'a'.repeat(level)}[${this.index(level)}]`;
    }

    private dest(level?: number) {
        if (this.depth === false && level === undefined) {
            return `obj['${this.key}']`;
        }

        level = level === undefined ? this.level : level;
        return `c${'c'.repeat(level)}[${this.index(level)}]`;
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

    private optionalExtractor() {
        return `(!('${this.key}' in source)) {}`;
    }

    private nullableExtractor() {
        return `(${this.source()} === null) {
			${this.dest()} = null;
		}`;
    }

    private defaultExtractor() {
        const defaultPhase = this.param(this.markers.def) + (this.markers.def instanceof Function ? '()' : '');
        return `(${this.source()} === undefined) {
			${this.dest()} = ${defaultPhase};
		}`;
    }

    private parserExtractor() {
        const parsePhase = `${this.param(this.markers.parse)}(${this.source()}, '${this.key}', ${this.body()})`;
        return `${this.dest()} = ${parsePhase};`;
    }

    private itemParserExtractor() {
        const parsePhase = `${this.param(this.markers.itemParse)}(${this.source(this.level)}, ${this.index()}, '${this.key}', ${this.body()})`;
        return `${this.dest(this.level)} = ${parsePhase};`;
    }

    private typeComparator(type: Object, source0: string, source1: string) {
        switch (type) {
            case Date:
                const nullable = `typeof ${source0} !== typeof ${source1} || `;
            	return `if (${nullable}Number(${source0}) !== Number(${source1}))  return false;`;
            case Array:
                return this.arrayComparator();
            case String:
            case Number:
            case Function:
            case undefined:
            case Object:
                return `
                    if (${source0} !== ${source1}) {
                        return false;   
                    }    
                `;
            default:
                if (hasMarkers(type)) {
                    return `
                        if ((!${source0} || !${source1}) && ${source0} !== ${source1}) {
                            return false;
                        }
                        if (!equal(${this.param(type)}, ${source0}, ${source1})) {
                            return false;
                        }
                    `;
                } else {
	                const custom = this.options.customComparatorsMap.get(type);
	                if (custom) {
		                return `if (!${this.param(custom.comparator)}(${source0}, ${source1})) return false;`;
	                }

                    return `
                        if (${source0} !== ${source1}) {
                            return false;   
                        }    
                    `;
                }
        }
    }

    private arrayComparator() {
        let phase = '';
        if (!this.depth) {
            phase += `
                let ${this.arraySource()} = ${this.source()};
                let ${this.arrayDest()} = ${this.dest()};
			`;
        }

        phase += `{`;
        if (this.markers.nullable) {
            phase += `
                let isArrS = Array.isArray(${this.arraySource()});
                let isArrD = Array.isArray(${this.arrayDest()});
                if (isArrS && !isArrD) return false;
                if (!isArrS && isArrD) return false;
            `;
        }
        phase += `
                if (${this.arraySource()}.length !== ${this.arrayDest()}.length) return false;
            }
        `;

        phase += `
			for (let ${this.index()} = 0; ${this.index()} < ${this.arraySource(this.level)}.length; ${this.index()}++) {
		`;

        if (this.markers.nestedItems && this.markers.nestedItems.length > this.depth) {
            phase += `
				let ${this.arraySource(this.level + 1)} = ${this.arraySource(this.level)}[${this.index(this.level)}];
				let ${this.arrayDest(this.level + 1)} = ${this.arrayDest(this.level)}[${this.index(this.level)}];
				${new Property(this.modelName, this.key, this.markers.nestedItems[this.level], this.level + 1, this.options).equal()}
			`;
        } else {
            phase += `
				${this.typeComparator(this.markers.items, this.dest(this.level), this.source(this.level))}
			`;
        }

        phase += `
			}
		`;

        return phase;
    }

    private typeExtractor(type: Object, dest: string, source: string) {
        switch (type) {
            case Date:
                return `${dest} = new Date(${source});`;
            case Array:
                return this.arrayExtractor();
            case String:
            case Number:
            case Function:
            case undefined:
            case Object:
                return `${dest} = ${source};`;
            default:
                if (hasMarkers(type)) {
                    return `${dest} = (${source} !== undefined ? parse(${this.param(type)}, ${source}) : undefined);`;
                } else {
                    return `${dest} = new ${this.param(type)}(${source});`;
                }
        }
    }

    private arrayExtractor() {
        let phase = '';
        if (!this.depth) {
            phase += `
				if (Array.isArray(${this.source()})) {
					let ${this.arraySource()} = ${this.source()};
					let ${this.arrayDest()} = [];
			`;
        }

        phase += `
			for (let ${this.index()} = 0; ${this.index()} < ${this.arraySource(this.level)}.length; ${this.index()}++) {
		`;

        if (this.markers.nestedItems && this.markers.nestedItems.length > this.depth) {
            phase += `
				let ${this.arraySource(this.level + 1)} = ${this.arraySource(this.level)}[${this.index(this.level)}];
				let ${this.arrayDest(this.level + 1)} = ${this.arrayDest(this.level)}[${this.index(this.level)}] = [];
				${new Property(this.modelName, this.key, this.markers.nestedItems[this.level], this.level + 1, this.options).execute()}
			`;
        } else if(this.markers.itemParse) {
            phase += `
				${this.itemParserExtractor()}
			`;
        } else {
            phase += `
				${this.typeExtractor(this.markers.items, this.dest(this.level), this.source(this.level))}
			`;
        }

        phase += `
			}
		`;

        if (!this.depth) {
            phase += `
					${this.dest()} = ${this.arrayDest()};
				}
			`;
        }

        return phase;
    }
}
