import { afterEach, expect } from '@rstest/core';
import * as jestDomMatchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { preloadRiichiRules } from '../src/lib/riichiRules';

await preloadRiichiRules();

expect.extend(jestDomMatchers);

afterEach(() => {
  cleanup();
});
