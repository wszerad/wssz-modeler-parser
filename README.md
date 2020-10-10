# @wssz/modeler-parser
Plugin for [@wssz/modeler](https://github.com/wszerad/wssz-modeler), convert raw JSON objects

## Usage

* Object parser
```ts
class NestedNumber extends ArrayItems {         // to handle nested array is needed to provide special class extended with ArrayItems
    @ItemsParse((v) => v * 2) items: number[];
}

class OtherClass {
    @Default('default') pDef: string;           // if field is undefined set to 'default', can be also function
    @Parse((v) => v * 2) pParse: number;        // give full control of parsing
    @ItemsParse((v) => v * 2) pParse: number[]; // give control of parsing for each item
    @Items(NestedNumber) pParse2: number[][];   // for deep array @Prop with array depth is needed
}

class NestedDate extends ArrayItems {
    @Items(Date) items: Date[];
}

class TestClass {
	@Prop() pString: string;                   // just copy prop
	@Prop() pDate: Date;                       // copy prop and cast to Date
	@Prop(OtherClass) pOther: OtherClass;      // copy and assign to new OtherClass instance (argument is required, otherwise just copy raw object)
	@Prop() pArray: string[];                  // copy array
	@Items(Date) pArrayDate: Date[];           // copy array and cast to Dates
	@Items(NestedDate) pArrayDate: Date[][];   // copy array (2d) and cast to Date
}

ModelerParser.parse(TestClass, rawData);
```

## Options
```ts
export interface ModelerParserOptions {
    development?: boolean,
    customComparators?: CustomComparator<any>[]
}
```
* development - turn on to get more accurate error messages
* customComparators - used in `.equal` to define manual comparators
```ts
{
    customComparators: [
        [CustomObject, {comparator: (x, y) => x === y}]
    ]
}
```

## Methods

#### ModelerParser.parse(model, rawData, options)
* force parse data to model (break if model is not valid)

#### ModelerParser.optionalParse(model, rawData, options)
* return rawData back if Model has no decorators otherwise works like `.parse`

#### ModelerParser.equal(model, source0, source1, options)
* deep comparison based on provided model

#### ModelerParser.clearCache()
* clean all cached parsers and comparator

## Supported decorators

#### @Nullable(): Decorator
* let field be null

#### @Prop<ParseFunction>(type?): Decorator
* for arrays with undefined 'type' will use shallow copy
* for 2D+ arrays set type in way like this [[Date]] - 2D, [[[Date]]] - 3D, etc.

#### @Default<ParseFunction>(value: BasicType | BasicFunction): Decorator

```ts
type BasicType = string | number | boolean | RegExp | Object;
type BasicFunction = () => BasicType;
```

## Build-in decorators

#### @Optional(): Decorator
* ignore field if not defined

#### @Parse(parse: ParseFunction): Decorator
* define parse function for field
* other decorators are ignored

```ts
type ParseFunction = (value: any, key: string, body: {[key: string]: any}) => any;
```

#### @ItemsParse(parse: ItemsParseFunction): Decorator
* define parse function for each array item
* for 1D arrays @Prop is optional
 
 ```ts
type ItemsParseFunction = (value: any, index: number, key: string, body: {[key: string]: any}) => any;
```
