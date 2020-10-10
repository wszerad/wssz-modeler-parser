import {Markers} from '@wssz/modeler';
import {codeCleaner, ModelerParserOptions, propertyExtractor} from "./utils";

export class Comparator {
    constructor(
        private name: string,
        private markers: Markers,
        private options: ModelerParserOptions
    ) {}

    private keysIterator() {
        const params = propertyExtractor(this.name, this.markers, this.options);
        return codeCleaner(params.map(property => property.equal()));
    }

    execute() {
        const body = `
            ${this.keysIterator()}
            return true;
		`;
        console.log(body);
        return new Function('source', 'obj', 'constructor', 'params', 'equal', body);
    }
}

