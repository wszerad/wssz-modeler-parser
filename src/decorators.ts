import { defineMarker } from '@wssz/modeler';

type ParseFunction = (value: any, key: string, body: {[key: string]: any}) => any;
type ItemsParseFunction = (value: any, index: number, key: string, body: {[key: string]: any}) => any;

export const Parse = defineMarker<ParseFunction>();
export const ItemsParse = defineMarker<ItemsParseFunction>();
export const Optional = defineMarker<boolean>(true);
