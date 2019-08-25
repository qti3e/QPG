import * as fs from "fs";
import * as path from "path";
import { Source } from "./source";
import { Parser } from "./parser";

const docPath = path.join(__dirname, "../ema.qpg");
const content = fs.readFileSync(docPath, "utf-8");
const source = new Source(content);
const parser = new Parser();
const ret = parser.parse(source);
console.log(ret);
debugger;