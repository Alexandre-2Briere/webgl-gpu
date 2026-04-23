import { describe, it, expect } from 'vitest';
import { getParamNames } from './functionParser';

describe('getParamNames', () => {
  describe('named function', () => {
    it('returns param names', () => {
      function foo(alpha: unknown, beta: unknown, gamma: unknown) { return [alpha, beta, gamma]; }
      expect(getParamNames(foo)).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('returns single param', () => {
      function foo(value: unknown) { return value; }
      expect(getParamNames(foo)).toEqual(['value']);
    });

    it('returns empty array for no params', () => {
      function foo() { return 0; }
      expect(getParamNames(foo)).toEqual([]);
    });
  });

  describe('anonymous function', () => {
    it('returns param names', () => {
      expect(getParamNames(function(x: unknown, y: unknown) { return [x, y]; })).toEqual(['x', 'y']);
    });

    it('returns empty array for no params', () => {
      expect(getParamNames(function() { return 0; })).toEqual([]);
    });
  });

  describe('arrow function with parentheses', () => {
    it('returns param names', () => {
      expect(getParamNames((alpha: unknown, beta: unknown) => [alpha, beta])).toEqual(['alpha', 'beta']);
    });

    it('returns empty array for no params', () => {
      expect(getParamNames(() => 0)).toEqual([]);
    });
  });

  describe('single-param arrow function without parentheses', () => {
    it('returns the param name', () => {
      expect(getParamNames((value: unknown) => (value as number) * 2)).toEqual(['value']);
    });
  });

  describe('async functions', () => {
    it('handles async named function', () => {
      expect(getParamNames(async function foo(alpha: unknown, beta: unknown) { return [alpha, beta]; })).toEqual(['alpha', 'beta']);
    });

    it('handles async arrow with parens', () => {
      expect(getParamNames(async (alpha: unknown, beta: unknown) => [alpha, beta])).toEqual(['alpha', 'beta']);
    });
  });

  describe('default values', () => {
    it('strips default value and returns param name', () => {
      expect(getParamNames(function(alpha = 1, beta = 'hello') { return [alpha, beta]; })).toEqual(['alpha', 'beta']);
    });

    it('strips default value in arrow function', () => {
      expect(getParamNames((alpha = 0, _beta = false) => alpha)).toEqual(['alpha', '_beta']);
    });
  });

  describe('rest params', () => {
    it('strips ... and returns the rest param name', () => {
      expect(getParamNames(function(alpha: unknown, ...rest: unknown[]) { return [alpha, ...rest]; })).toEqual(['alpha', 'rest']);
    });

    it('handles only a rest param', () => {
      expect(getParamNames(function(...rest: unknown[]) { return rest; })).toEqual(['rest']);
    });
  });

  describe('comments in param list', () => {
    it('strips block comments before matching', () => {
      expect(getParamNames(function(/* ignored */ alpha: unknown, beta: unknown) { return [alpha, beta]; })).toEqual(['alpha', 'beta']);
    });

    it('strips line comments before matching', () => {
      // Function with inline comment — constructed via string to control toString output
      const funcString = 'function(alpha, beta // inline comment\n) { return alpha; }';
      const func = new Function(`return (${funcString})`)() as Function;
      expect(getParamNames(func)).toEqual(['alpha', 'beta']);
    });
  });

  describe('multiline params', () => {
    it('handles params spread over multiple lines', () => {
      const func = new Function(`return (function(\n  alpha,\n  beta\n) { return alpha; })`)() as Function;
      expect(getParamNames(func)).toEqual(['alpha', 'beta']);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for a function with no recognisable signature', () => {
      const emptyFunc = (() => {
        const fake = { toString: () => 'not a function at all' };
        return fake as unknown as Function;
      })();
      expect(getParamNames(emptyFunc)).toEqual([]);
    });

    it('returns empty array for destructured param (not parseable as identifier)', () => {
      expect(getParamNames(function({ alpha }: { alpha: unknown }) { return alpha; })).toEqual([]);
    });

    it('handles extra whitespace around params', () => {
      const func = new Function(`return (function(  alpha  ,  beta  ) { return alpha; })`)() as Function;
      expect(getParamNames(func)).toEqual(['alpha', 'beta']);
    });
  });
});
