import {Markers} from '@wssz/modeler';
import {Property} from './Property';

export type Comparator<T> = {
    comparator: (x: T, y: T) => boolean;
}

export type CustomComparator<T> = [{ new(...args: any[]): T }, Comparator<T>];

export interface ModelerParserOptions {
    development?: boolean,
    customComparators?: CustomComparator<any>[]
}

export function codeCleaner(params: string[]) {
    return params
        .reduce((lines, phase) => {
            lines.push(...phase.split('\n'));
            return lines;
        }, [])
        .filter(p => !!p && !!p.trim())
        .map(p => '\t' + p)
        .join('\n');
}

export function propertyExtractor(name: string, markers: Markers = new Map(), options: ModelerParserOptions) {
    const params: Property[] = [];
    const parsedOptions = {
        ...options,
        customComparatorsMap: new Map(options.customComparators || [])
    };
    for (let [key, keyMarkers] of markers.entries()) {
        params.push(new Property(
            name,
            key as string,
            keyMarkers,
            false,
	        parsedOptions
        ));
    }
    return params;
}
