# @wssz/modeler-parser
Plugin for @wssz/modeler, convert raw JSON objects

## Usage

* Object parser
```ts
class OtherClass {
    @Type() pDate: Date;
    @Default('default') pDef: string;
}

class TestClass {
	@Type() pDate: Date;
	@Type() pString: string;
	@Type(OtherClass) pOther: OtherClass;
	@Items() pArray: 
}

const input = {
    pDate: '2019-08-31T08:38:07.913Z',
    pString: 'test',
    pOther: {
        pDate: '2019-08-31T08:38:07.913Z'
    }
};

parse(TestClass, input) =>
    // convert string date to Date objects
    // set default values
    // create instances of OtherClass, TestClass
    // assign fields to instances

```

## Supported decorators

#### @Type<ParseFunction>(type?): Decorator

#### @Items<ParseFunction>(type?): Decorator

#### @Default<ParseFunction>(value): Decorator

## Build-in decorators

#### @Parse(parse: ParseFunction): Decorator
* define parse function for field

```ts
type ParseFunction = (value: any, key: string, body: {[key: string]: any}) => any;
```

#### @ItemsParse(parse: ItemsParseFunction): Decorator
* define parse function for each array item
 
 ```ts
type ItemsParseFunction = (value: any, index: number, key: string, body: {[key: string]: any}) => any;
```