import assert from "node:assert/strict";
import { pageChanged } from "./marketplace_watch.ts";

assert.equal(pageChanged("SKU-42\nprice: 18", "SKU-42\nprice: 19"), true);
assert.equal(pageChanged("SKU-42\nprice: 18", " SKU-42\nprice: 18 "), false);
console.log("marketplace change decision: passed");
