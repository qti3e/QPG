import * as minimist from "minimist";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { generate } from "../src/main";

const args = minimist(process.argv.slice(2));
const filename = args._[0];
const target = args.target || "js";
const write = args.write;

if (target !== "js" && target !== "ts") {
  console.error(`Invalid target "${target}".`);
  process.exit(-1);
}

const source = readFileSync(join(process.cwd(), filename), "utf-8");
const output = generate(source, target);

if (!write) {
  console.log(output);
  process.exit(0);
}

writeFileSync(join(process.cwd(), write), output);
