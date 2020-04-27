import 'mocha';
import 'reflect-metadata';
import { expect } from 'chai';
import { Default, Items, Prop, ArrayItems, Nullable } from '@wssz/modeler';
import { ModelerParser, Optional } from '../index';
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
	describe('parser', () => {
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
