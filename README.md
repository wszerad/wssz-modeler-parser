# @wssz/modeler-parser
Plugin for [@wssz/modeler](https://github.com/wszerad/wssz-modeler), convert raw JSON objects

## Usage

* Object parser
```ts
class OtherClass {
    @Default('default') pDef: string;           // if field is undefined set to 'default', can be also function
    @Parse((v) => v * 2) pParse: number;        // give full control of parsing
    @ParseItem((v) => v * 2) pParse: number[];  // give control of parsing for each item
    @Prop([[]])
    @ParseItem((v) => v * 2)
    pParse2: number[][];                        // for deep array @Prop with array depth is needed
}

class TestClass {
	@Prop() pString: string;                // just copy prop
	@Prop() pDate: Date;                    // copy prop and cast to Date
	@Prop(OtherClass) pOther: OtherClass;   // copy and assign to new OtherClass instance (argument is required, otherwise just copy raw object)
	@Prop() pArray: string[]:               // copy array
	@Prop([Date]) pArrayDate: Date[];       // copy array and cast to Date
	@Prop([[Date]]) pArrayDate@D: Date[][]; // copy array (2d) and cast to Date, 3d - ([[[Date]]]), etc.
}

ModelerParser.parse(TestClass, rawData);
```

## Methods

#### ModelerParser.parse(model, rawData)
* force parse data to model (break if model is not valid)

#### ModelerParser.optionalParse(model, rawData)
* pass data without any change if there is no valid model

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
