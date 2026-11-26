import { plain } from "./errors";

describe("errors", () => {
  it("drops terminal colors and the exit-code line", () => {
    const raw =
      "\u001b[41mE100\u001b[0m [StylesPath] Runtime error\n\nThe StylesPath 'styles' doesn't exist.\n\n" +
      "\u001b[2m\u001b[3mExecution stopped with code 2.\u001b[0m\u001b[2m\u001b[0m";
    expect(plain(raw)).toBe("E100 [StylesPath] Runtime error\n\nThe StylesPath 'styles' doesn't exist.");
  });
  it("leaves a plain message alone", () => {
    expect(plain("vale.wasm did not start")).toBe("vale.wasm did not start");
  });
});
