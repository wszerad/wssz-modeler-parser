import 'mocha';
import 'reflect-metadata';
import { expect } from 'chai';
import { Default, Prop, Required } from '@wssz/modeler';
import { ItemsParse, Parse } from '../src/decorators';
import { parse } from '../src/parser';
import { ArrayItems } from '@wssz/modeler/src/ArrayItems';

class OtherClass {
	@Prop()
	pDate: Date;
}

describe('tests', () => {
	describe('parser', () => {
		const date = new Date();
		const input = {
			pDate: new Date(date),
			pString: 'kot',
			pOther: {
				pDate: new Date(date)
			},
			pInvisible: 5,
			pParse: 10,
			pArray: [4],
			pArrayDate: [new Date(date)],
			pArrayParse: [1, 4],
			pNestedArray: [[1, 2]],
			pNestedArrayParse: [[2, 4]]
		};
		const rawInput = JSON.parse(JSON.stringify(input));

		it('should ignore undecorated field', () => {
			class InvisibleType {
				pInvisible: number;
			}
			expect(parse(InvisibleType, input)).to.eql({});
		});

		it('should copy simple type', () => {
			class SimpleType {
				@Prop() pString: string;
			}
			expect(parse(SimpleType, input)).to.eql({pString: input.pString});
		});

		it('should cast Date', () => {
			class DateType {
				@Prop() pDate: Date;
			}
			expect(parse(DateType, input)).to.eql({pDate: input.pDate});
		});

		it('should cast nested object', () => {
			class NestedObjectType {
				@Prop(OtherClass) pOther: OtherClass;
			}
			expect(parse(NestedObjectType, input)).to.eql({pOther: input.pOther.pDate});
		});

		it('should copy object', () => {
			class ShallowObjectType {
				@Prop() pOther: OtherClass;
			}
			expect(parse(ShallowObjectType, input)).to.equal({pOther: rawInput.pOther.pDate});
		});

		it('should copy Date in array', () => {
			class DataArrayType {
				@Prop(Date) pArrayDate: Date[];
			}
			expect(parse(DataArrayType, input)).to.eql({pArrayDate: input.pArrayDate});
		});

		it('should copy array', () => {
			class ShallowArrayType {
				@Prop() pArray: number[];
			}
			expect(parse(ShallowArrayType, input)).to.eql({pArray: rawInput.pArray});
		});

		it('should copy raw array', () => {
			class ShallowArrayDateType {
				@Prop() pArrayDate: Date[];
			}
			expect(parse(ShallowArrayDateType, input)).to.eql({pArrayDate: rawInput.pArrayDate});
		});

		it('should parse field', () => {
			class ParseType {
				@Parse(v => v * 2)
				@Prop() pParse: number;
			}
			expect(parse(ParseType, input)).to.eql({pParse: input.pParse * 2});
		});

		it('should parse array', () => {
			class ParseArrayType {
				@ItemsParse(v => v * 2)
				@Prop() pArrayParse: number[];
			}
			expect(parse(ParseArrayType, input)).to.eql({pArrayParse: input.pArrayParse.map(v => v * 2)});
		});

		it('should use default', () => {
			class DefaultType {
				@Default(20)
				@Prop() pDefault: number;
			}
			expect(parse(DefaultType, input)).to.eql({pDefault: 20});
		});

		it('should cast nested array', () => {
			class NestedArrayLevel extends ArrayItems {

				items: Date[];
			}
			class NestedArrayType {
				@Prop(NestedArrayLevel) pNestedArray: Date[][];
			}
			expect(parse(NestedArrayType, input)).to.eql({pDefault: 20});
		});

		it('should catch undefined field', () => {
			class RequiredObject {
				@Prop(OtherClass)
				@Required()
				pUnsetOther: OtherClass;
			}
			expect(parse(RequiredObject, input, {development: true})).to.eql(Error);
		});


	});
});