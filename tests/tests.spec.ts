import 'mocha';
import 'reflect-metadata';
import { expect } from 'chai';
import { Default, Items, Prop, ArrayItems, Nullable } from '@wssz/modeler';
import {ModelerParser, ModelerParserOptions, Optional} from '../index';
import { ItemsParse, Parse } from '../src/decorators';

class Caster {
	private val: string;

	constructor(props: string) {
		this.val = props + '!';
	}

	get realValue() {
		return this.val;
	}

	toJSON() {
		return this.val.slice(0, -1);
	}
}

class OtherClass {
	@Prop()
	pDate: Date;
}

describe('tests', () => {
	const date = new Date();
	const input = {
		pDate: new Date(date),
		pNullDate: null as Date,
		pString: 'kot',
		pOther: {
			pDate: new Date(date)
		},
		pInvisible: 5,
		pParse: 10,
		pArray: [4],
		pArrayDate: [new Date(date)],
		pArrayParse: [8],
		pNestedArray: [[1, 2]],
		pNestedArrayParse: [[2, 4]],
		pNestedArrayDate: [[new Date(date)]],
		pCaster: new Caster('123')
	};
	const rawInput = JSON.parse(JSON.stringify(input));

	describe('equal', () => {
		it('simple type', () => {
			class SimpleType {
				@Prop() pString: string;
			}

			const other: SimpleType = {
				pString: input.pString
			};
			const otherWrong: SimpleType = {
				pString: input.pString + 'postfix'
			};
			expect(ModelerParser.equal(SimpleType, input, other)).to.be.true;
			expect(ModelerParser.equal(SimpleType, input, otherWrong)).to.be.false;
		});

		it('Data type', () => {
			class DataType {
				@Prop() pDate: Date;
			}

			const other: DataType = {
				pDate: input.pDate
			};
			const otherWrong: DataType = {
				pDate: new Date(input.pDate.getTime() + 1000)
			};
			expect(ModelerParser.equal(DataType, input, other)).to.be.true;
			expect(ModelerParser.equal(DataType, input, otherWrong)).to.be.false;
		});

		it('simple array', () => {
			class SimpleArray {
				@Items(Number) pArray: number[];
			}

			const other: SimpleArray = {
				pArray: input.pArray
			};
			const otherWrong: SimpleArray = {
				pArray: input.pArray.concat(2)
			};
			expect(ModelerParser.equal(SimpleArray, input, other)).to.be.true;
			expect(ModelerParser.equal(SimpleArray, input, otherWrong)).to.be.false;
		});

		it('nested model', () => {
			class NestedModel {
				@Prop() pOther: OtherClass;
			}

			const other: NestedModel = {
				pOther: input.pOther
			};
			const otherWrong: NestedModel = {
				pOther: {
					pDate: new Date(input.pOther.pDate.getTime() + 1000)
				}
			};
			expect(ModelerParser.equal(NestedModel, input, other)).to.be.true;
			expect(ModelerParser.equal(NestedModel, input, otherWrong)).to.be.false;
		});

		it('deep nested array', () => {
			class NestedArray extends ArrayItems {
				@Items(Number) items: number[];
			}

			class DeepNestedArray {
				@Items(NestedArray) pNestedArray: number[][];
			}

			const other: DeepNestedArray = {
				pNestedArray: input.pNestedArray.slice().map(i => i.slice())
			};
			const otherWrong: DeepNestedArray = {
				pNestedArray: [...input.pNestedArray, [0]]
			};
			const otherWrong2: DeepNestedArray = {
				pNestedArray: [[...input.pNestedArray[0], 0]]
			};
			expect(ModelerParser.equal(DeepNestedArray, input, other)).to.be.true;
			expect(ModelerParser.equal(DeepNestedArray, input, otherWrong)).to.be.false;
			expect(ModelerParser.equal(DeepNestedArray, input, otherWrong2)).to.be.false;
		});

		it('custom comparator', () => {
			class Custom {
				@Prop() pCaster: Caster;
			}

			const other: Custom = {
				pCaster: new Caster(input.pCaster.toJSON())
			};
			const otherWrong: Custom = {
				pCaster: new Caster(input.pCaster.toJSON() +  'f')
			};
			const options: ModelerParserOptions = {
				customComparators: [[Caster, {comparator: (x, y) => x.toJSON() === y.toJSON()}]]
			}
			expect(ModelerParser.equal(Custom, input, other)).to.be.true;
			expect(ModelerParser.equal(Custom, input, otherWrong)).to.be.false;
		});
	});

	describe('parser', () => {
		it('should ignore undecorated field', () => {
			class InvisibleType {
				pInvisible: number;
			}

			expect(ModelerParser.parse(InvisibleType, rawInput)).to.eql({});
		});

		it('should copy simple type', () => {
			class SimpleType {
				@Prop() pString: string;
			}

			expect(ModelerParser.parse(SimpleType, rawInput)).to.eql({pString: input.pString});
		});

		it('should cast Date', () => {
			class DateType {
				@Prop() pDate: Date;
			}

			expect(ModelerParser.parse(DateType, rawInput)).to.eql({pDate: input.pDate});
		});

		it('should cast nested object', () => {
			class NestedObjectType {
				@Prop(OtherClass) pOther: OtherClass;
			}

			expect(ModelerParser.parse(NestedObjectType, rawInput)).to.eql({pOther: {pDate: input.pOther.pDate}});
		});

		it('should copy object', () => {
			class ShallowObjectType {
				@Prop(Object) pOther: OtherClass;
			}

			expect(ModelerParser.parse(ShallowObjectType, rawInput)).to.eql({pOther: {pDate: rawInput.pOther.pDate}});
		});

		it('should copy Date in array', () => {
			class DataArrayType {
				@Items(Date)
				@Prop() pArrayDate: Date[];
			}

			expect(ModelerParser.parse(DataArrayType, rawInput)).to.eql({pArrayDate: input.pArrayDate});
		});

		it('should copy array', () => {
			class ShallowArrayType {
				@Prop() pArray: number[];
			}

			expect(ModelerParser.parse(ShallowArrayType, rawInput)).to.eql({pArray: rawInput.pArray});
		});

		it('should copy raw array', () => {
			class ShallowArrayDateType {
				@Prop() pArrayDate: Date[];
			}

			expect(ModelerParser.parse(ShallowArrayDateType, rawInput)).to.eql({pArrayDate: rawInput.pArrayDate});
		});

		it('should parse field', () => {
			class ParseType {
				@Parse(v => v * 2)
				@Prop() pParse: number;
			}

			expect(ModelerParser.parse(ParseType, rawInput)).to.eql({pParse: input.pParse * 2});
		});

		it('should parse array', () => {
			class ParseArrayType {
				@ItemsParse(v => v * 2)
				@Prop() pArray: number[];
			}

			expect(ModelerParser.parse(ParseArrayType, rawInput)).to.eql({pArray: input.pArrayParse});
		});

		it('should use default', () => {
			class DefaultType {
				@Default(20)
				@Prop() pDefault: number;
			}

			expect(ModelerParser.parse(DefaultType, rawInput)).to.eql({pDefault: 20});
		});

		it('should pass nested array', () => {
			class NestedArrayType {
				@Prop(Object) pNestedArray: number[][];
			}

			expect(ModelerParser.parse(NestedArrayType, rawInput)).to.eql({pNestedArray: input.pNestedArray});
		});

		it('should ModelerParser.parse nested array', () => {
			class NestedArrayLevel extends ArrayItems {
				@ItemsParse(v => v * 2) items: number[];
			}

			class NestedArrayType {
				@Items(NestedArrayLevel) pNestedArray: number[][];
			}

			expect(ModelerParser.parse(NestedArrayType, rawInput)).to.eql({pNestedArray: input.pNestedArrayParse});
		});

		it('should cast nested array with Date', () => {
			class NestedArrayLevel extends ArrayItems {
				@Items(Date) items: Date[];
			}

			class NestedArrayType {
				@Items(NestedArrayLevel) pNestedArrayDate: Date[][];
			}

			expect(ModelerParser.parse(NestedArrayType, rawInput)).to.eql({pNestedArrayDate: input.pNestedArrayDate});
		});

		it('should cast custom caster class', () => {
			class CasterClass {
				@Prop() pCaster: Caster
			}

			expect(ModelerParser.parse(CasterClass, rawInput)).to.eql({pCaster: input.pCaster});
			expect(input.pCaster.realValue.length).to.greaterThan(input.pCaster.toJSON().length);
		});


		it('should ignore optional field', () => {
			class InvisibleType {
				@Optional() pOptional: number;
			}

			expect(ModelerParser.parse(InvisibleType, rawInput)).to.eql({});
		});

		it('should parse optional but defined field', () => {
			class OptionalDateType {
				@Prop() @Optional() pDate: Date;
			}

			expect(ModelerParser.parse(OptionalDateType, rawInput)).to.eql({pDate: input.pDate});
		});

		it('should pass null field', () => {
			class NullDateType {
				@Nullable() pNullDate: Date;
			}

			expect(ModelerParser.parse(NullDateType, rawInput)).to.eql({pNullDate: null});
		});

		it('should parse nullable field', () => {
			class NullDateType {
				@Prop() @Nullable() pDate: Date;
			}

			expect(ModelerParser.parse(NullDateType, rawInput)).to.eql({pDate: input.pDate});
		});

		it('should chain optional, default, nullable in proper way', () => {
			class ChainType {
				@Nullable() @Optional() @Default(true) data0: boolean;
				@Nullable() @Optional() @Default(true) data1: boolean;
				@Nullable() @Optional() @Default(true) data2: boolean;
			}

			expect(ModelerParser.parse(ChainType, {
				data0: null,
				data1: undefined
			})).to.eql({
				data0: null,
				data1: true
			});
		});

		it('should pass data for unknown model', () => {
			expect(ModelerParser.optionalParse(String, rawInput)).to.eql(rawInput);
		});
	});
});
